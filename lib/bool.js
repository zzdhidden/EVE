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

  type._bool = (function(_super) {

    __extends(_bool, _super);

    function _bool() {
      _bool.__super__.constructor.call(this);
      this.validator(function(val) {
        return validator.isBoolean(val);
      }, message("invalid"));
    }

    _bool.check = function(obj) {
      return validator.isBoolean(obj);
    };

    _bool.from = function(obj) {
      var val;
      if (validator.isString(obj)) {
        val = trim(obj).toLowerCase();
        if (val === "false") return false;
        if (val === "true") return true;
      }
      return obj;
    };

    return _bool;

  })(type.Base);

  type.register('bool', type._bool);

}).call(this);
