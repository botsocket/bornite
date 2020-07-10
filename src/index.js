'use strict';

const Http = require('http');
const Https = require('https');
const URL = require('url');
const Stream = require('stream');
const Zlib = require('zlib');

const Dust = require('@botbind/dust');

const Schemas = require('./schemas');

const internals = {
    protocolRx: /^https?:/i,
};

exports.request = function (url, options) {
    // Validate parameters

    Dust.assert(typeof url === 'string', 'URL must be a string');

    const settings = Schemas.options.attempt(options);

    // Normalize settings

    settings.headers = internals.normalizeHeaders(settings.headers);
    settings.method = settings.method.toUpperCase();
    settings.redirectMethod = settings.redirectMethod.toUpperCase();

    // Normalize payload and headers

    if (settings.gzip &&
        !settings.headers['accept-encoding']) {

        settings.headers['accept-encoding'] = 'gzip';
    }

    if (typeof settings.payload === 'object' &&
        settings.payload instanceof Stream === false &&
        !Buffer.isBuffer(settings.payload)) {

        settings.payload = JSON.stringify(settings.payload);

        if (!settings.headers['content-type']) {
            settings.headers['content-type'] = 'application/json';
        }
    }

    const isBuffer = Buffer.isBuffer(settings.payload);
    if ((typeof settings.payload === 'string' || isBuffer) &&
        !settings.headers['content-length']) {

        settings.headers['content-length'] = isBuffer
            ? settings.payload.length
            : Buffer.byteLength(settings.payload);
    }

    // Request

    return new Promise((resolve, reject) => {
        internals.request(url, settings, (error, response) => {
            if (error) {
                return reject(error);
            }

            return resolve(response);
        });
    });
};

internals.normalizeHeaders = function (headers) {
    const normalized = {};
    for (const key of Object.keys(headers)) {
        normalized[key.toLowerCase()] = headers[key];
    }

    return normalized;
};

internals.request = function (url, settings, callback) {
    // Parse url

    const parsedUrl = new URL.URL(url);

    // Construct request options

    const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        protocol: parsedUrl.protocol,
        headers: settings.headers,
        method: settings.method,
        agent: settings.agent,
        timeout: settings.timeout,
    };

    if (parsedUrl.port) {
        options.port = Number(parsedUrl.port);
    }

    if (parsedUrl.username ||
        parsedUrl.password) {

        options.auth = `${parsedUrl.username}:${parsedUrl.password}`;
    }

    // Request

    const client = options.protocol === 'https:' ? Https : Http;
    const request = client.request(options);

    const finalize = (error, response) => {
        request.destroy();
        request.removeAllListeners();
        callback(error, response);
    };

    request.once('error', (error) => {
        finalize(error);
    });

    request.once('response', (response) => {
        const redirectMethod = internals.redirectMethod(response.statusCode, options.method, settings);

        if (!redirectMethod) {
            internals.read(response, settings, finalize);
            return;
        }

        // Redirect

        response.destroy();

        if (!settings.redirects) {
            finalize(new Error('Maximum redirects reached'));
            return;
        }

        let location = response.headers.location;
        if (!location) {
            finalize(new Error('Redirect without location'));
            return;
        }

        // Process location

        if (!internals.protocolRx.test(location)) {
            location = URL.resolve(parsedUrl.href, location);
        }

        // Modify settings

        if (redirectMethod === 'GET' ||
            redirectMethod === 'HEAD') {

            delete settings.payload;
            delete settings.headers['content-length'];
            delete settings.headers['content-type'];
        }

        if (settings.payload instanceof Stream) {
            finalize(new Error('Cannot follow redirects with stream payloads'));
            return;
        }

        settings.method = redirectMethod;
        settings.redirects--;

        internals.request(location, settings, finalize);
    });

    // Write payload

    if (settings.payload) {
        if (settings.payload instanceof Stream) {
            settings.payload.pipe(request);
            return;
        }

        request.write(settings.payload);
    }

    request.end();
};

internals.redirectMethod = function (code, method, settings) {
    switch (code) {
        case 301:
        case 302: return settings.redirectMethod; // 301 and 302 allows changing methods
        case 303: return 'GET'; // 303 requires the method to be GET
        case 307:
        case 308: return method; // 307 and 308 does not allow the method to change
    }
};

internals.read = function (response, settings, callback) {
    // Setup reader

    const reader = new internals.Reader(settings.maxBytes);

    const finalize = (error, content) => {
        reader.destroy();
        reader.removeAllListeners();
        callback(error, content);
    };

    reader.once('error', (error) => {
        finalize(error);
    });

    reader.once('finish', () => {
        const contentType = response.headers['content-type'] || '';
        const mime = contentType.split(';')[0].trim().toLowerCase();
        let payload = reader.content();

        if (mime === 'application/json') {
            try {
                payload = JSON.parse(payload);
            }
            catch (error) {
                finalize(new Error(`Failed to parse JSON: ${error.message}`));
                return;
            }
        }

        finalize(null, {
            payload,
            headers: response.headers,
            statusCode: response.statusCode,
            statusMessage: response.statusMessage,
            raw: response,
        });
    });

    // Decompress

    if (!settings.gzip) {
        response.pipe(reader);
        return;
    }

    const contentEncoding = response.headers['content-encoding'] || '';

    if (settings.method === 'HEAD' ||
        !contentEncoding ||
        response.statusCode === 204 ||
        response.statusCode === 304) {

        response.pipe(reader);
        return;
    }

    if (contentEncoding === 'gzip' ||
        contentEncoding === 'x-gzip') {

        const gunzip = Zlib.createGunzip();

        gunzip.once('error', (error) => {
            gunzip.destroy();
            gunzip.removeAllListeners();

            finalize(new Error(`Failed to decompress: ${error.message}`));
        });

        response.pipe(gunzip).pipe(reader);
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
        return Buffer.concat(this.buffers, this.length).toString();
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
