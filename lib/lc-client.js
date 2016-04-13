var Planner = require('csa').BasicCSA,
    Fetcher = require('./Fetcher'),
    DataPrefetcher = require('./DataPrefetcher');

var Client = function (config) {
  // Validate config
  this._config = config;

  //Create new DataPrefetcher
  this._dataPrefetcher = new DataPrefetcher(this._config);
}

Client.prototype.query = function (q, cb) {
  // Create fetcher
  var fetcher = new Fetcher(this._config,this._dataPrefetcher);
  
  //1. Validate query
  if (q.departureTime) {
    q.departureTime = new Date(q.departureTime);
  } else {
    throw "Date of departure not set";
  }
  if (!q.departureStop) {
    throw "Location of departure not set";
  }
  var query = q, self = this;
  
  //2. Use query to configure the data fetchers
  fetcher.buildConnectionsStream(q, function (connectionsStream) {
    //3. fire results using CSA.js and return the stream
    var planner = new Planner(q,self._dataPrefetcher);
    //When a result is found, stop the stream
    planner.on("result", function () {
      fetcher.close();
    });
    cb(connectionsStream.pipe(planner), fetcher, connectionsStream);
  });
};

if (typeof window !== "undefined") {
  window.lc = {
    Client : Client
  };
}

module.exports = Client;
module.exports.Fetcher = require('./Fetcher');
