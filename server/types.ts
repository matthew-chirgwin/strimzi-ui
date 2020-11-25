/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
import express from 'express';
import { SecureVersion } from 'tls';
import { Level, Logger, LoggerOptions } from 'pino';
import http, { IncomingMessage } from 'http';
import https from 'https';
import { exposedClientType, exposedFeatureFlagsType } from 'ui-config/types';
import WebSocket from 'ws';
import { Socket } from 'net';

export type supportedAuthenticationStrategyTypes = 'none' | 'scram' | 'oauth';

export type authenticationConfigType = {
  /** What authentication strategy to use to authenticate users */
  strategy: supportedAuthenticationStrategyTypes;
  /** Any additional configuration required for the provided authentication strategy */
  configuration?: Record<string, unknown>;
};

type sslCertificateType = {
  /** certificate in PEM format */
  cert?: string;
  /** private key for the provided certificate */
  key?: string;
  /** TLS ciphers used/supported by the HTTPS server for client negotiation */
  ciphers?: string;
  /** Minimum TLS version supported by the server */
  minTLS?: SecureVersion;
};

type clientConfigType = {
  /** Overrides to send to the client */
  configOverrides: exposedClientType;
  /** SSL transport configuration */
  transport: sslCertificateType;
  /** location of public files to server to the client */
  publicDir: string;
};

type moduleConfigType = {
  /** is the api module enabled (or not) */
  api: boolean;
  /** is the client module enabled (or not) */
  client: boolean;
  /** is the config module enabled (or not) */
  config: boolean;
  /** is the log module enabled (or not) */
  log: boolean;
  /** is the mockapi module enabled (or not). Expected to be used in dev/test settings only */
  mockapi: boolean;
};

type proxyConfigType = {
  /** The Hostname of the backend server to send API requests to */
  hostname: string;
  /** The port number of the backend server to send API requests to */
  port: number;
  /** The context root for the Strimzi-admin api  */
  contextRoot: string;
  /** SSL transport configuration */
  transport: sslCertificateType;
};

type sessionConfigType = {
  /** Name used to create the session cookie */
  name: string;
};

export type serverConfigType = {
  /** authentication configuration */
  authentication: authenticationConfigType;
  /** client (browser) facing configuration */
  client: clientConfigType;
  /** feature flag configuration overrides (for both client and server) */
  featureFlags: exposedFeatureFlagsType;
  /** logging configuration */
  logging: LoggerOptions;
  /** module configuration */
  modules: moduleConfigType;
  /** proxy (Strimzi-admin) configuration options */
  proxy: proxyConfigType;
  /** The Hostname to use/to accept traffic on */
  hostname: string;
  /** The port number to use/accept traffic on */
  port: number;
  /** Configuration for a creation/management of a session */
  session: sessionConfigType;
};

/** Re-export the pino Logger type */
export type loggerType = Logger;

/** Extend the pino Logger type with entry/exit tracing */
export type entryExitLoggerType = Logger & {
  /** function which logs entry into a function. Returns an object containing an exit loggers with the given name baked in */
  entry: (
    functionName: string,
    ...params: Array<unknown>
  ) => {
    /** called on exit of a function. Returns the parameter provided (enabling `return exit('foobar');`) */
    exit: <T>(returns: T) => T;
  };
};

export type strimziUIContextType = {
  /** configuration passed to the server */
  config: serverConfigType;
  /** the unique id for this request */
  requestID: string;
  /** a pre-configured logger object to use for the life of this request */
  logger: entryExitLoggerType;
};

export type serverType = http.Server | https.Server;

/** the handler which when invoked will bind upgrade events to the provided server, using the provided websocket server */
export interface bindToServer {
  (server: http.Server | https.Server, wsServer: WebSocket.Server): void;
}
/** IMPORTANT - `customWebsocketUpgrade` should only be used in cases where a module needs to own the whole websocket upgrade. This should not be needed in 99% of use cases. */
export interface customWebsocketUpgrade {
  (server: http.Server | https.Server, socketAuthFn: socketAuthFn): void;
}

/** A function which when invoked will check the authentication status of the provided websocket. If invalid, the socket will be closed with a `511` RC. If the owner of the socket is authenticated, `next` will be invoked */
export interface socketAuthFn {
  (msg: IncomingMessage, socket: Socket, next: () => void): void;
}
/** the handler invoked when a new websocket request is made to this module. It is provided the websocket to bind to, as well as an `socketAuthFn` authentication function to use as required */
export interface websocketHandler {
  (context: strimziUIContextType, ws: WebSocket, authFn: socketAuthFn): void;
}
/** a function invoked before any websocket upgrade event occurs. Use this to configure/set up your `wsHandler` per websocket connection, before any calls to `wsHandler` occur. Provided as a parameter is the request received to upgrade to a websocket */
export interface preUpgradeHandler {
  (context: strimziUIContextType, msg: IncomingMessage): Promise<void>;
}

export type httpHandlers = express.Router;

/** A server module represents a standalone set of handlers for either web (HTTP(S)) or websocket (WS(S)) requests. Handlers are registered at a mounting point, and any requests received to this point will be passed to the provided handlers, depending on protocol */
export type serverModule = {
  /** the root/mounting point for requests made to this module */
  mountPoint: string;
  /** an express router to handle HTTP requests on behalf of this module */
  httpHandlers?: httpHandlers;
  /** IMPORTANT - `customUpgradeFn` should only be used in cases where a module needs to own the whole websocket upgrade. This should not be needed in 99% of use cases. If used, any provided `preUpgradeHandler` or `wsHandler` will NOT be called */
  customUpgradeHandler?: customWebsocketUpgrade;
  /** a callback invoked before any websocket upgrade event occurs. Use this to configure/set up your `wsHandler` per websocket connection, before any calls to `wsHandler` occur */
  preUpgradeHandler?: preUpgradeHandler;
  /** the handler invoked when a new websocket request is made to this module. It is provided the websocket to bind to, as well as an `socketAuthFn` authentication function to use as required */
  wsHandler?: websocketHandler;
};

interface addModule {
  /** function called to add a module to the UI server */
  (
    mountLogger: entryExitLoggerType,
    authFunction: expressMiddleware,
    configAtServerStart: serverConfigType
  ): serverModule;
}

export type UIServerModule = {
  /** the name of this module. Compared against moduleConfigType keys at runtime to enable/disable modules */
  moduleName: string;
  /** function called to mount the module/allow it to handle requests  */
  addModule: addModule;
};

export interface expressMiddleware {
  /** typing of a general piece of express middleware */
  (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void;
}
/** the request object provided on UI server request. Core express request plus additions */
export type strimziUIRequestType = express.Request & {
  headers: {
    /** unique identifier for a request. If not present, will be added by the core module, and returned in the response */
    'x-strimzi-ui-request': string;
  };
};
/** the response object provided on UI server request. Core express request plus additions */
export type strimziUIResponseType = express.Response & {
  locals: {
    /** the context object for this request/response */
    strimziuicontext: strimziUIContextType;
  };
};

export interface ClientLoggingEvent {
  clientTime: number;
  clientID: string;
  clientLevel: Level;
  componentName: string;
  msg: string;
}
