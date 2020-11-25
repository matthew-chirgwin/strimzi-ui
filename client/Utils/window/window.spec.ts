/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import { getLocation, getRelativeUrl, getRelativeWs } from './window';

const testPath = '/bar';
const testLocation = new URL(`http://foo.com${testPath}`);

describe('window function tests', () => {
  let realLocation;

  beforeEach(() => {
    // control, but allow the restoration of, the window.location object
    realLocation = { ...window.location };
    // @ts-ignore
    delete window.location;
    // @ts-ignore
    window.location = testLocation;
  });

  afterEach(() => {
    window.location = realLocation;
  });

  describe(`getLocation`, () => {
    it('returns the location object from the window', () => {
      expect(getLocation().toString()).toEqual(testLocation.toString());
    });
  });

  describe(`getRelativeUrl`, () => {
    it('returns the expected URL object', () => {
      expect(getRelativeUrl(testPath).toString()).toEqual(
        testLocation.toString()
      );
    });
  });

  describe(`getRelativeWs`, () => {
    it('returns the expected URL object for a websocket', () => {
      const expectedWSURL = new URL(`ws://foo.com${testPath}`);

      expect(getRelativeWs(testPath).toString()).toEqual(
        expectedWSURL.toString()
      );
    });

    it('returns the expected URL object for a secure websocket', () => {
      const expectedWSURL = new URL(`wss://foo.com${testPath}`);
      // @ts-ignore
      delete window.location;
      // @ts-ignore
      window.location = new URL(`https://foo.com${testPath}`);
      expect(getRelativeWs(testPath).toString()).toEqual(
        expectedWSURL.toString()
      );
    });
  });
});
