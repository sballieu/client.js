var HttpFetcher = require('./http/NodeHttpFetcher.js'),
    Promise = require('promise');

// This is the penalty for having a transfer at a non wheelchair accessible stop (when asked for one)
const TRANSFER_MAX = 60*60*24*365;

var DataPrefetcher = function(config) {
    var self = this;
    this._config = config;

    // Create http fetcher
    this._http = new HttpFetcher(10); // 10 concurrent requests max.

    // TransferTimes data
    this._transfer_times = undefined; //map between stop and transfer time

    // Wheelchair accessibility data:
    this._no_wha_stop_ids = undefined; //list of stop ids that are not wheelchair accessible
}

/**
 * Return the transfer time of a connection
 */
DataPrefetcher.prototype.getTransferTime = function (previousConnection, connection, minTransferTime, wheelchairAccessible){
    var self = this;

    if(!this._transfer_times) {
        this._transfer_times = new Promise(function (fulfill, reject){
            //prefetch transfer data

            console.log('Getting page: ' + self._config.transfer_times);
            self._http.get(self._config.transfer_times).then( function(result) {
                var t = JSON.parse(result.body)["@graph"];

                // filter on transfer_type
                var transfers = t.filter(function(transfer) {
                    return (transfer.transfer_type == "gtfs:MinimumTimeTransfer");
                });

                var transfer_times = {};

                // convert to dict with times
                for (var i = 0, len = transfers.length; i < len; i++) {
                    transfer_times[transfers[i].origin_stop + "->" + transfers[i].destination_stop] = transfers[i].min_transfer_time;
                }

                fulfill(transfer_times);
            });
        });
    }

    return new Promise(function (fulfill, reject) {
        var transfertime = 0;

        self._transfer_times.then(function(transfer_times) {

            //if previous connection does not exists, than not useful to calculate transfer time
            //only transfer time when there is a transfer at the stop from one trip to another one
            if(previousConnection && previousConnection["trip"]!=null && previousConnection["trip"] != connection["gtfs:trip"]) {

                //get transferTime specified in gtfs (transfers.txt)
                var gtfs_transferTime = transfer_times[connection["departureStop"] + "->" + connection["departureStop"]];
                if(!gtfs_transferTime) {
                    gtfs_transferTime = 0;
                }

                //combine mimumum required transferTime and the GTFS transferTime
                transfertime = Math.max(minTransferTime,gtfs_transferTime);

                if(!wheelchairAccessible) {
                    fulfill(transfertime);
                } else {

                    if(!self._no_wha_stop_ids){
                        self._no_wha_stop_ids = new Promise(function (fulfill, reject){
                            //prefetch stops data

                            console.log('Getting page: ' + self._config.wheelchair_stops);
                            self._http.get(self._config.wheelchair_stops).then( function(result) {
                                var stops =  JSON.parse(result.body)["@graph"];

                                // filter the non wheelchair accessible stops
                                var stops_no_wha = stops.filter(function(stop) {
                                    return (stop.wheelchair_boarding == "gtfs:NotWheelchairAccessible");
                                });

                                var no_wha_stop_ids = [];

                                // convert to array of ids
                                for (var i = 0, len = stops_no_wha.length; i < len; i++) {
                                    no_wha_stop_ids.push(stops_no_wha[i].stop_id + "");
                                }

                                fulfill(no_wha_stop_ids);
                            });
                        });
                    }

                    self._no_wha_stop_ids.then(function(no_wha_stop_ids) {
                        //check if stop is wheelchair accessible
                        if(no_wha_stop_ids.indexOf(connection["departureStop"]) > -1) {
                            //return very high transferTime if the transfer cannot be executed with a wheelchair
                            fulfill(TRANSFER_MAX);
                        } else {
                            fulfill(transfertime);
                        }
                    });
                }
            } else {
                fulfill(0);
            }
        });
    });
}

module.exports = DataPrefetcher;