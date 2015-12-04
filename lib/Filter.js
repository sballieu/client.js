// Filters the stream using various configurable conditions
// E.g.,
//  * filter on dates that should be later or earlier then something


var Transform = require('stream').Transform,
    util = require('util'),
    httpsync = require('httpsync');

function Filter (http) {
    Transform.call(this, {objectMode : true});
    this._wheelchair = true;
    this._http = http;
    var trips =  JSON.parse(httpsync.get("http://localhost:3001/trips").end().data);

    // filter the non wheelchair accessible trips
    var trips_no_wha = trips.filter(function(trip) {
        return (trip.wheelchair_accessible == 2);
    });

    // convert to array of ids
    this._no_wha_trip_ids = [];
    for (var i = 0, len = trips_no_wha.length; i < len; i++) {
        this._no_wha_trip_ids.push(trips_no_wha[i].id);
    }
}

util.inherits(Filter, Transform);

Filter.prototype._transform = function (connection, encoding, done) {
    if (this._wheelchair){
        var id = parseInt(connection["gtfs:trip"]["@id"]);
        if  (this._no_wha_trip_ids.indexOf(id) > -1){
            done();
            return;
        }
    }
    this.push(connection);
    done();
};

module.exports = Filter;

