var HttpConnectionsStream = require('./http/HttpConnectionsStream'),
    HttpEntryPoint = require('./http/HttpEntryPoint'),
    MergeStream = require('csa').MergeStream,
    Filter = require('./Filter');

var Fetcher = function (config, httpFetcher) {
  this._config = config;
  this._entrypoints = [];
  for (var k in config.entrypoints) {
    this._entrypoints.push(config.entrypoints[k]);
  }
  this._http = httpFetcher;
  this._connectionsStreams = []; // Holds array of [ stream name, stream ]
  this._mergeStream = null;
  this.filter = new Filter(this._config, this._http);
}

Fetcher.prototype.close = function () {
  for (var k in this._connectionsStreams) {
    this._connectionsStreams[k][1].close();
  }
};

Fetcher.prototype.buildConnectionsStream = function (query, cb) {
  var self = this;

  this.filter.setProperties(query, function() {
    //Get the connections from the Web
    for (var k in self._entrypoints) {
      var entry = new HttpEntryPoint(self._entrypoints[k], self._http);
      entry.fetchFirstUrl(query.departureTime).then(function (url) {
        var connectionsStream = new HttpConnectionsStream(url, self._http);
        self._connectionsStreams.push([url, connectionsStream]); // Uses url as stream name
        if (self._connectionsStreams.length === 1) {
          cb(self._config, self._connectionsStreams[0][1].pipe(self.filter)); // Only one stream
        } else if (self._connectionsStreams.length === self._entrypoints) {
          self._mergeStream = new MergeStream(self._connectionsStreams, query.departureTime);
          cb(self._config, self._mergeStream.pipe(self.filter));
        }
      }, function (error) {
        console.error(error);
      });
    }
  });
};

module.exports = Fetcher;