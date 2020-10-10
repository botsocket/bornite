import Http = require('http');
import Https = require('https');
import Stream = require('stream');
import Url = require('url');

import Bornite = require('../src');

// custom()

const custom = Bornite.custom({
    method: 'test',
    baseUrl: 'test',
    headers: {
        test: 1,
    },
    agent: new Https.Agent({ maxSockets: Infinity }),
    redirects: 1,
    redirectMethod: 'test',
    gzip: true,
    maxBytes: 100000,
    timeout: 5000,
});

custom.request('test', {
    payload: 'Test',
    agent: new Http.Agent({ maxSockets: Infinity }),
});

custom.request('test', {
    payload: Buffer.from('test'),
});

custom.request('test', {
    payload: new Stream.Readable(),
});

custom.request('test', {
    payload: new Url.URLSearchParams(),
});

const custom2 = custom.custom({
    method: 'test2',
});

custom2.request('test');

// request()

Bornite.request('test', { method: 'test' }).then((response) => {

    response.headers['accept-language'];
    response.payload;
    response.raw.headers;
    response.statusCode;
    response.statusMessage;
});

Bornite.request<{ a: string }>('test', { method: 'test' }).then((response) => {

    if (response.payload) {
        response.payload.a;
    }
});

// get()

Bornite.get('test').then((response) => {

    response.headers['accept-language'];
    response.payload;
    response.raw.headers;
    response.statusCode;
    response.statusMessage;
});

Bornite.get<{ a: string }>('test').then((response) => {

    if (response.payload) {
        response.payload.a;
    }
});

// post()

Bornite.post('test').then((response) => {

    response.headers['accept-language'];
    response.payload;
    response.raw.headers;
    response.statusCode;
    response.statusMessage;
});

Bornite.post<{ a: string }>('test').then((response) => {

    if (response.payload) {
        response.payload.a;
    }
});

// put()

Bornite.put('test').then((response) => {

    response.headers['accept-language'];
    response.payload;
    response.raw.headers;
    response.statusCode;
    response.statusMessage;
});

Bornite.put<{ a: string }>('test').then((response) => {

    if (response.payload) {
        response.payload.a;
    }
});

// patch()

Bornite.patch('test').then((response) => {

    response.headers['accept-language'];
    response.payload;
    response.raw.headers;
    response.statusCode;
    response.statusMessage;
});

Bornite.patch<{ a: string }>('test').then((response) => {

    if (response.payload) {
        response.payload.a;
    }
});

// delete()

Bornite.delete('test').then((response) => {

    response.headers['accept-language'];
    response.payload;
    response.raw.headers;
    response.statusCode;
    response.statusMessage;
});

Bornite.delete<{ a: string }>('test').then((response) => {

    if (response.payload) {
        response.payload.a;
    }
});
