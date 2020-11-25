# Copyright Strimzi authors.
# License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
Feature: api module

    Behaviours and capabilities provided by the api module

    Scenario: Proxies all HTTP requests made to /api to the configured backend
    Given a 'api_only' server configuration
    And I run an instance of the Strimzi-UI server
    When I make a 'get' request to '/api/foo'
    Then I make the expected proxy request and get the expected proxied response

    Scenario: Proxies all HTTP requests made to /api to the securley configured backend
    Given a 'api_secured_only' server configuration
    And I run an instance of the Strimzi-UI server
    When I make a 'get' request to '/api/foo'
    Then I make the expected proxy request and get the expected proxied response

    Scenario: Handles errors from the proxied backend gracefully
    Given a 'api_secured_only' server configuration
    And the backend proxy returns an error response
    And I run an instance of the Strimzi-UI server
    When I make a 'get' request to '/api/foo'
    Then I make the expected proxy request and get the expected proxied response

    Scenario: Proxies all HTTP requests made to /api to the specified context root
    Given a 'api_with_custom_context_root' server configuration
    And I run an instance of the Strimzi-UI server
    When I make a 'get' request to '/api/foo'
    Then I make the expected proxy request and get the expected proxied response

    Scenario: Proxies all WS events made to /api to the configured backend, and returns any/all responses
    Given a 'api_only' server configuration
    And a proxy websocket can be established
    And I run an instance of the Strimzi-UI server
    When I make a websocket request to '/api'
    And a socket is opened to the backend
    Then any message sent to the api module is proxied on to the backend, and vice versa

    Scenario: Proxies and handles the backend socket being closed
    Given a 'api_only' server configuration
    And a proxy websocket can be established
    And I run an instance of the Strimzi-UI server
    When I make a websocket request to '/api'
    And a socket is opened to the backend
    Then if the backend socket closes, so does the client

    Scenario: Proxies and handles the client socket being closed
    Given a 'api_only' server configuration
    And a proxy websocket can be established
    And I run an instance of the Strimzi-UI server
    When I make a websocket request to '/api'
    And a socket is opened to the backend
    Then if the client socket closes, so does the backend

    Scenario: Handles errors from the client socket if any
    Given a 'api_only' server configuration
    And a proxy websocket can be established
    And I run an instance of the Strimzi-UI server
    When I make a websocket request to '/api'
    And a socket is opened to the backend
    Then if the client errors, the error is not proxied on

    Scenario: Handles errors from the backend socket, sending them on to the client gracefully
    Given a 'api_only' server configuration
    And a proxy websocket can be established
    And I run an instance of the Strimzi-UI server
    When I make a websocket request to '/api'
    And a socket is opened to the backend
    Then if the backend socket errors, the error is handled
