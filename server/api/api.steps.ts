/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */

import { createProxyServer } from 'http-proxy';
import { wsMockController, mockWSEventType } from '../test_common/__mocks__/ws';
const { returnHandlersForWsOnRoute } = wsMockController;

// without setting up a second server (with secure and insecure modes), the best way to simulate the proxying of calls is mocking them/verifying the api usage
type mockProxyServerType = {
  on: (event: string, handler: expressMiddleware) => void;
  web: jest.Mock<expressMiddleware>;
};

const placeholderProxyEvent = jest.fn();
const successResponseBody = 'OK from mock';
const mockServerImplementation: (
  shouldError: boolean
) => mockProxyServerType = (shouldError) => {
  const mockProxyEvents = {
    proxyReq: placeholderProxyEvent,
    proxyRes: placeholderProxyEvent,
    error: placeholderProxyEvent,
  };
  return {
    on: jest
      .fn()
      .mockImplementation(
        (event, handler) => (mockProxyEvents[event] = handler)
      ),
    web: jest.fn().mockImplementation((req, res) => {
      mockProxyEvents.proxyReq({}, req, res);
      if (shouldError) {
        mockProxyEvents.error({ message: 'mock error' }, req, res);
      } else {
        mockProxyEvents.proxyRes(
          { statusCode: 200, statusMessage: successResponseBody },
          req,
          res
        );
        res.status(200).send(successResponseBody);
      }
    }),
  };
}; // unpack the web to trigger on etc
const createMockServerFn: (shouldError?: boolean) => mockProxyServerType = (
  shouldError = false
) => mockServerImplementation(shouldError);

jest.mock('http-proxy', () => ({
  createProxyServer: jest.fn(),
}));

import { Then, After, Fusion, And, Before } from 'jest-cucumber-fusion';
import {
  stepWhichUpdatesWorld,
  stepWithWorld,
} from 'test_common/commonServerSteps';
import { expressMiddleware } from 'types';

Before(() => {
  createProxyServer.mockReturnValue(createMockServerFn(false));
});

After(() => {
  // reset all mocks to starting state
  jest.clearAllMocks();
});

And(
  'the backend proxy returns an error response',
  stepWhichUpdatesWorld((world) => {
    const { context } = world;
    createProxyServer.mockReturnValue(createMockServerFn(true));
    return {
      ...world,
      context: {
        ...context,
        responseWillError: true,
      },
    };
  })
);

Then(
  'I make the expected proxy request and get the expected proxied response',
  stepWithWorld(async (world) => {
    const { request, context, configuration } = world;
    const expectedContextRoot = configuration.proxy.contextRoot;
    const securedConfig = configuration.proxy.transport.cert ? true : false;

    const expectFailure = context.responseWillError ? true : false;

    await request.expect((res) => {
      // confirm the API module handles the response
      if (expectFailure) {
        expect(res.status).toBe(500);
      } else {
        expect(res.status).toBe(200);
        expect(res.text).toEqual(successResponseBody);
      }
    });

    // check all mock calls for expected values
    expect(createProxyServer).toHaveBeenCalledTimes(1);

    // confirm the API module configured the proxy as expected first
    const { target, ca, secure } = createProxyServer.mock.calls[0][0];
    if (securedConfig) {
      expect(target.startsWith('https://')).toBe(true);
      expect(ca).toBe(configuration.proxy.transport.cert);
      expect(secure).toBe(true);
    } else {
      expect(target.startsWith('http://')).toBe(true);
      expect(ca).toBeUndefined();
      expect(secure).toBe(false);
    }
    // confirm the expected context root is added to the end of the target
    expect(target.endsWith(expectedContextRoot)).toBe(true);

    expect(placeholderProxyEvent).not.toBeCalled(); // confirm placeholder event handlers are not called (ie ones provided by API module are)
  })
);

