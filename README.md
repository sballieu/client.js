# Linked Connections Client for javascript

Status: _Proof of Concept_

A javascript library to use intermodal route planning advice in the browser or in your nodejs applications.

## Install and use it

Install it:
```bash
npm install lc-client #for adding it to your $PATH add -g
```

For use on the command line:
```bash
# uses by default the config-example.json which comes with this repo
lcc -c config.json '{"arrivalStop" : "", "departureStop" : "", "departureTime": ""}'
```
Optionally you can specify the minium transfer time:
```bash
lcc -c config.json '{"arrivalStop" : "", "departureStop" : "", "departureTime": "", "minimumTransferTime": 60}'
```

You can also use the demo queries added in the queries folder.

Use it as a library:
```javascript
var Client = require('lc-client');
var planner = new Client({"entrypoints" : ["http://belgianrail.linkedconnections.org/"]});
planner.query({"arrivalStop" : "", "departureStop" : "", "departureTime": ""}, function (resultStream, source) {
  resultStream.on('result', function (path) {
    console.log(path);
  });
  resultStream.on('data', function (connection) {
    console.log(connection);
    //if you're not interested anymore, you can stop the processing by doing this
    if (stop_condition) {
      source.close();
    }
  });
  //you can also count the number of HTTP requests done by the interface as follows
  source.on('request', function (url) {
    console.log('Requesting', url);
  });
  //you can also catch when a response is generated HTTP requests done by the interface as follows
  source.on('response', function (url) {
    console.log('Response received for', url);
  });
});
```

Using it in the browser works in a similar way, by e.g., using browserify to generate a build file that can be used in the browser
```bash
browserify lib/lc-client.js -d -p [minifyify --no-map] > dist/build.js
```

You can also use our latest compiled version:
```html
<script src='http://demo.linkedconnections.org/lc-client-latest.js'></script>
<script>
var planner = new window.lc.Client({"entrypoints" : ["http://belgianrail.linkedconnections.org/"]});
//...
</script>
```

Within your script, you also use the Fetcher to have a stream of all connections:

```javascript
//1. Instantiate a fetcher
var fetcher = new require('lc-client').Fetcher({"entrypoints" : ["http://belgianrail.linkedconnections.org/"]});
//2. Use an empty query to get all connections from the sources configured in the fetcher
fetcher.buildConnectionsStream({}, function (connectionsStream) {
  connectionsStream.on('data', function (connection) {
    //do something with connection here
  });
});
```

Optionally you can specify transfer times server to enable dynamic transfer times depeding on the stops of the transfer:
```javascript
var planner = new Client({
  "entrypoints" : ["http://belgianrail.linkedconnections.org/"],
  "transferTimes" : "http://transfers.linkedconnections.me/"
});
```
The transfer times server should return JSONLD pages of the form:
```javascript
{
    "@context": {
      "gtfs": "http://vocab.gtfs.org/terms#",
      "origin_stop": {
        "@id": "gtfs:originStop",
        "@type": "@id" },
    "destination_stop": {
        "@id": "gtfs:destinationStop",
        "@type": "@id" },
    "transfer_type": {
        "@id": "gtfs:TransferType",
        "@type": "@id" },
    "min_transfer_time": {
        "@id": "gtfs:minimumTransferTime",
        "@type": "@id" }
},
"@graph": [
{
    "origin_stop": "...",
    "destination_stop": "...",
    "min_transfer_time": "...",
    "transfer_type": "..."
},
...
]
```
An example transfer server that returns transfer times from a GTFS transfer.txt file can be found at: https://github.com/sballieu/transfers-server

## How it works

The Linked Connections client plans routes over Linked Connections. These are hydra-powered hypermedia APIs that describe their things uisng the Linked Connections vocabulary. Furthermore, the objects returned in the document are ordere by departureTime.

The Client will start downloading schedule data from publicly available and discoverable locations on the Web. It will follow links to discover new documents.

More info can be found at http://linkedconnections.org

## License

The Linked Connections client is written by Pieter Colpaert, Brecht Van de Vyvere and colleagues.

This code is copyrighted by Ghent University – iMinds and released under the MIT license.
