var fs = require('fs');
var expect = require('chai').expect;
var webdriverio = require('webdriverio');

var sinon_server = fs.readFileSync('setup/sinon-server.js', 'utf8');
var sinon_setup = fs.readFileSync('setup/sinon-setup.js', 'utf8');
sinon_setup = sinon_server + sinon_setup;
var sinon_teardown = fs.readFileSync('setup/sinon-teardown.js', 'utf8');

var options = {
    desiredCapabilities: {
        browserName: 'chrome'
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
var chainedAction = function(method) {
    var args = Array.prototype.slice.call(arguments, 1);
    return function() {
        return new Promise(function(resolve, reject) {
            args.push(promisify(resolve, reject));
            browser[method].apply(browser, args);
        });
    };
};

// doAction is like chainedAction, but does the action immediately
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

// sets up the browser ready for a test by loading the given url
// and injecting sinon. returns a promise which is resolved when
// the setup is complete
var setup = function(url) {
    return new Promise(function(resolve, reject) {
        browser.url(url, promisify(function() {
            browser.execute(sinon_setup, promisify(resolve, reject));
        }, reject));
    });
};

// proxies calls to the fake sinon server running in the browser.
// implements the full sinon.respondWith API
// functions passed as arguments will stringified and run in the
// target browser so variables in enclosing scopes will not be available.
var respondWith = function() {
    var args = Array.prototype.slice.call(arguments);
    args = args.map(function(arg) {
        return (typeof arg === 'string') ?
            ('"' + arg + '"') :
            arg.toString();
    }).join(', ');

    var jsString = 'window._sinon_server.respondWith(' + args + ');';

    return new Promise(function(resolve, reject) {
        browser.execute(jsString, promisify(resolve, reject));
    });
};

describe('client', function(done) {
    // we need a long timeout to allow for browser startup
    // and page load, but short enough not to wait too long for
    // broken tests. 10 seconds is probably ok
    this.timeout(10000);

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
        browser.execute(sinon_teardown, done);
    });

    it('does a thing', function(done) {
        setup('http://localhost:8080/index.html')
        .then(function() {
            return respondWith('foo');
        })
        .then(chainedAction('click', '#button'))
        .then(chainedAction('getText', '#result'))
        .then(function(text) {
            expect(text).to.equal('foo');
            done();
        });
    });

    it('does another thing', function(done) {
        setup('http://localhost:8080/index.html')
        .then(function() {
            return Promise.all([
                respondWith('bar')
                // ,...
            ]);
        })
        .then(chainedAction('click', '#button'))
        .then(function(result) {
            // maybe do something with result
            return doAction('getText', '#result');
        })
        .then(function(text) {
            expect(text).to.equal('bar');
            done();
        });
    });
});
