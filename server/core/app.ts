/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
import url from 'url';
import express from 'express';
import helmet from 'helmet';
import { getModules } from './modules';
import {
  customWebsocketUpgrade,
  websocketHandler,
  serverConfigType,
  UIServerModule,
  serverModule,
  bindToServer,
  preUpgradeHandler,
  strimziUIContextType,
} from 'types';
import { authFunction } from 'placeholderFunctionsToReplace';
import expressSession, { SessionOptions } from 'express-session';
import {
  generateLogger,
  generateHttpLogger,
  STRIMZI_UI_REQUEST_ID_HEADER,
  generateRequestID,
} from 'logging';
import { IncomingMessage } from 'http';
import { Socket } from 'net';

/** internal shape used to process any registered websocket handlers from mounted modules */
type websocketRequestHandlers = {
  /** IMPORTANT - `customUpgradeFn` should only be used in cases where a module needs to own the whole websocket upgrade */
  customUpgradeFn: customWebsocketUpgrade | undefined;
  /** A mapping of WS handlers by context root */
  messageHandlers: Record<
    string,
    {
      moduleName: string;
      /** The handler for `Websocket` events */
      wsHandler: websocketHandler;
      /** Optional pre upgrade handler, which can be used to run setup actions before the websocket is upgraded */
      preUpgradeHandler: preUpgradeHandler;
    }
  >;
};

/** generates the 'context' object attached to all requests handled by the server */
const generateContext: (
  configFn: () => serverConfigType,
  moduleName: string,
  requestID: string
) => strimziUIContextType = (configFn, moduleName, requestID) => ({
  requestID: requestID,
  config: configFn(),
  logger: generateLogger(moduleName, requestID),
});

/** checks for the given config if the provided module name is true/false/exists */
const checkIfModuleEnabled: (
  moduleName: string,
  config: serverConfigType
) => boolean = (moduleName, { modules }) => modules[moduleName];

