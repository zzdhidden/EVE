(function() {
  var message, type, validator,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  validator = require("./validator");

  type = require("./type");

  message = require("./message");

  type._date = (function(_super) {

    __extends(_date, _super);

    function _date() {
      _date.__super__.constructor.apply(this, arguments);
    }

    _date.alias = Date;

    _date.check = function(obj) {
      return validator.isDate(obj);
    };

    _date.from = function(obj) {
      var time;
      if (obj instanceof Date) return obj;
      if ('string' === typeof obj) {
        if ("" + parseInt(obj, 10) === obj) {
          return new Date(parseInt(obj, 10) * Math.pow(10, 13 - obj.length));
        }
        if (obj.length === 14) {
          return new Date(obj.obj.replace(/^(\d\d\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/, "$1-$2-$3 $4:$5:$6"));
        }
        time = Date.parse(obj);
        if (time) {
          return new Date(time);
        } else {
          return obj;
        }
      }
      if ('number' === typeof obj) {
        return new Date(obj * Math.pow(10, 13 - ("" + obj).length));
      }
      return obj;
    };

    return _date;

  })(type.Base);

  type.register('date', type._date);

}).call(this);
