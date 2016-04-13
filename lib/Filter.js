// Filters the stream using various configurable conditions
// E.g.,
//  * filter on dates that should be later or earlier then something


var Transform = require('stream').Transform,
    util = require('util');

function Filter (config,wheelchair_accessible, dataPrefetcher) {
    Transform.call(this, {objectMode : true});
    this._config = config;
    this._wheelchair_accessible = wheelchair_accessible;
    this._dataPrefetcher = dataPrefetcher;
}

util.inherits(Filter, Transform);

Filter.prototype._transform = function (connection, encoding, done) {
    if (this._wheelchair_accessible){
        var self = this;
        var trip_id = parseInt(connection["gtfs:trip"]["@id"]);

        this._dataPrefetcher.isTripWheelchairAccessible(trip_id).then(function (trip_wheelchair_accessible) {
            if(trip_wheelchair_accessible) {
                self.push(connection);
                done();
            } else {
                done();
            }
        });
    }
    this.push(connection);
    done();
};

module.exports = Filter;
