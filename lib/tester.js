(function() {
  var C, D, S, T, Tester1, Tester2, mix, s, _,
    __slice = Array.prototype.slice;

  _ = require('underscore');

  console.log(_.isEmpty({}));

  return;

  mix = function(A, B) {
    var x1, x2;
    B.prototype.prototype = A.prototype;
    x1 = {};
    x1.prototype = A.prototype;
    x2 = {};
    return x2.prototype = A.prototype = B.prototype;
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

  Tester1 = (function() {

    function Tester1(name) {
      this.name = name;
    }

    Tester1.prototype.my_name = function() {
      return console.log("Tester1 name is " + this.name);
    };

    return Tester1;

  })();

  Tester2 = (function() {

    function Tester2(name) {
      this.name = name;
    }

    Tester2.prototype.my_name = function() {
      return console.log("Tester2 name is " + this.name);
    };

    Tester2.prototype.other = function() {
      return console.log("other");
    };

    return Tester2;

  })();

  C = (function() {

    function C(name) {
      this.name = name;
    }

    C.include(Tester1, Tester2);

    return C;

  })();

  D = (function() {

    function D(name) {
      this.name = name;
    }

    D.extend(Tester2);

    return D;

  })();

  T = (function() {

    function T(num) {
      if (num == null) num = 0;
      this.num = num;
      if (num === 1) this.child = new arguments.callee;
    }

    T.prototype.cal = function() {
      return console.log(this);
    };

    return T;

  })();

  S = (function() {

    function S() {
      this.c = function() {
        return console.log(this);
      };
      this.a = "b";
      this.prot = arguments.callee.prototype;
    }

    S.prototype.s = function() {
      console.log(this);
      return this.c();
    };

    return S;

  })();

  s = new S;

  console.log(s.constructor.prototype);

}).call(this);
