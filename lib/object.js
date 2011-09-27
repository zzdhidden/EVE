
/**
* object type.
*/

var validator = require("./validator.js");
var type = require("./type.js");
var message = require("./message.js");

type.extend( "object", {
/*
* schema
*/
	init: function(schema) {
		var ar = this.schema = [];
		push( schema );
		function push (path, val) {
			//{a: [type.number()] }
			if( validator.isArray(val) ) {
				if( path ) ar.push([path, type.array.apply(null, val)]);
			} else if(validator.isObject(val)){
				if(validator.isString(val.type)){
					//type schema
					//{a: type.number() }
					ar.push([path, val]);
				}else{
					//{a: { b: type.number() } }
					for( var key in val ) {
						//"a.b"
						push(path ? (path + "." + key) : key, val);
					}
				}
			}
		}
	}
	, valueChild: function(){
		var ob = this._value
		, schema = this.schema
		, len = schema.length;
		for (var i = 0; i < len; i++) {
			var sc = schema[i];
			var path = new objectPath(ob, sc[0]);
			if( path.exists() ) {
				path.set( sc[1].value(path.get()).value() );
			}
		};
		return this;
	}
	, validateChild: function(callback, ignoreUndefined) {
		var ob = this._value
		, completed = 0
		, schema = this.schema
		, errors = []
		, len = schema.length;
		return this;
		function iterate(){
			var sc = schema[completed];
			var path = new objectPath(ob, sc[0]);
			if( ignoreUndefined && !path.exists() ) {
				next();
				return;
			}
			sc[1].validate(function(err){
				if( err ) {
					errors.push([sc[0], err]);
				}
			}, ob);
		}

		function next(){
			completed++;
			if( completed === len ) {
				done();
			}else{
				iterate();
			}
		}
		function error(){
			return errors.length && errors || null;
		}

		function done () {
			var e = error();
			callback && callback(e);
			return e;
		}	
	}
}, {
	check: function(obj){
		return validator.isObject(obj);
	}
	, from: function(obj){
		return validator.isObject(obj) ? obj : null;
	}
	, path: objectPath
} );

/**
* object value at object path...
*
* @param {Object} obj {a: {b: "test" } }
* @param {String} selector  e.b.c
*
*/

function objectPath(obj, selector){
	//a.b.c
	this.obj = obj;
	this.selector = selector.split(".");
}

objectPath.prototype.exists = function(){
	var val = this.obj
	, selector = this.selector;
	for (var i = 0, len = selector.length; i < len; i++) {
		var key = selector[i];
		if( !val || !Object.prototype.hasOwnProperty.call(val, key) ) {
			return false;
		}
		val = val[key];
	}
	return true;
}

objectPath.prototype.get = function(){
	var val = this.obj
	, selector = this.selector;
	for (var i = 0, len = selector.length; i < len; i++) {
		var key = selector[i];
		if( !val || !Object.prototype.hasOwnProperty.call(val, key) ) {
			return undefined;
		}
		val = val[key];
	}
	return val;
}

objectPath.prototype.set = function(value){
	var val = this.obj
	, selector = this.selector;
	if( !val) return;

	for (var i = 0, len = selector.length; i < len; i++) {
		var key = selector[i];
		if( i == (len - 1) ) {
			val[key] = value;
		} else {
			if( !val[key] ) {
				val[key] = {};
			}
			val = val[key];
		}
	}
}

