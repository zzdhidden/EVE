(function() {
  var fn,
    __slice = Array.prototype.slice;

  Function.prototype.includer = function() {
    var argv, cl, key, obj, value, _i, _len, _ref;
    obj = arguments[0], argv = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    for (_i = 0, _len = argv.length; _i < _len; _i++) {
      cl = argv[_i];
      _ref = cl.prototype;
      for (key in _ref) {
        value = _ref[key];
        obj.prototype[key] = value;
      }
    }
    return obj;
  };

  Function.prototype.extender = function() {
    var argv, cl, key, obj, value, _i, _len, _ref;
    obj = arguments[0], argv = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    for (_i = 0, _len = argv.length; _i < _len; _i++) {
      cl = argv[_i];
      _ref = cl.prototype;
      for (key in _ref) {
        value = _ref[key];
        obj[key] = value;
      }
    }
    return obj;
  };

  Function.prototype.include = function() {
    var argv, cl, key, value, _i, _len, _ref;
    argv = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    for (_i = 0, _len = argv.length; _i < _len; _i++) {
      cl = argv[_i];
      _ref = cl.prototype;
      for (key in _ref) {
        value = _ref[key];
        this.prototype[key] = value;
      }
    }
    return this;
  };

  Function.prototype.extend = function() {
    var argv, cl, key, value, _i, _len, _ref;
    argv = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    for (_i = 0, _len = argv.length; _i < _len; _i++) {
      cl = argv[_i];
      _ref = cl.prototype;
      for (key in _ref) {
        value = _ref[key];
        this[key] = value;
      }
    }
    return this;
  };

  fn = {
    includer: function() {
      var argv, cl, key, obj, value, _i, _len, _ref;
      obj = arguments[0], argv = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      for (_i = 0, _len = argv.length; _i < _len; _i++) {
        cl = argv[_i];
        _ref = cl.prototype;
        for (key in _ref) {
          value = _ref[key];
          obj.prototype[key] = value;
        }
      }
      return obj;
    },
    extender: function() {
      var argv, cl, key, obj, value, _i, _len, _ref;
      obj = arguments[0], argv = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      for (_i = 0, _len = argv.length; _i < _len; _i++) {
        cl = argv[_i];
        _ref = cl.prototype;
        for (key in _ref) {
          value = _ref[key];
          obj[key] = value;
        }
      }
      return obj;
    },
    mixer: function() {
      var argv, cl, key, obj, value, _i, _len;
      obj = arguments[0], argv = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      for (_i = 0, _len = argv.length; _i < _len; _i++) {
        cl = argv[_i];
        for (key in cl) {
          value = cl[key];
          obj[key] = value;
        }
      }
      return obj;
    }
  };

  module.exports = fn;

}).call(this);
