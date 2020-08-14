import Http = require('http');
import Https = require('https');
import Url = require('url');
import Stream = require('stream');

declare namespace internals {
    class Radar {
        /**
         * Creates a custom Radar instance with common options where:
         *
         * @param options - Common options that apply to every request.
         */
        custom(options: Radar.Options): Radar;

        /**
         * Makes a request where:
         *
         * @param url - The URL to send the request.
         * @param options - Optional options.
         */
        request<T>(url: string, options?: Radar.Options): Promise<Radar.Response<T>>;

        /**
         * Performs a HTTP GET request
         *
         * @param url - The URL to send the request.
         * @param options - Optional options.
         */
        get<T>(url: string, options?: Omit<Radar.Options, 'method'>): Promise<Radar.Response<T>>

        /**
         * Performs a HTTP POST request
         *
         * @param url - The URL to send the request.
         * @param options - Optional options.
         */
        post<T>(url: string, options?: Omit<Radar.Options, 'method'>): Promise<Radar.Response<T>>

        /**
         * Performs a HTTP PUT request
         *
         * @param url - The URL to send the request.
         * @param options - Optional options.
         */
        put<T>(url: string, options?: Omit<Radar.Options, 'method'>): Promise<Radar.Response<T>>

        /**
         * Performs a HTTP PATCH request
         *
         * @param url - The URL to send the request.
         * @param options - Optional options.
         */
        patch<T>(url: string, options?: Omit<Radar.Options, 'method'>): Promise<Radar.Response<T>>

        /**
         * Performs a HTTP DELETE request
         *
         * @param url - The URL to send the request.
         * @param options - Optional options.
         */
        delete<T>(url: string, options?: Omit<Radar.Options, 'method'>): Promise<Radar.Response<T>>
    }
}

declare namespace Radar {
    interface Options {
        /**
         * The request method to use. Case-insensitive.
         */
        method?: string;

        /**
         * Base URL that is resolved with `url` to form a full URL. Most useful when used with `custom()`
         */
        baseUrl?: string;

        /**
         * A hash of case-insensitive header names and their values. `Content-Length`, `Content-Type` and `Accept-Encoding` are set by default if possible.
         */
        headers?: Http.OutgoingHttpHeaders;

        /**
         * The request payload. Can be a string, a buffer, a stream, `URLSearchParams` or a serializable object. If `method` is `GET` or `HEAD`, this key is forbidden.
         */
        payload?: string | object | Buffer | Stream.Readable | Url.URLSearchParams;

        /**
         * The HTTP Agent passed directly to `Http.request()`.
         */
        agent?: Http.Agent | Https.Agent;

        /**
         * The number of redirects to follow. Set to `0` or `false` to disable redirection. Set to `Infinity` to follow all possible redirects. Defaults to `0`.
         *
         * @default 0
         */
        redirects?: number | false;

        /**
         * The method to change to when performing `301` and `302` redirects. Note that `payload` is not forwarded if set to `GET` or `HEAD`. Defaults to using `method`.
         */
        redirectMethod?: string;

        /**
         * Whether to decompress gzipped payloads. Defaults to `false`.
         *
         * @default false
         */
        gzip?: boolean;

        /**
         * The maximum size in bytes the response payload can have. Set to `0` to disable counting bytes. Defaults to `0`.
         *
         * @default 0
         */
        maxBytes?: number;

        /**
         * Socket timeout in milliseconds. Passed directly to `Http.request()`.
         */
        timeout?: number;
    }

    interface Response<T> {
        /**
         * Payload returned by the server. Radar automatically parses the content if the `Content-Type` header is set to `application/json`.
         */
        payload?: T;

        /**
         * Response headers returned by the server.
         */
        headers: Http.IncomingHttpHeaders;

        /**
         * The status code of the response.
         */
        statusCode?: number;

        /**
         * The status message of the response.
         */
        statusMessage?: string;

        /**
         * The raw Node response object.
         */
        raw: Http.IncomingMessage;
    }
}

declare const radar: internals.Radar;

export = radar;
