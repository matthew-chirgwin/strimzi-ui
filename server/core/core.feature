# Copyright Strimzi authors.
# License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
Feature: core module

    Behaviours and capabilities provided by the core module

    Scenario: When making a call with no strimzi-ui header, one is added for later requests
        Given a 'mockapi_only' server configuration
        And I run an instance of the Strimzi-UI server
        When I make a request with no unique request header
        Then a unique request header is returned in the response

    Scenario: When making a call with a strimzi-ui header, that header is used in the request
        Given a 'mockapi_only' server configuration
        And I run an instance of the Strimzi-UI server
        When I make a request with a unique request header
        Then the unique request header sent is returned in the response

    Scenario: When making a call to the strimzi-ui server, the expected secuirty headers are present
        Given a 'mockapi_only' server configuration
        And I run an instance of the Strimzi-UI server
        When I make a 'get' request to '/api/test'
        Then all expected security headers are present

    Scenario: If two modules mount routes on the same mounting point, and one is disabled, the enabled module is invoked
        Given a 'mockapi_only' server configuration
        And I run an instance of the Strimzi-UI server
        When I make a 'get' request to '/api/test'
        Then the mockapi handler is called

    Scenario: When making a call to the strimzi-ui server, the expected session cookie is present
        Given a 'mockapi_only' server configuration
        And a session identifier of 'server-name'
        And I run an instance of the Strimzi-UI server
        When I make a 'get' request to '/'
        Then the response sets a cookie named 'server-name'

    Scenario: If mockapi and api modules are configured, only the api module is mounted
        Given a 'api_and_mockapi' server configuration
        And I run an instance of the Strimzi-UI server
        Then only the api module is mounted
    
    Scenario: Module's HTTP handlers are mounted in in context root length order
        Given a 'production' server configuration
        And I run an instance of the Strimzi-UI server
        Then modules are mounted with respect to their context root specifitity 

    Scenario: If a module is mounted, but then disabled, requests are rejected
        Given a 'production' server configuration
        And I run an instance of the Strimzi-UI server
        When I change to a 'mockapi_only' configuration
        Then requests for modules which were enabled but now are not return the expected responses