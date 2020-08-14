import Http = require('http');
import Https = require('https');
import Stream = require('stream');
import Url = require('url');

import Radar = require('../src');

// custom()

const custom = Radar.custom({
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

Radar.request('test', { method: 'test' }).then((response) => {

    response.headers['accept-language'];
    response.payload;
    response.raw.headers;
    response.statusCode;
    response.statusMessage;
});

Radar.request<{ a: string }>('test', { method: 'test' }).then((response) => {

    if (response.payload) {
        response.payload.a;
    }
});

// get()

Radar.get('test').then((response) => {

    response.headers['accept-language'];
    response.payload;
    response.raw.headers;
    response.statusCode;
    response.statusMessage;
});

Radar.get<{ a: string }>('test').then((response) => {

    if (response.payload) {
        response.payload.a;
    }
});

// post()

Radar.post('test').then((response) => {

    response.headers['accept-language'];
    response.payload;
    response.raw.headers;
    response.statusCode;
    response.statusMessage;
});

Radar.post<{ a: string }>('test').then((response) => {

    if (response.payload) {
        response.payload.a;
    }
});

// put()

Radar.put('test').then((response) => {

    response.headers['accept-language'];
    response.payload;
    response.raw.headers;
    response.statusCode;
    response.statusMessage;
});

Radar.put<{ a: string }>('test').then((response) => {

    if (response.payload) {
        response.payload.a;
    }
});

// patch()

Radar.patch('test').then((response) => {

    response.headers['accept-language'];
    response.payload;
    response.raw.headers;
    response.statusCode;
    response.statusMessage;
});

Radar.patch<{ a: string }>('test').then((response) => {

    if (response.payload) {
        response.payload.a;
    }
});

// delete()

Radar.delete('test').then((response) => {

    response.headers['accept-language'];
    response.payload;
    response.raw.headers;
    response.statusCode;
    response.statusMessage;
});

Radar.delete<{ a: string }>('test').then((response) => {

    if (response.payload) {
        response.payload.a;
    }
});
