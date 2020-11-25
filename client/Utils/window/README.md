# window

A set of helper functions to interact with the global `Window` object. This keeps all window logic in one file, and enables easy stubbing for test purposes.

## Functions available

- `getLocation` - returns the current `Location` object
- `getRelativeUrl` - returns a full URL object, relative to the current hostname/port/protocol, with a provided context route. Useful if programmatically creating/referencing the UI server. This function should be used for HTTP(S) traffic.
- `getRelativeWs` - returns a full URL object, relative to the current hostname/port/protocol, with a provided context route. Useful if programmatically creating/referencing the UI server. This function is used for WebSocket (WS(S)) traffic.
