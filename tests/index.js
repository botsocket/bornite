'use strict';

const Http = require('http');
const Zlib = require('zlib');
const Stream = require('stream');
const Url = require('url');

const Dust = require('@botbind/dust');

const Radar = require('../src');

const internals = {
    baseUrl: 'http://localhost:3000/',
    defaultPayload: 'Some random string',
    jsonPayload: {
        a: 1,
        b: 'x',
        c: {
            d: 1,
        },
    },
    searchParamsPayload: new Url.URLSearchParams({ a: 1, b: 'x' }),
};

internals.longPayload = new Array(100).join(internals.defaultPayload);
internals.gzipPayload = Zlib.gzipSync(internals.defaultPayload);
internals.bufferPayload = Buffer.from(internals.defaultPayload);
internals.streamPayload = new Stream.Readable({
    read() {

        this.push(internals.defaultPayload);
        this.push(null);
    },
});

describe('custom()', () => {

    it('should throw on incorrect parameters', () => {

        expect(() => Radar.custom()).toThrow('Options must be provided');
    });

    it('should request from custom instance', async () => {

        const custom = Radar.custom({
            baseUrl: internals.baseUrl,
            method: 'POST',
            headers: {
                header1: 'x',
            },
        });

        const server = await internals.server((request, response) => {

            expect(request.method).toBe('POST');
            expect(request.url).toBe('/test');
            expect(request.headers.header1).toBe('x');
            expect(request.headers.header2).toBe('y');
            expect(request.headers['content-length']).toBe('18');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            request.pipe(response);
        });

        const response = await custom.request('/test', {
            payload: internals.defaultPayload,
            headers: {
                header2: 'y',
            },
        });

        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should override settings provided to custom instance', async () => {

        const custom = Radar.custom({ method: 'POST' });
        const server = await internals.server((request, response) => {

            expect(request.method).toBe('GET');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.defaultPayload);
        });

        const response = await custom.get(internals.baseUrl);           // Override method

        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });
});

