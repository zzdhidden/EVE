(function() {
  var error, hasOwnProperty, message, objectPath, type, validator,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  objectPath = function(obj, selector) {
    this.obj = obj;
    this.selector = selector.split(".");
    return this;
  };

  validator = require("./validator");

  type = require("./type");

  message = require("./message");

  error = require("./error");

  type._object = (function(_super) {

    __extends(_object, _super);

    function _object(schema) {
      var ar, push, self;
      _object.__super__.constructor.call(this);
      self = this;
      this.original_schema = schema;
      ar = self.schema = [];
      push = function(path, val) {
        var key, sc, v, _results;
        sc = type(val);
        if (sc) {
          return ar.push([path, sc]);
        } else if (validator.isArray(val) && type.array) {
          if (path) return ar.push([path, type.array.apply(null, val)]);
        } else if (validator.isObject(val)) {
          _results = [];
          for (key in val) {
            v = val[key];
            _results.push(push((path ? path + "." + key : key), v));
          }
          return _results;
        }
      };
      push(null, schema);
    }

    _object.prototype.clone = function() {
      var k, key, new_schema, obj, v, val, _ref;
      new_schema = {};
      _ref = this.original_schema;
      for (k in _ref) {
        v = _ref[k];
        new_schema[k] = v.clone();
      }
      obj = new this.constructor(new_schema);
      for (key in this) {
        val = this[key];
        if (this.hasOwnProperty(key) && key !== '_value' && key !== 'schema') {
          obj[key] = val;
        }
      }
      return obj;
    };

    _object.prototype.afterValue = function() {
      var default_, i, len, ob, path, sc, schema;
      ob = this._value;
      schema = this.schema;
      len = schema.length;
      i = 0;
      while (i < len) {
        sc = schema[i];
        path = new objectPath(ob, sc[0]);
        if (path.exists()) {
          path.set(sc[1].value(path.get()).value());
        } else {
          default_ = sc[1].value(null).value();
          if (default_) {
            path.set(default_);
          } else {
            sc[1].value(null);
          }
        }
        i++;
      }
      return this;
    };

    _object.prototype.validate = function(callback) {
      var er1, er2, self;
      self = this;
      er1 = void 0;
      er2 = this._validate(function(err) {
        return er1 = self.validateChild(err, false, callback);
      });
      return er1 || er2;
    };

    _object.prototype.validateChild = function(err, ignoreUndefined, callback) {
      var completed, done, errors, iterate, len, next, ob, schema, _errors;
      ob = this._value;
      completed = 0;
      schema = this.schema;
      _errors = err || new error();
      len = schema.length;
      iterate = function() {
        var path, sc;
        sc = schema[completed];
        path = new objectPath(ob, sc[0]);
        if (ob === null) return next();
        if (ignoreUndefined && !path.exists()) return next();
        return sc[1].context(ob).validate((function(err) {
          if (err) _errors.on(sc[0], err);
          return next();
        }), ignoreUndefined);
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
      iterate();
      return errors();
    };

    _object.alias = Object;

    _object.check = function(obj) {
      return validator.isObject(obj);
    };

    _object.from = function(obj) {
      if (validator.exists(obj)) {
        if (validator.isObject(obj)) {
          return obj;
        } else {
          return obj;
        }
      } else {
        return obj;
      }
    };

    _object.path = objectPath;

    return _object;

  })(type.Base);

  hasOwnProperty = Object.prototype.hasOwnProperty;

  objectPath.prototype.exists = function() {
    var i, key, len, selector, val;
    val = this.obj;
    selector = this.selector;
    i = 0;
    len = selector.length;
    while (i < len) {
      key = selector[i];
      if (!val || !hasOwnProperty.call(val, key)) return false;
      val = val[key];
      i++;
    }
    return true;
  };

  objectPath.prototype.get = function() {
    var i, key, len, selector, val;
    val = this.obj;
    selector = this.selector;
    i = 0;
    len = selector.length;
    while (i < len) {
      key = selector[i];
      if (!val || !hasOwnProperty.call(val, key)) return undefined;
      val = val[key];
      i++;
    }
    return val;
  };

  objectPath.prototype.set = function(value) {
    var i, key, len, selector, val, _results;
    val = this.obj;
    selector = this.selector;
    if (!val) return;
    i = 0;
    len = selector.length;
    _results = [];
    while (i < len) {
      key = selector[i];
      if (i === (len - 1)) {
        val[key] = value;
      } else {
        if (!val[key]) val[key] = {};
        val = val[key];
      }
      _results.push(i++);
    }
    return _results;
  };

  type.register('object', type._object);

}).call(this);
