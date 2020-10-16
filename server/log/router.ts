/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
import express from 'express';
import {
  strimziUIRequestType,
  strimziUiResponseType,
  UIServerModule,
} from 'types';

const moduleName = 'log';

export const LogModule: UIServerModule = {
  moduleName,
  addModule: (logGenerator, authFn) => {
    const { entry } = logGenerator(moduleName);
    const { exit } = entry('addModule');
    const routerForModule = express.Router();

    // implementation to follow
    routerForModule.get('*', authFn, (req, res) => {
      const { isWs } = req as strimziUIRequestType;
      const { ws } = res as strimziUiResponseType;
      if (isWs) {
        ws.on('message', (message) => console.dir(message));
        ws.on('close', (_, reason) => console.log(`Module: closed ${reason}`));
        ws.send('response!');
      }
    });

    return exit({ mountPoint: '/log', routerForModule });
  },
};
