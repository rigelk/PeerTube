"use strict";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const express = require('express');
const fetch = require('node-fetch');
const app = express();

const fakeCorsHeaders = (referer) => {
    return referer ? {
      'origin': referer.split('/', 3).join('/'),
      'referer': referer,
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin'
    } : {};
};

app.all('*', async (req, res) => {
    const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
    console.log('= Serving', url.toString());

    // url.host = 'peertube.bittube.tv';
    url.host = 'bittube.video';
    url.protocol = 'https:';
    url.port = 443;
    console.log('- Fixed url:', url.toString());

    // Disable cache
    // delete req.headers['if-none-match'];
    // req.headers['if-modified-since'] = '*';

    const fakedCors = req.headers['referer'] ? fakeCorsHeaders(req.headers['referer'].replace(/https?:\/\/.+?\//g, `${url.protocol}//${url.host}/`)) : {};
    const data = req.headers['content-type'] ? await new Promise((resolve, reject) => {
        const buffers = [];
        req.on('data', (d) => buffers.push(d));
        req.on('end', () => resolve(Buffer.concat(buffers)));
        req.on('error', (err) => reject(err));
    }) : null;
    const response = await fetch(url, { method: req.method, body: data, headers: {
        ...req.headers,
        ...fakedCors,
        host: url.host,
        connection: 'close',
        'x-i-am-a-teapot': true,
        'x-forwarded-for': req.ip,
    }});
    const buffer = await response.buffer();

    const newHeaders = {};
    const headers = response.headers.raw();
    Object.keys(headers).map(function(key, index) {
        newHeaders[key.toLowerCase()] = headers[key].join(', ');
    });

    newHeaders['connection'] = 'close';
    delete newHeaders['content-encoding'];

    console.log('Response size:', buffer.byteLength, 'Status:', response.status);
    res.status(response.status).set(newHeaders).send(buffer);
});

const PORT = 4040;
app.listen(PORT, () => {
    console.log('== Listening on', PORT);
});