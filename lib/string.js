(function() {
  var message, trim, type, validator, _trim, _trimRe,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  validator = require("./validator");

  type = require("./type");

  message = require("./message");

  _trimRe = /^\s+|\s+$/g;

  _trim = String.prototype.trim;

  trim = function(val) {
    return val && (_trim ? _trim.call(val) : val.replace(_trimRe, ""));
  };

  type._string = (function(_super) {

    __extends(_string, _super);

    function _string() {
      _string.__super__.constructor.apply(this, arguments);
    }

    _string.prototype.len = function(minOrLen, max, msg) {
      var last;
      last = arguments[arguments.length - 1];
      msg = typeof last === "number" ? null : last;
      this.validator((function(str) {
        return validator.len(str, minOrLen, max);
      }), typeof max === "number" ? message("len_in", msg, {
        min: minOrLen,
        max: max
      }) : message("len", msg, {
        len: minOrLen
      }));
      return this;
    };

    _string.prototype.match = function(re, msg) {
      this.validator((function(str) {
        if (str && str.match(re)) {
          return true;
        } else {
          return false;
        }
      }), message("match", msg, {
        expression: "" + re
      }));
      return this;
    };

    _string.prototype["enum"] = function(items, msg) {
      this._enum = items;
      this.validator((function(str) {
        return validator.contains(items, str);
      }), message("enum", msg, {
        items: items.join(",")
      }));
      return this;
    };

    _string.prototype.email = function(msg) {
      this._email = true;
      this.validator((function(str) {
        if (str && validator.isEmail(str)) {
          return true;
        } else {
          return false;
        }
      }), message("email", msg));
      return this;
    };

    _string.prototype.url = function(msg) {
      this._url = true;
      this.validator((function(str) {
        if (str && validator.isUrl(str)) {
          return true;
        } else {
          return false;
        }
      }), message("url", msg));
      return this;
    };

    _string.prototype.lowercase = function() {
      this.processors.push(function(str) {
        if (str) {
          return str.toLowerCase();
        } else {
          return str;
        }
      });
      return this;
    };

    _string.prototype.uppercase = function() {
      this.processors.push(function(str) {
        if (str) {
          return str.toUpperCase();
        } else {
          return str;
        }
      });
      return this;
    };

    _string.prototype.trim = function() {
      this.processors.push(function(str) {
        if (str) {
          return trim(str);
        } else {
          return str;
        }
      });
      return this;
    };

    _string.alias = String;

    _string.check = function(obj) {
      return validator.isString(obj);
    };

    _string.from = function(obj) {
      if (validator.isNumber(obj)) {
        return obj.toString();
      } else {
        return obj;
      }
    };

    return _string;

  })(type.Base);

  type.register('string', type._string);

}).call(this);
