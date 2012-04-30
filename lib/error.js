(function() {
  var error, validator,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  validator = require("./validator");

  error = (function(_super) {

    __extends(error, _super);

    function error() {
      Error.call(this);
      Error.captureStackTrace && Error.captureStackTrace(this, arguments.callee);
      this.ok = false;
      this.name = 'EveError';
      this._messages = [];
      this._hasChildren = false;
      this._children = {};
    }

    error.prototype.toString = function() {
      return this.name + ': ' + this.message;
    };

    error.prototype.alias = function(name) {
      return this._alias = name;
    };

    error.prototype.push = function(msg) {
      this._messages.push(msg);
      this.message = this.concat(this.message, (this._alias ? this._alias + " " : "") + msg);
      return this.ok = true;
    };

    error.prototype.on = function(key, er) {
      var l;
      l = arguments.length;
      if (l === 1) return this._children[key] || null;
      if (er instanceof error) {
        this._hasChildren = true;
        if (!this.ok) this.ok = er.ok;
        this._children[key] = er;
        return this.message = this.concat(this.message, er.message);
      }
    };

    error.prototype.at = true;

    error.prototype.messages = function(withoutName) {
      var key, messages, msg, name, val, _i, _len, _ref, _ref2;
      messages = [];
      name = withoutName ? '' : this._alias || '';
      name = name ? name + " " : "";
      _ref = this._messages;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        msg = _ref[_i];
        messages.push(name + msg);
      }
      if (this._hasChildren) {
        _ref2 = this._children;
        for (key in _ref2) {
          val = _ref2[key];
          this.merge(messages, val.messages(withoutName));
        }
      }
      if (messages.length) {
        return messages;
      } else {
        return null;
      }
    };

    error.prototype.concat = function(s1, s2) {
      if (s1 && s2) {
        return s1 + "\n" + s2;
      } else {
        return s1 || s2;
      }
    };

    error.prototype.merge = function(ar1, ar2) {
      var val, _i, _len, _results;
      if (!ar2) return;
      _results = [];
      for (_i = 0, _len = ar2.length; _i < _len; _i++) {
        val = ar2[_i];
        _results.push(ar1.push(val));
      }
      return _results;
    };

    return error;

  })(Error);

  module.exports = error;

}).call(this);
