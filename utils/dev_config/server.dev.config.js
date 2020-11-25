/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
const {
  serverCertificates,
  mockAdminCertificates,
  devEnvValues,
} = require('../tooling/runtimeDevUtils.js');
const { devServer, mockadminServer, auth } = devEnvValues;

module.exports = {
  ...auth,
  client: {
    transport: {
      ...serverCertificates,
    },
  },
  logging: {
    level: 'debug',
  },
  modules: {
    api: true,
    client: false,
    config: true,
    log: true,
    mockapi: false,
  },
  proxy: {
    ...mockadminServer,
    transport: {
      ...mockAdminCertificates,
    },
  },
  ...devServer,
};
