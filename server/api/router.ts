/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
import express from 'express';
import { UIServerModule } from 'types';

import {
  proxyConfigType,
  generateWSProxy,
  generateWebProxy,
} from './controller';

const moduleName = 'api';

export const ApiModule: UIServerModule = {
  moduleName,
  addModule: (logger, authFn, serverConfig) => {
    const { proxy } = serverConfig;
    const { exit } = logger.entry('addModule', proxy);
    const { hostname, port, contextRoot, transport } = proxy;
    const { cert, minTLS } = transport;

    // pluck all required config we need to proxy http and ws traffic
    const config: proxyConfigType = {
      targetWeb: `${
        cert ? 'https' : 'http'
      }://${hostname}:${port}${contextRoot}`,
      targetWs: `${cert ? 'wss' : 'ws'}://${hostname}:${port}${contextRoot}`,
      ca: cert,
      minVersion: minTLS,
    };

    logger.debug({ config }, `api proxy configuration`);
    const routerForModule = express.Router();

    // proxy all http requests post auth check
    routerForModule.all('*', authFn, generateWebProxy(config));

    return exit({
      mountPoint: '/api',
      httpHandlers: routerForModule,
      ...generateWSProxy(config),
    });
  },
};
