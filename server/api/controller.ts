/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
import { createProxyServer } from 'http-proxy';
import WebSocket from 'ws';
import {
  preUpgradeHandler,
  strimziUIRequestType,
  strimziUIResponseType,
  websocketHandler,
  expressMiddleware,
  socketAuthFn,
} from 'types';
import { SecureVersion } from 'tls';
import { generateLogger } from 'logging';
import { IncomingMessage } from 'http';

const logger = generateLogger('Api.Controller');

const proxyErrorHandler: (
  err: Error,
  req: strimziUIRequestType,
  res: strimziUIResponseType
) => void = (err, req, res) => {
  res.locals.strimziuicontext.logger.debug(
    { err },
    `Error occurred whilst proxying request '${req.url}'. ${err.message}`
  );
  res.sendStatus(500);
};

const proxyStartHandler: (
  proxyReq: unknown,
  req: strimziUIRequestType,
  res: strimziUIResponseType
) => void = (_, req, res) => {
  res.locals.strimziuicontext.logger.debug(
    `Proxying request '${req.url}' to the backend api endpoint`
  );
};

const proxyCompleteHandler: (
  proxyRes: {
    statusCode: number;
    statusMessage: string;
  },
  req: strimziUIRequestType,
  res: strimziUIResponseType
) => void = ({ statusCode, statusMessage }, req, res) => {
  res.locals.strimziuicontext.logger.debug(
    `Response from backend api for request '${req.url}' : ${statusCode} - ${statusMessage}`
  );
};

type transportConfigType = {
  ca: string | undefined;
  minVersion: SecureVersion | undefined;
};

export type proxyConfigType = {
  targetWs: string;
  targetWeb: string;
} & transportConfigType;

type httpConfigType = {
  target: string;
  changeOrigin: boolean;
  secure: boolean;
} & transportConfigType;

const generateConfigForClient: (
  targetKey: string,
  config: proxyConfigType
) => httpConfigType = (targetKey, { ca, minVersion, ...others }) => ({
  target: others[targetKey],
  ca,
  minVersion,
  changeOrigin: true,
  secure: ca ? true : false,
});

export const generateWebProxy: (
  config: proxyConfigType
) => expressMiddleware = (config) => {
  const backendProxy = createProxyServer(
    generateConfigForClient('targetWeb', config)
  );

  // add proxy event handlers for HTTP traffic
  backendProxy.on('error', proxyErrorHandler);
  backendProxy.on('proxyReq', proxyStartHandler);
  backendProxy.on('proxyRes', proxyCompleteHandler);

  return (req, res) => backendProxy.web(req, res);
};

export const generateWSProxy: (
  config: proxyConfigType
) => { preUpgradeHandler: preUpgradeHandler; wsHandler: websocketHandler } = (
  config
) => {
  const socketMap = new Map<
    string,
    { backendSocket: WebSocket; upgradeMsg: IncomingMessage }
  >();

  const pairClientBackendWebSockets: (
    requestID: string,
    clientWs: WebSocket,
    authFn: socketAuthFn
  ) => void = (requestID, clientWs, authFn) => {
    const { entry } = logger;
    const functionName = `pairClientBackendWebSockets - ${requestID}`;
    const { exit } = entry(functionName);

    const socketForRequest = socketMap.get(requestID);
    /* istanbul ignore else  */
    if (socketForRequest) {
      const { backendSocket, upgradeMsg } = socketForRequest;
      logger.debug(`${functionName} - Binding client and backend sockets`);

      // on message, run the auth check function
      backendSocket.on('message', (data) =>
        authFn(upgradeMsg, upgradeMsg.socket, () => clientWs.send(data))
      );
      clientWs.on('message', (data) =>
        authFn(upgradeMsg, upgradeMsg.socket, () => backendSocket.send(data))
      );

      backendSocket.on('error', (err) => {
        logger.error(
          `${functionName} - Error received from backend. Closing client socket.`,
          err
        );
        // close the client, as errors occur when there is an issue with the socket, and it is closed as a result
        clientWs.close(500, err.message);
      });
      clientWs.on('error', (err) => {
        // this should never happen. In case it does, swallow the error.
        logger.error(`${functionName} - Error received from client`, err);
      });

      clientWs.on('close', (code, reason) => {
        logger.debug(`${functionName} - client socket closed`, code, reason);
        backendSocket.close();
        socketMap.delete(requestID);
      });
      backendSocket.on('close', (code, reason) => {
        logger.debug(`${functionName} - backend socket closed`, code, reason);
        clientWs.close(code);
        socketMap.delete(requestID);
      });
    } else {
      // error, no socket to backend for request - do not think this branch can be reached in normal operation, so here for safety
      logger.error(
        `${functionName} - No Websocket to backend found for request ${requestID} . Closing socket to client`
      );
      clientWs.close(500);
    }

    exit(true);
  };

  return {
    preUpgradeHandler: (context, msg) =>
      new Promise((resolve) => {
        const { requestID, logger } = context;
        const { entry } = logger;
        const { exit } = entry('Api.preUpgradeHandler');
        const wsProtocol = msg.headers['sec-websocket-protocol'];
        const wsToBackend = new WebSocket(
          config.targetWs,
          wsProtocol,
          generateConfigForClient('targetWs', config)
        );
        logger.debug(
          `Created websocket for ws request ${requestID} - protocol '${wsProtocol}'. Waiting for socket to become ready`
        );
        socketMap.set(requestID, {
          backendSocket: wsToBackend,
          upgradeMsg: msg,
        });
        wsToBackend.on('open', () => {
          logger.debug(`Websocket for request ${requestID} ready`);
          resolve();
        });
        exit(wsToBackend);
      }),

    wsHandler: (context, ws, authFn) => {
      const { requestID, logger } = context;
      const { entry } = logger;
      const { exit } = entry('Api.wsHandler', requestID);
      pairClientBackendWebSockets(requestID, ws, authFn);
      exit(true);
    },
  };
};
