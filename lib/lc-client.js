var Planner = require('csa').BasicCSA,
    Fetcher = require('./Fetcher'),
    HttpFetcher = require('./http/HttpFetcher');

// This is the penalty for having a transfer at a non wheelchair accessible stop (when asked for one)
const TRANSFER_MAX = 60*60*24*365;

var Client = function (config) {
  // Validate config
  this._config = config;

  // Create http fetcher for getTransferTime
  this._http = new HttpFetcher(20); // 20 concurrent requests max.

  // Wheelchair accessible data
  this._no_wha_stop_ids = [];
  this._wha_data_prefetched = false;

  // TransferTimes data
  this._transfer_times = {};
  this._transfer_times_prefetched = false;
}

Client.prototype.query = function (q, cb) {
  // Create fetcher
  var fetcher = new Fetcher(this._config);
  
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
    var planner = new Planner(q,self);
    //When a result is found, stop the stream
    planner.on("result", function () {
      fetcher.close();
    });
    cb(connectionsStream.pipe(planner), fetcher, connectionsStream);
  });
};

/**
 * Return the transfer time of a connection
 */
Client.prototype.getTransferTime = function (previousConnection, connection, minTransferTime, wheelchairAccessible, cb){
  if(this._transfer_times_prefetched){
    this._getTransferTimeAndTransferDataIsPrefetched(previousConnection, connection, minTransferTime, wheelchairAccessible, cb);

  } else {
    var self= this;

    //first prefetch transfer data
    console.log('Getting page: ' + this._config.transfer_times);
    this._http.get(this._config.transfer_times).then( function(result) {
      var t = JSON.parse(result.body)["@graph"];

      // filter on transfer_type
      var transfers = t.filter(function(transfer) {
        return (transfer.transfer_type == "gtfs:MinimumTimeTransfer");
      });

      // convert to dict with times
      for (var i = 0, len = transfers.length; i < len; i++) {
        self._transfer_times[transfers[i].origin_stop + "->" + transfers[i].destination_stop] = transfers[i].min_transfer_time;
      }

      self._transfer_times_prefetched = true;

      //calculate transfertime
      self._getTransferTimeAndTransferDataIsPrefetched(previousConnection, connection, minTransferTime, wheelchairAccessible, cb);
    });
  }
}


/**
 * Help function for getTransferTime. This method requires that the transfer data is already prefetched!
 */
Client.prototype._getTransferTimeAndTransferDataIsPrefetched = function (previousConnection, connection, minTransferTime, wheelchairAccessible, cb){
  var self= this;
  var transfertime = 0;

  //if previous connection does not exists, than not useful to calculate transfer time
  //only transfer time when there is a transfer at the stop from one trip to another one
  if(previousConnection && previousConnection["trip"]!=null && previousConnection["trip"] != connection["gtfs:trip"]["@id"]) {

    //get transferTime specified in gtfs (transfers.txt)
    var gtfs_transferTime = this._transfer_times[connection["departureStop"] + "->" + connection["departureStop"]];
    if(!gtfs_transferTime) {
      gtfs_transferTime = 0;
    }

    //combine mimumum required transferTime and the GTFS transferTime
    transfertime = Math.max(minTransferTime,gtfs_transferTime);

    if(!wheelchairAccessible) {

      cb(transfertime);

    }
    else
    {
      //create help function for checking if stop is wheelchairAccessible
      var _checkWheelchairAccessible = function (actualTransferTime, departureStop, cb) {
        //check if stop is wheelchair accessible
        if(self._no_wha_stop_ids.indexOf(departureStop) > -1) {
          //return very high transferTime if the transfer cannot be executed with a wheelchair
          cb(TRANSFER_MAX);
        } else {
          cb(actualTransferTime);
        }
      }

      //check if wheelchairAccessible data is available
      if(this._wha_data_prefetched) {

        // data available => check if transfer at stop is wheelchairAccessible
        _checkWheelchairAccessible(transfertime,connection["departureStop"],cb);

      } else {

        //prefetch wheelchair accessible data
        console.log('Getting page: ' + this._config.wheelchair_stops);
        this._http.get(this._config.wheelchair_stops).then( function(result) {
          var stops =  JSON.parse(result.body)["@graph"];

          // filter the non wheelchair accessible stops
          var stops_no_wha = stops.filter(function(stop) {
            return (stop.wheelchair_boarding == "gtfs:NotWheelchairAccessible");
          });

          // convert to array of ids
          for (var i = 0, len = stops_no_wha.length; i < len; i++) {
            self._no_wha_stop_ids.push(stops_no_wha[i].stop_id + "");
          }

          self._wha_data_prefetched = true;

          _checkWheelchairAccessible(transfertime,connection["departureStop"],cb);
        });
      }
    }

  } else {

    //no transfer => no transfer time
    cb(0);

  }
}

if (typeof window !== "undefined") {
  window.lc = {
    Client : Client
  };
}

module.exports = Client;
module.exports.Fetcher = require('./Fetcher');
