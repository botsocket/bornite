'use strict';

const Http = require('http');
const Https = require('https');
const Url = require('url');
const Stream = require('stream');
const Zlib = require('zlib');

const Dust = require('@botbind/dust');

const internals = {
    protocolRx: /^https?:/i,
    defaults: {
        headers: {},
        redirects: 0,
        gzip: false,
        maxBytes: 0,
    },
};

internals.Radar = class {
    constructor(settings) {

        this._settings = settings || internals.defaults;
    }

    _applyOptions(options) {

        return {
            ...this._settings,
            ...options,
            headers: {
                ...this._settings.headers,
                ...options.headers,
            },
        };
    }

    custom(options) {

        Dust.assert(options !== undefined, 'Options must be provided');

        const settings = this._applyOptions(options);
        return new internals.Radar(settings);
    }

    request(url, options = {}) {

        // Process parameters

        Dust.assert(typeof url === 'string', 'Url must be a string');

        const settings = this._applyOptions(options);

        Dust.assert(typeof settings.method === 'string', 'Option method must be a string');
        Dust.assert(settings.baseUrl === undefined || typeof settings.baseUrl === 'string', 'Option baseUrl must be a string');
        Dust.assert(!['GET', 'HEAD'].includes(settings.method.toUpperCase()) || settings.payload === undefined, 'Option payload cannot be provided when method is GET or HEAD');
        Dust.assert(settings.payload === undefined || typeof settings.payload === 'object' || typeof settings.payload === 'string', 'Option payload must be a string, a buffer, a stream, URLSearchParams or a serializable object');
        Dust.assert(settings.agent === undefined || typeof settings.agent === 'object', 'Option agent must be an object');
        Dust.assert(settings.redirects === undefined || typeof settings.redirects === 'number' || settings.redirects === false, 'Option redirects must be false or a number');
        Dust.assert(settings.redirectMethod === undefined || typeof settings.redirectMethod === 'string', 'Option redirectMethod must be a string');
        Dust.assert(settings.gzip === undefined || typeof settings.gzip === 'boolean', 'Option gzip must be a boolean');
        Dust.assert(settings.maxBytes === undefined || typeof settings.maxBytes === 'number' || settings.maxBytes === false, 'Option maxBytes must be false or a number');
        Dust.assert(settings.timeout === undefined || typeof settings.timeout === 'number', 'Option timeout must be a number');

        // Normalize settings

        settings.method = settings.method.toUpperCase();
        settings.redirectMethod = settings.redirectMethod ? settings.redirectMethod.toUpperCase() : settings.method;

        // Normalize headers and payloads

        const headers = new internals.Headers(settings.headers);

        if (settings.gzip) {
            headers.set('accept-encoding', 'gzip');
        }

        if (settings.payload instanceof Url.URLSearchParams) {
            settings.payload = settings.payload.toString();
            headers.set('content-type', 'application/x-www-form-urlencoded');
        }

        if (typeof settings.payload === 'object' &&
            settings.payload instanceof Stream === false &&
            !Buffer.isBuffer(settings.payload)) {

            settings.payload = JSON.stringify(settings.payload);
            headers.set('content-type', 'application/json');
        }

        // Calculate Content-Length

        const isBuffer = Buffer.isBuffer(settings.payload);
        if (typeof settings.payload === 'string' || isBuffer) {

            const length = isBuffer ? settings.payload.length : Buffer.byteLength(settings.payload);
            headers.set('content-length', length);
        }

        settings.headers = headers.normalized;          // Convert internal Header class to normal headers object

        // Request

        return new Promise((resolve, reject) => {

            internals.request(url, settings, (error, response) => {

                if (error) {
                    return reject(error);
                }

                return resolve(response);
            });
        });
    }
};

internals.shortcut = function () {

    for (const shortcut of ['get', 'post', 'put', 'patch', 'delete']) {
        internals.Radar.prototype[shortcut] = function (url, options = {}) {

            Dust.assert(!options.method, 'Option method is not allowed');

            return this.request(url, { ...options, method: shortcut.toUpperCase() });
        };
    }
};

internals.shortcut();

module.exports = new internals.Radar();

internals.Headers = class {
    constructor(headers) {

        const normalized = {};
        for (const key of Object.keys(headers)) {
            normalized[key.toLowerCase()] = headers[key];
        }

        this.normalized = normalized;
    }

    set(name, value) {

        if (!this.normalized[name]) {
            this.normalized[name] = value;
        }
    }
};

internals.request = function (url, settings, callback) {

    // Parse url

    const parsedUrl = new Url.URL(url, settings.baseUrl);

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
            location = Url.resolve(parsedUrl.href, location);
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
        case 302: return settings.redirectMethod;                   // 301 and 302 allows changing methods
        case 303: return 'GET';                                     // 303 requires the method to be GET
        case 307:
        case 308: return method;                                    // 307 and 308 does not allow the method to change
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

        if (this.maxBytes &&
            this.length > this.maxBytes) {

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
