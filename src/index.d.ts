import * as Http from 'http';
import * as Https from 'https';
import * as Url from 'url';
import * as Stream from 'stream';

declare const bornite: internals.Bornite;

export = bornite;

declare namespace internals {
    class Bornite {
        /**
         * Creates a custom Bornite instance with common options where:
         *
         * @param options - Common options that apply to every request.
         */
        custom(options: Options): Bornite;

        /**
         * Makes a request where:
         *
         * @param url - The URL to send the request.
         * @param options - Optional options.
         */
        request<T extends string | object>(url: string, options?: Options): Promise<Response<T>>;

        /**
         * Performs a HTTP GET request
         *
         * @param url - The URL to send the request.
         * @param options - Optional options.
         */
        get<T extends string | object>(url: string, options?: Omit<Options, 'method'>): Promise<Response<T>>

        /**
         * Performs a HTTP POST request
         *
         * @param url - The URL to send the request.
         * @param options - Optional options.
         */
        post<T extends string | object>(url: string, options?: Omit<Options, 'method'>): Promise<Response<T>>

        /**
         * Performs a HTTP PUT request
         *
         * @param url - The URL to send the request.
         * @param options - Optional options.
         */
        put<T extends string | object>(url: string, options?: Omit<Options, 'method'>): Promise<Response<T>>

        /**
         * Performs a HTTP PATCH request
         *
         * @param url - The URL to send the request.
         * @param options - Optional options.
         */
        patch<T extends string | object>(url: string, options?: Omit<Options, 'method'>): Promise<Response<T>>

        /**
         * Performs a HTTP DELETE request
         *
         * @param url - The URL to send the request.
         * @param options - Optional options.
         */
        delete<T extends string | object>(url: string, options?: Omit<Options, 'method'>): Promise<Response<T>>
    }


    interface Options {
        /**
         * The request method to use. Case-insensitive.
         */
        readonly method?: string;

        /**
         * Base URL that is resolved with `url` to form a full URL. Most useful when used with `custom()`
         */
        readonly baseUrl?: string;

        /**
         * A hash of case-insensitive header names and their values. `Content-Length`, `Content-Type` and `Accept-Encoding` are set by default if possible.
         */
        readonly headers?: Http.OutgoingHttpHeaders;

        /**
         * The request payload. Can be a string, a buffer, a stream, `URLSearchParams` or a serializable object. If `method` is `GET` or `HEAD`, this key is forbidden.
         */
        readonly payload?: string | object | Buffer | Stream.Readable | Url.URLSearchParams;

        /**
         * The HTTP Agent passed directly to `Http.request()`.
         */
        readonly agent?: Http.Agent | Https.Agent;

        /**
         * The number of redirects to follow. Set to `0` or `false` to disable redirection. Set to `Infinity` to follow all possible redirects. Defaults to `0`.
         *
         * @default 0
         */
        readonly redirects?: number | false;

        /**
         * The method to change to when performing `301` and `302` redirects. Note that `payload` is not forwarded if set to `GET` or `HEAD`. Defaults to using `method`.
         */
        readonly redirectMethod?: string;

        /**
         * Whether to decompress gzipped payloads. Defaults to `false`.
         *
         * @default false
         */
        readonly gzip?: boolean;

        /**
         * The maximum size in bytes the response payload can have. Set to `0` to disable counting bytes. Defaults to `0`.
         *
         * @default 0
         */
        readonly maxBytes?: number;

        /**
         * Socket timeout in milliseconds. Passed directly to `Http.request()`.
         */
        readonly timeout?: number;

        /**
         * Whether to validate response status code. If sets to `true`, Bornite will allow 2xx codes.
         *
         * @default false
         */
        readonly validateStatus?: boolean | ((statusCode: number) => boolean);
    }

    interface Response<T> {
        /**
         * Payload returned by the server. Bornite automatically parses the content if the `Content-Type` header is set to `application/json`.
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
