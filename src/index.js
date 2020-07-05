'use strict';

const Http = require('http');
const Https = require('https');
const URL = require('url');
const Stream = require('stream');
const Zlib = require('zlib');

const Dust = require('@botbind/dust');
const Lyra = require('@botbind/lyra');

const internals = {
    protocolRx: /^https?:/i,
};

internals.schema = Lyra.obj({
    method: Lyra.str()
        .uppercase()
        .convert()
        .required(),

    headers: Lyra.obj(),

    payload: Lyra.alt(
        Lyra.str().allow(''),
        Lyra.obj(),
    )
        .when('method', {
            is: ['GET', 'HEAD'],
            then: Lyra.forbidden(),
        }),

    redirect: Lyra.alt(
        Lyra.bool(),
        Lyra.num().min(1),
    )
        .default(false),

    redirectMethod: Lyra.str()
        .uppercase()
        .convert()
        .default(Lyra.ref('method')),

    gzip: Lyra.bool().default(false),

    maxBytes: Lyra.num(),

    timeout: Lyra.num(),
})
    .default();

exports.request = function (url, options) {
    const settings = internals.schema.attempt(options);
    settings.headers = internals.normalizeHeaders(settings.headers);

    return new Promise((resolve, reject) => {
        internals.request(url, settings, { resolve, reject });
    });
};

internals.normalizeHeaders = function (headers) {
    const normalized = {};
    for (const header of Object.keys(headers)) {
        normalized[header.toLowerCase()] = headers[header];
    }

    return normalized;
};

internals.request = function (url, settings, relay) {
    // Parse url

    const parsedUrl = new URL.URL(url);

    // Construct request options

    const requestOptions = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        protocol: parsedUrl.protocol,
        headers: settings.headers,
        method: settings.method,
        timeout: settings.timeout,
    };

    if (parsedUrl.port) {
        requestOptions.port = Number(parsedUrl.port);
    }

    if (parsedUrl.username ||
        parsedUrl.password) {

        requestOptions.auth = `${url.username}:${url.password}`;
    }

    // Set Accept-Encoding

    if (settings.gzip && !requestOptions.headers['accept-encoding']) {
        requestOptions.headers['accept-encoding'] = 'gzip';
    }

    // Process body and set Content-Type

    if (settings.payload &&
        typeof payload === 'object' &&
        settings.payload instanceof Stream === false &&
        !Buffer.isBuffer(settings.payload)) {

        requestOptions.payload = JSON.stringify(settings.payload);

        if (!requestOptions.headers['content-type']) {
            requestOptions.headers['content-type'] = 'application/json';
        }
    }

    // Calculate Content-Length

    const isBuffer = Buffer.isBuffer(requestOptions.payload);
    if ((typeof requestOptions.payload === 'string' || isBuffer) &&
        !requestOptions.headers['content-length']) {

        requestOptions.headers['content-length'] = isBuffer
            ? requestOptions.payload.length
            : Buffer.byteLength(requestOptions.payload);
    }

    // Send the request

    const client = requestOptions.protocol === 'https:' ? Https : Http;
    const request = client.request(requestOptions);

    const finalize = (error) => {
        relay.reject(error);
        request.destroy();
    };

    request.once('error', (error) => {
        finalize(error);
    });

    request.once('response', (response) => {
        const redirectMethod = internals.redirectMethod(response.statusCode, requestOptions.method, settings);

        if (settings.redirect === false || // Redirect could be 0 for subsequent redirections
            !redirectMethod) {

            internals.response(response, settings, relay);
            return;
        }

        // Redirection

        response.destroy();

        if (settings.redirect === 0) {
            finalize(new Error('Maximum redirections reached'));
            return;
        }

        let location = response.headers.location;
        if (!location) {
            finalize(new Error('Redirection without location'));
            return;
        }

        // Process location

        if (!internals.protocolRx.test(location)) {
            location = URL.resolve(parsedUrl.href, location);
        }

        // Modify the settings

        const newSettings = { ...settings };

        if (redirectMethod === 'GET') { // Delete the payload so the next recursive call will not get confused
            delete newSettings.payload;
        }

        if (newSettings.payload &&
            newSettings.payload instanceof Stream) {

            finalize(new Error('Cannot follow redirections with stream bodies'));
            return;
        }

        settings.method = redirectMethod;
        settings.redirect--;

        internals.request(location, settings, relay);
    });

    // Write payload

    if (settings.payload) {
        // Streams

        if (settings.payload instanceof Stream) {
            request.pipe(settings.payload);
            return;
        }

        // String (including json), Buffer
        request.write(settings.payload);
    }

    request.end();
};

internals.redirectMethod = function (code, method, settings) {
    // https://en.wikipedia.org/wiki/List_of_HTTP_status_codes#3xx_Redirection

    switch (code) {
        case 301:
        case 302: return settings.redirectMethod; // 301 and 302 allows changing methods
        case 303: return 'GET'; // 303 requires the method to be GET
        case 307:
        case 308: return method; // 307 and 308 does not allow the method to change
    }
};

internals.response = function (response, settings, relay) {
    // Normalize headers

    const headers = internals.normalizeHeaders(response.headers);

    // Setup reader

    const reader = new internals.Reader(settings.maxBytes);

    const finalize = (error, stream) => {
        relay.reject(error);
        response.destroy();
        stream.destroy();
    };

    reader.once('error', (error) => {
        finalize(error, reader);
    });

    reader.once('finish', () => {
        const contentType = headers['content-type'] || '';
        const mime = contentType.split(';')[0].trim().toLowerCase();
        let payload = reader.content().toString();

        if (mime === 'application/json') {
            payload = JSON.parse(payload);
        }

        relay.resolve({
            headers,
            payload,
            raw: response,
        });
    });

    // Compression

    if (!settings.gzip) { // Compression set to false
        response.pipe(reader);
        return;
    }

    const contentEncoding = headers['content-encoding'] || '';

    if (settings.method === 'HEAD' ||
        !contentEncoding ||
        response.statusCode === 204 ||
        response.statusCode === 304) {

        response.pipe(reader);
        return;
    }

    if (contentEncoding === 'gzip' ||
        contentEncoding === 'x-gzip') {

        const gzip = Zlib.createGunzip();

        gzip.once('error', (error) => {
            finalize(error, gzip);
        });

        response.pipe(gzip).pipe(reader);
        return;
    }

    response.pipe(reader);
};

internals.Reader = class extends Stream.Writable {
    constructor(maxBytes) {
        super();

        this.maxBytes = maxBytes;
        this.buffers = [];
        this.length = 0;
    }

    _write(chunk, _, next) {
        this.length += chunk.length;

        if (this.maxBytes && this.length > this.maxBytes) {
            this.emit('error', new Error('Maximum payload size reached'));
            return;
        }

        this.buffers.push(chunk);
        next();
    }

    content() {
        return Buffer.concat(this.buffers, this.length);
    }
};

internals.shortcut = function () {
    for (const shortcut of ['get', 'post', 'put', 'patch', 'delete']) {
        exports[shortcut] = function (url, options = {}) {
            Dust.assert(!options.method, 'Option method is not allowed');

            return exports.request(url, { ...options, method: shortcut.toUpperCase() });
        };
    }
};

internals.shortcut();
