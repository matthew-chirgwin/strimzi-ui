/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
// placeholder functions - to be replaced by actual implementation later

import express from 'express';
import { authenticationConfigType, socketAuthFn } from 'types';

const generateExpressAuthFn: (
  strategy: string
) => (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => void = (strategy) => {
  switch (strategy) {
    default:
    case 'none':
      return (req, res, next) => next();
    case 'scram':
    case 'oauth':
      return (req, res) => res.sendStatus(511); // if auth on, reject for sake of example. This is a middleware, akin to passport doing its checks.
  }
};

const generateWSAuthFn: (strategy: string) => socketAuthFn = (strategy) => {
  switch (strategy) {
    default:
    case 'none':
      return (msg, socket, next) => next();
    case 'scram':
    case 'oauth':
      return (msg, socket) => {
        if (socket !== null) {
          // if auth on, reject for sake of example. This is a middleware, akin to passport doing its checks.
          socket.write('HTTP/1.0 511 Network Authentication Required\n\n\n\n'); // headers
          socket.write('Network Authentication Required'); // body
          socket.end();
        }
      };
  }
};

const authFunction: (
  config: authenticationConfigType
) => {
  expressAuthFn: (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => void;
  socketAuthFn: socketAuthFn;
} = ({ strategy }) => ({
  expressAuthFn: generateExpressAuthFn(strategy),
  socketAuthFn: generateWSAuthFn(strategy),
});

export { authFunction };
