/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
import request from 'supertest';
import { returnRequestHandlers } from 'core';
import { Given, When, And, Then } from 'jest-cucumber-fusion';
import { serverConfigType } from 'types';
import { getConfigForName } from './testConfigs';
import express from 'express';
import merge from 'lodash.merge';
import {
  genericWorldType,
  worldGenerator,
} from '../../test_common/jest_cucumber_support/commonTestTypes';
import { requests } from './testGQLRequests';
import WebSocket from 'ws';
import { createServer, IncomingMessage } from 'http';
import { Socket } from 'net';
jest.mock('net');
jest.mock('ws');
jest.mock('subscriptions-transport-ws');

import { wsMockController, mockWSEventType } from './__mocks__/ws';
const { reset, returnHandlersForWsOnRoute } = wsMockController;
jest.mock('ws');

type supertestRequestType = request.SuperTest<request.Test>;

interface serverWorldType extends genericWorldType {
  server: supertestRequestType;
  triggerUpgrade: (msg: IncomingMessage, socket: Socket, head: Buffer) => void;
  wsRequest: {
    ws: mockWSEventType;
    msg: IncomingMessage;
    socket: Socket;
    head: Buffer;
  };
  request: request.Test;
  app: express.Application;
  configuration: serverConfigType;
  configurationFn: () => serverConfigType;
  websocket: WebSocket;
}

const serverWorld: serverWorldType = {
  server: {} as supertestRequestType,
  triggerUpgrade: () => {
    // NO-OP
  },
  wsRequest: {
    ws: {} as mockWSEventType,
    msg: {} as IncomingMessage,
    socket: {} as Socket,
    head: Buffer.from(''),
  },
  request: {} as request.Test,
  app: {} as express.Application,
  configuration: getConfigForName('default'),
  configurationFn: () => getConfigForName('default'),
  websocket: {} as WebSocket,
  context: {},
};

const { resetWorld, stepWhichUpdatesWorld, stepWithWorld } = worldGenerator(
  serverWorld
);

beforeEach(() => {
  resetWorld();
  reset();
});

Given(
  /a '(.+)' server configuration/,
  stepWhichUpdatesWorld((world, config) => {
    return {
      ...world,
      configuration: getConfigForName(config as string),
    };
  })
);

And(
  'Authentication is required',
  stepWhichUpdatesWorld((world) => {
    const { configuration } = world;
    return {
      ...world,
      configuration: merge(configuration, {
        authentication: { strategy: 'oauth' },
      }),
    };
  })
);

And(
  'I run an instance of the Strimzi-UI server',
  stepWhichUpdatesWorld((world) => {
    const { configuration } = world;
    const configurationFn = () => configuration;

    const { app, serverEventCb } = returnRequestHandlers(configurationFn);

    const serverForTest = createServer(app);
    const wsHandlerForTest = new WebSocket.Server();

    // bind the websocket to the server
    serverEventCb(serverForTest, wsHandlerForTest);

    return {
      ...world,
      server: request(serverForTest),
      triggerUpgrade: (...args) => serverForTest.emit('upgrade', ...args), // add a function to emulate a socket upgrade request
      configurationFn,
    };
  })
);

When(
  /^I change to a '(.+)' configuration$/,
  stepWhichUpdatesWorld((world, newConfig) => {
    return {
      ...world,
      configuration: getConfigForName(newConfig as string),
    };
  })
);

When(
  /^I make a '(.+)' request to '(.+)'$/,
  stepWhichUpdatesWorld((world, method, endpoint) => {
    const { server } = world;
    return {
      ...world,
      request: server[method as string](endpoint),
    };
  })
);

When(
  /^I make a '(.+)' gql request to '(.+)'$/,
  stepWhichUpdatesWorld((world, requestName, endpoint) => {
    const { server } = world;

    const query = requests[requestName as string] || {};

    return {
      ...world,
      request: server.post(endpoint as string).send(query),
    };
  })
);

When(
  /^I make a websocket request to '(.+)'$/,
  stepWhichUpdatesWorld((world, endpoint) => {
    const { triggerUpgrade } = world;

    const contextRoot = endpoint as string;

    const mockWSReturnedByUpgrade = returnHandlersForWsOnRoute(contextRoot);

    const mockSocket = new Socket();
    const mockMsg = new IncomingMessage(mockSocket);
    mockMsg.url = contextRoot;
    const mockBuffer = Buffer.from('');

    triggerUpgrade(mockMsg, mockSocket, mockBuffer);
    // the upgrade will trigger an async pre upgrade check. Return the result of this step delayed by 1 ms to allow this to occur
    return new Promise<serverWorldType>((resolve) =>
      setTimeout(
        () =>
          resolve({
            ...world,
            wsRequest: {
              ws: mockWSReturnedByUpgrade,
              msg: mockMsg,
              socket: mockSocket,
              head: mockBuffer,
            },
          }),
        1
      )
    );
  })
);

Then(
  /^the WebSocket has received (\d+) messages$/,
  stepWithWorld(({ wsRequest }, messageCount) => {
    const { ws } = wsRequest;
    expect(ws.message.mock()).toHaveBeenCalledTimes(
      parseInt(messageCount as string)
    );
  })
);

export { stepWhichUpdatesWorld, stepWithWorld };
