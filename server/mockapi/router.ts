/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
import express from 'express';
import { UIServerModule } from 'types';
import { ApolloServer } from 'apollo-server-express';
import { schema } from './data';
import bodyParser from 'body-parser';

const moduleName = 'mockapi';

export const MockApiModule: UIServerModule = {
  moduleName,
  addModule: (logger) => {
    const { exit } = logger.entry('addModule');
    const routerForModule = express.Router();

    // endpoint used for test purposes
    routerForModule.get('/test', (_, res) => {
      // /api/test
      const { entry } = res.locals.strimziuicontext.logger;
      const { exit } = entry('`/test` handler');
      res.setHeader('x-strimzi-ui-module', moduleName);
      res.sendStatus(418);
      exit(418);
    });

    const server = new ApolloServer({
      typeDefs: schema,
      resolvers: {},
      debug: true,
      mockEntireSchema: true,
      playground: true,
      subscriptions: {
        path: '/api', //must match mount point - ie subscription handler registered at /api
        keepAlive: 5000,
      },
    });

    routerForModule.use(
      bodyParser.json(),
      server.getMiddleware({ path: '/' }) // /api/
    );
    return exit({
      mountPoint: '/api',
      httpHandlers: routerForModule,
      customUpgradeHandler: (serverInstance) =>
        server.installSubscriptionHandlers(serverInstance),
    });
  },
};
