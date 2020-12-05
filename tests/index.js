'use strict';

const Http = require('http');
const Zlib = require('zlib');
const Stream = require('stream');
const Url = require('url');

const Bone = require('@botsocket/bone');

const Bornite = require('../src');

const internals = {
    baseUrl: 'http://localhost:',
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

        expect(() => Bornite.custom()).toThrow('Options must be provided');
    });

    it('should request from custom instance', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.method).toBe('POST');
            expect(request.url).toBe('/test/test2/test3/test4');
            expect(request.headers.header1).toBe('x');
            expect(request.headers.header2).toBe('y');
            expect(request.headers['content-length']).toBe('18');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            request.pipe(response);
        });

        const custom = Bornite.custom({
            baseUrl: internals.baseUrl + port + '/test/test2',
            method: 'POST',
            headers: {
                header1: 'x',
            },
        });

        const response = await custom.request('/test3/test4', {
            payload: internals.defaultPayload,
            headers: {
                header2: 'y',
            },
        });

        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should override settings provided to custom instance', async () => {

        const custom = Bornite.custom({ method: 'POST' });
        const { server, port } = await internals.server((request, response) => {

            expect(request.method).toBe('GET');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.defaultPayload);
        });

        const response = await custom.get(internals.baseUrl + port);           // Override method

        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });
});

