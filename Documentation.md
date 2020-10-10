# Documentation

## Introduction

Bornite is a library for making HTTP requests

## Installation

Bornite is available on npm:

```bash
npm install @botsocket/bornite
```

## Usage

A simple GET request:

```js
const Bornite = require('@botsocket/bornite');

const makeRequest = async function () {
    const response = await Bornite.get('https://www.google.com');

    response.payload; // <html>...
    response.statusCode; // 200
    response.statusMessage; // OK
};

makeRequest();
```

POST request with JSON payload:

```js
const Bornite = require('@botsocket/bornite');

const makeRequest = async function () {
    const response = await Bornite.post('https://my-url.com', {
        payload: {
            name: 'John Doe',
        },
    });

    response.statusCode; // 200
    response.statusMessage; // OK
};

makeRequest();
```

With `Promise`:

```js
const Bornite = require('@botsocket/bornite');

Bornite.get('https://www.google.com')
    .then((response) => {
        response.payload; // <html>...
        response.statusCode; // 200
        response.statusMessage; // OK
    });
```

## API

-   [`custom()`](#customoptions)
-   [`request()`](#requesturl-options)
    -   [`response.payload`](#responsepayload)
    -   [`response.headers`](#responseheaders)
    -   [`response.statusCode`](#responsestatuscode)
    -   [`response.statusMessage`](#responsestatusmessage)
    -   [`response.raw`](#responseraw)
-   [Shortcut](#shortcut)

### `custom(options)`

Creates a custom Bornite instance with common options where:

-   `options`: Common options that apply to every request. Same as ones passed to [`request()`](#requesturl-options).

```js
const custom = Bornite.custom({
    baseUrl: 'https://www.google.com',
    redirects: Infinity,
    gzip: true,
    headers: {
        'Some-Common-Header': 'abc',
    },
});

custom.get('/images');
custom.post('/gmail');
```

### `request(url, [options])`

Makes a request where:

-   `url`: The URL to send the request.
-   `options`: Optional options where:
    -  `method`: The request method to use. Case-insensitive.
    -  `baseUrl`: Base URL that is resolved with `url` to form a full URL. Most useful when used with [`custom()`](#customoptions).
    -  `headers`: A hash of case-insensitive header names and their values. `Content-Length`, `Content-Type` and `Accept-Encoding` are set by default if possible.
    -  `payload`: The request payload. Can be a string, a buffer, a stream, `URLSearchParams` or a serializable object. If `method` is `GET` or `HEAD`, this key is forbidden.
    -  `agent`: The HTTP Agent passed directly to `Http.request()`.
    -  `redirects`: The number of redirects to follow. Set to `0` or `false` to disable redirection. Set to `Infinity` to follow all possible redirects. Defaults to `0`.
    -   `redirectMethod`: The method to change to when performing `301` and `302` redirects. Note that `payload` is not forwarded if set to `GET` or `HEAD`. Defaults to using `method`.
    -   `gzip`: Whether to decompress gzipped payloads. Defaults to `false`.
    -   `maxBytes`: The maximum size in bytes the response payload can have. Set to `0` to disable counting bytes. Defaults to `0`.
    -   `timeout`: Socket timeout in milliseconds. Passed directly to `Http.request()`.

```js
const response = await Bornite.request('/images', {
    method: 'POST',
    baseUrl: 'https://www.google.com',
    headers: {},
    payload: { a: 1 },
    agent: new Http.Agent({ maxSockets: 1 }),
    redirects: Infinity,
    redirectMethod: 'GET',
    gzip: true,
    maxBytes: 5000,
    timeout: 2000,
}); // Requests to https://www.google.com/images
```

[Back to top](#api)

#### `response.payload`

Payload returned by the server. Bornite automatically parses the content if the `Content-Type` header is set to `application/json`.

[Back to top](#api)

#### `response.headers`

Response headers returned by the server.

[Back to top](#api)

#### `response.statusCode`

The status code of the response.

[Back to top](#api)

#### `response.statusMessage`

The status message of the response.

[Back to top](#api)

#### `response.raw`

The raw Node response object.

[Back to top](#api)

### Shortcuts

Bornite provides the following convenience methods for common HTTP methods:

```js
Bornite.get(url); // Equivalent to Bornite.request(url, { method: 'GET' })

Bornite.post(url); // Equivalent to Bornite.request(url, { method: 'POST' })

Bornite.put(url); // Equivalent to Bornite.request(url, { method: 'PUT' })

Bornite.patch(url); // Equivalent to Bornite.request(url, { method: 'PATCH' })

Bornite.delete(url); // Equivalent to Bornite.request(url, { method: 'DELETE' })
```

[Back to top](#api)










