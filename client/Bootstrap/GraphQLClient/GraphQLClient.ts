/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */

import { ApolloClient, HttpLink, split, InMemoryCache } from '@apollo/client';
import { WebSocketLink } from '@apollo/client/link/ws';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import { getRelativeUrl, getRelativeWs } from 'Utils';

// this code will create a WS connection to the UI server/backend. When Strimzi-admin has WS support, enabled this, and remove the apiLink HttpLink
const subscriptionClient = new SubscriptionClient(
  getRelativeWs('/api').toString(),
  {
    reconnect: true,
  }
);
const apiLink = new WebSocketLink(subscriptionClient);

// const apiLink = new HttpLink({ uri: getRelativeUrl('/api').toString(), fetch });

const configLink = new HttpLink({
  uri: getRelativeUrl('/config').toString(),
  fetch,
});

const splitLink = split(
  (operation) => operation.getContext().purpose === 'config',
  configLink,
  apiLink
);

const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

export { apolloClient };