describe('request()', () => {

    it('should throw on incorrect parameters', () => {

        expect(() => Radar.request(1)).toThrow('Url must be a string');
        expect(() => Radar.request('x')).toThrow('Option method must be a string');
        expect(() => Radar.request('x', { method: 1 })).toThrow('Option method must be a string');
        expect(() => Radar.request('x', { method: 'x', payload: 1 })).toThrow('Option payload must be a string, a buffer, a stream or a serializable object');
        expect(() => Radar.request('x', { method: 'GET', payload: {} })).toThrow('Option payload cannot be provided when method is GET or HEAD');
        expect(() => Radar.request('x', { method: 'GeT', payload: {} })).toThrow('Option payload cannot be provided when method is GET or HEAD');
        expect(() => Radar.request('x', { method: 'head', payload: {} })).toThrow('Option payload cannot be provided when method is GET or HEAD');
        expect(() => Radar.request('x', { method: 'x', redirects: 'x' })).toThrow('Option redirects must be false or a number');
        expect(() => Radar.request('x', { method: 'x', redirectMethod: 1 })).toThrow('Option redirectMethod must be a string');
        expect(() => Radar.request('x', { method: 'x', gzip: 1 })).toThrow('Option gzip must be a boolean');
        expect(() => Radar.request('x', { method: 'x', maxBytes: 'x' })).toThrow('Option maxBytes must be false or a number');
        expect(() => Radar.request('x', { method: 'x', timeout: 'x' })).toThrow('Option timeout must be a number');
    });

    it('should validate settings from custom instance', () => {

        const custom = Radar.custom({ method: 'GET' });
        expect(() => custom.request('x', { payload: {} })).toThrow('Option payload cannot be provided when method is GET or HEAD');

        const custom2 = Radar.custom({ method: 'POST' });
        expect(() => custom2.request('x', { method: 'GET', payload: {} })).toThrow('Option payload cannot be provided when method is GET or HEAD');

        const custom3 = Radar.custom({ redirects: 5 });
        expect(() => custom3.request('x')).toThrow('Option method must be a string');

        const custom4 = Radar.custom({ redirects: 'x' });
        expect(() => custom4.get('x')).toThrow('Option redirects must be false or a number');
    });

    it('should perform a get request', async () => {

        const server = await internals.server((request, response) => {

            expect(request.method).toBe('GET');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.defaultPayload);
        });

        const response = await Radar.get(internals.baseUrl);
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should get json', async () => {

        const server = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(internals.jsonPayload));
        });

        const response = await Radar.get(internals.baseUrl);
        expect(Dust.equal(response.payload, internals.jsonPayload)).toBe(true);

        server.close();
    });

    it('should reject on corrupted json', async () => {

        const server = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end('{');
        });

        await expect(Radar.get(internals.baseUrl)).rejects.toThrow('Failed to parse JSON: Unexpected end of JSON input');

        server.close();
    });

    it('should perform a post request', async () => {

        const server = await internals.server((request, response) => {

            expect(request.method).toBe('POST');
            expect(request.headers['content-length']).toBe('18');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            request.pipe(response);
        });

        const response = await Radar.post(internals.baseUrl, { payload: internals.defaultPayload });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should perform a post request with json payload', async () => {

        const server = await internals.server((request, response) => {

            expect(request.headers['content-length']).toBe('27');
            expect(request.headers['content-type']).toBe('application/json');

            response.writeHead(200, { 'Content-Type': 'application/json' });
            request.pipe(response);
        });

        const response = await Radar.post(internals.baseUrl, { payload: internals.jsonPayload });
        expect(Dust.equal(response.payload, internals.jsonPayload)).toBe(true);

        server.close();
    });

    it('should perform a post request with a payload with unicode characters', async () => {

        const server = await internals.server((request, response) => {

            expect(request.headers['content-length']).toBe('16');
            expect(request.headers['content-type']).toBe('application/json');

            response.writeHead(200, { 'Content-Type': 'application/json' });
            request.pipe(response);
        });

        const payload = { content: 'Ȓ' };
        const response = await Radar.post(internals.baseUrl, { payload });
        expect(Dust.equal(response.payload, payload)).toBe(true);

        server.close();
    });

    it('should perform a post request with buffer payload', async () => {

        const server = await internals.server((request, response) => {

            expect(request.headers['content-length']).toBe('18');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            request.pipe(response);
        });

        const response = await Radar.post(internals.baseUrl, { payload: internals.bufferPayload });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should perform a post request with stream payload', async () => {

        const server = await internals.server((request, response) => {

            response.writeHead(200);
            request.pipe(response);
        });

        const response = await Radar.post(internals.baseUrl, { payload: internals.streamPayload });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should perform a post request with URLSearchParams', async () => {

        const server = await internals.server((request, response) => {

            expect(request.headers['content-type']).toBe('application/x-www-form-urlencoded');
            expect(request.headers['content-length']).toBe('7');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            request.pipe(response);
        });

        const response = await Radar.post(internals.baseUrl, { payload: internals.searchParamsPayload });
        expect(response.payload).toBe(internals.searchParamsPayload.toString());

        server.close();
    });

    it('should perform a post request with custom content-type', async () => {

        const contentType = 'application/json-patch+json';
        const server = await internals.server((request, response) => {

            expect(request.headers['content-type']).toBe(contentType);

            response.writeHead(200, { 'Content-Type': 'application/json' });
            request.pipe(response);
        });

        const payload = [{ op: 'remove', path: '/test' }];
        const response = await Radar.post(internals.baseUrl, {
            payload,
            headers: {
                'Content-Type': contentType,
            },
        });

        expect(Dust.equal(response.payload, payload)).toBe(true);

        server.close();
    });

    it('should not override content-length if provided', async () => {

        const server = await internals.server((request, response) => {

            expect(request.headers['content-length']).toBe('18');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            request.pipe(response);
        });

        const response = await Radar.post(internals.baseUrl, {
            payload: internals.defaultPayload,
            headers: {
                'Content-Length': 18,
            },
        });

        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should perform a post request with headers', async () => {

        const server = await internals.server((request, response) => {

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            request.pipe(response);
        });

        const response = await Radar.post(internals.baseUrl, {
            payload: internals.defaultPayload,
            headers: {
                'User-Agent': 'radar',
            },
        });

        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should request to an https resource', async () => {

        const response = await Radar.get('https://www.google.com/');

        expect(response.payload.toLowerCase().includes('</html>')).toBe(true);
    });

    it('should not decompress by default', async () => {

        const server = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip' });
            response.end(internals.gzipPayload);
        });

        const response = await Radar.get(internals.baseUrl);
        expect(response.payload).toBe(internals.gzipPayload.toString());

        server.close();
    });

    it('should decompress if gzip is set to true', async () => {

        const server = await internals.server((request, response) => {

            expect(request.headers['accept-encoding']).toBe('gzip');

            response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip' });
            response.end(internals.gzipPayload);
        });

        const response = await Radar.get(internals.baseUrl, { gzip: true });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should decompress json', async () => {

        const gzipped = Zlib.gzipSync(JSON.stringify(internals.jsonPayload));
        const server = await internals.server((request, response) => {

            expect(request.headers['accept-encoding']).toBe('gzip');

            response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
            response.end(gzipped);
        });

        const response = await Radar.get(internals.baseUrl, { gzip: true });
        expect(Dust.equal(response.payload, internals.jsonPayload)).toBe(true);

        server.close();
    });

    it('should not decompress if no Content-Encoding is specified', async () => {

        const server = await internals.server((request, response) => {

            expect(request.headers['accept-encoding']).toBe('gzip');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.gzipPayload);
        });

        const response = await Radar.get(internals.baseUrl, { gzip: true });
        expect(response.payload).toBe(internals.gzipPayload.toString());

        server.close();
    });

    it('should decompress for x-gzip encoding', async () => {

        const server = await internals.server((request, response) => {

            expect(request.headers['accept-encoding']).toBe('gzip');

            response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'x-gzip' });
            response.end(internals.gzipPayload);
        });

        const response = await Radar.get(internals.baseUrl, { gzip: true });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should not decompress any other Content-Encoding', async () => {

        const server = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'deflate' });
            response.end(internals.gzipPayload);
        });

        const response = await Radar.get(internals.baseUrl, { gzip: true });
        expect(response.payload).toBe(internals.gzipPayload.toString());

        server.close();
    });

    it('should throw on corrupted compression', async () => {

        const server = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip' });
            response.end(internals.gzipPayload.toString() + 'some random stuff that is not compressed');
        });

        await expect(Radar.get(internals.baseUrl, { gzip: true })).rejects.toThrow('Failed to decompress: incorrect header check');

        server.close();
    });

    it('should handle basic authentication', async () => {

        const auth = 'username:password';
        const encoded = Buffer.from(auth).toString('base64');
        const server = await internals.server((request, response) => {

            expect(request.headers.authorization).toBe(`Basic ${encoded}`);

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.defaultPayload);
        });

        const response = await Radar.get(`http://${auth}@localhost:3000/`);
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should handle basic authentication without username', async () => {

        const auth = ':password';
        const encoded = Buffer.from(auth).toString('base64');
        const server = await internals.server((request, response) => {

            expect(request.headers.authorization).toBe(`Basic ${encoded}`);

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.defaultPayload);
        });

        const response = await Radar.get(`http://${auth}@localhost:3000/`);
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should reject if response payload exceeds maxBytes', async () => {

        const server = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.longPayload);
        });

        await expect(Radar.get(internals.baseUrl, { maxBytes: 100 })).rejects.toThrow('Maximum payload size reached');

        server.close();
    });

    it('should not reject response payload if less than maxBytes', async () => {

        const server = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.longPayload);
        });

        const response = await Radar.get(internals.baseUrl, { maxBytes: 10000 });
        expect(response.payload).toBe(internals.longPayload);

        server.close();
    });

    it('should handle 4xx errors', async () => {

        const server = await internals.server((_, response) => {

            response.writeHead(404);
            response.end();
        });

        const response = await Radar.get(internals.baseUrl);

        expect(response.statusCode).toBe(404);
        expect(response.statusMessage).toBe('Not Found');

        server.close();
    });

    it('should handle request errors', async () => {

        const original = Http.request;
        const request = new Stream.Writable();

        Http.request = function () {

            return request;
        };

        const server = await internals.server((_, response) => {

            response.end();
        });

        const promise = Radar.get(internals.baseUrl);

        request.emit('error', new Error('Some error'));

        await expect(promise).rejects.toThrow('Some error');

        server.close();
        Http.request = original;                                // eslint-disable-line require-atomic-updates
    });

    it('should reject when host is unavailable', async () => {

        await expect(Radar.get(internals.baseUrl)).rejects.toThrow('connect ECONNREFUSED 127.0.0.1:3000');
    });

    it('should perform a patch request', async () => {

        const server = await internals.server((request, response) => {

            expect(request.method).toBe('PATCH');

            response.end();
        });

        await Radar.patch(internals.baseUrl);

        server.close();
    });

    it('should perform a put request', async () => {

        const server = await internals.server((request, response) => {

            expect(request.method).toBe('PUT');

            response.end();
        });

        await Radar.put(internals.baseUrl);

        server.close();
    });

    it('should perform a delete request', async () => {

        const server = await internals.server((request, response) => {

            expect(request.method).toBe('DELETE');

            response.end();
        });

        await Radar.delete(internals.baseUrl);

        server.close();
    });

    it('should pass custom agents to Http.request', async () => {

        const agent = new Http.Agent({ maxSockets: 5 });
        const original = Http.request;

        Http.request = function (options) {

            expect(options.agent).toBe(agent);

            return original(options);
        };

        const server = await internals.server((_, response) => {

            response.end();
        });

        await Radar.get(internals.baseUrl, { agent });

        server.close();
        Http.request = original; // eslint-disable-line require-atomic-updates
    });

    it('should resolve urls from baseUrl', async () => {

        const server = await internals.server((request, response) => {

            expect(request.method).toBe('GET');
            expect(request.url).toBe('/test');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.defaultPayload);
        });

        const response = await Radar.get('/test', { baseUrl: internals.baseUrl });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should resolve urls when url host is different from baseUrl', async () => {

        const response = await Radar.get('https://www.google.com/', { baseUrl: internals.baseUrl });
        expect(response.payload.toLowerCase().includes('</html>')).toBe(true);
    });

    describe('Redirects', () => {

        it('should not follow redirects by default', async () => {

            const server = await internals.server((_, response) => {

                response.writeHead(301, { Location: '/' });
                response.end();
            });

            await expect(Radar.post(internals.baseUrl)).rejects.toThrow('Maximum redirects reached');

            server.close();
        });

        it('should not follow redirects if redirects is set to false', async () => {

            const server = await internals.server((_, response) => {

                response.writeHead(301, { Location: '/' });
                response.end();
            });

            await expect(Radar.post(internals.baseUrl, { redirects: false })).rejects.toThrow('Maximum redirects reached');

            server.close();
        });

        it('should reject stream payloads', async () => {

            const server = await internals.server((_, response) => {

                response.writeHead(301, { Location: '/' });
                response.end();
            });

            await expect(Radar.post(internals.baseUrl, { redirects: 1, payload: internals.streamPayload }))
                .rejects
                .toThrow('Cannot follow redirects with stream payloads');

            server.close();
        });

        it('should follow all redirects if redirects is set to Infinity', async () => {

            let count = 0;
            const server = await internals.server((request, response) => {

                if (count < 3) {
                    response.writeHead(301, { Location: '/' });
                    response.end();
                    count++;
                    return;
                }

                expect(request.url).toBe('/');
                expect(request.method).toBe('POST');
                expect(request.headers['content-length']).toBe('18');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                request.pipe(response);
            });

            const response = await Radar.post(internals.baseUrl, { redirects: Infinity, payload: internals.defaultPayload });
            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should reject if reaches maximum redirects', async () => {

            let count = 0;
            const server = await internals.server((_, response) => {

                if (count < 2) {
                    response.writeHead(301, { Location: '/' });
                    response.end();
                    count++;
                }
            });

            await expect(Radar.post(internals.baseUrl, { redirects: 1 })).rejects.toThrow('Maximum redirects reached');

            server.close();
        });

        it('should reject on redirects without headers', async () => {

            const server = await internals.server((_, response) => {

                response.writeHead(301);
                response.end();
            });

            await expect(Radar.post(internals.baseUrl, { redirects: 1 })).rejects.toThrow('Redirect without location');

            server.close();
        });

        it('should allow changing redirect methods', async () => {

            let redirected = false;
            const server = await internals.server((request, response) => {

                if (!redirected) {
                    response.writeHead(301, { Location: '/' });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/');
                expect(request.method).toBe('POST');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end(internals.defaultPayload);
            });

            const response = await Radar.get(internals.baseUrl, { redirects: 1, redirectMethod: 'POST' });
            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should strip payload if redirect method is GET (302)', async () => {

            let redirected = false;
            const server = await internals.server(async (request, response) => {

                if (!redirected) {
                    response.writeHead(302, { Location: '/' });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/');
                expect(request.method).toBe('GET');
                expect(request.headers['content-type']).toBe(undefined);
                expect(request.headers['content-length']).toBe(undefined);

                const payload = await internals.read(request);
                expect(payload).toBe('');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end(internals.defaultPayload);
            });

            const response = await Radar.post(internals.baseUrl, {
                redirects: 1,
                redirectMethod: 'GET',
                payload: internals.jsonPayload,
            });

            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should strip payload for 303 redirects', async () => {

            let redirected = false;
            const server = await internals.server(async (request, response) => {

                if (!redirected) {
                    response.writeHead(303, { Location: '/' });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/');
                expect(request.method).toBe('GET');
                expect(request.headers['content-type']).toBe(undefined);
                expect(request.headers['content-length']).toBe(undefined);

                const payload = await internals.read(request);
                expect(payload).toBe('');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end(internals.defaultPayload);
            });

            const response = await Radar.post(internals.baseUrl, {
                redirects: 1,
                payload: internals.jsonPayload,
            });

            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should not override redirect method (307)', async () => {

            let redirected = false;
            const server = await internals.server((request, response) => {

                if (!redirected) {
                    response.writeHead(307, { Location: '/' });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/');
                expect(request.method).toBe('POST');
                expect(request.headers['content-length']).toBe('18');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                request.pipe(response);
            });

            const response = await Radar.post(internals.baseUrl, {
                redirects: 1,
                redirectMethod: 'GET',
                payload: internals.defaultPayload,
            });

            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should not override redirect method (308)', async () => {

            let redirected = false;
            const server = await internals.server((request, response) => {

                if (!redirected) {
                    response.writeHead(308, { Location: '/' });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/');
                expect(request.method).toBe('POST');
                expect(request.headers['content-length']).toBe('18');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                request.pipe(response);
            });

            const response = await Radar.post(internals.baseUrl, {
                redirects: 1,
                redirectMethod: 'GET',
                payload: internals.defaultPayload,
            });

            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should redirect with absolute locations', async () => {

            let redirected = false;
            const server = await internals.server((request, response) => {

                if (!redirected) {
                    response.writeHead(301, { Location: internals.baseUrl });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/');
                expect(request.headers['content-length']).toBe('18');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                request.pipe(response);
            });

            const response = await Radar.post(internals.baseUrl, { redirects: 1, payload: internals.defaultPayload });
            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should redirect with json', async () => {

            let redirected = false;
            const server = await internals.server((request, response) => {

                if (!redirected) {
                    response.writeHead(301, { Location: '/' });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/');
                expect(request.method).toBe('POST');
                expect(request.headers['content-length']).toBe('27');
                expect(request.headers['content-type']).toBe('application/json');

                response.writeHead(200, { 'Content-Type': 'application/json' });
                request.pipe(response);
            });

            const response = await Radar.post(internals.baseUrl, { redirects: 1, payload: internals.jsonPayload });
            expect(Dust.equal(response.payload, internals.jsonPayload)).toBe(true);

            server.close();
        });

        it('should redirect to a different host', async () => {

            const server = await internals.server((_, response) => {

                response.writeHead(301, { Location: 'https://www.google.com/' });
                response.end();
            });

            const response = await Radar.get(internals.baseUrl, { redirects: 1 });
            expect(response.payload.toLowerCase().includes('</html>')).toBe(true);

            server.close();
        });
    });
});

internals.server = function (handler) {

    const server = Http.createServer(handler);

    return new Promise((resolve) => {

        server.listen(3000, () => {

            resolve(server);
        });
    });
};

internals.read = function (stream) {

    return new Promise((resolve) => {

        const data = [];

        stream.on('data', (chunk) => {

            data.push(chunk);
        });

        stream.once('end', () => {

            resolve(Buffer.concat(data).toString());
        });
    });
};
