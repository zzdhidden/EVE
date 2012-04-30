(function() {
  var error, message, type, validator,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  validator = require("./validator");

  type = require("./type");

  message = require("./message");

  error = require("./error");

  type._and = (function(_super) {

    __extends(_and, _super);

    function _and(schemas) {
      var self;
      _and.__super__.constructor.call(this);
      self = this;
      self.schemas = schemas;
    }

    _and.prototype.clone = function() {
      var cloned_schemas, key, obj, schema, val, _i, _len, _ref;
      cloned_schemas = [];
      _ref = this.schemas;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        schema = _ref[_i];
        cloned_schemas.push(schema.clone());
      }
      obj = new this.constructor(cloned_schemas);
      for (key in this) {
        val = this[key];
        if (this.hasOwnProperty(key) && key !== '_value' && key !== 'schemas') {
          obj[key] = val;
        }
      }
      return obj;
    };

    _and.prototype.validate = function(callback) {
      var er1, er2, self;
      self = this;
      er1 = void 0;
      if (this._value === null || this._value === void 0) {
        er2 = this._validate(function(err) {
          if (callback) return callback(err);
        });
      } else {
        er2 = this._validate(function(err) {
          return er1 = self.validateChild(err, callback);
        });
      }
      return er1 || er2;
    };

    _and.prototype.afterValue = function() {
      var sc, _i, _len, _ref;
      this.validate();
      if (this._valid_schemas) {
        _ref = this._valid_schemas;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          sc = _ref[_i];
          this._value = sc.val(this._value).val();
        }
      }
      return this;
    };

    _and.prototype.validateChild = function(err, callback) {
      var completed, done, errors, iterate, len, next, ob, schemas, self, _errors;
      ob = this._value;
      self = this;
      completed = 0;
      schemas = this.schemas;
      _errors = err || new error();
      len = schemas.length;
      this._valid_schemas = [];
      iterate = function() {
        var sc;
        sc = schemas[completed];
        return sc.val(ob).validate(function(err) {
          if (!err) self._valid_schemas.push(sc);
          if (err) _errors.on(completed, err);
          return next();
        });
      };
      next = function() {
        completed++;
        if (completed === len) return done();
        return iterate();
      };
      errors = function() {
        if (self._valid_schemas.length === len) return null;
        return _errors.ok && _errors || null;
      };
      done = function() {
        var e;
        e = errors();
        callback && callback(e);
        return e;
      };
      iterate();
      return errors();
    };

    return _and;

  })(type.Base);

  type.register('and', type._and);

}).call(this);
