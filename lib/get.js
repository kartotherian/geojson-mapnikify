var AgentKeepAlive = require('agentkeepalive'),
    xtend = require('xtend'),
    requestLib = require('request');

// Use a single agent for all requests so that requests to the same
// host can use keep-alive for performance.
var agent = new AgentKeepAlive({
    maxSockets: 128,
    maxKeepAliveRequests: 0,
    maxKeepAliveTime: 30000
});

/**
 * Safely get a file at a uri as a binary buffer, with timeout protection
 * and a length limit.
 *
 * @param {string} uri
 * @param {function} callback
 */
module.exports = function get(options, callback) {
    var request = getClient();
    var params = normalizeParams(options);
    if(!params) { callback(new Error('Invalid parameters: ' + JSON.stringify(options))); }

    // This might load the same file multiple times, but the overhead should
    // be very little.
    request(params, function(err, resp, data) {
        // Use err.status of 400 as it's not an unexpected application error,
        // but likely due to a bad request. Catches ECONNREFUSED,
        // getaddrinfo ENOENT, etc.
        if (err || !data || !resp || resp.statusCode !== 200) {
            var reqErr = new Error('Unable to load marker from URL.');
            reqErr.originalError = err;
            return callback(reqErr);
        }
        // request 2.2.x *always* returns the response body as a string.
        // @TODO remove this once request is upgraded.
        if (!(data instanceof Buffer)) data = new Buffer(data, 'binary');
        // Restrict data length.
        if (data.length > 32768) return callback(new Error('Marker loaded from URL is too large.'));
        callback(null, data);
    });
};

function normalizeParams(options) {
    var params = {};

    if(typeof options === 'string') {
        params.uri = options;
    } else if(typeof options === 'object') {
        params = xtend(params, options);
    } else {
        return false;
    }

    var uri = params.uri || params.url;
    if (typeof params.agent === 'undefined') {
        // Don't use keepalive agent for https.
        params.agent = uri.indexOf('https') === 0 ? null : agent;
    }

    return params;
}

// allows passing in a custom request handler
function getClient() {
    if (module.exports.requestClient) { return module.exports.requestClient; }
    return requestLib.defaults({
        timeout: 5000,
        encoding: 'binary',
        headers: {
            'accept-encoding': 'binary'
        }
    });
}
