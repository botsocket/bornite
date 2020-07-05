'use strict';

const Dust = require('@botbind/dust');
const Express = require('express');

const Radar = require('../src');

const internals = {
    server: null,
    baseUrl: 'http://localhost:3000',
};

describe('request()', () => {
    afterEach(() => {
        if (internals.server) {
            internals.server.close();
        }
    });

    describe('GET', () => {
        it('should get json', async () => {
            const endpoint = '/json';
            const json = {
                a: 1,
                b: 'x',
                c: {
                    d: 1,
                },
            };

            internals.createServer((app) => {
                app.get(endpoint, (_, response) => {
                    response.json(json);
                });
            });

            const response = await internals.request(endpoint, { method: 'GET' });
            expect(Dust.equal(response.payload, json)).toBe(true);
        });

        it('should get raw text', async () => {
            const endpoint = '/hello';
            const text = '<h1>Hello</h1>';

            internals.createServer((app) => {
                app.get(endpoint, (_, response) => {
                    response.send(text);
                });
            });

            const response = await internals.request(endpoint, { method: 'GET' });
            expect(Dust.equal(response.payload, text)).toBe(true);
        });
    });
});

internals.createServer = function (setup) {
    const app = Express();

    setup(app);
    internals.server = app.listen(3000);
};

internals.request = function (url, options) {
    return Radar.request(internals.baseUrl + url, options);
};
