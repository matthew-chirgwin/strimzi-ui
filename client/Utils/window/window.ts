/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */

/** Returns the current location object from the global Window object */
export const getLocation: () => Location = () => window.location;

/** Returns a URL object for `path` relative to the current, using the http(s) protocol  */
export const getRelativeUrl: (path: string) => URL = (path) =>
  new URL(path, getLocation().href);

/** Returns a URL object for `path` relative to the current, using the ws(s) protocol */
export const getRelativeWs: (path: string) => URL = (path) => {
  const relativeUrl = getRelativeUrl(path);
  relativeUrl.protocol = relativeUrl.protocol === 'http:' ? 'ws:' : 'wss:';
  return relativeUrl;
};