describe('request()', () => {

    it('should throw on incorrect parameters', () => {

        expect(() => Bornite.request(1)).toThrow('Url must be a string');
        expect(() => Bornite.request('x')).toThrow('Option method must be a string');
        expect(() => Bornite.request('x', { method: 1 })).toThrow('Option method must be a string');
        expect(() => Bornite.request('x', { method: 'x', payload: 1 })).toThrow('Option payload must be a string, a buffer, a stream, URLSearchParams or a serializable object');
        expect(() => Bornite.request('x', { method: 'GET', payload: {} })).toThrow('Option payload cannot be provided when method is GET or HEAD');
        expect(() => Bornite.request('x', { method: 'GeT', payload: {} })).toThrow('Option payload cannot be provided when method is GET or HEAD');
        expect(() => Bornite.request('x', { method: 'head', payload: {} })).toThrow('Option payload cannot be provided when method is GET or HEAD');
        expect(() => Bornite.request('x', { method: 'x', redirects: 'x' })).toThrow('Option redirects must be false or a number');
        expect(() => Bornite.request('x', { method: 'x', redirectMethod: 1 })).toThrow('Option redirectMethod must be a string');
        expect(() => Bornite.request('x', { method: 'x', gzip: 1 })).toThrow('Option gzip must be a boolean');
        expect(() => Bornite.request('x', { method: 'x', maxBytes: 'x' })).toThrow('Option maxBytes must be false or a number');
        expect(() => Bornite.request('x', { method: 'x', timeout: 'x' })).toThrow('Option timeout must be a number');
        expect(() => Bornite.request('x', { method: 'x', validateStatus: 'x' })).toThrow('Option validateStatus must be a boolean or a function');
    });

    it('should validate settings from custom instance', () => {

        const custom = Bornite.custom({ method: 'GET' });
        expect(() => custom.request('x', { payload: {} })).toThrow('Option payload cannot be provided when method is GET or HEAD');

        const custom2 = Bornite.custom({ method: 'POST' });
        expect(() => custom2.request('x', { method: 'GET', payload: {} })).toThrow('Option payload cannot be provided when method is GET or HEAD');

        const custom3 = Bornite.custom({ redirects: 5 });
        expect(() => custom3.request('x')).toThrow('Option method must be a string');

        const custom4 = Bornite.custom({ redirects: 'x' });
        expect(() => custom4.get('x')).toThrow('Option redirects must be false or a number');
    });

    it('should perform a get request', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.method).toBe('GET');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.defaultPayload);
        });

        const response = await Bornite.get(internals.baseUrl + port);
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should get json', async () => {

        const { server, port } = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(internals.jsonPayload));
        });

        const response = await Bornite.get(internals.baseUrl + port);
        expect(Bone.equal(response.payload, internals.jsonPayload)).toBe(true);

        server.close();
    });

    it('should reject on corrupted json', async () => {

        const { server, port } = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end('{');
        });

        try {
            await Bornite.get(internals.baseUrl + port);
            throw new Error('');            // Throw dummy message to trigger catch block in case request does not fail
        }
        catch (error) {
            expect(error.message).toBe(`Request to "${internals.baseUrl + port}" failed: Invalid JSON syntax - Unexpected end of JSON input`);
            expect(error.response.statusCode).toBe(200);
            expect(error.response.statusMessage).toBe('OK');
            expect(error.response.payload).toBe('{');
        }

        server.close();
    });

    it('should perform a post request', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.method).toBe('POST');
            expect(request.headers['content-length']).toBe('18');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            request.pipe(response);
        });

        const response = await Bornite.post(internals.baseUrl + port, { payload: internals.defaultPayload });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should perform a post request with json payload', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.headers['content-length']).toBe('27');
            expect(request.headers['content-type']).toBe('application/json');

            response.writeHead(200, { 'Content-Type': 'application/json' });
            request.pipe(response);
        });

        const response = await Bornite.post(internals.baseUrl + port, { payload: internals.jsonPayload });
        expect(Bone.equal(response.payload, internals.jsonPayload)).toBe(true);

        server.close();
    });

    it('should perform a post request with a payload with unicode characters', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.headers['content-length']).toBe('16');
            expect(request.headers['content-type']).toBe('application/json');

            response.writeHead(200, { 'Content-Type': 'application/json' });
            request.pipe(response);
        });

        const payload = { content: 'Ȓ' };
        const response = await Bornite.post(internals.baseUrl + port, { payload });
        expect(Bone.equal(response.payload, payload)).toBe(true);

        server.close();
    });

    it('should perform a post request with buffer payload', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.headers['content-length']).toBe('18');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            request.pipe(response);
        });

        const response = await Bornite.post(internals.baseUrl + port, { payload: internals.bufferPayload });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should perform a post request with stream payload', async () => {

        const { server, port } = await internals.server((request, response) => {

            response.writeHead(200);
            request.pipe(response);
        });

        const response = await Bornite.post(internals.baseUrl + port, { payload: internals.streamPayload });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should perform a post request with URLSearchParams', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.headers['content-type']).toBe('application/x-www-form-urlencoded');
            expect(request.headers['content-length']).toBe('7');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            request.pipe(response);
        });

        const response = await Bornite.post(internals.baseUrl + port, { payload: internals.searchParamsPayload });
        expect(response.payload).toBe(internals.searchParamsPayload.toString());

        server.close();
    });

    it('should perform a post request with custom content-type', async () => {

        const contentType = 'application/json-patch+json';
        const { server, port } = await internals.server((request, response) => {

            expect(request.headers['content-type']).toBe(contentType);

            response.writeHead(200, { 'Content-Type': 'application/json' });
            request.pipe(response);
        });

        const payload = [{ op: 'remove', path: '/test' }];
        const response = await Bornite.post(internals.baseUrl + port, {
            payload,
            headers: {
                'Content-Type': contentType,
            },
        });

        expect(Bone.equal(response.payload, payload)).toBe(true);

        server.close();
    });

    it('should not override content-length if provided', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.headers['content-length']).toBe('18');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            request.pipe(response);
        });

        const response = await Bornite.post(internals.baseUrl + port, {
            payload: internals.defaultPayload,
            headers: {
                'Content-Length': 18,
            },
        });

        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should perform a post request with headers', async () => {

        const { server, port } = await internals.server((request, response) => {

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            request.pipe(response);
        });

        const response = await Bornite.post(internals.baseUrl + port, {
            payload: internals.defaultPayload,
            headers: {
                'User-Agent': 'bornite',
            },
        });

        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should request to an https resource', async () => {

        const response = await Bornite.get('https://www.google.com');

        expect(response.payload.toLowerCase().includes('</html>')).toBe(true);
    });

    it('should not decompress by default', async () => {

        const { server, port } = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip' });
            response.end(internals.gzipPayload);
        });

        const response = await Bornite.get(internals.baseUrl + port);
        expect(response.payload).toBe(internals.gzipPayload.toString());

        server.close();
    });

    it('should decompress if gzip is set to true', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.headers['accept-encoding']).toBe('gzip');

            response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip' });
            response.end(internals.gzipPayload);
        });

        const response = await Bornite.get(internals.baseUrl + port, { gzip: true });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should decompress json', async () => {

        const gzipped = Zlib.gzipSync(JSON.stringify(internals.jsonPayload));
        const { server, port } = await internals.server((request, response) => {

            expect(request.headers['accept-encoding']).toBe('gzip');

            response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' });
            response.end(gzipped);
        });

        const response = await Bornite.get(internals.baseUrl + port, { gzip: true });
        expect(Bone.equal(response.payload, internals.jsonPayload)).toBe(true);

        server.close();
    });

    it('should not decompress if no Content-Encoding is specified', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.headers['accept-encoding']).toBe('gzip');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.gzipPayload);
        });

        const response = await Bornite.get(internals.baseUrl + port, { gzip: true });
        expect(response.payload).toBe(internals.gzipPayload.toString());

        server.close();
    });

    it('should decompress for x-gzip encoding', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.headers['accept-encoding']).toBe('gzip');

            response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'x-gzip' });
            response.end(internals.gzipPayload);
        });

        const response = await Bornite.get(internals.baseUrl + port, { gzip: true });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should not decompress any other Content-Encoding', async () => {

        const { server, port } = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'deflate' });
            response.end(internals.gzipPayload);
        });

        const response = await Bornite.get(internals.baseUrl + port, { gzip: true });
        expect(response.payload).toBe(internals.gzipPayload.toString());

        server.close();
    });

    it('should throw on corrupted compression', async () => {

        const { server, port } = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip' });
            response.end(internals.gzipPayload.toString() + 'some random stuff that is not compressed');
        });

        try {
            await Bornite.get(internals.baseUrl + port, { gzip: true });
            throw new Error('');            // Throw dummy message to trigger catch block in case request does not fail
        }
        catch (error) {
            expect(error.message).toBe(`Request to "${internals.baseUrl + port}" failed: Decompression error - incorrect header check`);
            expect(error.response.statusCode).toBe(200);
            expect(error.response.statusMessage).toBe('OK');
            expect(error.response.payload).toBe(undefined);             // Failed at decompression step, therefore no payload will be returned
        }

        server.close();
    });

    it('should handle basic authentication', async () => {

        const auth = 'username:password';
        const encoded = Buffer.from(auth).toString('base64');
        const { server, port } = await internals.server((request, response) => {

            expect(request.headers.authorization).toBe(`Basic ${encoded}`);

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.defaultPayload);
        });

        const response = await Bornite.get(`http://${auth}@localhost:${port}/`);
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should handle basic authentication without username', async () => {

        const auth = ':password';
        const encoded = Buffer.from(auth).toString('base64');
        const { server, port } = await internals.server((request, response) => {

            expect(request.headers.authorization).toBe(`Basic ${encoded}`);

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.defaultPayload);
        });

        const response = await Bornite.get(`http://${auth}@localhost:${port}/`);
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should reject if response payload exceeds maxBytes', async () => {

        const { server, port } = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.longPayload);
        });

        await expect(Bornite.get(internals.baseUrl + port, { maxBytes: 100 })).rejects.toThrow('Maximum payload size reached');

        server.close();
    });

    it('should not reject response payload if less than maxBytes', async () => {

        const { server, port } = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.longPayload);
        });

        const response = await Bornite.get(internals.baseUrl + port, { maxBytes: 10000 });
        expect(response.payload).toBe(internals.longPayload);

        server.close();
    });

    it('should handle 4xx errors', async () => {

        const { server, port } = await internals.server((_, response) => {

            response.writeHead(404);
            response.end();
        });

        const response = await Bornite.get(internals.baseUrl + port);

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

        const { server, port } = await internals.server((_, response) => {

            response.end();
        });

        const promise = Bornite.get(internals.baseUrl + port);

        request.emit('error', new Error('Some error'));

        await expect(promise).rejects.toThrow('Some error');

        server.close();
        Http.request = original;                                // eslint-disable-line require-atomic-updates
    });

    it('should reject when host is unavailable', async () => {

        await expect(Bornite.get('http://localhost')).rejects.toThrow('connect ECONNREFUSED 127.0.0.1');
    });

    it('should perform a patch request', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.method).toBe('PATCH');

            response.end();
        });

        await Bornite.patch(internals.baseUrl + port);

        server.close();
    });

    it('should perform a put request', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.method).toBe('PUT');

            response.end();
        });

        await Bornite.put(internals.baseUrl + port);

        server.close();
    });

    it('should perform a delete request', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.method).toBe('DELETE');

            response.end();
        });

        await Bornite.delete(internals.baseUrl + port);

        server.close();
    });

    it('should pass custom agents to Http.request', async () => {

        const agent = new Http.Agent({ maxSockets: 5 });
        const original = Http.request;
        let calls = 0;

        Http.request = function (options) {

            calls++;
            expect(options.agent).toBe(agent);

            return original(options);
        };

        const { server, port } = await internals.server((_, response) => {

            response.end();
        });

        await Bornite.get(internals.baseUrl + port, { agent });

        expect(calls).toBe(1);

        server.close();
        Http.request = original; // eslint-disable-line require-atomic-updates
    });

    it('should resolve urls from baseUrl', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.url).toBe('/test');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.defaultPayload);
        });

        const response = await Bornite.get('/test', { baseUrl: internals.baseUrl + port });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should ignore baseUrl when path is absolute', async () => {

        const response = await Bornite.get('https://www.google.com', { baseUrl: 'http://localhost' });
        expect(response.payload.toLowerCase().includes('</html>')).toBe(true);
    });

    it('should append paths to baseUrl', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.url).toBe('/test/test2/test3/test4');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.defaultPayload);
        });

        const response = await Bornite.get('/test3/test4', { baseUrl: internals.baseUrl + port + '/test/test2' });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should append paths to baseUrl with trailing "/"', async () => {

        const { server, port } = await internals.server((request, response) => {

            expect(request.url).toBe('/test/test2/test3/test4');

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            response.end(internals.defaultPayload);
        });

        const response = await Bornite.get('test3/test4', { baseUrl: internals.baseUrl + port + '/test/test2/' });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    it('should throw if validateStatus returns false (default validator)', async () => {

        const { server, port } = await internals.server((_, response) => {

            response.writeHead(404, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(internals.jsonPayload));
        });

        try {
            await Bornite.get(internals.baseUrl + port, { validateStatus: true });
            throw new Error('');            // Throw dummy message to trigger catch block in case request does not fail
        }
        catch (error) {
            expect(error.message).toBe(`Request to "${internals.baseUrl + port}" failed: Server responded with status code 404 - Not Found`);
            expect(error.response.statusCode).toBe(404);
            expect(error.response.statusMessage).toBe('Not Found');
            expect(Bone.equal(error.response.payload, internals.jsonPayload)).toBe(true);
        }

        server.close();
    });

    it('should throw if validateStatus returns false (custom validator)', async () => {

        const { server, port } = await internals.server((_, response) => {

            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(internals.jsonPayload));
        });

        try {
            await Bornite.get(internals.baseUrl + port, { validateStatus: () => false });
            throw new Error('');            // Throw dummy message to trigger catch block in case request does not fail
        }
        catch (error) {
            expect(error.message).toBe(`Request to "${internals.baseUrl + port}" failed: Server responded with status code 200 - OK`);
            expect(error.response.statusCode).toBe(200);
            expect(error.response.statusMessage).toBe('OK');
            expect(Bone.equal(error.response.payload, internals.jsonPayload)).toBe(true);
        }

        server.close();
    });

    it('should continue if validateStatus returns true', async () => {

        const { server, port } = await internals.server((request, response) => {

            response.writeHead(200, { 'Content-Type': 'text/plain' });
            request.pipe(response);
        });

        const response = await Bornite.post(internals.baseUrl + port, { payload: internals.defaultPayload, validateStatus: true });
        expect(response.payload).toBe(internals.defaultPayload);

        server.close();
    });

    describe('Redirects', () => {

        it('should not follow redirects by default', async () => {

            const { server, port } = await internals.server((_, response) => {

                response.writeHead(301, { Location: '/test' });
                response.end();
            });

            await expect(Bornite.post(internals.baseUrl + port)).rejects.toThrow('Maximum redirects reached');

            server.close();
        });

        it('should not follow redirects if redirects is set to false', async () => {

            const { server, port } = await internals.server((_, response) => {

                response.writeHead(301, { Location: '/test' });
                response.end();
            });

            await expect(Bornite.post(internals.baseUrl + port, { redirects: false })).rejects.toThrow('Maximum redirects reached');

            server.close();
        });

        it('should reject stream payloads', async () => {

            const { server, port } = await internals.server((_, response) => {

                response.writeHead(301, { Location: '/test' });
                response.end();
            });

            await expect(Bornite.post(internals.baseUrl + port, { redirects: 1, payload: internals.streamPayload }))
                .rejects
                .toThrow('Cannot follow redirects with stream payloads');

            server.close();
        });

        it('should follow all redirects if redirects is set to Infinity', async () => {

            let count = 0;
            const { server, port } = await internals.server((request, response) => {

                if (count < 3) {
                    response.writeHead(301, { Location: '/test' });
                    response.end();
                    count++;
                    return;
                }

                expect(request.url).toBe('/test');
                expect(request.method).toBe('POST');
                expect(request.headers['content-length']).toBe('18');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                request.pipe(response);
            });

            const response = await Bornite.post(internals.baseUrl + port, { redirects: Infinity, payload: internals.defaultPayload });
            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should reject if reaches maximum redirects', async () => {

            let count = 0;
            const { server, port } = await internals.server((_, response) => {

                if (count < 2) {
                    response.writeHead(301, { Location: '/test' });
                    response.end();
                    count++;
                }
            });

            await expect(Bornite.post(internals.baseUrl + port, { redirects: 1 })).rejects.toThrow('Maximum redirects reached');

            server.close();
        });

        it('should reject on redirects without headers', async () => {

            const { server, port } = await internals.server((_, response) => {

                response.writeHead(301);
                response.end();
            });

            await expect(Bornite.post(internals.baseUrl + port, { redirects: 1 })).rejects.toThrow('Redirect without location');

            server.close();
        });

        it('should allow changing redirect methods', async () => {

            let redirected = false;
            const { server, port } = await internals.server((request, response) => {

                if (!redirected) {
                    response.writeHead(301, { Location: '/test' });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/test');
                expect(request.method).toBe('POST');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end(internals.defaultPayload);
            });

            const response = await Bornite.get(internals.baseUrl + port, { redirects: 1, redirectMethod: 'POST' });
            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should strip payload if redirect method is GET (302)', async () => {

            let redirected = false;
            const { server, port } = await internals.server(async (request, response) => {

                if (!redirected) {
                    response.writeHead(302, { Location: '/test' });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/test');
                expect(request.headers['content-type']).toBe(undefined);
                expect(request.headers['content-length']).toBe(undefined);

                const payload = await internals.read(request);
                expect(payload).toBe('');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end(internals.defaultPayload);
            });

            const response = await Bornite.post(internals.baseUrl + port, {
                redirects: 1,
                redirectMethod: 'GET',
                payload: internals.jsonPayload,
            });

            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should strip payload for 303 redirects', async () => {

            let redirected = false;
            const { server, port } = await internals.server(async (request, response) => {

                if (!redirected) {
                    response.writeHead(303, { Location: '/test' });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/test');
                expect(request.headers['content-type']).toBe(undefined);
                expect(request.headers['content-length']).toBe(undefined);

                const payload = await internals.read(request);
                expect(payload).toBe('');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.end(internals.defaultPayload);
            });

            const response = await Bornite.post(internals.baseUrl + port, {
                redirects: 1,
                payload: internals.jsonPayload,
            });

            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should not override redirect method (307)', async () => {

            let redirected = false;
            const { server, port } = await internals.server((request, response) => {

                if (!redirected) {
                    response.writeHead(307, { Location: '/test' });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/test');
                expect(request.method).toBe('POST');
                expect(request.headers['content-length']).toBe('18');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                request.pipe(response);
            });

            const response = await Bornite.post(internals.baseUrl + port, {
                redirects: 1,
                redirectMethod: 'GET',
                payload: internals.defaultPayload,
            });

            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should not override redirect method (308)', async () => {

            let redirected = false;
            const { server, port } = await internals.server((request, response) => {

                if (!redirected) {
                    response.writeHead(308, { Location: '/test' });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/test');
                expect(request.method).toBe('POST');
                expect(request.headers['content-length']).toBe('18');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                request.pipe(response);
            });

            const response = await Bornite.post(internals.baseUrl + port, {
                redirects: 1,
                redirectMethod: 'GET',
                payload: internals.defaultPayload,
            });

            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should redirect with absolute locations', async () => {

            let redirected = false;
            const { server, port } = await internals.server((request, response) => {

                if (!redirected) {
                    response.writeHead(301, { Location: internals.baseUrl + port + '/test' });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/test');
                expect(request.headers['content-length']).toBe('18');

                response.writeHead(200, { 'Content-Type': 'text/plain' });
                request.pipe(response);
            });

            const response = await Bornite.post(internals.baseUrl + port, { redirects: 1, payload: internals.defaultPayload });
            expect(response.payload).toBe(internals.defaultPayload);

            server.close();
        });

        it('should redirect with json', async () => {

            let redirected = false;
            const { server, port } = await internals.server((request, response) => {

                if (!redirected) {
                    response.writeHead(301, { Location: '/test' });
                    response.end();
                    redirected = true;
                    return;
                }

                expect(request.url).toBe('/test');
                expect(request.headers['content-length']).toBe('27');
                expect(request.headers['content-type']).toBe('application/json');

                response.writeHead(200, { 'Content-Type': 'application/json' });
                request.pipe(response);
            });

            const response = await Bornite.post(internals.baseUrl + port, { redirects: 1, payload: internals.jsonPayload });
            expect(Bone.equal(response.payload, internals.jsonPayload)).toBe(true);

            server.close();
        });

        it('should redirect to a different host', async () => {

            const { server, port } = await internals.server((_, response) => {

                response.writeHead(301, { Location: 'https://www.google.com' });
                response.end();
            });

            const response = await Bornite.get(internals.baseUrl + port, { redirects: 1 });
            expect(response.payload.toLowerCase().includes('</html>')).toBe(true);

            server.close();
        });
    });
});

internals.server = function (handler) {

    const server = Http.createServer(handler);

    return new Promise((resolve) => {

        server.listen(0, () => {

            resolve({ server, port: server.address().port });
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
