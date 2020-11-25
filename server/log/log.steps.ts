/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
import { And, Then, Fusion } from 'jest-cucumber-fusion';
import { stepWithWorld } from 'test_common/commonServerSteps';

Then(
  'I get the expected log response',
  stepWithWorld((world) => {
    const { request } = world;
    return request.expect(426);
  })
);

And(
  'I send a logging WebSocket message',
  stepWithWorld(({ wsRequest }) => {
    const { ws } = wsRequest;
    ws.init_send.trigger(
      JSON.stringify([
        {
          clientLevel: 'warn',
          msg: 'test logging message',
        },
      ])
    );
  })
);

And(
  'I send a logging WebSocket message without a clientLevel',
  stepWithWorld(({ wsRequest }) => {
    const { ws } = wsRequest;

    ws.init_send.trigger(
      JSON.stringify([
        {
          msg: 'test logging message',
        },
      ])
    );
  })
);

And(
  'I send a non-string logging WebSocket message',
  stepWithWorld(({ wsRequest }) => {
    const { ws } = wsRequest;

    ws.init_send.trigger(new ArrayBuffer(10));
  })
);

And(
  'I send a logging WebSocket message that is not a JSON array',
  stepWithWorld(({ wsRequest }) => {
    const { ws } = wsRequest;

    ws.init_send.trigger(
      JSON.stringify({
        clientLevel: 'warn',
        msg: 'test logging message',
      })
    );
  })
);

And(
  'I send an unparsable string logging WebSocket message',
  stepWithWorld(({ wsRequest }) => {
    const { ws } = wsRequest;

    ws.init_send.trigger('{this is not: "json"}');
  })
);

And(
  'I close the WebSocket',
  stepWithWorld(({ wsRequest }) => {
    const { ws } = wsRequest;
    ws.init_close.trigger(0, 'Test close');
  })
);

And(
  'the WebSocket is closed',
  stepWithWorld(({ wsRequest }) => {
    const { ws } = wsRequest;
    expect(ws.close.mock()).toHaveBeenCalledTimes(1);
    expect(ws.close.mock()).toHaveBeenCalledWith(0, 'Test close');
  })
);

Fusion('log.feature');
