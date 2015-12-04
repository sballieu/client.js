// Filters the stream using various configurable conditions
// E.g.,
//  * filter on dates that should be later or earlier then something


var Transform = require('stream').Transform,
    util = require('util');

function Filter (http) {
    Transform.call(this, {objectMode : true});
    this._wheelchair = true;
    this._http = http;
}

util.inherits(Filter, Transform);

Filter.prototype._transform = function (connection, encoding, done) {
    if(this._wheelchair){
        this._http.get("http://localhost:3001/trips/" + connection["gtfs:trip"]["@id"]).then(
            function (result) {
                //check if trip is wheelchair accessible
                var trip = JSON.parse(result.end().data).wheelchair_accessible;
                if(trip === 2 || trip === 0) {
                    done();
                    return;
                }
            }
        )
    }
    this.push(connection);
    done();
};

module.exports = Filter;

