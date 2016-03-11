// Filters the stream using various configurable conditions
// E.g.,
//  * filter on dates that should be later or earlier then something


var Transform = require('stream').Transform,
    util = require('util'),
    request = require('urllib-sync').request;

function Filter (config) {
    Transform.call(this, {objectMode : true});
    this._config = config;
    this._wheelchair_accessible = false;
    this._data_prefetched = false;
    // list of trip ids that are not wheelchair accessible
    this._no_wha_trip_ids = [];
}

util.inherits(Filter, Transform);

Filter.prototype._transform = function (connection, encoding, done) {
    if (this._wheelchair_accessible){
        var id = parseInt(connection["gtfs:trip"]["@id"]);
        if  (this._no_wha_trip_ids.indexOf(id) > -1){
            done();
            return;
        }
    }
    this.push(connection);
    done();
};

Filter.prototype.setProperties = function (query) {
    this._wheelchair_accessible = query.wheelchair_accessible;

    if (this._wheelchair_accessible && !this._data_prefetched ) {
        //prefetch trips data
        var trips =  JSON.parse(request(this._config.wheelchair_trips).data)["@graph"];

        // filter the non wheelchair accessible trips
        var trips_no_wha = trips.filter(function(trip) {
            return (trip.wheelchair_accessible == 2);
        });

        // convert to array of ids
        for (var i = 0, len = trips_no_wha.length; i < len; i++) {
            this._no_wha_trip_ids.push(trips_no_wha[i].trip_id);
        }
        this._data_prefetched = true;
    }
}


module.exports = Filter;

