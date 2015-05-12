# selenium-sinon
POC for selenium tests with mocha and webdriver.io using sinon-stubbed XHRs

To run:

- Get the selenium standalone server and run it:

```
curl -O http://selenium-release.storage.googleapis.com/2.45/selenium-server-standalone-2.45.0.jar
java -jar selenium-server-standalone-2.45.0.jar
```

- Run npm install

```
npm install
```

- Run the node server which will serve the application under test:

```
cd server
node server.js
```

- Run the tests:

```
cd test
mocha test.js
```