And(
  'a proxy websocket can be established',
  stepWhichUpdatesWorld((world) => {
    const { configuration, context } = world;
    const { contextRoot, hostname, port, transport } = configuration.proxy;

    const wsProtocol = transport.cert ? 'wss://' : 'ws://';

    const wsHandlers = returnHandlersForWsOnRoute(
      `${wsProtocol}${hostname}:${port}${contextRoot}`
    );

    return {
      ...world,
      context: {
        ...context,
        apiBackendSocket: wsHandlers,
      },
    };
  })
);

And(
  'a socket is opened to the backend',
  stepWithWorld((world) => {
    const { open } = world.context.apiBackendSocket as mockWSEventType;

    // emulate the open of the socket to the backend - should be initiated via the pre upgrade handler
    expect(open.trigger()).toBe(true);
    // confirm module => backend now opened
    expect(open.mock()).toBeCalledTimes(1);
  })
);

Then(
  'any message sent to the api module is proxied on to the backend, and vice versa',
  stepWithWorld((world) => {
    const proxySocket = world.context.apiBackendSocket as mockWSEventType;

    // get the socket from client to core
    const clientSocket = world.wsRequest.ws;
    const sampleIncomingMsg = 'request';
    const sampleReturnedMsg = 'response';

    // send some data from the client socket, and confirm it is sent on to the proxy
    expect(clientSocket.message.trigger(sampleIncomingMsg)).toBe(true);
    expect(proxySocket.init_send.mock()).toHaveBeenCalledTimes(1);
    expect(proxySocket.init_send.mock()).toHaveBeenCalledWith(
      sampleIncomingMsg
    );
    // and vice versa
    expect(proxySocket.message.trigger(sampleReturnedMsg)).toBe(true);
    expect(clientSocket.init_send.mock()).toHaveBeenCalledTimes(1);
    expect(clientSocket.init_send.mock()).toHaveBeenCalledWith(
      sampleReturnedMsg
    );
  })
);

Then(
  'if the backend socket closes, so does the client',
  stepWithWorld((world) => {
    const proxySocket = world.context.apiBackendSocket as mockWSEventType;

    // get the socket from client to core
    const clientSocket = world.wsRequest.ws;

    const mockCode = 123;
    const mockReason = 'test';

    // confirm the close event is sent on
    expect(proxySocket.init_close.trigger(mockCode, mockReason)).toBe(true);
    expect(clientSocket.init_close.mock()).toHaveBeenCalledTimes(1);
    expect(clientSocket.init_close.mock()).toHaveBeenCalledWith(mockCode);
  })
);

Then(
  'if the client socket closes, so does the backend',
  stepWithWorld((world) => {
    const proxySocket = world.context.apiBackendSocket as mockWSEventType;

    // get the socket from client to core
    const clientSocket = world.wsRequest.ws;

    const mockCode = 123;
    const mockReason = 'test';

    // confirm the close event is sent on
    expect(clientSocket.init_close.trigger(mockCode, mockReason)).toBe(true);
    expect(proxySocket.init_close.mock()).toHaveBeenCalledTimes(1);
  })
);

Then(
  'if the client errors, the error is not proxied on',
  stepWithWorld((world) => {
    const proxySocket = world.context.apiBackendSocket as mockWSEventType;

    // get the socket from client to core
    const clientSocket = world.wsRequest.ws;
    // create a mock error
    const mockError = new Error('example');

    // confirm on error, the backend is not told (to abstract/isolate it from users/we dont trust them/should not get errors this direction)
    expect(clientSocket.error.trigger(mockError)).toBe(true);
    expect(proxySocket.error.mock()).toHaveBeenCalledTimes(0);
  })
);

Then(
  'if the backend socket errors, the error is handled',
  stepWithWorld((world) => {
    const proxySocket = world.context.apiBackendSocket as mockWSEventType;

    // get the socket from client to core
    const clientSocket = world.wsRequest.ws;
    // create a mock error
    const mockError = new Error('example');

    // confirm on error, the client gets the error (as we trust the backend)
    expect(proxySocket.error.trigger(mockError)).toBe(true);
    expect(clientSocket.init_close.mock()).toHaveBeenCalledTimes(1);
    expect(clientSocket.init_close.mock()).toHaveBeenCalledWith(
      500,
      mockError.message
    );
  })
);

Fusion('api.feature');
