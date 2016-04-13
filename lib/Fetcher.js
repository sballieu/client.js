var HttpFetcher = require('./http/NodeHttpFetcher.js'),
    HttpConnectionsStream = require('./http/HttpConnectionsStream'),
    HttpEntryPoint = require('./http/HttpEntryPoint'),
    MergeStream = require('csa').MergeStream,
    util = require('util'),
    EventEmitter = require('events'),
    Filter = require('./Filter');

var Fetcher = function (config, dataPrefetcher) {
  EventEmitter.call(this);
  this._config = config;
  this._entrypoints = [];
  for (var k in config.entrypoints) {
    this._entrypoints.push(config.entrypoints[k]);
  }

  this.http = new HttpFetcher(10); // 10 concurrent requests max.
  var self = this;
  this.http.on('request', function (url) {
    self.emit('request', url);
  });
  this.http.on('response', function (url) {
    self.emit('response', url);
  });

  this._connectionsStreams = []; // Holds array of [ stream name, stream ]
  this._mergeStream = null;
  this._dataPrefetcher = dataPrefetcher;
}

util.inherits(Fetcher, EventEmitter);

Fetcher.prototype.close = function () {
  for (var k in this._connectionsStreams) {
    this._connectionsStreams[k][1].close();
  }
};

Fetcher.prototype.buildConnectionsStream = function (query, cb) {
  var self = this;
  var filter = new Filter(this._config, query.wheelchair_accessible, this._dataPrefetcher);

  //Get the connections from the Web
  for (var k in this._entrypoints) {
    var entry = new HttpEntryPoint(this._entrypoints[k], this.http);
    entry.fetchFirstUrl(query.departureTime).then(function (url) {
      var connectionsStream = new HttpConnectionsStream(url, self.http, query.departureTime);
      self._connectionsStreams.push([url, connectionsStream]); // Uses url as stream name
      if (self._connectionsStreams.length === 1) {
        cb(self._connectionsStreams[0][1].pipe(filter)); // Only one stream
      } else if (self._connectionsStreams.length === self._entrypoints.length) {
        self._mergeStream = new MergeStream(self._connectionsStreams, query.departureTime);
        cb(self._mergeStream.pipe(sfilter));
      }
    }, function (error) {
      console.error(error);
    });
  }
};

module.exports = Fetcher;
