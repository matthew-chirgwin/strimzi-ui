/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
import WebSocket from 'ws';
import http from 'http';

import { loadConfig, watchConfig, getServerName } from 'serverConfig';
import { returnExpress } from 'core';
import { log } from 'placeholder';
import { strimziUiResponseType } from 'types';

const errorHandler: (err: Error, ...others: unknown[]) => void = (
  err,
  ...others
) => {
  log(
    serverName,
    'runtime',
    'main',
    'Error',
    `Error thrown: ${err.message}`,
    err,
    others
  );
  // trace the error to syserr, but dont kill the process
  // eslint-disable-next-line no-console
  console.trace();
};

const serverName = getServerName();

log(
  serverName,
  'startup',
  'main',
  'server starting',
  `Strimzi ui server initialising`
);

loadConfig((loadedInitialConfig) => {
  let config = loadedInitialConfig;

  log(
    serverName,
    'startup',
    'main',
    'server starting',
    `Strimzi ui server starting with config`,
    JSON.stringify(config)
  );

  watchConfig((latestConfig) => {
    log(
      serverName,
      'runtime',
      'main',
      'configReload',
      `Strimzi ui server configuration changing to for future requests:`,
      JSON.stringify(latestConfig)
    );
    config = latestConfig;
  }); // load config and update config value
  const expressApp = returnExpress(serverName, () => config);
  const httpServer = http.createServer(expressApp);

  const instance = httpServer.listen(config.port, config.hostname, () =>
    log(
      serverName,
      'startup',
      'main',
      'server ready',
      `Strimzi ui server ready at http://${config.hostname}:${config.port}`
    )
  );

  const wss = new WebSocket.Server({ noServer: true });
  instance.on('upgrade', (req, socket, head) =>
    wss.handleUpgrade(req, socket, head, (ws) => {
      const res = new http.ServerResponse(req) as strimziUiResponseType;
      // add/mark the request as a websocket request
      req.isWs = true;
      res.ws = ws;
      // call the express app as usual
      expressApp(req, res);
    })
  );

  const shutdown = (server) => () =>
    server.close(() => {
      log(
        serverName,
        'teardown',
        'main',
        'server closing',
        `Strimzi ui server closed`
      );
      process.exit(0);
    });

  process.on('SIGTERM', shutdown(instance));
  process.on('SIGINT', shutdown(instance));
});

// catch errors gracefully
process.on('uncaughtException', errorHandler);
process.on('unhandledRejection', errorHandler);
