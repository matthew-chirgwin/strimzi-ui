/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
const {
  mockAdminCertificates,
  devEnvValues,
} = require('../tooling/runtimeDevUtils.js');
const { mockadminServer } = devEnvValues;

module.exports = {
  authentication: {
    strategy: 'none',
  },
  client: {
    transport: {
      ...mockAdminCertificates,
    },
  },
  logging: {
    level: 'debug',
  },
  modules: {
    api: false,
    client: false,
    config: false,
    log: false,
    mockapi: true,
  },
  proxy: {
    transport: {},
  },
  ...mockadminServer,
};
