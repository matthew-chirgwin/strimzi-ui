/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */

//This is a mock of the `ws` library. It abstracts both the websocket and websocket server, providing (via the exported `wsMockController`) the ability to define and control the returned mock sockets, as if you were using them like a client
/* eslint-disable */
import { IncomingMessage } from 'http';
import { Socket } from 'net';

interface mockWebSocketServer {
  handleUpgrade: (
    msg: IncomingMessage,
    socket: Socket,
    head: Buffer,
    cb: (ws: mockWebSocket) => void
  ) => void;
}

interface mockWebSocket {
  on: (evt, cb) => void;
  send: (...params: Array<unknown>) => void;
  close: (...params: Array<unknown>) => void;
}

const websocketServer = new Map<string, mockWebSocketServer>();
const websockets = new Map<string, mockWebSocket>();

/**
 * mock server implementation. Implements the `handleUpgrade` only, returning a pre registered mock WS object
 */
const mockServer: () => mockWebSocketServer = () => ({
  handleUpgrade: (msg, socket, head, cb) => {
    const url = msg.url || 'no url in incoming message!';
    const ws = websockets.get(url);
    if (ws === undefined) {
      throw new Error(
        `No mock socket found for url: '${url}'. Register all expected websockets before emitting an upgrade event`
      );
    } else {
      cb(ws);
    }
  },
});

/**
 *  a mocked event - ie what would be called on message, close, error etc. Provides a mechanism to trigger that event, and access the registered mock
 */
export type mockWSEventType = {
  [action: string]: {
    trigger: (...params: Array<unknown>) => boolean;
    mock: () => jest.Mock;
  };
};

/**
 * returnHandlersForWsOnRoute sets up a mock websocket, and returns a set of handlers to interact and monitor it. The handlers will be of type `mockWSEventType`, and the following are registered:
 *
 *  | action/event | provided via key |
 *  | ------ | --------|
 *  | (on) message| message |
 * | (on) open| open |
 * | (on) close| close |
 * | (on) error| error |
 * | send| init_send |
 * | close| init_close |
 *
 *
 * @param contextRoot the url/root this websocket will be registered to return on
 * @returns an object containing the above handlers, allowing a socket to be controlled and observed
 */
const returnHandlersForWsOnRoute: (contextRoot: string) => mockWSEventType = (
  contextRoot
) => {
  const eventsRegistered = new Map<string, jest.Mock>();

  const triggerEvtAndReturnBool: (
    event: string
  ) => (...params: Array<unknown>) => boolean = (event) => (...params) => {
    let callbackInvoked = false;
    const callbackForEvent = eventsRegistered.get(event);
    if (callbackForEvent) {
      callbackForEvent(...params);
      callbackInvoked = true;
    }
    return callbackInvoked;
  };

  const mockWs = {
    on: (evt, cb) => eventsRegistered.set(evt, jest.fn(cb)),
    send: jest.fn(),
    close: jest.fn(),
  };
  websockets.set(contextRoot, mockWs);

  const generateHandlerCallbacksForEvent: (event: string) => mockWSEventType = (
    event
  ) => ({
    [event]: {
      trigger: triggerEvtAndReturnBool(event),
      mock: () => {
        const mockForEvt = eventsRegistered.get(event);
        if (mockForEvt) {
          return mockForEvt;
        } else {
          return jest.fn();
        }
      },
    },
  });

  const generateHandlerForSocket: (
    event: string,
    handler: string
  ) => mockWSEventType = (event, handler) => ({
    [`init_${event}`]: {
      trigger: triggerEvtAndReturnBool(handler),
      mock: () => mockWs[event],
    },
  });

  return {
    // callbacks registered via the `on` mechanism
    ...generateHandlerCallbacksForEvent('open'),
    ...generateHandlerCallbacksForEvent('message'),
    ...generateHandlerCallbacksForEvent('close'),
    ...generateHandlerCallbacksForEvent('error'),
    // send and close handlers - configured to call any registered `on` handlers as a result of them being called
    ...generateHandlerForSocket('send', 'message'),
    ...generateHandlerForSocket('close', 'close'),
  };
};

const getSocketForRoute = (route: string) => websockets.get(route);

export const wsMockController = {
  returnHandlersForWsOnRoute,
  reset: () => {
    websocketServer.clear();
    websockets.clear();
  },
};

jest.mock('ws', () => {
  const mockWS = getSocketForRoute;
  // @ts-ignore - cannot find a better way of mocking the default/adding functions on the constructor
  mockWS.Server = jest.fn().mockImplementation(mockServer);
  return {
    __esModule: true,
    default: mockWS,
    wsMockController,
  };
});

import Websocket from 'ws';

export default Websocket;
