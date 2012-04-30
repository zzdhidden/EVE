(function() {
  var validator;

  validator = (function() {

    function validator() {
      var i, types;
      this.class2type = {};
      types = "Boolean Number String Function Array Date RegExp Object".split(" ");
      i = types.length - 1;
      while (i >= 0) {
        this.class2type["[object " + types[i] + "]"] = types[i].toLowerCase();
        i--;
      }
    }

    validator.prototype.toString = Object.prototype.toString;

    validator.prototype.type = function(obj) {
      if (!(obj != null)) {
        return String(obj);
      } else {
        return this.class2type[this.toString.call(obj)] || "object";
      }
    };

    validator.prototype.isArray = function(obj) {
      return this.type(obj) === "array";
    };

    validator.prototype.isObject = function(obj) {
      return !!obj && this.type(obj) === "object";
    };

    validator.prototype.isNumber = function(obj) {
      return this.type(obj) === "number";
    };

    validator.prototype.isFunction = function(obj) {
      return this.type(obj) === "function";
    };

    validator.prototype.isDate = function(obj) {
      return this.type(obj) === "date";
    };

    validator.prototype.isRegExp = function(obj) {
      return this.type(obj) === "regexp";
    };

    validator.prototype.isBoolean = function(obj) {
      return this.type(obj) === "boolean";
    };

    validator.prototype.isString = function(obj) {
      return this.type(obj) === "string";
    };

    validator.prototype.isInteger = function(obj) {
      return this.type(obj) === "number" && !(obj % 1);
    };

    validator.prototype.isEmail = function(str) {
      return !!(str && str.match(/^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/));
    };

    validator.prototype.isUrl = function(str) {
      return !!(str && str.match(/^(?:(?:ht|f)tp(?:s?)\:\/\/|~\/|\/)?(?:\w+:\w+@)?((?:(?:[-\w\d{1-3}]+\.)+(?:com|org|net|gov|mil|biz|info|mobi|name|aero|jobs|edu|co\.uk|ac\.uk|it|fr|tv|museum|asia|local|travel|[a-z]{2}))|((\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)(\.(\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)){3}))(?::[\d]{1,5})?(?:(?:(?:\/(?:[-\w~!$+|.,=]|%[a-f\d]{2})+)+|\/)+|\?|#)?(?:(?:\?(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)(?:&(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)*)*(?:#(?:[-\w~!$ |\/.,*:;=]|%[a-f\d]{2})*)?$/));
    };

    validator.prototype.isAlpha = function(str) {
      return !!(str && str.match(/^[a-zA-Z]+$/));
    };

    validator.prototype.isNumeric = function(str) {
      return !!(str && str.match(/^-?[0-9]+$/));
    };

    validator.prototype.isAlphanumeric = function(str) {
      return !!(str && str.match(/^[a-zA-Z0-9]+$/));
    };

    validator.prototype.isIp = function(str) {
      return !!(str && str.match(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/));
    };

    validator.prototype.exists = function(obj) {
      return obj !== null && obj !== undefined;
    };

    validator.prototype.notEmpty = function(obj) {
      var key, val;
      if (this.isObject(obj)) {
        for (key in obj) {
          val = obj[key];
          if (val !== void 0) return true;
        }
        return false;
      }
      if (this.isNumber(obj)) return obj !== 0;
      return !!(obj !== null && obj !== undefined && !(obj + "").match(/^[\s\t\r\n]*$/));
    };

    validator.prototype.equals = function(obj, eql) {
      return obj === eql;
    };

    validator.prototype.contains = function(obj, item) {
      var i, n, t;
      if (!obj) return false;
      t = this.type(obj);
      if (this.type(obj.indexOf) === "function") {
        return obj.indexOf(item) !== -1;
      } else if (t === "array") {
        n = -1;
        i = obj.length - 1;
        while (i >= 0) {
          if (obj[i] === item) n = i;
          i--;
        }
        return n !== -1;
      }
      return false;
    };

    validator.prototype.len = function(obj, minOrLen, max) {
      if (!obj) return false;
      if (typeof max === "number") {
        return obj.length >= minOrLen && obj.length <= max;
      } else {
        return obj.length === minOrLen;
      }
    };

    validator.prototype.mod = function(val, by_, rem) {
      return val % (by_ || 1) === (rem || 0);
    };

    return validator;

  })();

  module.exports = new validator;

}).call(this);
