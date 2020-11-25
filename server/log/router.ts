/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
import express from 'express';
import { UIServerModule } from 'types';
import { wsHandler } from './controller';

const moduleName = 'log';

export const LogModule: UIServerModule = {
  moduleName,
  addModule: (logger, authFn) => {
    const { exit } = logger.entry('addModule');
    const routerForModule = express.Router();

    routerForModule.get('*', authFn, (req, res) => {
      // Return 426 Upgrade Required if this isn't a websocket request (ie via http)
      res.sendStatus(426);
    });

    return exit({
      mountPoint: '/log',
      httpHandlers: routerForModule,
      wsHandler, // websocket handler
    });
  },
};
