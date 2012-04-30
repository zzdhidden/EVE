(function() {
  var error, message, moduler, process, type, validate, validator, _mapper,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  validator = require("./validator");

  message = require("./message");

  error = require("./error");

  moduler = require('./moduler');

  _mapper = {};

  process = function(schema, val, context) {
    var fn, len, processor, processors, _i, _len;
    processors = schema.processors;
    len = processors.length;
    fn = function(processor) {
      return val = processor.call(context || null, val);
    };
    for (_i = 0, _len = processors.length; _i < _len; _i++) {
      processor = processors[_i];
      fn(processor);
    }
    return val;
  };

  type = module.exports = function(key) {
    if (key && key.type && type[key.type] && key instanceof type["_" + key.type]) {
      return key;
    }
    if (_mapper[key]) {
      key = _mapper[key];
    } else {
      key = null;
    }
    return key && type[key] && type[key]() || null;
  };

  type.Base = (function() {

    function Base() {
      this._default = null;
      this._value = null;
      this._required = false;
      this._notEmpty = false;
      this.validators = [];
      this.processors = [];
      this.type = this.constructor.type;
      this.value = this.valFn;
      this.val = this.valFn;
    }

    Base.prototype.clone = function() {
      var key, obj, val;
      obj = new this.constructor();
      for (key in this) {
        val = this[key];
        if (this.hasOwnProperty(key) && key !== '_value') obj[key] = val;
      }
      return obj;
    };

    Base.prototype.required = function(msg) {
      this._required = message("required", msg);
      return this;
    };

    Base.prototype.notEmpty = function(msg) {
      this._notEmpty = message("notEmpty", msg);
      return this;
    };

    Base.prototype["default"] = function(value) {
      if (!arguments.length) {
        if (typeof this._default === 'function') {
          return this._default();
        } else {
          return this._default;
        }
      }
      this._default = value;
      return this;
    };

    Base.prototype.alias = function(value) {
      if (!arguments.length) {
        if (typeof this._alias === 'function') {
          return this._alias();
        } else {
          return this._alias;
        }
      }
      this._alias = value;
      return this;
    };

    Base.prototype.context = function(context) {
      this._context = context;
      return this;
    };

    Base.prototype.validator = function(fn, msg) {
      this.validators.push([fn, message("invalid", msg)]);
      return this;
    };

    Base.prototype.processor = function(fn) {
      this.processors.push(fn);
      return this;
    };

    Base.prototype._validate = function(callback) {
      return validate(this, this._value, callback, this._context);
    };

    Base.prototype.validate = function(callback) {
      return this._validate(callback);
    };

    Base.prototype.process = function() {
      return this._value = process(this, this._value);
    };

    Base.prototype.exists = function() {
      return this.required;
    };

    Base.prototype.valFn = function(value) {
      if (!arguments.length) return this._value;
      if (validator.exists(value)) {} else {
        value = this["default"]() || value;
      }
      if (typeof this.constructor.from === "function") {
        this._value = this.constructor.from(value);
      } else {
        this._value = value;
      }
      this.process();
      this.afterValue && this.afterValue();
      return this;
    };

    Base.check = function() {
      return true;
    };

    Base.from = function(val) {
      return val;
    };

    return Base;

  })();

  validate = function(schema, val, callback, context) {
    var completed, done, errors, iterate, len, next, notEmpty, notExists, required, validators, _errors,
      _this = this;
    validators = schema.validators;
    len = validators.length;
    required = schema._required;
    notExists = !validator.exists(val);
    notEmpty = schema._notEmpty;
    completed = 0;
    _errors = new error();
    _errors.alias(schema.alias());
    errors = function() {
      return _errors.ok && _errors || null;
    };
    done = function() {
      var e;
      e = errors();
      validator.isFunction(callback) && callback(e);
      return e;
    };
    if (required && notExists) {
      _errors.push(required);
      return done();
    }
    if (notExists) return done();
    if (!schema.constructor.check(val)) {
      _errors.push(message("wrongType", "", {
        type: schema.constructor.name
      }));
      return done();
    }
    if (notEmpty && !validator.notEmpty(val)) {
      _errors.push(notEmpty);
      return done();
    }
    if (!len) return done();
    iterate = function() {
      var async, fn, msg, stopWhenError, valid, __validator;
      __validator = validators[completed];
      fn = __validator[0];
      msg = __validator[1];
      async = true;
      stopWhenError = __validator[2];
      valid = fn.call(context || null, val, function(ok) {
        if (!async) return;
        if (!ok) {
          _errors.push(msg);
          if (stopWhenError) return done();
        }
        return next();
      });
      if (typeof valid === "boolean") {
        async = false;
        if (!valid) {
          _errors.push(msg);
          if (stopWhenError) return done();
        }
        return next();
      }
    };
    next = function() {
      completed++;
      if (completed === len) {
        return done();
      } else {
        return iterate();
      }
    };
    iterate();
    return errors();
  };

  type.register = function(name, klass) {
    klass.type = name;
    if (klass.alias) _mapper[klass.alias] = name;
    return type[name] = function(args) {
      return new klass(args);
    };
  };

  type._any = (function(_super) {

    __extends(_any, _super);

    function _any() {
      _any.__super__.constructor.apply(this, arguments);
    }

    return _any;

  })(type.Base);

  type.register('any', type._any);

}).call(this);
