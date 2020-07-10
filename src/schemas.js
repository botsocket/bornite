'use strict';

const Lyra = require('@botbind/lyra');

exports.options = Lyra.obj({
    method: Lyra.str().required(),

    headers: Lyra.obj().default({}),

    payload: Lyra.alt(
        Lyra.str(),
        Lyra.obj(),
        Lyra.arr(),
    )
        .when('method', {
            is: Lyra.str().insensitive().valid('GET', 'HEAD'),
            then: Lyra.forbidden(),
        })
        .messages({ 'alternatives.any': '{#label} must be a string, a buffer, a stream or a serializable object' }),

    agent: Lyra.obj(),

    redirects: Lyra.num().integer().min(0).allow(Infinity, false).default(0),

    redirectMethod: Lyra.str().default(Lyra.ref('method')),

    gzip: Lyra.bool().default(false),

    maxBytes: Lyra.num(),

    timeout: Lyra.num(),
})
    .default()
    .label('Options');
