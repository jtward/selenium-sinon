var fs = require('fs');
var expect = require('chai').expect;
var webdriverio = require('webdriverio');
var _ = require('lodash');

fauxJax_setup = fs.readFileSync('setup/fauxJax-setup.js', 'utf8');

var options = {
    desiredCapabilities: {
        browserName: 'safari'
    }
};

var browser = {};

// promisify makes it easier to work with the webdriverio API with
// promises
var promisify = function(resolve, reject) {
    return function(error, result) {
        (error ? reject : resolve)(error ? error.message : result);
    };
};

// return a function that executes an action on the browser
// the returned function returns a promise, which is fulfilled
// with the result of the action when it completes.
var action = function(method) {
    var args = Array.prototype.slice.call(arguments, 1);
    return function() {
        return new Promise(function(resolve, reject) {
            args.push(promisify(resolve, reject));
            browser[method].apply(browser, args);
        });
    };
};

// doAction is like action, but does the action immediately
// instead of returning a function that does the action. returns a
// promise, which is fulfilled with the result of the action when
// it completes.
var doAction = function(method) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function(resolve, reject) {
        args.push(promisify(resolve, reject));
        browser[method].apply(browser, args);
    });
};

var fakeServer = (function() {
    var isResponding = false;

    var registeredResponses = [];

    var respondWith = function(method, url, response) {
        registeredResponses.push({
            method: method,
            url: url,
            response: response
        });
    };

    var reset = function() {
        registeredResponses.length = 0;
        isResponding = false;
    };

    var getRequests = action('execute', function() {
        return window.fakeServer.getRequests();
    });

    var responses = function(requests) {
        return requests.map(function(request) {
            var requestParams = request.request;
            var match;
            
            var response = _.find(registeredResponses, function(response) {
                if (response.method === requestParams.method) {
                    match = requestParams.url.match(response.url);
                    return match;
                }
            });

            if (response) {
                var args = match.slice(1);
                args.unshift(requestParams);
                
                response = response.response;
                if (typeof response === 'function') {
                    response = response.apply(response, args);
                }
                
                return {
                    id: request.id,
                    response: response
                };
            }
            else {
                console.log('no fake server response for request: ', requestParams);
            }
        });
    };

    var respond = function(requests) {
        return doAction('execute', function(responses) {
            window.fakeServer.respond(responses);
        }, responses(requests));
    };

    var sendResponses = function(result) {
        var requests = JSON.parse(result.value);
        if (requests.length) {
            return respond(requests);
        }
        else {
            return Promise.resolve();
        }
    };

    var maybeStop = function() {
        return (isResponding ? Promise.resolve : Promise.reject).call(Promise);
    };

    var startResponding = function() {
        isResponding = true;
        (function serve() {
            return maybeStop()
            .then(getRequests)
            .then(sendResponses)
            .then(serve)
        }());
    };

    return {
        respondWith: respondWith,
        startResponding: startResponding,
        reset: reset
    };
}());

// sets up the browser ready for a test by loading the given url
// and injecting sinon. returns a promise which is resolved when
// the setup is complete
var setup = function(url) {
    return new Promise(function(resolve, reject) {
        browser.url(url, promisify(function() {
            browser.execute(fauxJax_setup, promisify(function() {
                fakeServer.startResponding();
                resolve();
            }, reject));
        }, reject));
    });
};

describe('client', function(done) {
    // we need a long timeout to allow for browser startup
    // and page load, but short enough not to wait too long for
    // broken tests. 10 seconds is probably ok
    this.timeout(30000);

    // we create a browser instance once, before all tests
    before(function(done) {
        browser = webdriverio.remote(options);
        browser.init({}, done);
    });

    // clean up after ourselves by ending the browser process
    after(function(done) {
        browser.end(done);
    });

    // execute teardown after each test
    // each test is expected to call setup itself
    afterEach(function(done) {
        fakeServer.reset();
        browser.execute("fauxJax.restore();", done);
    });

    it('does a thing', function(done) {
        fakeServer.respondWith('GET', /.*/, [200, {}, '{"foo":"bar"}']);

        setup('http://localhost:8080/index.html')
        .then(action('click', '#button'))
        .then(action('getText', '#result'))
        .then(function(text) {
            expect(text).to.equal('{"foo":"bar"}');
        })
        .then(done)
        .catch(done);
    });
});
