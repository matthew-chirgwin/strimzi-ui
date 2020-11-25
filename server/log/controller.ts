/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
import { Logger } from 'pino';
import { ClientLoggingEvent, websocketHandler } from 'types';
import { Data } from 'ws';

const messageHandler: (logger: Logger) => (data: Data) => void = (logger) => (
  data
) => {
  if (typeof data === 'string') {
    try {
      JSON.parse(data).forEach((clientLogEvent: ClientLoggingEvent) => {
        if (clientLogEvent.clientLevel) {
          logger[clientLogEvent.clientLevel](clientLogEvent);
        } else {
          logger.debug(clientLogEvent);
        }
      });
    } catch (err) {
      // Ignore any data that cannot be parsed
      logger.trace({ err }, `messageHandler failed: ${err.message}, ${data}`);
    }
  } else {
    // Ignore any non-string data
    logger.trace(
      `messageHandler ignoring data of type ${typeof data}: ${data}`
    );
  }
};

const closeHandler: (
  logger: Logger
) => (code: number, reason: string) => void = (logger) => (code, reason) =>
  logger.debug(`WebSocket listener closed. (${code}) ${reason}`);

export const wsHandler: websocketHandler = (context, ws) => {
  const { requestID, logger } = context;
  const { entry } = logger;
  const { exit } = entry('log.wsHandler', requestID);
  // no auth on these as an there is an initial check on upgrade, and there is no sensitive data transmitted
  ws.on('message', messageHandler(logger));
  ws.on('close', closeHandler(logger));

  exit(true);
};
