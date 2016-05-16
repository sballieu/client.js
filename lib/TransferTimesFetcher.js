var Promise = require('promise');

var TransferTimesFetcher = function (config, http) {
    this._http = http;
    //create a map for storing the transfer times
    //["stopA"->"stopB"] = "transfer time in seconds"
    if (config.transferTimes) {
        this._url = config.transferTimes;
        this._transferTimes = undefined;
    } else {
        //make empty map if url server is not defined
        this._transferTimes = new Promise(function (fulfill) {
            fulfill({})
        })
    }
}

TransferTimesFetcher.prototype.get = function (previousConnection, connection) {
    var self = this;
    //check if transferTimes map already exists
    if (!this._transferTimes) {
        this._transferTimes = new Promise(function (fulfill) {
            //prefetch transfer data

            self._http.get(self._url).then(function (result) {
                var t = JSON.parse(result.body)["@graph"];

                // filter on transfer_type
                var transfers = t.filter(function (transfer) {
                    return (transfer.transfer_type == "gtfs:MinimumTimeTransfer");
                });

                var transfer_times = {};

                // convert to dict with times
                for (var i = 0, len = transfers.length; i < len; i++) {
                    //["stopA"->"stopB"] = "transfer time in seconds"
                    transfer_times[transfers[i].origin_stop + "->" + transfers[i].destination_stop] = transfers[i].min_transfer_time;
                }

                fulfill(transfer_times);
            });
        });
    }

    return new Promise(function (done) {
        self._transferTimes.then(function (transfer_times) {
            var transfer_time = transfer_times[connection["departureStop"] + "->" + connection["departureStop"]];
            if (!transfer_time) {
                transfer_time = 0;
            }
            done(transfer_time);
        })
    });
}

module.exports = TransferTimesFetcher;
