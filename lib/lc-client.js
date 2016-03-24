var Planner = require('csa').BasicCSA,
    Fetcher = require('./Fetcher'),
    request = require('urllib-sync').request;;

// This is the penalty for having a transfer at a non wheelchair accessible stop (when asked for one)
const TRANSFER_MAX = 60*60*24*365;

var Client = function (config) {
  // Validate config
  this._config = config;

  // Create fetcher
  this._fetcher = new Fetcher(this._config);

  // Wheelchair accessible data
  this._no_wha_stop_ids = [];
  this._wha_data_prefetched = false;

  // TransferTimes data
  this._transfer_times = {};
  var t =  JSON.parse(request(this._config.transfer_times).data)["@graph"];
  // filter on transfer_type
  var transfers = t.filter(function(transfer) {
    return (transfer.transfer_type == "gtfs:MinimumTimeTransfer");
  });
  // convert to dict with times
  for (var i = 0, len = transfers.length; i < len; i++) {
    this._transfer_times[transfers[i].origin_stop + "->" + transfers[i].destination_stop] = transfers[i].min_transfer_time;
  }
}

Client.prototype.query = function (q, cb) {
  //1. Validate query
  if (q.departureTime) {
    console.log(q.departureTime);
    q.departureTime = new Date(q.departureTime);
  } else {
    throw "Date of departure not set";
  }
  if (!q.departureStop) {
    throw "Location of departure not set";
  }
  var query = q, self = this;
  
  //2. Use query to configure the data fetchers
  this._fetcher.buildConnectionsStream(q, function (config, connectionsStream) {
    //3. fire results using CSA.js and return the stream
    var planner = new Planner(q,self);
    //When a result is found, stop the stream
    planner.on("result", function () {
      self._fetcher.close();
    });
    cb(connectionsStream.pipe(planner));
  });
};

/**
 * Return the transfer time of a connection
 */
Client.prototype.getTransferTime = function (perviousConnection, connection, minTransferTime, wheelchairAccessible){
  var transferTime = 0;
  //if previous connection does not exists, than useful to calculate transfer time
  //only transfer time when there is a transfer at the stop from one trip to another one
  if(perviousConnection && perviousConnection["trip"]!=null && perviousConnection["trip"] != connection["gtfs:trip"]["@id"]) {

    // add penalty to transferTime if the transfer cannot be executed with a wheelchair
    if(wheelchairAccessible) {

      //check if wheelchair data is already available
      if(!this._wha_data_prefetched){
        //prefetch wheelchair accessible dat
        var stops =  JSON.parse(request(this._config.wheelchair_stops).data)["@graph"];

        // filter the non wheelchair accessible stops
        var stops_no_wha = stops.filter(function(stop) {
          return (stop.wheelchair_boarding == "gtfs:NotWheelchairAccessible");
        });

        // convert to array of ids
        for (var i = 0, len = stops_no_wha.length; i < len; i++) {
          this._no_wha_stop_ids.push(stops_no_wha[i].stop_id + "");
        }
      }

      //check if stop is wheelchair accessible
      if(this._no_wha_stop_ids.indexOf(connection["departureStop"]) > -1) {
        transferTime += TRANSFER_MAX;
      }
    }

    //get transferTime specified in gtfs (transfers.txt)
    var gtfs_transferTime = this._transfer_times[connection["departureStop"] + "->" + connection["departureStop"]];
    if(!gtfs_transferTime) {
      gtfs_transferTime = 0;
    }

    //combine actual transferTime with mimumum required transferTime and the GTFS transferTime
    transferTime = Math.max(transferTime,minTransferTime,gtfs_transferTime);
  }
  return transferTime;
}

if (typeof window !== "undefined") {
  window.lc = {
    Client : Client
  };
}

module.exports = Client;