export const returnRequestHandlers: (
  getConfig: () => serverConfigType
) => { app: express.Application; serverEventCb: bindToServer } = (
  getConfig
) => {
  const logger = generateLogger('core');
  const app = express();

  const config = getConfig();
  const { session, authentication } = config;

  //Add session support
  const sessionOpts: SessionOptions = {
    secret: 'CHANGEME', //TODO replace with value from config https://github.com/strimzi/strimzi-ui/issues/111
    name: session.name,
    cookie: {
      maxAge: 1000 * 3600 * 24 * 30, //30 days as a starting point //TODO replace with value from config https://github.com/strimzi/strimzi-ui/issues/111
    },
  };

  const sessionMiddleware = expressSession(sessionOpts);

  // for each module, call the function to add it to the set of mounted modules

  const { expressAuthFn, socketAuthFn } = authFunction(authentication);

  const mountedModules = getModules(config).reduce(
    (
      acc: Record<string, serverModule>,
      { moduleName, addModule }: UIServerModule
    ) => {
      logger.info(`Mounting module '${moduleName}'`);
      const { mountPoint, ...others } = addModule(
        generateLogger(moduleName),
        expressAuthFn,
        config
      );
      logger.info(
        `Mounted module '${moduleName}', responding to requests on '${mountPoint}'`
      );
      return {
        ...acc,
        [moduleName]: {
          mountPoint,
          ...others,
        },
      };
    },
    {} as Record<string, serverModule>
  );

  /////////////////////////////////////
  // Express (HTTP) handlers
  /////////////////////////////////////

  // add helmet middleware
  app.use(helmet());

  // add pino-http middleware
  app.use(generateHttpLogger());

  // bind the session middleware
  app.use(sessionMiddleware);

  // before all handlers, add context and request start/end handlers
  app.all('*', (req, res, next) => {
    // log start of request (end of request is automatically logged)
    req.log.debug('Request received');
    // make sure the response has the requestID header (set via the pino-http middleware)
    res.setHeader(STRIMZI_UI_REQUEST_ID_HEADER, req.id as string);
    // create a 'context' for this request, containing config and the request ID. Available to handlers via `res.locals.strimziuicontext`
    res.locals.strimziuicontext = generateContext(
      getConfig,
      'core',
      req.id as string
    );
    next();
  });

  Object.entries(mountedModules)
    .map(([moduleName, { mountPoint, httpHandlers }]) => ({
      moduleName,
      mountPoint,
      httpHandlers,
    }))
    .sort(({ mountPoint: mountPointA }, { mountPoint: mountPointB }) => {
      // Sort mountpoints in reverse order, so that the shortest mountpoints are added last
      // and do not route traffic meant for other endpoints
      return mountPointA < mountPointB ? 1 : mountPointA > mountPointB ? -1 : 0;
    })
    .forEach(({ moduleName, mountPoint, httpHandlers }) =>
      app.use(`${mountPoint}`, (req, res, next) => {
        // add logger for this module
        res.locals.strimziuicontext = {
          ...res.locals.strimziuicontext,
          logger: generateLogger(moduleName, req.id as string),
        };

        // check if this module is still enabled/should serve requests
        const isEnabled = checkIfModuleEnabled(
          moduleName,
          res.locals.strimziuicontext.config
        );
        res.locals.strimziuicontext.logger.debug(
          `%s module is ${isEnabled ? '' : 'not '}enabled`,
          moduleName
        );
        isEnabled && httpHandlers ? httpHandlers(req, res, next) : next(); // if enabled, call the router for the module so it can handle the request. Else, call the next module
      })
    );

  /////////////////////////////////////
  // Server upgrade (WS) handler
  /////////////////////////////////////

  // map returned websocket handlers to the required `websocketRequestHandlers` shape
  const websocketHandlers: websocketRequestHandlers = Object.entries(
    mountedModules
  )
    .map(([moduleName, serverModule]) => ({ ...serverModule, moduleName }))
    .map(
      ({
        mountPoint,
        wsHandler,
        preUpgradeHandler,
        customUpgradeHandler,
        moduleName,
      }) => ({
        mount: mountPoint,
        moduleName,
        wsHandler,
        preUpgradeHandler,
        customUpgradeHandler,
      })
    )
    .reduce(
      (
        { customUpgradeFn, messageHandlers },
        {
          mount,
          moduleName,
          customUpgradeHandler,
          wsHandler,
          preUpgradeHandler,
        }
      ) => ({
        customUpgradeFn: customUpgradeHandler
          ? customUpgradeHandler
          : customUpgradeFn,
        messageHandlers:
          mount && wsHandler
            ? {
              ...messageHandlers,
              [mount]: {
                moduleName,
                wsHandler,
                preUpgradeHandler: preUpgradeHandler
                  ? preUpgradeHandler
                  : () => Promise.resolve(),
              },
            }
            : messageHandlers,
      }),
      {
        customUpgradeFn: undefined,
        messageHandlers: {},
      } as websocketRequestHandlers
    );

  const generateServerOnBindingFn: (
    mockWSEventTypes: websocketRequestHandlers
  ) => bindToServer = (mockWSEventTypes) => (server, wsServer) => {
    const { messageHandlers, customUpgradeFn } = mockWSEventTypes;

    // edge, support apollo wanting to upgrade all ws requests
    customUpgradeFn
      ? customUpgradeFn(server, socketAuthFn)
      : // else handle all upgrades and add auth on connect
      server.on(
        'upgrade',
        async (msg: IncomingMessage, socket: Socket, head: Buffer) => {
          logger.debug(`Received WS upgrade request`);

          // call auth on socket upgrade - middleware will deal with rejection/close socket/add headers etc
          socketAuthFn(msg, socket, async () => {
            logger.debug(
              `WS upgrade request authenticated - delegating to registered module to handle`
            );
            const wsUrl = msg.url;
            const parsedUrl = wsUrl ? url.parse(wsUrl).pathname : null;
            /* istanbul ignore else  */
            if (parsedUrl !== null) {
              const {
                preUpgradeHandler,
                wsHandler,
                moduleName,
              } = messageHandlers[parsedUrl];

              const context = generateContext(
                getConfig,
                moduleName,
                generateRequestID(msg)
              );

              const isEnabled = checkIfModuleEnabled(
                moduleName,
                context.config
              );

              if (isEnabled) {
                logger.debug(
                  `'${moduleName}' module to handle request ${context.requestID}. Handling upgrade.`
                );
                await preUpgradeHandler(context, msg); // wait for any preUpgradeHandler to complete
                // perform the upgrade, delegating the socket to the handler
                wsServer.handleUpgrade(msg, socket, head, (ws) =>
                  wsHandler(context, ws, socketAuthFn)
                );
              } else {
                logger.debug(
                  `'${moduleName}' module is not enabled, and will not handle this request. Closing socket.`
                );
              }
            } else {
              logger.error(
                `No URL available from WS request. A URL must be present for the server to know how to handle the request.`
              );
            }
          });
        }
      );
  };

  return {
    app,
    serverEventCb: generateServerOnBindingFn(websocketHandlers),
  };
};
