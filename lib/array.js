(function() {
  var error, message, type, validator,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  error = require("./error");

  validator = require("./validator");

  type = require("./type");

  message = require("./message");

  type._array = (function(_super) {

    __extends(_array, _super);

    function _array(schema) {
      var sc;
      _array.__super__.constructor.call(this);
      this.original_schema = schema;
      sc = type(schema);
      if (!sc && validator.isObject(schema) && type.object) {
        sc = type.object(schema);
      }
      this.schema = sc;
    }

    _array.prototype.clone = function() {
      var key, obj, val;
      obj = new this.constructor(this.original_schema.clone());
      for (key in this) {
        val = this[key];
        if (this.hasOwnProperty(key) && key !== '_value' && key !== 'schema') {
          obj[key] = val;
        }
      }
      return obj;
    };

    _array.prototype.len = function(minOrLen, max, msg) {
      var last;
      last = arguments[arguments.length - 1];
      msg = typeof last === "number" ? null : last;
      this.validator((function(ar) {
        return validator.len(ar, minOrLen, max);
      }), (typeof max === "number" ? message("len_in", msg, {
        min: minOrLen,
        max: max
      }) : message("len", msg, {
        len: minOrLen
      })));
      return this;
    };

    _array.prototype.afterValue = function() {
      var i, len, ob, schema;
      ob = this._value;
      schema = this.schema;
      len = ob && ob.length;
      if (schema && len) {
        i = 0;
        while (i < len) {
          ob[i] = schema.val(ob[i]).val();
          i++;
        }
      }
      return this;
    };

    _array.prototype.validate = function(callback) {
      var er1, er2, self;
      self = this;
      er1 = void 0;
      if (this._value === null || this._value === void 0 || this._value.length === 0) {
        er2 = this._validate(function(err) {
          if (callback) return callback(err);
        });
      } else {
        er2 = this._validate(function(err) {
          er1 = self.schema && self._value && self._value.length && self.validateChild(err, callback) || null;
          if (err && callback) return callback(err);
        });
      }
      return er1 || er2;
    };

    _array.prototype.validateChild = function(err, callback) {
      var completed, done, errors, iterate, len, next, ob, schema, _errors;
      iterate = function() {
        var item;
        item = ob[completed];
        return schema.val(item).validate(function(err) {
          if (err) _errors.on(completed, err);
          return next();
        });
      };
      next = function() {
        completed++;
        if (completed === len) {
          return done();
        } else {
          return iterate();
        }
      };
      errors = function() {
        return _errors.ok && _errors || null;
      };
      done = function() {
        var e;
        e = errors();
        callback && callback(e);
        return e;
      };
      ob = this._value;
      completed = 0;
      schema = this.schema;
      _errors = err || new error();
      len = ob.length;
      iterate();
      return errors();
    };

    _array.alias = Array;

    _array.check = function(obj) {
      return validator.isArray(obj);
    };

    _array.from = function(obj) {
      return obj;
    };

    return _array;

  })(type.Base);

  type.register('array', type._array);

}).call(this);
