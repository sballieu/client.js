// Filters the stream using various configurable conditions
// E.g.,
//  * filter on dates that should be later or earlier then something


var Transform = require('stream').Transform,
    util = require('util'),
    httpsync = require('httpsync');

function Filter () {
    Transform.call(this, {objectMode : true});
    this.wheelchair = true;
}

util.inherits(Filter, Transform);

Filter.prototype._transform = function (connection, encoding, done) {
    if(this.wheelchair){
        //check stop arrival
        var stop_arr = JSON.parse(httpsync.get("http://localhost:3001/stops/" + connection.arrivalStop).end().data).wheelchair_boarding;

        //check stop depature
        var stop_dep = JSON.parse(httpsync.get("http://localhost:3001/stops/" + connection.departureStop).end().data).wheelchair_boarding;

        //check trip
        var trip = JSON.parse(httpsync.get("http://localhost:3001/trips/" + connection["gtfs:trip"]["@id"]).end().data).wheelchair_accessible;

        if(trip === 2 || stop_arr === 2 || stop_dep === 2) {
            //console.log("Connection removed from stream")
            done();
            return;
        }
    }
    this.push(connection);
    done();
};

module.exports = Filter;

