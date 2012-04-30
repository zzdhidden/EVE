var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var res = mod._cached ? mod._cached : mod();
    return res;
}

require.paths = [];
require.modules = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = x + '/package.json';
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key)
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

require.define = function (filename, fn) {
    var dirname = require._core[filename]
        ? ''
        : require.modules.path().dirname(filename)
    ;
    
    var require_ = function (file) {
        return require(file, dirname)
    };
    require_.resolve = function (name) {
        return require.resolve(name, dirname);
    };
    require_.modules = require.modules;
    require_.define = require.define;
    var module_ = { exports : {} };
    
    require.modules[filename] = function () {
        require.modules[filename]._cached = module_.exports;
        fn.call(
            module_.exports,
            require_,
            module_,
            module_.exports,
            dirname,
            filename
        );
        require.modules[filename]._cached = module_.exports;
        return module_.exports;
    };
};

if (typeof process === 'undefined') process = {};

if (!process.nextTick) process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;
    
    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }
    
    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

if (!process.title) process.title = 'browser';

if (!process.binding) process.binding = function (name) {
    if (name === 'evals') return require('vm')
    else throw new Error('No such module')
};

if (!process.cwd) process.cwd = function () { return '.' };

if (!process.env) process.env = {};
if (!process.argv) process.argv = [];

require.define("path", function (require, module, exports, __dirname, __filename) {
function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("/test/and.test.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var assert, deepEqual, equal, eve, fail, notDeepEqual, notEqual, notStrictEqual, ok, strictEqual, type, _ref;

  _ref = require("./helper"), assert = _ref.assert, ok = _ref.ok, fail = _ref.fail, equal = _ref.equal, notEqual = _ref.notEqual, deepEqual = _ref.deepEqual, notDeepEqual = _ref.notDeepEqual, strictEqual = _ref.strictEqual, notStrictEqual = _ref.notStrictEqual, eve = _ref.eve;

  type = eve.type;

  describe("type", function() {
    return describe("and", function() {
      beforeEach(function() {
        return this.schema = type.and([type.string().lowercase().notEmpty().len(3, 12), type.string().trim().notEmpty().email()]);
      });
      it("should have and type", function() {
        return ok(type.and);
      });
      it("should process values", function() {
        var val;
        val = this.schema.val(" Test@g.com ").val();
        equal(val, "test@g.com");
        return ok(!this.schema.validate());
      });
      it("should validate required if required and embedded in object", function() {
        var errs, sc;
        sc = type.object({
          test: type.and([type.string().len(5), type.string().email()]).required()
        });
        errs = sc.val({
          test2: ["a"]
        }).validate(function(errs) {
          ok(errs);
          return equal(errs.messages().length, 1);
        });
        ok(errs);
        return equal(errs.messages().length, 1);
      });
      it("should not validate required if not required and embedded in object", function() {
        var errs, sc;
        sc = type.object({
          test: type.and([type.string().len(5), type.string().email()])
        });
        errs = sc.val({
          test2: ["a"]
        }).validate(function(errs) {
          return ok(!errs);
        });
        return ok(!errs);
      });
      it("should process values for clones", function() {
        var sc, val;
        sc = this.schema.clone();
        val = sc.val(" Test@g.com ").val();
        equal(val, "test@g.com");
        return ok(!sc.validate());
      });
      it("should be able to validate if both fails", function(done) {
        var errs;
        this.schema.val("");
        errs = this.schema.validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 2);
          return done();
        });
        return ok(errs);
      });
      it("should be able to validate if both fails for clones", function(done) {
        var errs, sc;
        sc = this.schema.clone();
        sc.val("");
        errs = sc.validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 2);
          return done();
        });
        return ok(errs);
      });
      it("should be able to validate if one is valid", function(done) {
        var errs;
        this.schema.val("test");
        errs = this.schema.validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 1);
          return done();
        });
        return ok(errs);
      });
      it("should be able to validate if one is valid for clones", function(done) {
        var errs, sc;
        sc = this.schema.clone();
        sc.val("test");
        errs = sc.validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 1);
          return done();
        });
        return ok(errs);
      });
      it("should be able to validate if both are valid", function(done) {
        var errs;
        this.schema.val("ddddt@g.com");
        return errs = this.schema.validate(function(errs) {
          ok(!errs);
          return done();
        });
      });
      it("should be able to validate if both are valid for clones", function(done) {
        var errs, sc;
        sc = this.schema.clone();
        sc.val("ddddt@g.com");
        return errs = sc.validate(function(errs) {
          ok(!errs);
          return done();
        });
      });
      it("should be able to validate async", function(done) {
        var sc;
        sc = type.and([
          type.string().validator(function(val, next) {
            return setTimeout((function() {
              return next(val !== "admin");
            }), 100);
          }, "must not be admin"), type.string().trim().email().validator(function(val, next) {
            return setTimeout((function() {
              return next(val.length !== 5);
            }), 100);
          }, "must not have 5 chars")
        ]);
        return sc.val("admin").validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 3);
          return done();
        });
      });
      return it("should support custom validators", function() {
        var sc;
        sc = type.and([
          type.string().validator(function(val) {
            ok(this);
            equal(val, "admin");
            return true;
          })
        ]);
        return sc.val("admin").validate();
      });
    });
  });

}).call(this);

});

require.define("/test/helper.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var exporter, exports;

  if ((typeof window) !== 'undefined') {
    exporter = window.chai.assert;
  } else {
    exporter = require("chai").assert;
  }

  exporter.eve = require("./../lib/eve.js");

  exports = module.exports = exporter;

}).call(this);

});

require.define("/node_modules/chai/package.json", function (require, module, exports, __dirname, __filename) {
module.exports = {"main":"./index"}
});

require.define("/node_modules/chai/index.js", function (require, module, exports, __dirname, __filename) {
module.exports = (process && process.env && process.env.CHAI_COV)
  ? require('./lib-cov/chai')
  : require('./lib/chai');

});

require.define("/node_modules/chai/lib-cov/chai.js", function (require, module, exports, __dirname, __filename) {
/* automatically generated by JSCoverage - do not edit */
if (typeof _$jscoverage === 'undefined') _$jscoverage = {};
if (! _$jscoverage['chai.js']) {
  _$jscoverage['chai.js'] = [];
  _$jscoverage['chai.js'][7] = 0;
  _$jscoverage['chai.js'][8] = 0;
  _$jscoverage['chai.js'][10] = 0;
  _$jscoverage['chai.js'][12] = 0;
  _$jscoverage['chai.js'][13] = 0;
  _$jscoverage['chai.js'][15] = 0;
  _$jscoverage['chai.js'][17] = 0;
  _$jscoverage['chai.js'][18] = 0;
  _$jscoverage['chai.js'][19] = 0;
  _$jscoverage['chai.js'][20] = 0;
  _$jscoverage['chai.js'][23] = 0;
  _$jscoverage['chai.js'][26] = 0;
  _$jscoverage['chai.js'][27] = 0;
  _$jscoverage['chai.js'][29] = 0;
  _$jscoverage['chai.js'][30] = 0;
  _$jscoverage['chai.js'][32] = 0;
  _$jscoverage['chai.js'][33] = 0;
}
_$jscoverage['chai.js'][7]++;
var used = [];
_$jscoverage['chai.js'][8]++;
var exports = module.exports = {};
_$jscoverage['chai.js'][10]++;
exports.version = "0.5.2";
_$jscoverage['chai.js'][12]++;
exports.Assertion = require("./assertion");
_$jscoverage['chai.js'][13]++;
exports.AssertionError = require("./error");
_$jscoverage['chai.js'][15]++;
exports.inspect = require("./utils/inspect");
_$jscoverage['chai.js'][17]++;
exports.use = (function (fn) {
  _$jscoverage['chai.js'][18]++;
  if (! ~ used.indexOf(fn)) {
    _$jscoverage['chai.js'][19]++;
    fn(this);
    _$jscoverage['chai.js'][20]++;
    used.push(fn);
  }
  _$jscoverage['chai.js'][23]++;
  return this;
});
_$jscoverage['chai.js'][26]++;
var expect = require("./interface/expect");
_$jscoverage['chai.js'][27]++;
exports.use(expect);
_$jscoverage['chai.js'][29]++;
var should = require("./interface/should");
_$jscoverage['chai.js'][30]++;
exports.use(should);
_$jscoverage['chai.js'][32]++;
var assert = require("./interface/assert");
_$jscoverage['chai.js'][33]++;
exports.use(assert);
_$jscoverage['chai.js'].source = ["/*!"," * chai"," * Copyright(c) 2011-2012 Jake Luer &lt;jake@alogicalparadox.com&gt;"," * MIT Licensed"," */","","var used = [];","var exports = module.exports = {};","","exports.version = '0.5.2';","","exports.Assertion = require('./assertion');","exports.AssertionError = require('./error');","","exports.inspect = require('./utils/inspect');","","exports.use = function (fn) {","  if (!~used.indexOf(fn)) {","    fn(this);","    used.push(fn);","  }","","  return this;","};","","var expect = require('./interface/expect');","exports.use(expect);","","var should = require('./interface/should');","exports.use(should);","","var assert = require('./interface/assert');","exports.use(assert);"];

});

require.define("/node_modules/chai/lib-cov/assertion.js", function (require, module, exports, __dirname, __filename) {
/* automatically generated by JSCoverage - do not edit */
if (typeof _$jscoverage === 'undefined') _$jscoverage = {};
if (! _$jscoverage['assertion.js']) {
  _$jscoverage['assertion.js'] = [];
  _$jscoverage['assertion.js'][48] = 0;
  _$jscoverage['assertion.js'][57] = 0;
  _$jscoverage['assertion.js'][68] = 0;
  _$jscoverage['assertion.js'][69] = 0;
  _$jscoverage['assertion.js'][70] = 0;
  _$jscoverage['assertion.js'][71] = 0;
  _$jscoverage['assertion.js'][87] = 0;
  _$jscoverage['assertion.js'][103] = 0;
  _$jscoverage['assertion.js'][104] = 0;
  _$jscoverage['assertion.js'][105] = 0;
  _$jscoverage['assertion.js'][108] = 0;
  _$jscoverage['assertion.js'][109] = 0;
  _$jscoverage['assertion.js'][127] = 0;
  _$jscoverage['assertion.js'][129] = 0;
  _$jscoverage['assertion.js'][143] = 0;
  _$jscoverage['assertion.js'][145] = 0;
  _$jscoverage['assertion.js'][159] = 0;
  _$jscoverage['assertion.js'][161] = 0;
  _$jscoverage['assertion.js'][176] = 0;
  _$jscoverage['assertion.js'][178] = 0;
  _$jscoverage['assertion.js'][179] = 0;
  _$jscoverage['assertion.js'][193] = 0;
  _$jscoverage['assertion.js'][195] = 0;
  _$jscoverage['assertion.js'][208] = 0;
  _$jscoverage['assertion.js'][210] = 0;
  _$jscoverage['assertion.js'][224] = 0;
  _$jscoverage['assertion.js'][226] = 0;
  _$jscoverage['assertion.js'][240] = 0;
  _$jscoverage['assertion.js'][242] = 0;
  _$jscoverage['assertion.js'][256] = 0;
  _$jscoverage['assertion.js'][258] = 0;
  _$jscoverage['assertion.js'][272] = 0;
  _$jscoverage['assertion.js'][274] = 0;
  _$jscoverage['assertion.js'][275] = 0;
  _$jscoverage['assertion.js'][294] = 0;
  _$jscoverage['assertion.js'][296] = 0;
  _$jscoverage['assertion.js'][301] = 0;
  _$jscoverage['assertion.js'][315] = 0;
  _$jscoverage['assertion.js'][317] = 0;
  _$jscoverage['assertion.js'][324] = 0;
  _$jscoverage['assertion.js'][338] = 0;
  _$jscoverage['assertion.js'][340] = 0;
  _$jscoverage['assertion.js'][347] = 0;
  _$jscoverage['assertion.js'][366] = 0;
  _$jscoverage['assertion.js'][368] = 0;
  _$jscoverage['assertion.js'][374] = 0;
  _$jscoverage['assertion.js'][390] = 0;
  _$jscoverage['assertion.js'][392] = 0;
  _$jscoverage['assertion.js'][394] = 0;
  _$jscoverage['assertion.js'][395] = 0;
  _$jscoverage['assertion.js'][396] = 0;
  _$jscoverage['assertion.js'][397] = 0;
  _$jscoverage['assertion.js'][400] = 0;
  _$jscoverage['assertion.js'][405] = 0;
  _$jscoverage['assertion.js'][423] = 0;
  _$jscoverage['assertion.js'][425] = 0;
  _$jscoverage['assertion.js'][433] = 0;
  _$jscoverage['assertion.js'][450] = 0;
  _$jscoverage['assertion.js'][451] = 0;
  _$jscoverage['assertion.js'][457] = 0;
  _$jscoverage['assertion.js'][472] = 0;
  _$jscoverage['assertion.js'][473] = 0;
  _$jscoverage['assertion.js'][479] = 0;
  _$jscoverage['assertion.js'][494] = 0;
  _$jscoverage['assertion.js'][495] = 0;
  _$jscoverage['assertion.js'][500] = 0;
  _$jscoverage['assertion.js'][515] = 0;
  _$jscoverage['assertion.js'][516] = 0;
  _$jscoverage['assertion.js'][521] = 0;
  _$jscoverage['assertion.js'][537] = 0;
  _$jscoverage['assertion.js'][538] = 0;
  _$jscoverage['assertion.js'][540] = 0;
  _$jscoverage['assertion.js'][545] = 0;
  _$jscoverage['assertion.js'][560] = 0;
  _$jscoverage['assertion.js'][561] = 0;
  _$jscoverage['assertion.js'][563] = 0;
  _$jscoverage['assertion.js'][571] = 0;
  _$jscoverage['assertion.js'][590] = 0;
  _$jscoverage['assertion.js'][591] = 0;
  _$jscoverage['assertion.js'][592] = 0;
  _$jscoverage['assertion.js'][597] = 0;
  _$jscoverage['assertion.js'][617] = 0;
  _$jscoverage['assertion.js'][618] = 0;
  _$jscoverage['assertion.js'][619] = 0;
  _$jscoverage['assertion.js'][620] = 0;
  _$jscoverage['assertion.js'][623] = 0;
  _$jscoverage['assertion.js'][629] = 0;
  _$jscoverage['assertion.js'][630] = 0;
  _$jscoverage['assertion.js'][640] = 0;
  _$jscoverage['assertion.js'][641] = 0;
  _$jscoverage['assertion.js'][657] = 0;
  _$jscoverage['assertion.js'][658] = 0;
  _$jscoverage['assertion.js'][662] = 0;
  _$jscoverage['assertion.js'][679] = 0;
  _$jscoverage['assertion.js'][680] = 0;
  _$jscoverage['assertion.js'][681] = 0;
  _$jscoverage['assertion.js'][683] = 0;
  _$jscoverage['assertion.js'][691] = 0;
  _$jscoverage['assertion.js'][706] = 0;
  _$jscoverage['assertion.js'][707] = 0;
  _$jscoverage['assertion.js'][712] = 0;
  _$jscoverage['assertion.js'][727] = 0;
  _$jscoverage['assertion.js'][728] = 0;
  _$jscoverage['assertion.js'][733] = 0;
  _$jscoverage['assertion.js'][748] = 0;
  _$jscoverage['assertion.js'][749] = 0;
  _$jscoverage['assertion.js'][751] = 0;
  _$jscoverage['assertion.js'][756] = 0;
  _$jscoverage['assertion.js'][770] = 0;
  _$jscoverage['assertion.js'][772] = 0;
  _$jscoverage['assertion.js'][773] = 0;
  _$jscoverage['assertion.js'][792] = 0;
  _$jscoverage['assertion.js'][793] = 0;
  _$jscoverage['assertion.js'][796] = 0;
  _$jscoverage['assertion.js'][800] = 0;
  _$jscoverage['assertion.js'][802] = 0;
  _$jscoverage['assertion.js'][806] = 0;
  _$jscoverage['assertion.js'][807] = 0;
  _$jscoverage['assertion.js'][811] = 0;
  _$jscoverage['assertion.js'][812] = 0;
  _$jscoverage['assertion.js'][816] = 0;
  _$jscoverage['assertion.js'][817] = 0;
  _$jscoverage['assertion.js'][818] = 0;
  _$jscoverage['assertion.js'][820] = 0;
  _$jscoverage['assertion.js'][821] = 0;
  _$jscoverage['assertion.js'][823] = 0;
  _$jscoverage['assertion.js'][827] = 0;
  _$jscoverage['assertion.js'][830] = 0;
  _$jscoverage['assertion.js'][833] = 0;
  _$jscoverage['assertion.js'][841] = 0;
  _$jscoverage['assertion.js'][871] = 0;
  _$jscoverage['assertion.js'][872] = 0;
  _$jscoverage['assertion.js'][874] = 0;
  _$jscoverage['assertion.js'][876] = 0;
  _$jscoverage['assertion.js'][877] = 0;
  _$jscoverage['assertion.js'][878] = 0;
  _$jscoverage['assertion.js'][879] = 0;
  _$jscoverage['assertion.js'][880] = 0;
  _$jscoverage['assertion.js'][881] = 0;
  _$jscoverage['assertion.js'][884] = 0;
  _$jscoverage['assertion.js'][885] = 0;
  _$jscoverage['assertion.js'][888] = 0;
  _$jscoverage['assertion.js'][889] = 0;
  _$jscoverage['assertion.js'][893] = 0;
  _$jscoverage['assertion.js'][896] = 0;
  _$jscoverage['assertion.js'][897] = 0;
  _$jscoverage['assertion.js'][902] = 0;
  _$jscoverage['assertion.js'][903] = 0;
  _$jscoverage['assertion.js'][904] = 0;
  _$jscoverage['assertion.js'][909] = 0;
  _$jscoverage['assertion.js'][911] = 0;
  _$jscoverage['assertion.js'][915] = 0;
  _$jscoverage['assertion.js'][917] = 0;
  _$jscoverage['assertion.js'][922] = 0;
  _$jscoverage['assertion.js'][938] = 0;
  _$jscoverage['assertion.js'][939] = 0;
  _$jscoverage['assertion.js'][943] = 0;
  _$jscoverage['assertion.js'][951] = 0;
  _$jscoverage['assertion.js'][966] = 0;
  _$jscoverage['assertion.js'][967] = 0;
  _$jscoverage['assertion.js'][975] = 0;
  _$jscoverage['assertion.js'][991] = 0;
  _$jscoverage['assertion.js'][992] = 0;
  _$jscoverage['assertion.js'][997] = 0;
  _$jscoverage['assertion.js'][1004] = 0;
  _$jscoverage['assertion.js'][1005] = 0;
  _$jscoverage['assertion.js'][1006] = 0;
}
_$jscoverage['assertion.js'][48]++;
var AssertionError = require("./error"), eql = require("./utils/eql"), toString = Object.prototype.toString, inspect = require("./utils/inspect");
_$jscoverage['assertion.js'][57]++;
module.exports = Assertion;
_$jscoverage['assertion.js'][68]++;
function Assertion(obj, msg, stack) {
  _$jscoverage['assertion.js'][69]++;
  this.ssfi = stack || arguments.callee;
  _$jscoverage['assertion.js'][70]++;
  this.obj = obj;
  _$jscoverage['assertion.js'][71]++;
  this.msg = msg;
}
_$jscoverage['assertion.js'][87]++;
Assertion.includeStack = false;
_$jscoverage['assertion.js'][103]++;
Assertion.prototype.assert = (function (expr, msg, negateMsg, expected, actual) {
  _$jscoverage['assertion.js'][104]++;
  actual = actual || this.obj;
  _$jscoverage['assertion.js'][105]++;
  var msg = (this.negate? negateMsg: msg), ok = this.negate? ! expr: expr;
  _$jscoverage['assertion.js'][108]++;
  if (! ok) {
    _$jscoverage['assertion.js'][109]++;
    throw new AssertionError({message: this.msg? this.msg + ": " + msg: msg, actual: actual, expected: expected, stackStartFunction: Assertion.includeStack? this.assert: this.ssfi});
  }
});
_$jscoverage['assertion.js'][127]++;
Object.defineProperty(Assertion.prototype, "inspect", {get: (function () {
  _$jscoverage['assertion.js'][129]++;
  return inspect(this.obj);
}), configurable: true});
_$jscoverage['assertion.js'][143]++;
Object.defineProperty(Assertion.prototype, "to", {get: (function () {
  _$jscoverage['assertion.js'][145]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][159]++;
Object.defineProperty(Assertion.prototype, "be", {get: (function () {
  _$jscoverage['assertion.js'][161]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][176]++;
Object.defineProperty(Assertion.prototype, "been", {get: (function () {
  _$jscoverage['assertion.js'][178]++;
  this.tense = "past";
  _$jscoverage['assertion.js'][179]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][193]++;
Object.defineProperty(Assertion.prototype, "an", {get: (function () {
  _$jscoverage['assertion.js'][195]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][208]++;
Object.defineProperty(Assertion.prototype, "is", {get: (function () {
  _$jscoverage['assertion.js'][210]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][224]++;
Object.defineProperty(Assertion.prototype, "and", {get: (function () {
  _$jscoverage['assertion.js'][226]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][240]++;
Object.defineProperty(Assertion.prototype, "have", {get: (function () {
  _$jscoverage['assertion.js'][242]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][256]++;
Object.defineProperty(Assertion.prototype, "with", {get: (function () {
  _$jscoverage['assertion.js'][258]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][272]++;
Object.defineProperty(Assertion.prototype, "not", {get: (function () {
  _$jscoverage['assertion.js'][274]++;
  this.negate = true;
  _$jscoverage['assertion.js'][275]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][294]++;
Object.defineProperty(Assertion.prototype, "ok", {get: (function () {
  _$jscoverage['assertion.js'][296]++;
  this.assert(this.obj, "expected " + this.inspect + " to be truthy", "expected " + this.inspect + " to be falsy");
  _$jscoverage['assertion.js'][301]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][315]++;
Object.defineProperty(Assertion.prototype, "true", {get: (function () {
  _$jscoverage['assertion.js'][317]++;
  this.assert(true === this.obj, "expected " + this.inspect + " to be true", "expected " + this.inspect + " to be false", this.negate? false: true);
  _$jscoverage['assertion.js'][324]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][338]++;
Object.defineProperty(Assertion.prototype, "false", {get: (function () {
  _$jscoverage['assertion.js'][340]++;
  this.assert(false === this.obj, "expected " + this.inspect + " to be false", "expected " + this.inspect + " to be true", this.negate? true: false);
  _$jscoverage['assertion.js'][347]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][366]++;
Object.defineProperty(Assertion.prototype, "exist", {get: (function () {
  _$jscoverage['assertion.js'][368]++;
  this.assert(null != this.obj, "expected " + this.inspect + " to exist", "expected " + this.inspect + " to not exist");
  _$jscoverage['assertion.js'][374]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][390]++;
Object.defineProperty(Assertion.prototype, "empty", {get: (function () {
  _$jscoverage['assertion.js'][392]++;
  var expected = this.obj;
  _$jscoverage['assertion.js'][394]++;
  if (Array.isArray(this.obj)) {
    _$jscoverage['assertion.js'][395]++;
    expected = this.obj.length;
  }
  else {
    _$jscoverage['assertion.js'][396]++;
    if (typeof this.obj === "object") {
      _$jscoverage['assertion.js'][397]++;
      expected = Object.keys(this.obj).length;
    }
  }
  _$jscoverage['assertion.js'][400]++;
  this.assert(! expected, "expected " + this.inspect + " to be empty", "expected " + this.inspect + " not to be empty");
  _$jscoverage['assertion.js'][405]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][423]++;
Object.defineProperty(Assertion.prototype, "arguments", {get: (function () {
  _$jscoverage['assertion.js'][425]++;
  this.assert("[object Arguments]" == Object.prototype.toString.call(this.obj), "expected " + this.inspect + " to be arguments", "expected " + this.inspect + " to not be arguments", "[object Arguments]", Object.prototype.toString.call(this.obj));
  _$jscoverage['assertion.js'][433]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][450]++;
Assertion.prototype.equal = (function (val) {
  _$jscoverage['assertion.js'][451]++;
  this.assert(val === this.obj, "expected " + this.inspect + " to equal " + inspect(val), "expected " + this.inspect + " to not equal " + inspect(val), val);
  _$jscoverage['assertion.js'][457]++;
  return this;
});
_$jscoverage['assertion.js'][472]++;
Assertion.prototype.eql = (function (obj) {
  _$jscoverage['assertion.js'][473]++;
  this.assert(eql(obj, this.obj), "expected " + this.inspect + " to equal " + inspect(obj), "expected " + this.inspect + " to not equal " + inspect(obj), obj);
  _$jscoverage['assertion.js'][479]++;
  return this;
});
_$jscoverage['assertion.js'][494]++;
Assertion.prototype.above = (function (val) {
  _$jscoverage['assertion.js'][495]++;
  this.assert(this.obj > val, "expected " + this.inspect + " to be above " + val, "expected " + this.inspect + " to be below " + val);
  _$jscoverage['assertion.js'][500]++;
  return this;
});
_$jscoverage['assertion.js'][515]++;
Assertion.prototype.below = (function (val) {
  _$jscoverage['assertion.js'][516]++;
  this.assert(this.obj < val, "expected " + this.inspect + " to be below " + val, "expected " + this.inspect + " to be above " + val);
  _$jscoverage['assertion.js'][521]++;
  return this;
});
_$jscoverage['assertion.js'][537]++;
Assertion.prototype.within = (function (start, finish) {
  _$jscoverage['assertion.js'][538]++;
  var range = start + ".." + finish;
  _$jscoverage['assertion.js'][540]++;
  this.assert(this.obj >= start && this.obj <= finish, "expected " + this.inspect + " to be within " + range, "expected " + this.inspect + " to not be within " + range);
  _$jscoverage['assertion.js'][545]++;
  return this;
});
_$jscoverage['assertion.js'][560]++;
Assertion.prototype.a = (function (type) {
  _$jscoverage['assertion.js'][561]++;
  var klass = type.charAt(0).toUpperCase() + type.slice(1);
  _$jscoverage['assertion.js'][563]++;
  this.assert("[object " + klass + "]" === toString.call(this.obj), "expected " + this.inspect + " to be a " + type, "expected " + this.inspect + " not to be a " + type, "[object " + klass + "]", toString.call(this.obj));
  _$jscoverage['assertion.js'][571]++;
  return this;
});
_$jscoverage['assertion.js'][590]++;
Assertion.prototype["instanceof"] = (function (constructor) {
  _$jscoverage['assertion.js'][591]++;
  var name = constructor.name;
  _$jscoverage['assertion.js'][592]++;
  this.assert(this.obj instanceof constructor, "expected " + this.inspect + " to be an instance of " + name, "expected " + this.inspect + " to not be an instance of " + name);
  _$jscoverage['assertion.js'][597]++;
  return this;
});
_$jscoverage['assertion.js'][617]++;
Assertion.prototype.property = (function (name, val) {
  _$jscoverage['assertion.js'][618]++;
  if (this.negate && undefined !== val) {
    _$jscoverage['assertion.js'][619]++;
    if (undefined === this.obj[name]) {
      _$jscoverage['assertion.js'][620]++;
      throw new Error(this.inspect + " has no property " + inspect(name));
    }
  }
  else {
    _$jscoverage['assertion.js'][623]++;
    this.assert(undefined !== this.obj[name], "expected " + this.inspect + " to have a property " + inspect(name), "expected " + this.inspect + " to not have property " + inspect(name));
  }
  _$jscoverage['assertion.js'][629]++;
  if (undefined !== val) {
    _$jscoverage['assertion.js'][630]++;
    this.assert(val === this.obj[name], "expected " + this.inspect + " to have a property " + inspect(name) + " of " + inspect(val) + ", but got " + inspect(this.obj[name]), "expected " + this.inspect + " to not have a property " + inspect(name) + " of " + inspect(val), val, this.obj[val]);
  }
  _$jscoverage['assertion.js'][640]++;
  this.obj = this.obj[name];
  _$jscoverage['assertion.js'][641]++;
  return this;
});
_$jscoverage['assertion.js'][657]++;
Assertion.prototype.ownProperty = (function (name) {
  _$jscoverage['assertion.js'][658]++;
  this.assert(this.obj.hasOwnProperty(name), "expected " + this.inspect + " to have own property " + inspect(name), "expected " + this.inspect + " to not have own property " + inspect(name));
  _$jscoverage['assertion.js'][662]++;
  return this;
});
_$jscoverage['assertion.js'][679]++;
Assertion.prototype.length = (function (n) {
  _$jscoverage['assertion.js'][680]++;
  new Assertion(this.obj).to.have.property("length");
  _$jscoverage['assertion.js'][681]++;
  var len = this.obj.length;
  _$jscoverage['assertion.js'][683]++;
  this.assert(len == n, "expected " + this.inspect + " to have a length of " + n + " but got " + len, "expected " + this.inspect + " to not have a length of " + len, n, len);
  _$jscoverage['assertion.js'][691]++;
  return this;
});
_$jscoverage['assertion.js'][706]++;
Assertion.prototype.match = (function (re) {
  _$jscoverage['assertion.js'][707]++;
  this.assert(re.exec(this.obj), "expected " + this.inspect + " to match " + re, "expected " + this.inspect + " not to match " + re);
  _$jscoverage['assertion.js'][712]++;
  return this;
});
_$jscoverage['assertion.js'][727]++;
Assertion.prototype.include = (function (obj) {
  _$jscoverage['assertion.js'][728]++;
  this.assert(~ this.obj.indexOf(obj), "expected " + this.inspect + " to include " + inspect(obj), "expected " + this.inspect + " to not include " + inspect(obj));
  _$jscoverage['assertion.js'][733]++;
  return this;
});
_$jscoverage['assertion.js'][748]++;
Assertion.prototype.string = (function (str) {
  _$jscoverage['assertion.js'][749]++;
  new Assertion(this.obj).is.a("string");
  _$jscoverage['assertion.js'][751]++;
  this.assert(~ this.obj.indexOf(str), "expected " + this.inspect + " to contain " + inspect(str), "expected " + this.inspect + " to not contain " + inspect(str));
  _$jscoverage['assertion.js'][756]++;
  return this;
});
_$jscoverage['assertion.js'][770]++;
Object.defineProperty(Assertion.prototype, "contain", {get: (function () {
  _$jscoverage['assertion.js'][772]++;
  this.contains = true;
  _$jscoverage['assertion.js'][773]++;
  return this;
}), configurable: true});
_$jscoverage['assertion.js'][792]++;
Assertion.prototype.keys = (function (keys) {
  _$jscoverage['assertion.js'][793]++;
  var str, ok = true;
  _$jscoverage['assertion.js'][796]++;
  keys = keys instanceof Array? keys: Array.prototype.slice.call(arguments);
  _$jscoverage['assertion.js'][800]++;
  if (! keys.length) {
    _$jscoverage['assertion.js'][800]++;
    throw new Error("keys required");
  }
  _$jscoverage['assertion.js'][802]++;
  var actual = Object.keys(this.obj), len = keys.length;
  _$jscoverage['assertion.js'][806]++;
  ok = keys.every((function (key) {
  _$jscoverage['assertion.js'][807]++;
  return ~ actual.indexOf(key);
}));
  _$jscoverage['assertion.js'][811]++;
  if (! this.negate && ! this.contains) {
    _$jscoverage['assertion.js'][812]++;
    ok = ok && keys.length == actual.length;
  }
  _$jscoverage['assertion.js'][816]++;
  if (len > 1) {
    _$jscoverage['assertion.js'][817]++;
    keys = keys.map((function (key) {
  _$jscoverage['assertion.js'][818]++;
  return inspect(key);
}));
    _$jscoverage['assertion.js'][820]++;
    var last = keys.pop();
    _$jscoverage['assertion.js'][821]++;
    str = keys.join(", ") + ", and " + last;
  }
  else {
    _$jscoverage['assertion.js'][823]++;
    str = inspect(keys[0]);
  }
  _$jscoverage['assertion.js'][827]++;
  str = (len > 1? "keys ": "key ") + str;
  _$jscoverage['assertion.js'][830]++;
  str = (this.contains? "contain ": "have ") + str;
  _$jscoverage['assertion.js'][833]++;
  this.assert(ok, "expected " + this.inspect + " to " + str, "expected " + this.inspect + " to not " + str, keys, Object.keys(this.obj));
  _$jscoverage['assertion.js'][841]++;
  return this;
});
_$jscoverage['assertion.js'][871]++;
Assertion.prototype["throw"] = (function (constructor, msg) {
  _$jscoverage['assertion.js'][872]++;
  new Assertion(this.obj).is.a("function");
  _$jscoverage['assertion.js'][874]++;
  var thrown = false;
  _$jscoverage['assertion.js'][876]++;
  if (arguments.length === 0) {
    _$jscoverage['assertion.js'][877]++;
    msg = null;
    _$jscoverage['assertion.js'][878]++;
    constructor = null;
  }
  else {
    _$jscoverage['assertion.js'][879]++;
    if (constructor && (constructor instanceof RegExp || "string" === typeof constructor)) {
      _$jscoverage['assertion.js'][880]++;
      msg = constructor;
      _$jscoverage['assertion.js'][881]++;
      constructor = null;
    }
  }
  _$jscoverage['assertion.js'][884]++;
  try {
    _$jscoverage['assertion.js'][885]++;
    this.obj();
  }
  catch (err) {
    _$jscoverage['assertion.js'][888]++;
    if (constructor && "function" === typeof constructor) {
      _$jscoverage['assertion.js'][889]++;
      this.assert(err instanceof constructor && err.name == constructor.name, "expected " + this.inspect + " to throw " + constructor.name + " but a " + err.name + " was thrown", "expected " + this.inspect + " to not throw " + constructor.name);
      _$jscoverage['assertion.js'][893]++;
      if (! msg) {
        _$jscoverage['assertion.js'][893]++;
        return this;
      }
    }
    _$jscoverage['assertion.js'][896]++;
    if (err.message && msg && msg instanceof RegExp) {
      _$jscoverage['assertion.js'][897]++;
      this.assert(msg.exec(err.message), "expected " + this.inspect + " to throw error matching " + msg + " but got " + inspect(err.message), "expected " + this.inspect + " to throw error not matching " + msg);
      _$jscoverage['assertion.js'][902]++;
      return this;
    }
    else {
      _$jscoverage['assertion.js'][903]++;
      if (err.message && msg && "string" === typeof msg) {
        _$jscoverage['assertion.js'][904]++;
        this.assert(~ err.message.indexOf(msg), "expected " + this.inspect + " to throw error including " + inspect(msg) + " but got " + inspect(err.message), "expected " + this.inspect + " to throw error not including " + inspect(msg));
        _$jscoverage['assertion.js'][909]++;
        return this;
      }
      else {
        _$jscoverage['assertion.js'][911]++;
        thrown = true;
      }
    }
  }
  _$jscoverage['assertion.js'][915]++;
  var name = (constructor? constructor.name: "an error");
  _$jscoverage['assertion.js'][917]++;
  this.assert(thrown === true, "expected " + this.inspect + " to throw " + name, "expected " + this.inspect + " to not throw " + name);
  _$jscoverage['assertion.js'][922]++;
  return this;
});
_$jscoverage['assertion.js'][938]++;
Assertion.prototype.respondTo = (function (method) {
  _$jscoverage['assertion.js'][939]++;
  var context = ("function" === typeof this.obj)? this.obj.prototype[method]: this.obj[method];
  _$jscoverage['assertion.js'][943]++;
  this.assert("function" === typeof context, "expected " + this.inspect + " to respond to " + inspect(method), "expected " + this.inspect + " to not respond to " + inspect(method), "function", typeof context);
  _$jscoverage['assertion.js'][951]++;
  return this;
});
_$jscoverage['assertion.js'][966]++;
Assertion.prototype.satisfy = (function (matcher) {
  _$jscoverage['assertion.js'][967]++;
  this.assert(matcher(this.obj), "expected " + this.inspect + " to satisfy " + inspect(matcher), "expected " + this.inspect + " to not satisfy" + inspect(matcher), this.negate? false: true, matcher(this.obj));
  _$jscoverage['assertion.js'][975]++;
  return this;
});
_$jscoverage['assertion.js'][991]++;
Assertion.prototype.closeTo = (function (expected, delta) {
  _$jscoverage['assertion.js'][992]++;
  this.assert((this.obj - delta === expected) || (this.obj + delta === expected), "expected " + this.inspect + " to be close to " + expected + " +/- " + delta, "expected " + this.inspect + " not to be close to " + expected + " +/- " + delta);
  _$jscoverage['assertion.js'][997]++;
  return this;
});
_$jscoverage['assertion.js'][1004]++;
(function alias(name, as) {
  _$jscoverage['assertion.js'][1005]++;
  Assertion.prototype[as] = Assertion.prototype[name];
  _$jscoverage['assertion.js'][1006]++;
  return alias;
})("length", "lengthOf")("keys", "key")("ownProperty", "haveOwnProperty")("above", "greaterThan")("below", "lessThan")("throw", "throws")("throw", "Throw")("instanceof", "instanceOf");
_$jscoverage['assertion.js'].source = ["/*!"," * chai"," * Copyright(c) 2011 Jake Luer &lt;jake@alogicalparadox.com&gt;"," * MIT Licensed"," *"," * Primarily a refactor of: should.js"," * https://github.com/visionmedia/should.js"," * Copyright(c) 2011 TJ Holowaychuk &lt;tj@vision-media.ca&gt;"," * MIT Licensed"," */","","/**"," * ### BDD Style Introduction"," *"," * The BDD style is exposed through `expect` or `should` interfaces. In both"," * scenarios, you chain together natural language assertions."," *"," *      // expect"," *      var expect = require('chai').expect;"," *      expect(foo).to.equal('bar');"," *"," *      // should"," *      var should = require('chai').should();"," *      foo.should.equal('bar');"," *"," * #### Differences"," *"," * The `expect` interface provides a function as a starting point for chaining"," * your language assertions. It works on node.js and in all browsers."," *"," * The `should` interface extends `Object.prototype` to provide a single getter as"," * the starting point for your language assertions. It works on node.js and in"," * all browsers except Internet Explorer."," *"," * #### Configuration"," *"," * By default, Chai does not show stack traces upon an AssertionError. This can"," * be changed by modifying the `includeStack` parameter for chai.Assertion. For example:"," *"," *      var chai = require('chai');"," *      chai.Assertion.includeStack = true; // defaults to false"," */","","/*!"," * Module dependencies."," */","","var AssertionError = require('./error')","  , eql = require('./utils/eql')","  , toString = Object.prototype.toString","  , inspect = require('./utils/inspect');","","/*!"," * Module export."," */","","module.exports = Assertion;","","","/*!"," * # Assertion Constructor"," *"," * Creates object for chaining."," *"," * @api private"," */","","function Assertion (obj, msg, stack) {","  this.ssfi = stack || arguments.callee;","  this.obj = obj;","  this.msg = msg;","}","","/*!","  * ## Assertion.includeStack","  * , toString = Object.prototype.toString","  *","  * User configurable property, influences whether stack trace","  * is included in Assertion error message. Default of false","  * suppresses stack trace in the error message","  *","  *     Assertion.includeStack = true;  // enable stack on error","  *","  * @api public","  */","","Assertion.includeStack = false;","","/*!"," * # .assert(expression, message, negateMessage, expected, actual)"," *"," * Executes an expression and check expectations. Throws AssertionError for reporting if test doesn't pass."," *"," * @name assert"," * @param {Philosophical} expression to be tested"," * @param {String} message to display if fails"," * @param {String} negatedMessage to display if negated expression fails"," * @param {*} expected value (remember to check for negation)"," * @param {*} actual (optional) will default to `this.obj`"," * @api private"," */","","Assertion.prototype.assert = function (expr, msg, negateMsg, expected, actual) {","  actual = actual || this.obj;","  var msg = (this.negate ? negateMsg : msg)","    , ok = this.negate ? !expr : expr;","","  if (!ok) {","    throw new AssertionError({","        message: this.msg ? this.msg + ': ' + msg : msg // include custom message if available","      , actual: actual","      , expected: expected","      , stackStartFunction: (Assertion.includeStack) ? this.assert : this.ssfi","    });","  }","};","","/*!"," * # inspect"," *"," * Returns the current object stringified."," *"," * @name inspect"," * @api private"," */","","Object.defineProperty(Assertion.prototype, 'inspect',","  { get: function () {","      return inspect(this.obj);","    }","  , configurable: true","});","","/**"," * # to"," *"," * Language chain."," *"," * @name to"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'to',","  { get: function () {","      return this;","    }","  , configurable: true","});","","/**"," * # be"," *"," * Language chain."," *"," * @name be"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'be',","  { get: function () {","      return this;","    }","  , configurable: true","});","","/**"," * # been"," *"," * Language chain. Also tests `tense` to past for addon"," * modules that use the tense feature."," *"," * @name been"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'been',","  { get: function () {","      this.tense = 'past';","      return this;","    }","  , configurable: true","});","","/**"," * # an"," *"," * Language chain."," *"," * @name an"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'an',","  { get: function () {","      return this;","    }","  , configurable: true","});","/**"," * # is"," *"," * Language chain."," *"," * @name is"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'is',","  { get: function () {","      return this;","    }","  , configurable: true","});","","/**"," * # and"," *"," * Language chain."," *"," * @name and"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'and',","  { get: function () {","      return this;","    }","  , configurable: true","});","","/**"," * # have"," *"," * Language chain."," *"," * @name have"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'have',","  { get: function () {","      return this;","    }","  , configurable: true","});","","/**"," * # with"," *"," * Language chain."," *"," * @name with"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'with',","  { get: function () {","      return this;","    }","  , configurable: true","});","","/**"," * # .not"," *"," * Negates any of assertions following in the chain."," *"," * @name not"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'not',","  { get: function () {","      this.negate = true;","      return this;","    }","  , configurable: true","});","","/**"," * # .ok"," *"," * Assert object truthiness."," *"," *      expect('everthing').to.be.ok;"," *      expect(false).to.not.be.ok;"," *      expect(undefined).to.not.be.ok;"," *      expect(null).to.not.be.ok;"," *"," * @name ok"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'ok',","  { get: function () {","      this.assert(","          this.obj","        , 'expected ' + this.inspect + ' to be truthy'","        , 'expected ' + this.inspect + ' to be falsy');","","      return this;","    }","  , configurable: true","});","","/**"," * # .true"," *"," * Assert object is true"," *"," * @name true"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'true',","  { get: function () {","      this.assert(","          true === this.obj","        , 'expected ' + this.inspect + ' to be true'","        , 'expected ' + this.inspect + ' to be false'","        , this.negate ? false : true","      );","","      return this;","    }","  , configurable: true","});","","/**"," * # .false"," *"," * Assert object is false"," *"," * @name false"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'false',","  { get: function () {","      this.assert(","          false === this.obj","        , 'expected ' + this.inspect + ' to be false'","        , 'expected ' + this.inspect + ' to be true'","        , this.negate ? true : false","      );","","      return this;","    }","  , configurable: true","});","","/**"," * # .exist"," *"," * Assert object exists (null)."," *"," *      var foo = 'hi'"," *        , bar;"," *      expect(foo).to.exist;"," *      expect(bar).to.not.exist;"," *"," * @name exist"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'exist',","  { get: function () {","      this.assert(","          null != this.obj","        , 'expected ' + this.inspect + ' to exist'","        , 'expected ' + this.inspect + ' to not exist'","      );","","      return this;","    }","  , configurable: true","});","","/**"," * # .empty"," *"," * Assert object's length to be 0."," *"," *      expect([]).to.be.empty;"," *"," * @name empty"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'empty',","  { get: function () {","      var expected = this.obj;","","      if (Array.isArray(this.obj)) {","        expected = this.obj.length;","      } else if (typeof this.obj === 'object') {","        expected = Object.keys(this.obj).length;","      }","","      this.assert(","          !expected","        , 'expected ' + this.inspect + ' to be empty'","        , 'expected ' + this.inspect + ' not to be empty');","","      return this;","    }","  , configurable: true","});","","/**"," * # .arguments"," *"," * Assert object is an instanceof arguments."," *"," *      function test () {"," *        expect(arguments).to.be.arguments;"," *      }"," *"," * @name arguments"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'arguments',","  { get: function () {","      this.assert(","          '[object Arguments]' == Object.prototype.toString.call(this.obj)","        , 'expected ' + this.inspect + ' to be arguments'","        , 'expected ' + this.inspect + ' to not be arguments'","        , '[object Arguments]'","        , Object.prototype.toString.call(this.obj)","      );","","      return this;","    }","  , configurable: true","});","","/**"," * # .equal(value)"," *"," * Assert strict equality."," *"," *      expect('hello').to.equal('hello');"," *"," * @name equal"," * @param {*} value"," * @api public"," */","","Assertion.prototype.equal = function (val) {","  this.assert(","      val === this.obj","    , 'expected ' + this.inspect + ' to equal ' + inspect(val)","    , 'expected ' + this.inspect + ' to not equal ' + inspect(val)","    , val );","","  return this;","};","","/**"," * # .eql(value)"," *"," * Assert deep equality."," *"," *      expect({ foo: 'bar' }).to.eql({ foo: 'bar' });"," *"," * @name eql"," * @param {*} value"," * @api public"," */","","Assertion.prototype.eql = function (obj) {","  this.assert(","      eql(obj, this.obj)","    , 'expected ' + this.inspect + ' to equal ' + inspect(obj)","    , 'expected ' + this.inspect + ' to not equal ' + inspect(obj)","    , obj );","","  return this;","};","","/**"," * # .above(value)"," *"," * Assert greater than `value`."," *"," *      expect(10).to.be.above(5);"," *"," * @name above"," * @param {Number} value"," * @api public"," */","","Assertion.prototype.above = function (val) {","  this.assert(","      this.obj &gt; val","    , 'expected ' + this.inspect + ' to be above ' + val","    , 'expected ' + this.inspect + ' to be below ' + val);","","  return this;","};","","/**"," * # .below(value)"," *"," * Assert less than `value`."," *"," *      expect(5).to.be.below(10);"," *"," * @name below"," * @param {Number} value"," * @api public"," */","","Assertion.prototype.below = function (val) {","  this.assert(","      this.obj &lt; val","    , 'expected ' + this.inspect + ' to be below ' + val","    , 'expected ' + this.inspect + ' to be above ' + val);","","  return this;","};","","/**"," * # .within(start, finish)"," *"," * Assert that a number is within a range."," *"," *      expect(7).to.be.within(5,10);"," *"," * @name within"," * @param {Number} start lowerbound inclusive"," * @param {Number} finish upperbound inclusive"," * @api public"," */","","Assertion.prototype.within = function (start, finish) {","  var range = start + '..' + finish;","","  this.assert(","      this.obj &gt;= start &amp;&amp; this.obj &lt;= finish","    , 'expected ' + this.inspect + ' to be within ' + range","    , 'expected ' + this.inspect + ' to not be within ' + range);","","  return this;","};","","/**"," * # .a(type)"," *"," * Assert typeof."," *"," *      expect('test').to.be.a('string');"," *"," * @name a"," * @param {String} type"," * @api public"," */","","Assertion.prototype.a = function (type) {","  var klass = type.charAt(0).toUpperCase() + type.slice(1);","","  this.assert(","      '[object ' + klass + ']' === toString.call(this.obj)","    , 'expected ' + this.inspect + ' to be a ' + type","    , 'expected ' + this.inspect + ' not to be a ' + type","    , '[object ' + klass + ']'","    , toString.call(this.obj)","  );","","  return this;","};","","/**"," * # .instanceof(constructor)"," *"," * Assert instanceof."," *"," *      var Tea = function (name) { this.name = name; }"," *        , Chai = new Tea('chai');"," *"," *      expect(Chai).to.be.an.instanceOf(Tea);"," *"," * @name instanceof"," * @param {Constructor}"," * @alias instanceOf"," * @api public"," */","","Assertion.prototype.instanceof = function (constructor) {","  var name = constructor.name;","  this.assert(","      this.obj instanceof constructor","    , 'expected ' + this.inspect + ' to be an instance of ' + name","    , 'expected ' + this.inspect + ' to not be an instance of ' + name);","","  return this;","};","","/**"," * # .property(name, [value])"," *"," * Assert that property of `name` exists, optionally with `value`."," *"," *      var obj = { foo: 'bar' }"," *      expect(obj).to.have.property('foo');"," *      expect(obj).to.have.property('foo', 'bar');"," *      expect(obj).to.have.property('foo').to.be.a('string');"," *"," * @name property"," * @param {String} name"," * @param {*} value (optional)"," * @returns value of property for chaining"," * @api public"," */","","Assertion.prototype.property = function (name, val) {","  if (this.negate &amp;&amp; undefined !== val) {","    if (undefined === this.obj[name]) {","      throw new Error(this.inspect + ' has no property ' + inspect(name));","    }","  } else {","    this.assert(","        undefined !== this.obj[name]","      , 'expected ' + this.inspect + ' to have a property ' + inspect(name)","      , 'expected ' + this.inspect + ' to not have property ' + inspect(name));","  }","","  if (undefined !== val) {","    this.assert(","        val === this.obj[name]","      , 'expected ' + this.inspect + ' to have a property ' + inspect(name) + ' of ' +","          inspect(val) + ', but got ' + inspect(this.obj[name])","      , 'expected ' + this.inspect + ' to not have a property ' + inspect(name) + ' of ' +  inspect(val)","      , val","      , this.obj[val]","    );","  }","","  this.obj = this.obj[name];","  return this;","};","","/**"," * # .ownProperty(name)"," *"," * Assert that has own property by `name`."," *"," *      expect('test').to.have.ownProperty('length');"," *"," * @name ownProperty"," * @alias haveOwnProperty"," * @param {String} name"," * @api public"," */","","Assertion.prototype.ownProperty = function (name) {","  this.assert(","      this.obj.hasOwnProperty(name)","    , 'expected ' + this.inspect + ' to have own property ' + inspect(name)","    , 'expected ' + this.inspect + ' to not have own property ' + inspect(name));","  return this;","};","","/**"," * # .length(val)"," *"," * Assert that object has expected length."," *"," *      expect([1,2,3]).to.have.length(3);"," *      expect('foobar').to.have.length(6);"," *"," * @name length"," * @alias lengthOf"," * @param {Number} length"," * @api public"," */","","Assertion.prototype.length = function (n) {","  new Assertion(this.obj).to.have.property('length');","  var len = this.obj.length;","","  this.assert(","      len == n","    , 'expected ' + this.inspect + ' to have a length of ' + n + ' but got ' + len","    , 'expected ' + this.inspect + ' to not have a length of ' + len","    , n","    , len","  );","","  return this;","};","","/**"," * # .match(regexp)"," *"," * Assert that matches regular expression."," *"," *      expect('foobar').to.match(/^foo/);"," *"," * @name match"," * @param {RegExp} RegularExpression"," * @api public"," */","","Assertion.prototype.match = function (re) {","  this.assert(","      re.exec(this.obj)","    , 'expected ' + this.inspect + ' to match ' + re","    , 'expected ' + this.inspect + ' not to match ' + re);","","  return this;","};","","/**"," * # .include(obj)"," *"," * Assert the inclusion of an object in an Array or substring in string."," *"," *      expect([1,2,3]).to.include(2);"," *"," * @name include"," * @param {Object|String|Number} obj"," * @api public"," */","","Assertion.prototype.include = function (obj) {","  this.assert(","      ~this.obj.indexOf(obj)","    , 'expected ' + this.inspect + ' to include ' + inspect(obj)","    , 'expected ' + this.inspect + ' to not include ' + inspect(obj));","","  return this;","};","","/**"," * # .string(string)"," *"," * Assert inclusion of string in string."," *"," *      expect('foobar').to.have.string('bar');"," *"," * @name string"," * @param {String} string"," * @api public"," */","","Assertion.prototype.string = function (str) {","  new Assertion(this.obj).is.a('string');","","  this.assert(","      ~this.obj.indexOf(str)","    , 'expected ' + this.inspect + ' to contain ' + inspect(str)","    , 'expected ' + this.inspect + ' to not contain ' + inspect(str));","","  return this;","};","","","","/**"," * # contain"," *"," * Toggles the `contain` flag for the `keys` assertion."," *"," * @name contain"," * @api public"," */","","Object.defineProperty(Assertion.prototype, 'contain',","  { get: function () {","      this.contains = true;","      return this;","    },","    configurable: true","});","","/**"," * # .keys(key1, [key2], [...])"," *"," * Assert exact keys or the inclusing of keys using the `contain` modifier."," *"," *      expect({ foo: 1, bar: 2 }).to.have.keys(['foo', 'bar']);"," *      expect({ foo: 1, bar: 2, baz: 3 }).to.contain.keys('foo', 'bar');"," *"," * @name keys"," * @alias key"," * @param {String|Array} Keys"," * @api public"," */","","Assertion.prototype.keys = function(keys) {","  var str","    , ok = true;","","  keys = keys instanceof Array","    ? keys","    : Array.prototype.slice.call(arguments);","","  if (!keys.length) throw new Error('keys required');","","  var actual = Object.keys(this.obj)","    , len = keys.length;","","  // Inclusion","  ok = keys.every(function(key){","    return ~actual.indexOf(key);","  });","","  // Strict","  if (!this.negate &amp;&amp; !this.contains) {","    ok = ok &amp;&amp; keys.length == actual.length;","  }","","  // Key string","  if (len &gt; 1) {","    keys = keys.map(function(key){","      return inspect(key);","    });","    var last = keys.pop();","    str = keys.join(', ') + ', and ' + last;","  } else {","    str = inspect(keys[0]);","  }","","  // Form","  str = (len &gt; 1 ? 'keys ' : 'key ') + str;","","  // Have / include","  str = (this.contains ? 'contain ' : 'have ') + str;","","  // Assertion","  this.assert(","      ok","    , 'expected ' + this.inspect + ' to ' + str","    , 'expected ' + this.inspect + ' to not ' + str","    , keys","    , Object.keys(this.obj)","  );","","  return this;","}","","/**"," * # .throw(constructor)"," *"," * Assert that a function will throw a specific type of error or that error"," * thrown will match a RegExp or include a string."," *"," *      var fn = function () { throw new ReferenceError('This is a bad function.'); }"," *      expect(fn).to.throw(ReferenceError);"," *      expect(fn).to.throw(/bad function/);"," *      expect(fn).to.not.throw('good function');"," *      expect(fn).to.throw(ReferenceError, /bad function/);"," *"," * Please note that when a throw expectation is negated, it will check each"," * parameter independently, starting with Error constructor type. The appropriate way"," * to check for the existence of a type of error but for a message that does not match"," * is to use `and`."," *"," *      expect(fn).to.throw(ReferenceError).and.not.throw(/good function/);"," *"," * @name throw"," * @alias throws"," * @alias Throw"," * @param {ErrorConstructor} constructor"," * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types"," * @api public"," */","","Assertion.prototype.throw = function (constructor, msg) {","  new Assertion(this.obj).is.a('function');","","  var thrown = false;","","  if (arguments.length === 0) {","    msg = null;","    constructor = null;","  } else if (constructor &amp;&amp; (constructor instanceof RegExp || 'string' === typeof constructor)) {","    msg = constructor;","    constructor = null;","  }","","  try {","    this.obj();","  } catch (err) {","    // first, check constructor","    if (constructor &amp;&amp; 'function' === typeof constructor) {","      this.assert(","          err instanceof constructor &amp;&amp; err.name == constructor.name","        , 'expected ' + this.inspect + ' to throw ' + constructor.name + ' but a ' + err.name + ' was thrown'","        , 'expected ' + this.inspect + ' to not throw ' + constructor.name );","      if (!msg) return this;","    }","    // next, check message","    if (err.message &amp;&amp; msg &amp;&amp; msg instanceof RegExp) {","      this.assert(","          msg.exec(err.message)","        , 'expected ' + this.inspect + ' to throw error matching ' + msg + ' but got ' + inspect(err.message)","        , 'expected ' + this.inspect + ' to throw error not matching ' + msg","      );","      return this;","    } else if (err.message &amp;&amp; msg &amp;&amp; 'string' === typeof msg) {","      this.assert(","          ~err.message.indexOf(msg)","        , 'expected ' + this.inspect + ' to throw error including ' + inspect(msg) + ' but got ' + inspect(err.message)","        , 'expected ' + this.inspect + ' to throw error not including ' + inspect(msg)","      );","      return this;","    } else {","      thrown = true;","    }","  }","","  var name = (constructor ? constructor.name : 'an error');","","  this.assert(","      thrown === true","    , 'expected ' + this.inspect + ' to throw ' + name","    , 'expected ' + this.inspect + ' to not throw ' + name);","","  return this;","};","","/**"," * # .respondTo(method)"," *"," * Assert that object/class will respond to a method."," *"," *      expect(Klass).to.respondTo('bar');"," *      expect(obj).to.respondTo('bar');"," *"," * @name respondTo"," * @param {String} method"," * @api public"," */","","Assertion.prototype.respondTo = function (method) {","  var context = ('function' === typeof this.obj)","    ? this.obj.prototype[method]","    : this.obj[method];","","  this.assert(","      'function' === typeof context","    , 'expected ' + this.inspect + ' to respond to ' + inspect(method)","    , 'expected ' + this.inspect + ' to not respond to ' + inspect(method)","    , 'function'","    , typeof context","  );","","  return this;","};","","/**"," * # .satisfy(method)"," *"," * Assert that passes a truth test."," *"," *      expect(1).to.satisfy(function(num) { return num &gt; 0; });"," *"," * @name satisfy"," * @param {Function} matcher"," * @api public"," */","","Assertion.prototype.satisfy = function (matcher) {","  this.assert(","      matcher(this.obj)","    , 'expected ' + this.inspect + ' to satisfy ' + inspect(matcher)","    , 'expected ' + this.inspect + ' to not satisfy' + inspect(matcher)","    , this.negate ? false : true","    , matcher(this.obj)","  );","","  return this;","};","","/**"," * # .closeTo(expected, delta)"," *"," * Assert that actual is equal to +/- delta."," *"," *      expect(1.5).to.be.closeTo(1, 0.5);"," *"," * @name closeTo"," * @param {Number} expected"," * @param {Number} delta"," * @api public"," */","","Assertion.prototype.closeTo = function (expected, delta) {","  this.assert(","      (this.obj - delta === expected) || (this.obj + delta === expected)","    , 'expected ' + this.inspect + ' to be close to ' + expected + ' +/- ' + delta","    , 'expected ' + this.inspect + ' not to be close to ' + expected + ' +/- ' + delta);","","  return this;","};","","/*!"," * Aliases."," */","","(function alias(name, as){","  Assertion.prototype[as] = Assertion.prototype[name];","  return alias;","})","('length', 'lengthOf')","('keys', 'key')","('ownProperty', 'haveOwnProperty')","('above', 'greaterThan')","('below', 'lessThan')","('throw', 'throws')","('throw', 'Throw') // for troublesome browsers","('instanceof', 'instanceOf');"];

});

require.define("/node_modules/chai/lib-cov/error.js", function (require, module, exports, __dirname, __filename) {
/* automatically generated by JSCoverage - do not edit */
if (typeof _$jscoverage === 'undefined') _$jscoverage = {};
if (! _$jscoverage['error.js']) {
  _$jscoverage['error.js'] = [];
  _$jscoverage['error.js'][7] = 0;
  _$jscoverage['error.js'][9] = 0;
  _$jscoverage['error.js'][15] = 0;
  _$jscoverage['error.js'][16] = 0;
  _$jscoverage['error.js'][17] = 0;
  _$jscoverage['error.js'][18] = 0;
  _$jscoverage['error.js'][19] = 0;
  _$jscoverage['error.js'][20] = 0;
  _$jscoverage['error.js'][21] = 0;
  _$jscoverage['error.js'][22] = 0;
  _$jscoverage['error.js'][24] = 0;
  _$jscoverage['error.js'][25] = 0;
  _$jscoverage['error.js'][29] = 0;
  _$jscoverage['error.js'][31] = 0;
  _$jscoverage['error.js'][32] = 0;
}
_$jscoverage['error.js'][7]++;
var fail = require("./chai").fail;
_$jscoverage['error.js'][9]++;
module.exports = AssertionError;
_$jscoverage['error.js'][15]++;
function AssertionError(options) {
  _$jscoverage['error.js'][16]++;
  options = options || {};
  _$jscoverage['error.js'][17]++;
  this.name = "AssertionError";
  _$jscoverage['error.js'][18]++;
  this.message = options.message;
  _$jscoverage['error.js'][19]++;
  this.actual = options.actual;
  _$jscoverage['error.js'][20]++;
  this.expected = options.expected;
  _$jscoverage['error.js'][21]++;
  this.operator = options.operator;
  _$jscoverage['error.js'][22]++;
  var stackStartFunction = options.stackStartFunction || fail;
  _$jscoverage['error.js'][24]++;
  if (Error.captureStackTrace) {
    _$jscoverage['error.js'][25]++;
    Error.captureStackTrace(this, stackStartFunction);
  }
}
_$jscoverage['error.js'][29]++;
AssertionError.prototype.__proto__ = Error.prototype;
_$jscoverage['error.js'][31]++;
AssertionError.prototype.toString = (function () {
  _$jscoverage['error.js'][32]++;
  return this.message;
});
_$jscoverage['error.js'].source = ["/*!"," * chai"," * Copyright(c) 2011 Jake Luer &lt;jake@alogicalparadox.com&gt;"," * MIT Licensed"," */","","var fail = require('./chai').fail;","","module.exports = AssertionError;","","/*!"," * Inspired by node.js assert module"," * https://github.com/joyent/node/blob/f8c335d0caf47f16d31413f89aa28eda3878e3aa/lib/assert.js"," */","function AssertionError (options) {","  options = options || {};","  this.name = 'AssertionError';","  this.message = options.message;","  this.actual = options.actual;","  this.expected = options.expected;","  this.operator = options.operator;","  var stackStartFunction = options.stackStartFunction || fail;","","  if (Error.captureStackTrace) {","    Error.captureStackTrace(this, stackStartFunction);","  }","}","","AssertionError.prototype.__proto__ = Error.prototype;","","AssertionError.prototype.toString = function() {","  return this.message;","};"];

});

require.define("/node_modules/chai/lib-cov/utils/eql.js", function (require, module, exports, __dirname, __filename) {
/* automatically generated by JSCoverage - do not edit */
if (typeof _$jscoverage === 'undefined') _$jscoverage = {};
if (! _$jscoverage['utils/eql.js']) {
  _$jscoverage['utils/eql.js'] = [];
  _$jscoverage['utils/eql.js'][5] = 0;
  _$jscoverage['utils/eql.js'][8] = 0;
  _$jscoverage['utils/eql.js'][9] = 0;
  _$jscoverage['utils/eql.js'][11] = 0;
  _$jscoverage['utils/eql.js'][16] = 0;
  _$jscoverage['utils/eql.js'][18] = 0;
  _$jscoverage['utils/eql.js'][19] = 0;
  _$jscoverage['utils/eql.js'][21] = 0;
  _$jscoverage['utils/eql.js'][22] = 0;
  _$jscoverage['utils/eql.js'][24] = 0;
  _$jscoverage['utils/eql.js'][25] = 0;
  _$jscoverage['utils/eql.js'][28] = 0;
  _$jscoverage['utils/eql.js'][32] = 0;
  _$jscoverage['utils/eql.js'][33] = 0;
  _$jscoverage['utils/eql.js'][37] = 0;
  _$jscoverage['utils/eql.js'][38] = 0;
  _$jscoverage['utils/eql.js'][47] = 0;
  _$jscoverage['utils/eql.js'][51] = 0;
  _$jscoverage['utils/eql.js'][52] = 0;
  _$jscoverage['utils/eql.js'][55] = 0;
  _$jscoverage['utils/eql.js'][56] = 0;
  _$jscoverage['utils/eql.js'][59] = 0;
  _$jscoverage['utils/eql.js'][60] = 0;
  _$jscoverage['utils/eql.js'][61] = 0;
  _$jscoverage['utils/eql.js'][63] = 0;
  _$jscoverage['utils/eql.js'][66] = 0;
  _$jscoverage['utils/eql.js'][67] = 0;
  _$jscoverage['utils/eql.js'][68] = 0;
  _$jscoverage['utils/eql.js'][70] = 0;
  _$jscoverage['utils/eql.js'][71] = 0;
  _$jscoverage['utils/eql.js'][72] = 0;
  _$jscoverage['utils/eql.js'][74] = 0;
  _$jscoverage['utils/eql.js'][75] = 0;
  _$jscoverage['utils/eql.js'][79] = 0;
  _$jscoverage['utils/eql.js'][83] = 0;
  _$jscoverage['utils/eql.js'][84] = 0;
  _$jscoverage['utils/eql.js'][86] = 0;
  _$jscoverage['utils/eql.js'][87] = 0;
  _$jscoverage['utils/eql.js'][89] = 0;
  _$jscoverage['utils/eql.js'][90] = 0;
  _$jscoverage['utils/eql.js'][91] = 0;
  _$jscoverage['utils/eql.js'][95] = 0;
  _$jscoverage['utils/eql.js'][96] = 0;
  _$jscoverage['utils/eql.js'][97] = 0;
  _$jscoverage['utils/eql.js'][99] = 0;
}
_$jscoverage['utils/eql.js'][5]++;
module.exports = _deepEqual;
_$jscoverage['utils/eql.js'][8]++;
if (! Buffer) {
  _$jscoverage['utils/eql.js'][9]++;
  var Buffer = {isBuffer: (function () {
  _$jscoverage['utils/eql.js'][11]++;
  return false;
})};
}
_$jscoverage['utils/eql.js'][16]++;
function _deepEqual(actual, expected) {
  _$jscoverage['utils/eql.js'][18]++;
  if (actual === expected) {
    _$jscoverage['utils/eql.js'][19]++;
    return true;
  }
  else {
    _$jscoverage['utils/eql.js'][21]++;
    if (Buffer.isBuffer(actual) && Buffer.isBuffer(expected)) {
      _$jscoverage['utils/eql.js'][22]++;
      if (actual.length != expected.length) {
        _$jscoverage['utils/eql.js'][22]++;
        return false;
      }
      _$jscoverage['utils/eql.js'][24]++;
      for (var i = 0; i < actual.length; i++) {
        _$jscoverage['utils/eql.js'][25]++;
        if (actual[i] !== expected[i]) {
          _$jscoverage['utils/eql.js'][25]++;
          return false;
        }
}
      _$jscoverage['utils/eql.js'][28]++;
      return true;
    }
    else {
      _$jscoverage['utils/eql.js'][32]++;
      if (actual instanceof Date && expected instanceof Date) {
        _$jscoverage['utils/eql.js'][33]++;
        return actual.getTime() === expected.getTime();
      }
      else {
        _$jscoverage['utils/eql.js'][37]++;
        if (typeof actual != "object" && typeof expected != "object") {
          _$jscoverage['utils/eql.js'][38]++;
          return actual === expected;
        }
        else {
          _$jscoverage['utils/eql.js'][47]++;
          return objEquiv(actual, expected);
        }
      }
    }
  }
}
_$jscoverage['utils/eql.js'][51]++;
function isUndefinedOrNull(value) {
  _$jscoverage['utils/eql.js'][52]++;
  return value === null || value === undefined;
}
_$jscoverage['utils/eql.js'][55]++;
function isArguments(object) {
  _$jscoverage['utils/eql.js'][56]++;
  return Object.prototype.toString.call(object) == "[object Arguments]";
}
_$jscoverage['utils/eql.js'][59]++;
function objEquiv(a, b) {
  _$jscoverage['utils/eql.js'][60]++;
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b)) {
    _$jscoverage['utils/eql.js'][61]++;
    return false;
  }
  _$jscoverage['utils/eql.js'][63]++;
  if (a.prototype !== b.prototype) {
    _$jscoverage['utils/eql.js'][63]++;
    return false;
  }
  _$jscoverage['utils/eql.js'][66]++;
  if (isArguments(a)) {
    _$jscoverage['utils/eql.js'][67]++;
    if (! isArguments(b)) {
      _$jscoverage['utils/eql.js'][68]++;
      return false;
    }
    _$jscoverage['utils/eql.js'][70]++;
    a = pSlice.call(a);
    _$jscoverage['utils/eql.js'][71]++;
    b = pSlice.call(b);
    _$jscoverage['utils/eql.js'][72]++;
    return _deepEqual(a, b);
  }
  _$jscoverage['utils/eql.js'][74]++;
  try {
    _$jscoverage['utils/eql.js'][75]++;
    var ka = Object.keys(a), kb = Object.keys(b), key, i;
  }
  catch (e) {
    _$jscoverage['utils/eql.js'][79]++;
    return false;
  }
  _$jscoverage['utils/eql.js'][83]++;
  if (ka.length != kb.length) {
    _$jscoverage['utils/eql.js'][84]++;
    return false;
  }
  _$jscoverage['utils/eql.js'][86]++;
  ka.sort();
  _$jscoverage['utils/eql.js'][87]++;
  kb.sort();
  _$jscoverage['utils/eql.js'][89]++;
  for (i = ka.length - 1; i >= 0; i--) {
    _$jscoverage['utils/eql.js'][90]++;
    if (ka[i] != kb[i]) {
      _$jscoverage['utils/eql.js'][91]++;
      return false;
    }
}
  _$jscoverage['utils/eql.js'][95]++;
  for (i = ka.length - 1; i >= 0; i--) {
    _$jscoverage['utils/eql.js'][96]++;
    key = ka[i];
    _$jscoverage['utils/eql.js'][97]++;
    if (! _deepEqual(a[key], b[key])) {
      _$jscoverage['utils/eql.js'][97]++;
      return false;
    }
}
  _$jscoverage['utils/eql.js'][99]++;
  return true;
}
_$jscoverage['utils/eql.js'].source = ["// This is directly from Node.js assert","// https://github.com/joyent/node/blob/f8c335d0caf47f16d31413f89aa28eda3878e3aa/lib/assert.js","","","module.exports = _deepEqual;","","// For browser implementation","if (!Buffer) {","  var Buffer = {","    isBuffer: function () {","      return false;","    }","  };","}","","function _deepEqual(actual, expected) {","  // 7.1. All identical values are equivalent, as determined by ===.","  if (actual === expected) {","    return true;","","  } else if (Buffer.isBuffer(actual) &amp;&amp; Buffer.isBuffer(expected)) {","    if (actual.length != expected.length) return false;","","    for (var i = 0; i &lt; actual.length; i++) {","      if (actual[i] !== expected[i]) return false;","    }","","    return true;","","  // 7.2. If the expected value is a Date object, the actual value is","  // equivalent if it is also a Date object that refers to the same time.","  } else if (actual instanceof Date &amp;&amp; expected instanceof Date) {","    return actual.getTime() === expected.getTime();","","  // 7.3. Other pairs that do not both pass typeof value == 'object',","  // equivalence is determined by ==.","  } else if (typeof actual != 'object' &amp;&amp; typeof expected != 'object') {","    return actual === expected;","","  // 7.4. For all other Object pairs, including Array objects, equivalence is","  // determined by having the same number of owned properties (as verified","  // with Object.prototype.hasOwnProperty.call), the same set of keys","  // (although not necessarily the same order), equivalent values for every","  // corresponding key, and an identical 'prototype' property. Note: this","  // accounts for both named and indexed properties on Arrays.","  } else {","    return objEquiv(actual, expected);","  }","}","","function isUndefinedOrNull(value) {","  return value === null || value === undefined;","}","","function isArguments(object) {","  return Object.prototype.toString.call(object) == '[object Arguments]';","}","","function objEquiv(a, b) {","  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))","    return false;","  // an identical 'prototype' property.","  if (a.prototype !== b.prototype) return false;","  //~~~I've managed to break Object.keys through screwy arguments passing.","  //   Converting to array solves the problem.","  if (isArguments(a)) {","    if (!isArguments(b)) {","      return false;","    }","    a = pSlice.call(a);","    b = pSlice.call(b);","    return _deepEqual(a, b);","  }","  try {","    var ka = Object.keys(a),","        kb = Object.keys(b),","        key, i;","  } catch (e) {//happens when one is a string literal and the other isn't","    return false;","  }","  // having the same number of owned properties (keys incorporates","  // hasOwnProperty)","  if (ka.length != kb.length)","    return false;","  //the same set of keys (although not necessarily the same order),","  ka.sort();","  kb.sort();","  //~~~cheap key test","  for (i = ka.length - 1; i &gt;= 0; i--) {","    if (ka[i] != kb[i])","      return false;","  }","  //equivalent values for every corresponding key, and","  //~~~possibly expensive deep test","  for (i = ka.length - 1; i &gt;= 0; i--) {","    key = ka[i];","    if (!_deepEqual(a[key], b[key])) return false;","  }","  return true;","}"];

});

require.define("/node_modules/chai/lib-cov/utils/inspect.js", function (require, module, exports, __dirname, __filename) {
/* automatically generated by JSCoverage - do not edit */
if (typeof _$jscoverage === 'undefined') _$jscoverage = {};
if (! _$jscoverage['utils/inspect.js']) {
  _$jscoverage['utils/inspect.js'] = [];
  _$jscoverage['utils/inspect.js'][4] = 0;
  _$jscoverage['utils/inspect.js'][17] = 0;
  _$jscoverage['utils/inspect.js'][18] = 0;
  _$jscoverage['utils/inspect.js'][21] = 0;
  _$jscoverage['utils/inspect.js'][23] = 0;
  _$jscoverage['utils/inspect.js'][26] = 0;
  _$jscoverage['utils/inspect.js'][29] = 0;
  _$jscoverage['utils/inspect.js'][34] = 0;
  _$jscoverage['utils/inspect.js'][38] = 0;
  _$jscoverage['utils/inspect.js'][39] = 0;
  _$jscoverage['utils/inspect.js'][40] = 0;
  _$jscoverage['utils/inspect.js'][44] = 0;
  _$jscoverage['utils/inspect.js'][45] = 0;
  _$jscoverage['utils/inspect.js'][48] = 0;
  _$jscoverage['utils/inspect.js'][49] = 0;
  _$jscoverage['utils/inspect.js'][50] = 0;
  _$jscoverage['utils/inspect.js'][51] = 0;
  _$jscoverage['utils/inspect.js'][53] = 0;
  _$jscoverage['utils/inspect.js'][54] = 0;
  _$jscoverage['utils/inspect.js'][56] = 0;
  _$jscoverage['utils/inspect.js'][57] = 0;
  _$jscoverage['utils/inspect.js'][59] = 0;
  _$jscoverage['utils/inspect.js'][60] = 0;
  _$jscoverage['utils/inspect.js'][64] = 0;
  _$jscoverage['utils/inspect.js'][67] = 0;
  _$jscoverage['utils/inspect.js'][68] = 0;
  _$jscoverage['utils/inspect.js'][69] = 0;
  _$jscoverage['utils/inspect.js'][73] = 0;
  _$jscoverage['utils/inspect.js'][74] = 0;
  _$jscoverage['utils/inspect.js'][75] = 0;
  _$jscoverage['utils/inspect.js'][79] = 0;
  _$jscoverage['utils/inspect.js'][80] = 0;
  _$jscoverage['utils/inspect.js'][84] = 0;
  _$jscoverage['utils/inspect.js'][85] = 0;
  _$jscoverage['utils/inspect.js'][89] = 0;
  _$jscoverage['utils/inspect.js'][90] = 0;
  _$jscoverage['utils/inspect.js'][93] = 0;
  _$jscoverage['utils/inspect.js'][94] = 0;
  _$jscoverage['utils/inspect.js'][97] = 0;
  _$jscoverage['utils/inspect.js'][98] = 0;
  _$jscoverage['utils/inspect.js'][99] = 0;
  _$jscoverage['utils/inspect.js'][101] = 0;
  _$jscoverage['utils/inspect.js'][105] = 0;
  _$jscoverage['utils/inspect.js'][107] = 0;
  _$jscoverage['utils/inspect.js'][108] = 0;
  _$jscoverage['utils/inspect.js'][109] = 0;
  _$jscoverage['utils/inspect.js'][111] = 0;
  _$jscoverage['utils/inspect.js'][112] = 0;
  _$jscoverage['utils/inspect.js'][116] = 0;
  _$jscoverage['utils/inspect.js'][118] = 0;
  _$jscoverage['utils/inspect.js'][122] = 0;
  _$jscoverage['utils/inspect.js'][123] = 0;
  _$jscoverage['utils/inspect.js'][125] = 0;
  _$jscoverage['utils/inspect.js'][128] = 0;
  _$jscoverage['utils/inspect.js'][131] = 0;
  _$jscoverage['utils/inspect.js'][134] = 0;
  _$jscoverage['utils/inspect.js'][137] = 0;
  _$jscoverage['utils/inspect.js'][140] = 0;
  _$jscoverage['utils/inspect.js'][141] = 0;
  _$jscoverage['utils/inspect.js'][146] = 0;
  _$jscoverage['utils/inspect.js'][147] = 0;
  _$jscoverage['utils/inspect.js'][151] = 0;
  _$jscoverage['utils/inspect.js'][152] = 0;
  _$jscoverage['utils/inspect.js'][153] = 0;
  _$jscoverage['utils/inspect.js'][154] = 0;
  _$jscoverage['utils/inspect.js'][155] = 0;
  _$jscoverage['utils/inspect.js'][158] = 0;
  _$jscoverage['utils/inspect.js'][161] = 0;
  _$jscoverage['utils/inspect.js'][162] = 0;
  _$jscoverage['utils/inspect.js'][163] = 0;
  _$jscoverage['utils/inspect.js'][167] = 0;
  _$jscoverage['utils/inspect.js'][171] = 0;
  _$jscoverage['utils/inspect.js'][172] = 0;
  _$jscoverage['utils/inspect.js'][173] = 0;
  _$jscoverage['utils/inspect.js'][174] = 0;
  _$jscoverage['utils/inspect.js'][175] = 0;
  _$jscoverage['utils/inspect.js'][176] = 0;
  _$jscoverage['utils/inspect.js'][178] = 0;
  _$jscoverage['utils/inspect.js'][181] = 0;
  _$jscoverage['utils/inspect.js'][182] = 0;
  _$jscoverage['utils/inspect.js'][186] = 0;
  _$jscoverage['utils/inspect.js'][187] = 0;
  _$jscoverage['utils/inspect.js'][189] = 0;
  _$jscoverage['utils/inspect.js'][190] = 0;
  _$jscoverage['utils/inspect.js'][191] = 0;
  _$jscoverage['utils/inspect.js'][192] = 0;
  _$jscoverage['utils/inspect.js'][194] = 0;
  _$jscoverage['utils/inspect.js'][196] = 0;
  _$jscoverage['utils/inspect.js'][197] = 0;
  _$jscoverage['utils/inspect.js'][198] = 0;
  _$jscoverage['utils/inspect.js'][199] = 0;
  _$jscoverage['utils/inspect.js'][202] = 0;
  _$jscoverage['utils/inspect.js'][203] = 0;
  _$jscoverage['utils/inspect.js'][208] = 0;
  _$jscoverage['utils/inspect.js'][211] = 0;
  _$jscoverage['utils/inspect.js'][212] = 0;
  _$jscoverage['utils/inspect.js'][213] = 0;
  _$jscoverage['utils/inspect.js'][215] = 0;
  _$jscoverage['utils/inspect.js'][216] = 0;
  _$jscoverage['utils/inspect.js'][217] = 0;
  _$jscoverage['utils/inspect.js'][218] = 0;
  _$jscoverage['utils/inspect.js'][220] = 0;
  _$jscoverage['utils/inspect.js'][223] = 0;
  _$jscoverage['utils/inspect.js'][227] = 0;
  _$jscoverage['utils/inspect.js'][231] = 0;
  _$jscoverage['utils/inspect.js'][232] = 0;
  _$jscoverage['utils/inspect.js'][233] = 0;
  _$jscoverage['utils/inspect.js'][234] = 0;
  _$jscoverage['utils/inspect.js'][235] = 0;
  _$jscoverage['utils/inspect.js'][236] = 0;
  _$jscoverage['utils/inspect.js'][239] = 0;
  _$jscoverage['utils/inspect.js'][240] = 0;
  _$jscoverage['utils/inspect.js'][248] = 0;
  _$jscoverage['utils/inspect.js'][251] = 0;
  _$jscoverage['utils/inspect.js'][252] = 0;
  _$jscoverage['utils/inspect.js'][256] = 0;
  _$jscoverage['utils/inspect.js'][257] = 0;
  _$jscoverage['utils/inspect.js'][260] = 0;
  _$jscoverage['utils/inspect.js'][261] = 0;
  _$jscoverage['utils/inspect.js'][264] = 0;
  _$jscoverage['utils/inspect.js'][265] = 0;
  _$jscoverage['utils/inspect.js'][268] = 0;
  _$jscoverage['utils/inspect.js'][269] = 0;
}
_$jscoverage['utils/inspect.js'][4]++;
module.exports = inspect;
_$jscoverage['utils/inspect.js'][17]++;
function inspect(obj, showHidden, depth, colors) {
  _$jscoverage['utils/inspect.js'][18]++;
  var ctx = {showHidden: showHidden, seen: [], stylize: (function (str) {
  _$jscoverage['utils/inspect.js'][21]++;
  return str;
})};
  _$jscoverage['utils/inspect.js'][23]++;
  return formatValue(ctx, obj, (typeof depth === "undefined"? 2: depth));
}
_$jscoverage['utils/inspect.js'][26]++;
function formatValue(ctx, value, recurseTimes) {
  _$jscoverage['utils/inspect.js'][29]++;
  if (value && typeof value.inspect === "function" && value.inspect !== exports.inspect && ! (value.constructor && value.constructor.prototype === value)) {
    _$jscoverage['utils/inspect.js'][34]++;
    return value.inspect(recurseTimes);
  }
  _$jscoverage['utils/inspect.js'][38]++;
  var primitive = formatPrimitive(ctx, value);
  _$jscoverage['utils/inspect.js'][39]++;
  if (primitive) {
    _$jscoverage['utils/inspect.js'][40]++;
    return primitive;
  }
  _$jscoverage['utils/inspect.js'][44]++;
  var visibleKeys = Object.keys(value);
  _$jscoverage['utils/inspect.js'][45]++;
  var keys = ctx.showHidden? Object.getOwnPropertyNames(value): visibleKeys;
  _$jscoverage['utils/inspect.js'][48]++;
  if (keys.length === 0) {
    _$jscoverage['utils/inspect.js'][49]++;
    if (typeof value === "function") {
      _$jscoverage['utils/inspect.js'][50]++;
      var name = value.name? ": " + value.name: "";
      _$jscoverage['utils/inspect.js'][51]++;
      return ctx.stylize("[Function" + name + "]", "special");
    }
    _$jscoverage['utils/inspect.js'][53]++;
    if (isRegExp(value)) {
      _$jscoverage['utils/inspect.js'][54]++;
      return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
    }
    _$jscoverage['utils/inspect.js'][56]++;
    if (isDate(value)) {
      _$jscoverage['utils/inspect.js'][57]++;
      return ctx.stylize(Date.prototype.toUTCString.call(value), "date");
    }
    _$jscoverage['utils/inspect.js'][59]++;
    if (isError(value)) {
      _$jscoverage['utils/inspect.js'][60]++;
      return formatError(value);
    }
  }
  _$jscoverage['utils/inspect.js'][64]++;
  var base = "", array = false, braces = ["{", "}"];
  _$jscoverage['utils/inspect.js'][67]++;
  if (isArray(value)) {
    _$jscoverage['utils/inspect.js'][68]++;
    array = true;
    _$jscoverage['utils/inspect.js'][69]++;
    braces = ["[", "]"];
  }
  _$jscoverage['utils/inspect.js'][73]++;
  if (typeof value === "function") {
    _$jscoverage['utils/inspect.js'][74]++;
    var n = value.name? ": " + value.name: "";
    _$jscoverage['utils/inspect.js'][75]++;
    base = " [Function" + n + "]";
  }
  _$jscoverage['utils/inspect.js'][79]++;
  if (isRegExp(value)) {
    _$jscoverage['utils/inspect.js'][80]++;
    base = " " + RegExp.prototype.toString.call(value);
  }
  _$jscoverage['utils/inspect.js'][84]++;
  if (isDate(value)) {
    _$jscoverage['utils/inspect.js'][85]++;
    base = " " + Date.prototype.toUTCString.call(value);
  }
  _$jscoverage['utils/inspect.js'][89]++;
  if (isError(value)) {
    _$jscoverage['utils/inspect.js'][90]++;
    base = " " + formatError(value);
  }
  _$jscoverage['utils/inspect.js'][93]++;
  if (keys.length === 0 && (! array || value.length == 0)) {
    _$jscoverage['utils/inspect.js'][94]++;
    return braces[0] + base + braces[1];
  }
  _$jscoverage['utils/inspect.js'][97]++;
  if (recurseTimes < 0) {
    _$jscoverage['utils/inspect.js'][98]++;
    if (isRegExp(value)) {
      _$jscoverage['utils/inspect.js'][99]++;
      return ctx.stylize(RegExp.prototype.toString.call(value), "regexp");
    }
    else {
      _$jscoverage['utils/inspect.js'][101]++;
      return ctx.stylize("[Object]", "special");
    }
  }
  _$jscoverage['utils/inspect.js'][105]++;
  ctx.seen.push(value);
  _$jscoverage['utils/inspect.js'][107]++;
  var output;
  _$jscoverage['utils/inspect.js'][108]++;
  if (array) {
    _$jscoverage['utils/inspect.js'][109]++;
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  }
  else {
    _$jscoverage['utils/inspect.js'][111]++;
    output = keys.map((function (key) {
  _$jscoverage['utils/inspect.js'][112]++;
  return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
}));
  }
  _$jscoverage['utils/inspect.js'][116]++;
  ctx.seen.pop();
  _$jscoverage['utils/inspect.js'][118]++;
  return reduceToSingleString(output, base, braces);
}
_$jscoverage['utils/inspect.js'][122]++;
function formatPrimitive(ctx, value) {
  _$jscoverage['utils/inspect.js'][123]++;
  switch (typeof value) {
  case "undefined":
    _$jscoverage['utils/inspect.js'][125]++;
    return ctx.stylize("undefined", "undefined");
  case "string":
    _$jscoverage['utils/inspect.js'][128]++;
    var simple = "'" + JSON.stringify(value).replace(/^"|"$/g, "").replace(/'/g, "\\'").replace(/\\"/g, "\"") + "'";
    _$jscoverage['utils/inspect.js'][131]++;
    return ctx.stylize(simple, "string");
  case "number":
    _$jscoverage['utils/inspect.js'][134]++;
    return ctx.stylize("" + value, "number");
  case "boolean":
    _$jscoverage['utils/inspect.js'][137]++;
    return ctx.stylize("" + value, "boolean");
  }
  _$jscoverage['utils/inspect.js'][140]++;
  if (value === null) {
    _$jscoverage['utils/inspect.js'][141]++;
    return ctx.stylize("null", "null");
  }
}
_$jscoverage['utils/inspect.js'][146]++;
function formatError(value) {
  _$jscoverage['utils/inspect.js'][147]++;
  return "[" + Error.prototype.toString.call(value) + "]";
}
_$jscoverage['utils/inspect.js'][151]++;
function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  _$jscoverage['utils/inspect.js'][152]++;
  var output = [];
  _$jscoverage['utils/inspect.js'][153]++;
  for (var i = 0, l = value.length; i < l; ++i) {
    _$jscoverage['utils/inspect.js'][154]++;
    if (Object.prototype.hasOwnProperty.call(value, String(i))) {
      _$jscoverage['utils/inspect.js'][155]++;
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true));
    }
    else {
      _$jscoverage['utils/inspect.js'][158]++;
      output.push("");
    }
}
  _$jscoverage['utils/inspect.js'][161]++;
  keys.forEach((function (key) {
  _$jscoverage['utils/inspect.js'][162]++;
  if (! key.match(/^\d+$/)) {
    _$jscoverage['utils/inspect.js'][163]++;
    output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true));
  }
}));
  _$jscoverage['utils/inspect.js'][167]++;
  return output;
}
_$jscoverage['utils/inspect.js'][171]++;
function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  _$jscoverage['utils/inspect.js'][172]++;
  var name, str;
  _$jscoverage['utils/inspect.js'][173]++;
  if (value.__lookupGetter__) {
    _$jscoverage['utils/inspect.js'][174]++;
    if (value.__lookupGetter__(key)) {
      _$jscoverage['utils/inspect.js'][175]++;
      if (value.__lookupSetter__(key)) {
        _$jscoverage['utils/inspect.js'][176]++;
        str = ctx.stylize("[Getter/Setter]", "special");
      }
      else {
        _$jscoverage['utils/inspect.js'][178]++;
        str = ctx.stylize("[Getter]", "special");
      }
    }
    else {
      _$jscoverage['utils/inspect.js'][181]++;
      if (value.__lookupSetter__(key)) {
        _$jscoverage['utils/inspect.js'][182]++;
        str = ctx.stylize("[Setter]", "special");
      }
    }
  }
  _$jscoverage['utils/inspect.js'][186]++;
  if (visibleKeys.indexOf(key) < 0) {
    _$jscoverage['utils/inspect.js'][187]++;
    name = "[" + key + "]";
  }
  _$jscoverage['utils/inspect.js'][189]++;
  if (! str) {
    _$jscoverage['utils/inspect.js'][190]++;
    if (ctx.seen.indexOf(value[key]) < 0) {
      _$jscoverage['utils/inspect.js'][191]++;
      if (recurseTimes === null) {
        _$jscoverage['utils/inspect.js'][192]++;
        str = formatValue(ctx, value[key], null);
      }
      else {
        _$jscoverage['utils/inspect.js'][194]++;
        str = formatValue(ctx, value[key], recurseTimes - 1);
      }
      _$jscoverage['utils/inspect.js'][196]++;
      if (str.indexOf("\n") > -1) {
        _$jscoverage['utils/inspect.js'][197]++;
        if (array) {
          _$jscoverage['utils/inspect.js'][198]++;
          str = str.split("\n").map((function (line) {
  _$jscoverage['utils/inspect.js'][199]++;
  return "  " + line;
})).join("\n").substr(2);
        }
        else {
          _$jscoverage['utils/inspect.js'][202]++;
          str = "\n" + str.split("\n").map((function (line) {
  _$jscoverage['utils/inspect.js'][203]++;
  return "   " + line;
})).join("\n");
        }
      }
    }
    else {
      _$jscoverage['utils/inspect.js'][208]++;
      str = ctx.stylize("[Circular]", "special");
    }
  }
  _$jscoverage['utils/inspect.js'][211]++;
  if (typeof name === "undefined") {
    _$jscoverage['utils/inspect.js'][212]++;
    if (array && key.match(/^\d+$/)) {
      _$jscoverage['utils/inspect.js'][213]++;
      return str;
    }
    _$jscoverage['utils/inspect.js'][215]++;
    name = JSON.stringify("" + key);
    _$jscoverage['utils/inspect.js'][216]++;
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      _$jscoverage['utils/inspect.js'][217]++;
      name = name.substr(1, name.length - 2);
      _$jscoverage['utils/inspect.js'][218]++;
      name = ctx.stylize(name, "name");
    }
    else {
      _$jscoverage['utils/inspect.js'][220]++;
      name = name.replace(/'/g, "\\'").replace(/\\"/g, "\"").replace(/(^"|"$)/g, "'");
      _$jscoverage['utils/inspect.js'][223]++;
      name = ctx.stylize(name, "string");
    }
  }
  _$jscoverage['utils/inspect.js'][227]++;
  return name + ": " + str;
}
_$jscoverage['utils/inspect.js'][231]++;
function reduceToSingleString(output, base, braces) {
  _$jscoverage['utils/inspect.js'][232]++;
  var numLinesEst = 0;
  _$jscoverage['utils/inspect.js'][233]++;
  var length = output.reduce((function (prev, cur) {
  _$jscoverage['utils/inspect.js'][234]++;
  numLinesEst++;
  _$jscoverage['utils/inspect.js'][235]++;
  if (cur.indexOf("\n") >= 0) {
    _$jscoverage['utils/inspect.js'][235]++;
    numLinesEst++;
  }
  _$jscoverage['utils/inspect.js'][236]++;
  return prev + cur.length + 1;
}), 0);
  _$jscoverage['utils/inspect.js'][239]++;
  if (length > 60) {
    _$jscoverage['utils/inspect.js'][240]++;
    return braces[0] + (base === ""? "": base + "\n ") + " " + output.join(",\n  ") + " " + braces[1];
  }
  _$jscoverage['utils/inspect.js'][248]++;
  return braces[0] + base + " " + output.join(", ") + " " + braces[1];
}
_$jscoverage['utils/inspect.js'][251]++;
function isArray(ar) {
  _$jscoverage['utils/inspect.js'][252]++;
  return Array.isArray(ar) || (typeof ar === "object" && objectToString(ar) === "[object Array]");
}
_$jscoverage['utils/inspect.js'][256]++;
function isRegExp(re) {
  _$jscoverage['utils/inspect.js'][257]++;
  return typeof re === "object" && objectToString(re) === "[object RegExp]";
}
_$jscoverage['utils/inspect.js'][260]++;
function isDate(d) {
  _$jscoverage['utils/inspect.js'][261]++;
  return typeof d === "object" && objectToString(d) === "[object Date]";
}
_$jscoverage['utils/inspect.js'][264]++;
function isError(e) {
  _$jscoverage['utils/inspect.js'][265]++;
  return typeof e === "object" && objectToString(e) === "[object Error]";
}
_$jscoverage['utils/inspect.js'][268]++;
function objectToString(o) {
  _$jscoverage['utils/inspect.js'][269]++;
  return Object.prototype.toString.call(o);
}
_$jscoverage['utils/inspect.js'].source = ["// This is (almost) directly from Node.js utils","// https://github.com/joyent/node/blob/f8c335d0caf47f16d31413f89aa28eda3878e3aa/lib/util.js","","module.exports = inspect;","","/**"," * Echos the value of a value. Trys to print the value out"," * in the best way possible given the different types."," *"," * @param {Object} obj The object to print out."," * @param {Boolean} showHidden Flag that shows hidden (not enumerable)"," *    properties of objects."," * @param {Number} depth Depth in which to descend in object. Default is 2."," * @param {Boolean} colors Flag to turn on ANSI escape codes to color the"," *    output. Default is false (no coloring)."," */","function inspect(obj, showHidden, depth, colors) {","  var ctx = {","    showHidden: showHidden,","    seen: [],","    stylize: function (str) { return str; }","  };","  return formatValue(ctx, obj, (typeof depth === 'undefined' ? 2 : depth));","}","","function formatValue(ctx, value, recurseTimes) {","  // Provide a hook for user-specified inspect functions.","  // Check that value is an object with an inspect function on it","  if (value &amp;&amp; typeof value.inspect === 'function' &amp;&amp;","      // Filter out the util module, it's inspect function is special","      value.inspect !== exports.inspect &amp;&amp;","      // Also filter out any prototype objects using the circular check.","      !(value.constructor &amp;&amp; value.constructor.prototype === value)) {","    return value.inspect(recurseTimes);","  }","","  // Primitive types cannot have properties","  var primitive = formatPrimitive(ctx, value);","  if (primitive) {","    return primitive;","  }","","  // Look up the keys of the object.","  var visibleKeys = Object.keys(value);","  var keys = ctx.showHidden ? Object.getOwnPropertyNames(value) : visibleKeys;","","  // Some type of object without properties can be shortcutted.","  if (keys.length === 0) {","    if (typeof value === 'function') {","      var name = value.name ? ': ' + value.name : '';","      return ctx.stylize('[Function' + name + ']', 'special');","    }","    if (isRegExp(value)) {","      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');","    }","    if (isDate(value)) {","      return ctx.stylize(Date.prototype.toUTCString.call(value), 'date');","    }","    if (isError(value)) {","      return formatError(value);","    }","  }","","  var base = '', array = false, braces = ['{', '}'];","","  // Make Array say that they are Array","  if (isArray(value)) {","    array = true;","    braces = ['[', ']'];","  }","","  // Make functions say that they are functions","  if (typeof value === 'function') {","    var n = value.name ? ': ' + value.name : '';","    base = ' [Function' + n + ']';","  }","","  // Make RegExps say that they are RegExps","  if (isRegExp(value)) {","    base = ' ' + RegExp.prototype.toString.call(value);","  }","","  // Make dates with properties first say the date","  if (isDate(value)) {","    base = ' ' + Date.prototype.toUTCString.call(value);","  }","","  // Make error with message first say the error","  if (isError(value)) {","    base = ' ' + formatError(value);","  }","","  if (keys.length === 0 &amp;&amp; (!array || value.length == 0)) {","    return braces[0] + base + braces[1];","  }","","  if (recurseTimes &lt; 0) {","    if (isRegExp(value)) {","      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');","    } else {","      return ctx.stylize('[Object]', 'special');","    }","  }","","  ctx.seen.push(value);","","  var output;","  if (array) {","    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);","  } else {","    output = keys.map(function(key) {","      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);","    });","  }","","  ctx.seen.pop();","","  return reduceToSingleString(output, base, braces);","}","","","function formatPrimitive(ctx, value) {","  switch (typeof value) {","    case 'undefined':","      return ctx.stylize('undefined', 'undefined');","","    case 'string':","      var simple = '\\'' + JSON.stringify(value).replace(/^\"|\"$/g, '')","                                               .replace(/'/g, \"\\\\'\")","                                               .replace(/\\\\\"/g, '\"') + '\\'';","      return ctx.stylize(simple, 'string');","","    case 'number':","      return ctx.stylize('' + value, 'number');","","    case 'boolean':","      return ctx.stylize('' + value, 'boolean');","  }","  // For some reason typeof null is \"object\", so special case here.","  if (value === null) {","    return ctx.stylize('null', 'null');","  }","}","","","function formatError(value) {","  return '[' + Error.prototype.toString.call(value) + ']';","}","","","function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {","  var output = [];","  for (var i = 0, l = value.length; i &lt; l; ++i) {","    if (Object.prototype.hasOwnProperty.call(value, String(i))) {","      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,","          String(i), true));","    } else {","      output.push('');","    }","  }","  keys.forEach(function(key) {","    if (!key.match(/^\\d+$/)) {","      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,","          key, true));","    }","  });","  return output;","}","","","function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {","  var name, str;","  if (value.__lookupGetter__) {","    if (value.__lookupGetter__(key)) {","      if (value.__lookupSetter__(key)) {","        str = ctx.stylize('[Getter/Setter]', 'special');","      } else {","        str = ctx.stylize('[Getter]', 'special');","      }","    } else {","      if (value.__lookupSetter__(key)) {","        str = ctx.stylize('[Setter]', 'special');","      }","    }","  }","  if (visibleKeys.indexOf(key) &lt; 0) {","    name = '[' + key + ']';","  }","  if (!str) {","    if (ctx.seen.indexOf(value[key]) &lt; 0) {","      if (recurseTimes === null) {","        str = formatValue(ctx, value[key], null);","      } else {","        str = formatValue(ctx, value[key], recurseTimes - 1);","      }","      if (str.indexOf('\\n') &gt; -1) {","        if (array) {","          str = str.split('\\n').map(function(line) {","            return '  ' + line;","          }).join('\\n').substr(2);","        } else {","          str = '\\n' + str.split('\\n').map(function(line) {","            return '   ' + line;","          }).join('\\n');","        }","      }","    } else {","      str = ctx.stylize('[Circular]', 'special');","    }","  }","  if (typeof name === 'undefined') {","    if (array &amp;&amp; key.match(/^\\d+$/)) {","      return str;","    }","    name = JSON.stringify('' + key);","    if (name.match(/^\"([a-zA-Z_][a-zA-Z_0-9]*)\"$/)) {","      name = name.substr(1, name.length - 2);","      name = ctx.stylize(name, 'name');","    } else {","      name = name.replace(/'/g, \"\\\\'\")","                 .replace(/\\\\\"/g, '\"')","                 .replace(/(^\"|\"$)/g, \"'\");","      name = ctx.stylize(name, 'string');","    }","  }","","  return name + ': ' + str;","}","","","function reduceToSingleString(output, base, braces) {","  var numLinesEst = 0;","  var length = output.reduce(function(prev, cur) {","    numLinesEst++;","    if (cur.indexOf('\\n') &gt;= 0) numLinesEst++;","    return prev + cur.length + 1;","  }, 0);","","  if (length &gt; 60) {","    return braces[0] +","           (base === '' ? '' : base + '\\n ') +","           ' ' +","           output.join(',\\n  ') +","           ' ' +","           braces[1];","  }","","  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];","}","","function isArray(ar) {","  return Array.isArray(ar) ||","         (typeof ar === 'object' &amp;&amp; objectToString(ar) === '[object Array]');","}","","function isRegExp(re) {","  return typeof re === 'object' &amp;&amp; objectToString(re) === '[object RegExp]';","}","","function isDate(d) {","  return typeof d === 'object' &amp;&amp; objectToString(d) === '[object Date]';","}","","function isError(e) {","  return typeof e === 'object' &amp;&amp; objectToString(e) === '[object Error]';","}","","function objectToString(o) {","  return Object.prototype.toString.call(o);","}"];

});

require.define("/node_modules/chai/lib-cov/interface/expect.js", function (require, module, exports, __dirname, __filename) {
/* automatically generated by JSCoverage - do not edit */
if (typeof _$jscoverage === 'undefined') _$jscoverage = {};
if (! _$jscoverage['interface/expect.js']) {
  _$jscoverage['interface/expect.js'] = [];
  _$jscoverage['interface/expect.js'][7] = 0;
  _$jscoverage['interface/expect.js'][8] = 0;
  _$jscoverage['interface/expect.js'][9] = 0;
}
_$jscoverage['interface/expect.js'][7]++;
module.exports = (function (chai) {
  _$jscoverage['interface/expect.js'][8]++;
  chai.expect = (function (val, message) {
  _$jscoverage['interface/expect.js'][9]++;
  return new chai.Assertion(val, message);
});
});
_$jscoverage['interface/expect.js'].source = ["/*!"," * chai"," * Copyright(c) 2011 Jake Luer &lt;jake@alogicalparadox.com&gt;"," * MIT Licensed"," */","","module.exports = function (chai) {","  chai.expect = function (val, message) {","    return new chai.Assertion(val, message);","  };","};",""];

});

require.define("/node_modules/chai/lib-cov/interface/should.js", function (require, module, exports, __dirname, __filename) {
/* automatically generated by JSCoverage - do not edit */
if (typeof _$jscoverage === 'undefined') _$jscoverage = {};
if (! _$jscoverage['interface/should.js']) {
  _$jscoverage['interface/should.js'] = [];
  _$jscoverage['interface/should.js'][7] = 0;
  _$jscoverage['interface/should.js'][8] = 0;
  _$jscoverage['interface/should.js'][10] = 0;
  _$jscoverage['interface/should.js'][12] = 0;
  _$jscoverage['interface/should.js'][15] = 0;
  _$jscoverage['interface/should.js'][16] = 0;
  _$jscoverage['interface/should.js'][17] = 0;
  _$jscoverage['interface/should.js'][18] = 0;
  _$jscoverage['interface/should.js'][20] = 0;
  _$jscoverage['interface/should.js'][25] = 0;
  _$jscoverage['interface/should.js'][27] = 0;
  _$jscoverage['interface/should.js'][28] = 0;
  _$jscoverage['interface/should.js'][31] = 0;
  _$jscoverage['interface/should.js'][32] = 0;
  _$jscoverage['interface/should.js'][35] = 0;
  _$jscoverage['interface/should.js'][36] = 0;
  _$jscoverage['interface/should.js'][40] = 0;
  _$jscoverage['interface/should.js'][42] = 0;
  _$jscoverage['interface/should.js'][43] = 0;
  _$jscoverage['interface/should.js'][46] = 0;
  _$jscoverage['interface/should.js'][47] = 0;
  _$jscoverage['interface/should.js'][50] = 0;
  _$jscoverage['interface/should.js'][51] = 0;
  _$jscoverage['interface/should.js'][54] = 0;
}
_$jscoverage['interface/should.js'][7]++;
module.exports = (function (chai) {
  _$jscoverage['interface/should.js'][8]++;
  var Assertion = chai.Assertion;
  _$jscoverage['interface/should.js'][10]++;
  chai.should = (function () {
  _$jscoverage['interface/should.js'][12]++;
  Object.defineProperty(Object.prototype, "should", {set: (function () {
}), get: (function () {
  _$jscoverage['interface/should.js'][15]++;
  if (this instanceof String || this instanceof Number) {
    _$jscoverage['interface/should.js'][16]++;
    return new Assertion(this.constructor(this));
  }
  else {
    _$jscoverage['interface/should.js'][17]++;
    if (this instanceof Boolean) {
      _$jscoverage['interface/should.js'][18]++;
      return new Assertion(this == true);
    }
  }
  _$jscoverage['interface/should.js'][20]++;
  return new Assertion(this);
}), configurable: true});
  _$jscoverage['interface/should.js'][25]++;
  var should = {};
  _$jscoverage['interface/should.js'][27]++;
  should.equal = (function (val1, val2) {
  _$jscoverage['interface/should.js'][28]++;
  new Assertion(val1).to.equal(val2);
});
  _$jscoverage['interface/should.js'][31]++;
  should["throw"] = (function (fn, errt, errs) {
  _$jscoverage['interface/should.js'][32]++;
  new Assertion(fn).to["throw"](errt, errs);
});
  _$jscoverage['interface/should.js'][35]++;
  should.exist = (function (val) {
  _$jscoverage['interface/should.js'][36]++;
  new Assertion(val).to.exist;
});
  _$jscoverage['interface/should.js'][40]++;
  should.not = {};
  _$jscoverage['interface/should.js'][42]++;
  should.not.equal = (function (val1, val2) {
  _$jscoverage['interface/should.js'][43]++;
  new Assertion(val1).to.not.equal(val2);
});
  _$jscoverage['interface/should.js'][46]++;
  should.not["throw"] = (function (fn, errt, errs) {
  _$jscoverage['interface/should.js'][47]++;
  new Assertion(fn).to.not["throw"](errt, errs);
});
  _$jscoverage['interface/should.js'][50]++;
  should.not.exist = (function (val) {
  _$jscoverage['interface/should.js'][51]++;
  new Assertion(val).to.not.exist;
});
  _$jscoverage['interface/should.js'][54]++;
  return should;
});
});
_$jscoverage['interface/should.js'].source = ["/*!"," * chai"," * Copyright(c) 2011 Jake Luer &lt;jake@alogicalparadox.com&gt;"," * MIT Licensed"," */","","module.exports = function (chai) {","  var Assertion = chai.Assertion;","","  chai.should = function () {","    // modify Object.prototype to have `should`","    Object.defineProperty(Object.prototype, 'should', {","      set: function(){},","      get: function(){","        if (this instanceof String || this instanceof Number) {","          return new Assertion(this.constructor(this));","        } else if (this instanceof Boolean) {","          return new Assertion(this == true);","        }","        return new Assertion(this);","      },","      configurable: true","    });","","    var should = {};","","    should.equal = function (val1, val2) {","      new Assertion(val1).to.equal(val2);","    };","","    should.throw = function (fn, errt, errs) {","      new Assertion(fn).to.throw(errt, errs);","    };","","    should.exist = function (val) {","      new Assertion(val).to.exist;","    }","","    // negation","    should.not = {}","","    should.not.equal = function (val1, val2) {","      new Assertion(val1).to.not.equal(val2);","    };","","    should.not.throw = function (fn, errt, errs) {","      new Assertion(fn).to.not.throw(errt, errs);","    };","","    should.not.exist = function (val) {","      new Assertion(val).to.not.exist;","    }","","    return should;","  };","};"];

});

require.define("/node_modules/chai/lib-cov/interface/assert.js", function (require, module, exports, __dirname, __filename) {
/* automatically generated by JSCoverage - do not edit */
if (typeof _$jscoverage === 'undefined') _$jscoverage = {};
if (! _$jscoverage['interface/assert.js']) {
  _$jscoverage['interface/assert.js'] = [];
  _$jscoverage['interface/assert.js'][31] = 0;
  _$jscoverage['interface/assert.js'][35] = 0;
  _$jscoverage['interface/assert.js'][42] = 0;
  _$jscoverage['interface/assert.js'][57] = 0;
  _$jscoverage['interface/assert.js'][58] = 0;
  _$jscoverage['interface/assert.js'][81] = 0;
  _$jscoverage['interface/assert.js'][82] = 0;
  _$jscoverage['interface/assert.js'][99] = 0;
  _$jscoverage['interface/assert.js'][100] = 0;
  _$jscoverage['interface/assert.js'][102] = 0;
  _$jscoverage['interface/assert.js'][122] = 0;
  _$jscoverage['interface/assert.js'][123] = 0;
  _$jscoverage['interface/assert.js'][125] = 0;
  _$jscoverage['interface/assert.js'][145] = 0;
  _$jscoverage['interface/assert.js'][146] = 0;
  _$jscoverage['interface/assert.js'][163] = 0;
  _$jscoverage['interface/assert.js'][164] = 0;
  _$jscoverage['interface/assert.js'][181] = 0;
  _$jscoverage['interface/assert.js'][182] = 0;
  _$jscoverage['interface/assert.js'][199] = 0;
  _$jscoverage['interface/assert.js'][200] = 0;
  _$jscoverage['interface/assert.js'][217] = 0;
  _$jscoverage['interface/assert.js'][218] = 0;
  _$jscoverage['interface/assert.js'][235] = 0;
  _$jscoverage['interface/assert.js'][236] = 0;
  _$jscoverage['interface/assert.js'][252] = 0;
  _$jscoverage['interface/assert.js'][253] = 0;
  _$jscoverage['interface/assert.js'][270] = 0;
  _$jscoverage['interface/assert.js'][271] = 0;
  _$jscoverage['interface/assert.js'][287] = 0;
  _$jscoverage['interface/assert.js'][288] = 0;
  _$jscoverage['interface/assert.js'][305] = 0;
  _$jscoverage['interface/assert.js'][306] = 0;
  _$jscoverage['interface/assert.js'][323] = 0;
  _$jscoverage['interface/assert.js'][324] = 0;
  _$jscoverage['interface/assert.js'][341] = 0;
  _$jscoverage['interface/assert.js'][342] = 0;
  _$jscoverage['interface/assert.js'][359] = 0;
  _$jscoverage['interface/assert.js'][360] = 0;
  _$jscoverage['interface/assert.js'][377] = 0;
  _$jscoverage['interface/assert.js'][378] = 0;
  _$jscoverage['interface/assert.js'][395] = 0;
  _$jscoverage['interface/assert.js'][396] = 0;
  _$jscoverage['interface/assert.js'][416] = 0;
  _$jscoverage['interface/assert.js'][417] = 0;
  _$jscoverage['interface/assert.js'][434] = 0;
  _$jscoverage['interface/assert.js'][435] = 0;
  _$jscoverage['interface/assert.js'][455] = 0;
  _$jscoverage['interface/assert.js'][456] = 0;
  _$jscoverage['interface/assert.js'][475] = 0;
  _$jscoverage['interface/assert.js'][476] = 0;
  _$jscoverage['interface/assert.js'][478] = 0;
  _$jscoverage['interface/assert.js'][479] = 0;
  _$jscoverage['interface/assert.js'][480] = 0;
  _$jscoverage['interface/assert.js'][481] = 0;
  _$jscoverage['interface/assert.js'][499] = 0;
  _$jscoverage['interface/assert.js'][500] = 0;
  _$jscoverage['interface/assert.js'][518] = 0;
  _$jscoverage['interface/assert.js'][519] = 0;
  _$jscoverage['interface/assert.js'][539] = 0;
  _$jscoverage['interface/assert.js'][540] = 0;
  _$jscoverage['interface/assert.js'][541] = 0;
  _$jscoverage['interface/assert.js'][542] = 0;
  _$jscoverage['interface/assert.js'][545] = 0;
  _$jscoverage['interface/assert.js'][565] = 0;
  _$jscoverage['interface/assert.js'][566] = 0;
  _$jscoverage['interface/assert.js'][567] = 0;
  _$jscoverage['interface/assert.js'][568] = 0;
  _$jscoverage['interface/assert.js'][571] = 0;
  _$jscoverage['interface/assert.js'][590] = 0;
  _$jscoverage['interface/assert.js'][591] = 0;
  _$jscoverage['interface/assert.js'][592] = 0;
  _$jscoverage['interface/assert.js'][594] = 0;
  _$jscoverage['interface/assert.js'][595] = 0;
  _$jscoverage['interface/assert.js'][605] = 0;
  _$jscoverage['interface/assert.js'][606] = 0;
  _$jscoverage['interface/assert.js'][613] = 0;
  _$jscoverage['interface/assert.js'][614] = 0;
  _$jscoverage['interface/assert.js'][615] = 0;
}
_$jscoverage['interface/assert.js'][31]++;
module.exports = (function (chai) {
  _$jscoverage['interface/assert.js'][35]++;
  var Assertion = chai.Assertion, inspect = chai.inspect;
  _$jscoverage['interface/assert.js'][42]++;
  var assert = chai.assert = {};
  _$jscoverage['interface/assert.js'][57]++;
  assert.fail = (function (actual, expected, message, operator) {
  _$jscoverage['interface/assert.js'][58]++;
  throw new chai.AssertionError({actual: actual, expected: expected, message: message, operator: operator, stackStartFunction: assert.fail});
});
  _$jscoverage['interface/assert.js'][81]++;
  assert.ok = (function (val, msg) {
  _$jscoverage['interface/assert.js'][82]++;
  new Assertion(val, msg).is.ok;
});
  _$jscoverage['interface/assert.js'][99]++;
  assert.equal = (function (act, exp, msg) {
  _$jscoverage['interface/assert.js'][100]++;
  var test = new Assertion(act, msg);
  _$jscoverage['interface/assert.js'][102]++;
  test.assert(exp == test.obj, "expected " + test.inspect + " to equal " + inspect(exp), "expected " + test.inspect + " to not equal " + inspect(exp));
});
  _$jscoverage['interface/assert.js'][122]++;
  assert.notEqual = (function (act, exp, msg) {
  _$jscoverage['interface/assert.js'][123]++;
  var test = new Assertion(act, msg);
  _$jscoverage['interface/assert.js'][125]++;
  test.assert(exp != test.obj, "expected " + test.inspect + " to equal " + inspect(exp), "expected " + test.inspect + " to not equal " + inspect(exp));
});
  _$jscoverage['interface/assert.js'][145]++;
  assert.strictEqual = (function (act, exp, msg) {
  _$jscoverage['interface/assert.js'][146]++;
  new Assertion(act, msg).to.equal(exp);
});
  _$jscoverage['interface/assert.js'][163]++;
  assert.notStrictEqual = (function (act, exp, msg) {
  _$jscoverage['interface/assert.js'][164]++;
  new Assertion(act, msg).to.not.equal(exp);
});
  _$jscoverage['interface/assert.js'][181]++;
  assert.deepEqual = (function (act, exp, msg) {
  _$jscoverage['interface/assert.js'][182]++;
  new Assertion(act, msg).to.eql(exp);
});
  _$jscoverage['interface/assert.js'][199]++;
  assert.notDeepEqual = (function (act, exp, msg) {
  _$jscoverage['interface/assert.js'][200]++;
  new Assertion(act, msg).to.not.eql(exp);
});
  _$jscoverage['interface/assert.js'][217]++;
  assert.isTrue = (function (val, msg) {
  _$jscoverage['interface/assert.js'][218]++;
  new Assertion(val, msg).is["true"];
});
  _$jscoverage['interface/assert.js'][235]++;
  assert.isFalse = (function (val, msg) {
  _$jscoverage['interface/assert.js'][236]++;
  new Assertion(val, msg).is["false"];
});
  _$jscoverage['interface/assert.js'][252]++;
  assert.isNull = (function (val, msg) {
  _$jscoverage['interface/assert.js'][253]++;
  new Assertion(val, msg).to.equal(null);
});
  _$jscoverage['interface/assert.js'][270]++;
  assert.isNotNull = (function (val, msg) {
  _$jscoverage['interface/assert.js'][271]++;
  new Assertion(val, msg).to.not.equal(null);
});
  _$jscoverage['interface/assert.js'][287]++;
  assert.isUndefined = (function (val, msg) {
  _$jscoverage['interface/assert.js'][288]++;
  new Assertion(val, msg).to.equal(undefined);
});
  _$jscoverage['interface/assert.js'][305]++;
  assert.isDefined = (function (val, msg) {
  _$jscoverage['interface/assert.js'][306]++;
  new Assertion(val, msg).to.not.equal(undefined);
});
  _$jscoverage['interface/assert.js'][323]++;
  assert.isFunction = (function (val, msg) {
  _$jscoverage['interface/assert.js'][324]++;
  new Assertion(val, msg).to.be.a("function");
});
  _$jscoverage['interface/assert.js'][341]++;
  assert.isObject = (function (val, msg) {
  _$jscoverage['interface/assert.js'][342]++;
  new Assertion(val, msg).to.be.a("object");
});
  _$jscoverage['interface/assert.js'][359]++;
  assert.isArray = (function (val, msg) {
  _$jscoverage['interface/assert.js'][360]++;
  new Assertion(val, msg).to.be["instanceof"](Array);
});
  _$jscoverage['interface/assert.js'][377]++;
  assert.isString = (function (val, msg) {
  _$jscoverage['interface/assert.js'][378]++;
  new Assertion(val, msg).to.be.a("string");
});
  _$jscoverage['interface/assert.js'][395]++;
  assert.isNumber = (function (val, msg) {
  _$jscoverage['interface/assert.js'][396]++;
  new Assertion(val, msg).to.be.a("number");
});
  _$jscoverage['interface/assert.js'][416]++;
  assert.isBoolean = (function (val, msg) {
  _$jscoverage['interface/assert.js'][417]++;
  new Assertion(val, msg).to.be.a("boolean");
});
  _$jscoverage['interface/assert.js'][434]++;
  assert.typeOf = (function (val, type, msg) {
  _$jscoverage['interface/assert.js'][435]++;
  new Assertion(val, msg).to.be.a(type);
});
  _$jscoverage['interface/assert.js'][455]++;
  assert.instanceOf = (function (val, type, msg) {
  _$jscoverage['interface/assert.js'][456]++;
  new Assertion(val, msg).to.be["instanceof"](type);
});
  _$jscoverage['interface/assert.js'][475]++;
  assert.include = (function (exp, inc, msg) {
  _$jscoverage['interface/assert.js'][476]++;
  var obj = new Assertion(exp, msg);
  _$jscoverage['interface/assert.js'][478]++;
  if (Array.isArray(exp)) {
    _$jscoverage['interface/assert.js'][479]++;
    obj.to.include(inc);
  }
  else {
    _$jscoverage['interface/assert.js'][480]++;
    if ("string" === typeof exp) {
      _$jscoverage['interface/assert.js'][481]++;
      obj.to.contain.string(inc);
    }
  }
});
  _$jscoverage['interface/assert.js'][499]++;
  assert.match = (function (exp, re, msg) {
  _$jscoverage['interface/assert.js'][500]++;
  new Assertion(exp, msg).to.match(re);
});
  _$jscoverage['interface/assert.js'][518]++;
  assert.length = (function (exp, len, msg) {
  _$jscoverage['interface/assert.js'][519]++;
  new Assertion(exp, msg).to.have.length(len);
});
  _$jscoverage['interface/assert.js'][539]++;
  assert["throws"] = (function (fn, type, msg) {
  _$jscoverage['interface/assert.js'][540]++;
  if ("string" === typeof type) {
    _$jscoverage['interface/assert.js'][541]++;
    msg = type;
    _$jscoverage['interface/assert.js'][542]++;
    type = null;
  }
  _$jscoverage['interface/assert.js'][545]++;
  new Assertion(fn, msg).to["throw"](type);
});
  _$jscoverage['interface/assert.js'][565]++;
  assert.doesNotThrow = (function (fn, type, msg) {
  _$jscoverage['interface/assert.js'][566]++;
  if ("string" === typeof type) {
    _$jscoverage['interface/assert.js'][567]++;
    msg = type;
    _$jscoverage['interface/assert.js'][568]++;
    type = null;
  }
  _$jscoverage['interface/assert.js'][571]++;
  new Assertion(fn, msg).to.not["throw"](type);
});
  _$jscoverage['interface/assert.js'][590]++;
  assert.operator = (function (val, operator, val2, msg) {
  _$jscoverage['interface/assert.js'][591]++;
  if (! ~ ["==", "===", ">", ">=", "<", "<=", "!=", "!=="].indexOf(operator)) {
    _$jscoverage['interface/assert.js'][592]++;
    throw new Error("Invalid operator \"" + operator + "\"");
  }
  _$jscoverage['interface/assert.js'][594]++;
  var test = new Assertion(eval(val + operator + val2), msg);
  _$jscoverage['interface/assert.js'][595]++;
  test.assert(true === test.obj, "expected " + inspect(val) + " to be " + operator + " " + inspect(val2), "expected " + inspect(val) + " to not be " + operator + " " + inspect(val2));
});
  _$jscoverage['interface/assert.js'][605]++;
  assert.ifError = (function (val, msg) {
  _$jscoverage['interface/assert.js'][606]++;
  new Assertion(val, msg).to.not.be.ok;
});
  _$jscoverage['interface/assert.js'][613]++;
  (function alias(name, as) {
  _$jscoverage['interface/assert.js'][614]++;
  assert[as] = assert[name];
  _$jscoverage['interface/assert.js'][615]++;
  return alias;
})("length", "lengthOf")("throws", "throw");
});
_$jscoverage['interface/assert.js'].source = ["/*!"," * chai"," * Copyright(c) 2011 Jake Luer &lt;jake@alogicalparadox.com&gt;"," * MIT Licensed"," */","","/**"," * ### TDD Style Introduction"," *"," * The TDD style is exposed through `assert` interfaces. This provides"," * the classic assert.`test` notation, similiar to that packaged with"," * node.js. This assert module, however, provides several additional"," * tests and is browser compatible."," *"," *      // assert"," *      var assert = require('chai').assert;"," *        , foo = 'bar';"," *"," *      assert.typeOf(foo, 'string');"," *      assert.equal(foo, 'bar');"," *"," * #### Configuration"," *"," * By default, Chai does not show stack traces upon an AssertionError. This can"," * be changed by modifying the `includeStack` parameter for chai.Assertion. For example:"," *"," *      var chai = require('chai');"," *      chai.Assertion.includeStack = true; // defaults to false"," */","","module.exports = function (chai) {","  /*!","   * Chai dependencies.","   */","  var Assertion = chai.Assertion","    , inspect = chai.inspect;","","  /*!","   * Module export.","   */","","  var assert = chai.assert = {};","","  /**","   * # .fail(actual, expect, msg, operator)","   *","   * Throw a failure. Node.js compatible.","   *","   * @name fail","   * @param {*} actual value","   * @param {*} expected value","   * @param {String} message","   * @param {String} operator","   * @api public","   */","","  assert.fail = function (actual, expected, message, operator) {","    throw new chai.AssertionError({","        actual: actual","      , expected: expected","      , message: message","      , operator: operator","      , stackStartFunction: assert.fail","    });","  }","","  /**","   * # .ok(object, [message])","   *","   * Assert object is truthy.","   *","   *      assert.ok('everthing', 'everything is ok');","   *      assert.ok(false, 'this will fail');","   *","   * @name ok","   * @param {*} object to test","   * @param {String} message","   * @api public","   */","","  assert.ok = function (val, msg) {","    new Assertion(val, msg).is.ok;","  };","","  /**","   * # .equal(actual, expected, [message])","   *","   * Assert strict equality.","   *","   *      assert.equal(3, 3, 'these numbers are equal');","   *","   * @name equal","   * @param {*} actual","   * @param {*} expected","   * @param {String} message","   * @api public","   */","","  assert.equal = function (act, exp, msg) {","    var test = new Assertion(act, msg);","","    test.assert(","        exp == test.obj","      , 'expected ' + test.inspect + ' to equal ' + inspect(exp)","      , 'expected ' + test.inspect + ' to not equal ' + inspect(exp));","  };","","  /**","   * # .notEqual(actual, expected, [message])","   *","   * Assert not equal.","   *","   *      assert.notEqual(3, 4, 'these numbers are not equal');","   *","   * @name notEqual","   * @param {*} actual","   * @param {*} expected","   * @param {String} message","   * @api public","   */","","  assert.notEqual = function (act, exp, msg) {","    var test = new Assertion(act, msg);","","    test.assert(","        exp != test.obj","      , 'expected ' + test.inspect + ' to equal ' + inspect(exp)","      , 'expected ' + test.inspect + ' to not equal ' + inspect(exp));","  };","","  /**","   * # .strictEqual(actual, expected, [message])","   *","   * Assert strict equality.","   *","   *      assert.strictEqual(true, true, 'these booleans are strictly equal');","   *","   * @name strictEqual","   * @param {*} actual","   * @param {*} expected","   * @param {String} message","   * @api public","   */","","  assert.strictEqual = function (act, exp, msg) {","    new Assertion(act, msg).to.equal(exp);","  };","","  /**","   * # .notStrictEqual(actual, expected, [message])","   *","   * Assert strict equality.","   *","   *      assert.notStrictEqual(1, true, 'these booleans are not strictly equal');","   *","   * @name notStrictEqual","   * @param {*} actual","   * @param {*} expected","   * @param {String} message","   * @api public","   */","","  assert.notStrictEqual = function (act, exp, msg) {","    new Assertion(act, msg).to.not.equal(exp);","  };","","  /**","   * # .deepEqual(actual, expected, [message])","   *","   * Assert not deep equality.","   *","   *      assert.deepEqual({ tea: 'green' }, { tea: 'green' });","   *","   * @name deepEqual","   * @param {*} actual","   * @param {*} expected","   * @param {String} message","   * @api public","   */","","  assert.deepEqual = function (act, exp, msg) {","    new Assertion(act, msg).to.eql(exp);","  };","","  /**","   * # .notDeepEqual(actual, expected, [message])","   *","   * Assert not deep equality.","   *","   *      assert.notDeepEqual({ tea: 'green' }, { tea: 'jasmine' });","   *","   * @name notDeepEqual","   * @param {*} actual","   * @param {*} expected","   * @param {String} message","   * @api public","   */","","  assert.notDeepEqual = function (act, exp, msg) {","    new Assertion(act, msg).to.not.eql(exp);","  };","","  /**","   * # .isTrue(value, [message])","   *","   * Assert `value` is true.","   *","   *      var tea_served = true;","   *      assert.isTrue(tea_served, 'the tea has been served');","   *","   * @name isTrue","   * @param {Boolean} value","   * @param {String} message","   * @api public","   */","","  assert.isTrue = function (val, msg) {","    new Assertion(val, msg).is.true;","  };","","  /**","   * # .isFalse(value, [message])","   *","   * Assert `value` is false.","   *","   *      var tea_served = false;","   *      assert.isFalse(tea_served, 'no tea yet? hmm...');","   *","   * @name isFalse","   * @param {Boolean} value","   * @param {String} message","   * @api public","   */","","  assert.isFalse = function (val, msg) {","    new Assertion(val, msg).is.false;","  };","","  /**","   * # .isNull(value, [message])","   *","   * Assert `value` is null.","   *","   *      assert.isNull(err, 'no errors');","   *","   * @name isNull","   * @param {*} value","   * @param {String} message","   * @api public","   */","","  assert.isNull = function (val, msg) {","    new Assertion(val, msg).to.equal(null);","  };","","  /**","   * # .isNotNull(value, [message])","   *","   * Assert `value` is not null.","   *","   *      var tea = 'tasty chai';","   *      assert.isNotNull(tea, 'great, time for tea!');","   *","   * @name isNotNull","   * @param {*} value","   * @param {String} message","   * @api public","   */","","  assert.isNotNull = function (val, msg) {","    new Assertion(val, msg).to.not.equal(null);","  };","","  /**","   * # .isUndefined(value, [message])","   *","   * Assert `value` is undefined.","   *","   *      assert.isUndefined(tea, 'no tea defined');","   *","   * @name isUndefined","   * @param {*} value","   * @param {String} message","   * @api public","   */","","  assert.isUndefined = function (val, msg) {","    new Assertion(val, msg).to.equal(undefined);","  };","","  /**","   * # .isDefined(value, [message])","   *","   * Assert `value` is not undefined.","   *","   *      var tea = 'cup of chai';","   *      assert.isDefined(tea, 'no tea defined');","   *","   * @name isUndefined","   * @param {*} value","   * @param {String} message","   * @api public","   */","","  assert.isDefined = function (val, msg) {","    new Assertion(val, msg).to.not.equal(undefined);","  };","","  /**","   * # .isFunction(value, [message])","   *","   * Assert `value` is a function.","   *","   *      var serve_tea = function () { return 'cup of tea'; };","   *      assert.isFunction(serve_tea, 'great, we can have tea now');","   *","   * @name isFunction","   * @param {Function} value","   * @param {String} message","   * @api public","   */","","  assert.isFunction = function (val, msg) {","    new Assertion(val, msg).to.be.a('function');","  };","","  /**","   * # .isObject(value, [message])","   *","   * Assert `value` is an object.","   *","   *      var selection = { name: 'Chai', serve: 'with spices' };","   *      assert.isObject(selection, 'tea selection is an object');","   *","   * @name isObject","   * @param {Object} value","   * @param {String} message","   * @api public","   */","","  assert.isObject = function (val, msg) {","    new Assertion(val, msg).to.be.a('object');","  };","","  /**","   * # .isArray(value, [message])","   *","   * Assert `value` is an instance of Array.","   *","   *      var menu = [ 'green', 'chai', 'oolong' ];","   *      assert.isArray(menu, 'what kind of tea do we want?');","   *","   * @name isArray","   * @param {*} value","   * @param {String} message","   * @api public","   */","","  assert.isArray = function (val, msg) {","    new Assertion(val, msg).to.be.instanceof(Array);","  };","","  /**","   * # .isString(value, [message])","   *","   * Assert `value` is a string.","   *","   *      var teaorder = 'chai';","   *      assert.isString(tea_order, 'order placed');","   *","   * @name isString","   * @param {String} value","   * @param {String} message","   * @api public","   */","","  assert.isString = function (val, msg) {","    new Assertion(val, msg).to.be.a('string');","  };","","  /**","   * # .isNumber(value, [message])","   *","   * Assert `value` is a number","   *","   *      var cups = 2;","   *      assert.isNumber(cups, 'how many cups');","   *","   * @name isNumber","   * @param {Number} value","   * @param {String} message","   * @api public","   */","","  assert.isNumber = function (val, msg) {","    new Assertion(val, msg).to.be.a('number');","  };","","  /**","   * # .isBoolean(value, [message])","   *","   * Assert `value` is a boolean","   *","   *      var teaready = true","   *        , teaserved = false;","   *","   *      assert.isBoolean(tea_ready, 'is the tea ready');","   *      assert.isBoolean(tea_served, 'has tea been served');","   *","   * @name isBoolean","   * @param {*} value","   * @param {String} message","   * @api public","   */","","  assert.isBoolean = function (val, msg) {","    new Assertion(val, msg).to.be.a('boolean');","  };","","  /**","   * # .typeOf(value, name, [message])","   *","   * Assert typeof `value` is `name`.","   *","   *      assert.typeOf('tea', 'string', 'we have a string');","   *","   * @name typeOf","   * @param {*} value","   * @param {String} typeof name","   * @param {String} message","   * @api public","   */","","  assert.typeOf = function (val, type, msg) {","    new Assertion(val, msg).to.be.a(type);","  };","","  /**","   * # .instanceOf(object, constructor, [message])","   *","   * Assert `value` is instanceof `constructor`.","   *","   *      var Tea = function (name) { this.name = name; }","   *        , Chai = new Tea('chai');","   *","   *      assert.instanceOf(Chai, Tea, 'chai is an instance of tea');","   *","   * @name instanceOf","   * @param {Object} object","   * @param {Constructor} constructor","   * @param {String} message","   * @api public","   */","","  assert.instanceOf = function (val, type, msg) {","    new Assertion(val, msg).to.be.instanceof(type);","  };","","  /**","   * # .include(value, includes, [message])","   *","   * Assert the inclusion of an object in another. Works","   * for strings and arrays.","   *","   *      assert.include('foobar', 'bar', 'foobar contains string `var`);","   *      assert.include([ 1, 2, 3], 3, 'array contains value);","   *","   * @name include","   * @param {Array|String} value","   * @param {*} includes","   * @param {String} message","   * @api public","   */","","  assert.include = function (exp, inc, msg) {","    var obj = new Assertion(exp, msg);","","    if (Array.isArray(exp)) {","      obj.to.include(inc);","    } else if ('string' === typeof exp) {","      obj.to.contain.string(inc);","    }","  };","","  /**","   * # .match(value, regex, [message])","   *","   * Assert that `value` matches regular expression.","   *","   *      assert.match('foobar', /^foo/, 'Regexp matches');","   *","   * @name match","   * @param {*} value","   * @param {RegExp} RegularExpression","   * @param {String} message","   * @api public","   */","","  assert.match = function (exp, re, msg) {","    new Assertion(exp, msg).to.match(re);","  };","","  /**","   * # .length(value, constructor, [message])","   *","   * Assert that object has expected length.","   *","   *      assert.length([1,2,3], 3, 'Array has length of 3');","   *      assert.length('foobar', 5, 'String has length of 6');","   *","   * @name length","   * @param {*} value","   * @param {Number} length","   * @param {String} message","   * @api public","   */","","  assert.length = function (exp, len, msg) {","    new Assertion(exp, msg).to.have.length(len);","  };","","  /**","   * # .throws(function, [constructor/regexp], [message])","   *","   * Assert that a function will throw a specific","   * type of error.","   *","   *      assert.throw(fn, ReferenceError, 'function throw reference error');","   *","   * @name throws","   * @alias throw","   * @param {Function} function to test","   * @param {ErrorConstructor} constructor","   * @param {String} message","   * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types","   * @api public","   */","","  assert.throws = function (fn, type, msg) {","    if ('string' === typeof type) {","      msg = type;","      type = null;","    }","","    new Assertion(fn, msg).to.throw(type);","  };","","  /**","   * # .doesNotThrow(function, [constructor/regexp], [message])","   *","   * Assert that a function will throw a specific","   * type of error.","   *","   *      var fn = function (err) { if (err) throw Error(err) };","   *      assert.doesNotThrow(fn, Error, 'function throw reference error');","   *","   * @name doesNotThrow","   * @param {Function} function to test","   * @param {ErrorConstructor} constructor","   * @param {String} message","   * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types","   * @api public","   */","","  assert.doesNotThrow = function (fn, type, msg) {","    if ('string' === typeof type) {","      msg = type;","      type = null;","    }","","    new Assertion(fn, msg).to.not.throw(type);","  };","","  /**","   * # .operator(val, operator, val2, [message])","   *","   * Compare two values using operator.","   *","   *      assert.operator(1, '&lt;', 2, 'everything is ok');","   *      assert.operator(1, '&gt;', 2, 'this will fail');","   *","   * @name operator","   * @param {*} object to test","   * @param {String} operator","   * @param {*} second object","   * @param {String} message","   * @api public","   */","","  assert.operator = function (val, operator, val2, msg) {","    if (!~['==', '===', '&gt;', '&gt;=', '&lt;', '&lt;=', '!=', '!=='].indexOf(operator)) {","      throw new Error('Invalid operator \"' + operator + '\"');","    }","    var test = new Assertion(eval(val + operator + val2), msg);","    test.assert(","        true === test.obj","      , 'expected ' + inspect(val) + ' to be ' + operator + ' ' + inspect(val2)","      , 'expected ' + inspect(val) + ' to not be ' + operator + ' ' + inspect(val2) );","  };","","  /*!","   * Undocumented / untested","   */","","  assert.ifError = function (val, msg) {","    new Assertion(val, msg).to.not.be.ok;","  };","","  /*!","   * Aliases.","   */","","  (function alias(name, as){","    assert[as] = assert[name];","    return alias;","  })","  ('length', 'lengthOf')","  ('throws', 'throw');","};"];

});

require.define("/node_modules/chai/lib/chai.js", function (require, module, exports, __dirname, __filename) {
/*!
 * chai
 * Copyright(c) 2011-2012 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var used = [];
var exports = module.exports = {};

exports.version = '0.5.2';

exports.Assertion = require('./assertion');
exports.AssertionError = require('./error');

exports.inspect = require('./utils/inspect');

exports.use = function (fn) {
  if (!~used.indexOf(fn)) {
    fn(this);
    used.push(fn);
  }

  return this;
};

var expect = require('./interface/expect');
exports.use(expect);

var should = require('./interface/should');
exports.use(should);

var assert = require('./interface/assert');
exports.use(assert);

});

require.define("/node_modules/chai/lib/assertion.js", function (require, module, exports, __dirname, __filename) {
/*!
 * chai
 * Copyright(c) 2011 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 *
 * Primarily a refactor of: should.js
 * https://github.com/visionmedia/should.js
 * Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * ### BDD Style Introduction
 *
 * The BDD style is exposed through `expect` or `should` interfaces. In both
 * scenarios, you chain together natural language assertions.
 *
 *      // expect
 *      var expect = require('chai').expect;
 *      expect(foo).to.equal('bar');
 *
 *      // should
 *      var should = require('chai').should();
 *      foo.should.equal('bar');
 *
 * #### Differences
 *
 * The `expect` interface provides a function as a starting point for chaining
 * your language assertions. It works on node.js and in all browsers.
 *
 * The `should` interface extends `Object.prototype` to provide a single getter as
 * the starting point for your language assertions. It works on node.js and in
 * all browsers except Internet Explorer.
 *
 * #### Configuration
 *
 * By default, Chai does not show stack traces upon an AssertionError. This can
 * be changed by modifying the `includeStack` parameter for chai.Assertion. For example:
 *
 *      var chai = require('chai');
 *      chai.Assertion.includeStack = true; // defaults to false
 */

/*!
 * Module dependencies.
 */

var AssertionError = require('./error')
  , eql = require('./utils/eql')
  , toString = Object.prototype.toString
  , inspect = require('./utils/inspect');

/*!
 * Module export.
 */

module.exports = Assertion;


/*!
 * # Assertion Constructor
 *
 * Creates object for chaining.
 *
 * @api private
 */

function Assertion (obj, msg, stack) {
  this.ssfi = stack || arguments.callee;
  this.obj = obj;
  this.msg = msg;
}

/*!
  * ## Assertion.includeStack
  * , toString = Object.prototype.toString
  *
  * User configurable property, influences whether stack trace
  * is included in Assertion error message. Default of false
  * suppresses stack trace in the error message
  *
  *     Assertion.includeStack = true;  // enable stack on error
  *
  * @api public
  */

Assertion.includeStack = false;

/*!
 * # .assert(expression, message, negateMessage, expected, actual)
 *
 * Executes an expression and check expectations. Throws AssertionError for reporting if test doesn't pass.
 *
 * @name assert
 * @param {Philosophical} expression to be tested
 * @param {String} message to display if fails
 * @param {String} negatedMessage to display if negated expression fails
 * @param {*} expected value (remember to check for negation)
 * @param {*} actual (optional) will default to `this.obj`
 * @api private
 */

Assertion.prototype.assert = function (expr, msg, negateMsg, expected, actual) {
  actual = actual || this.obj;
  var msg = (this.negate ? negateMsg : msg)
    , ok = this.negate ? !expr : expr;

  if (!ok) {
    throw new AssertionError({
        message: this.msg ? this.msg + ': ' + msg : msg // include custom message if available
      , actual: actual
      , expected: expected
      , stackStartFunction: (Assertion.includeStack) ? this.assert : this.ssfi
    });
  }
};

/*!
 * # inspect
 *
 * Returns the current object stringified.
 *
 * @name inspect
 * @api private
 */

Object.defineProperty(Assertion.prototype, 'inspect',
  { get: function () {
      return inspect(this.obj);
    }
  , configurable: true
});

/**
 * # to
 *
 * Language chain.
 *
 * @name to
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'to',
  { get: function () {
      return this;
    }
  , configurable: true
});

/**
 * # be
 *
 * Language chain.
 *
 * @name be
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'be',
  { get: function () {
      return this;
    }
  , configurable: true
});

/**
 * # been
 *
 * Language chain. Also tests `tense` to past for addon
 * modules that use the tense feature.
 *
 * @name been
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'been',
  { get: function () {
      this.tense = 'past';
      return this;
    }
  , configurable: true
});

/**
 * # an
 *
 * Language chain.
 *
 * @name an
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'an',
  { get: function () {
      return this;
    }
  , configurable: true
});
/**
 * # is
 *
 * Language chain.
 *
 * @name is
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'is',
  { get: function () {
      return this;
    }
  , configurable: true
});

/**
 * # and
 *
 * Language chain.
 *
 * @name and
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'and',
  { get: function () {
      return this;
    }
  , configurable: true
});

/**
 * # have
 *
 * Language chain.
 *
 * @name have
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'have',
  { get: function () {
      return this;
    }
  , configurable: true
});

/**
 * # with
 *
 * Language chain.
 *
 * @name with
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'with',
  { get: function () {
      return this;
    }
  , configurable: true
});

/**
 * # .not
 *
 * Negates any of assertions following in the chain.
 *
 * @name not
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'not',
  { get: function () {
      this.negate = true;
      return this;
    }
  , configurable: true
});

/**
 * # .ok
 *
 * Assert object truthiness.
 *
 *      expect('everthing').to.be.ok;
 *      expect(false).to.not.be.ok;
 *      expect(undefined).to.not.be.ok;
 *      expect(null).to.not.be.ok;
 *
 * @name ok
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'ok',
  { get: function () {
      this.assert(
          this.obj
        , 'expected ' + this.inspect + ' to be truthy'
        , 'expected ' + this.inspect + ' to be falsy');

      return this;
    }
  , configurable: true
});

/**
 * # .true
 *
 * Assert object is true
 *
 * @name true
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'true',
  { get: function () {
      this.assert(
          true === this.obj
        , 'expected ' + this.inspect + ' to be true'
        , 'expected ' + this.inspect + ' to be false'
        , this.negate ? false : true
      );

      return this;
    }
  , configurable: true
});

/**
 * # .false
 *
 * Assert object is false
 *
 * @name false
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'false',
  { get: function () {
      this.assert(
          false === this.obj
        , 'expected ' + this.inspect + ' to be false'
        , 'expected ' + this.inspect + ' to be true'
        , this.negate ? true : false
      );

      return this;
    }
  , configurable: true
});

/**
 * # .exist
 *
 * Assert object exists (null).
 *
 *      var foo = 'hi'
 *        , bar;
 *      expect(foo).to.exist;
 *      expect(bar).to.not.exist;
 *
 * @name exist
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'exist',
  { get: function () {
      this.assert(
          null != this.obj
        , 'expected ' + this.inspect + ' to exist'
        , 'expected ' + this.inspect + ' to not exist'
      );

      return this;
    }
  , configurable: true
});

/**
 * # .empty
 *
 * Assert object's length to be 0.
 *
 *      expect([]).to.be.empty;
 *
 * @name empty
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'empty',
  { get: function () {
      var expected = this.obj;

      if (Array.isArray(this.obj)) {
        expected = this.obj.length;
      } else if (typeof this.obj === 'object') {
        expected = Object.keys(this.obj).length;
      }

      this.assert(
          !expected
        , 'expected ' + this.inspect + ' to be empty'
        , 'expected ' + this.inspect + ' not to be empty');

      return this;
    }
  , configurable: true
});

/**
 * # .arguments
 *
 * Assert object is an instanceof arguments.
 *
 *      function test () {
 *        expect(arguments).to.be.arguments;
 *      }
 *
 * @name arguments
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'arguments',
  { get: function () {
      this.assert(
          '[object Arguments]' == Object.prototype.toString.call(this.obj)
        , 'expected ' + this.inspect + ' to be arguments'
        , 'expected ' + this.inspect + ' to not be arguments'
        , '[object Arguments]'
        , Object.prototype.toString.call(this.obj)
      );

      return this;
    }
  , configurable: true
});

/**
 * # .equal(value)
 *
 * Assert strict equality.
 *
 *      expect('hello').to.equal('hello');
 *
 * @name equal
 * @param {*} value
 * @api public
 */

Assertion.prototype.equal = function (val) {
  this.assert(
      val === this.obj
    , 'expected ' + this.inspect + ' to equal ' + inspect(val)
    , 'expected ' + this.inspect + ' to not equal ' + inspect(val)
    , val );

  return this;
};

/**
 * # .eql(value)
 *
 * Assert deep equality.
 *
 *      expect({ foo: 'bar' }).to.eql({ foo: 'bar' });
 *
 * @name eql
 * @param {*} value
 * @api public
 */

Assertion.prototype.eql = function (obj) {
  this.assert(
      eql(obj, this.obj)
    , 'expected ' + this.inspect + ' to equal ' + inspect(obj)
    , 'expected ' + this.inspect + ' to not equal ' + inspect(obj)
    , obj );

  return this;
};

/**
 * # .above(value)
 *
 * Assert greater than `value`.
 *
 *      expect(10).to.be.above(5);
 *
 * @name above
 * @param {Number} value
 * @api public
 */

Assertion.prototype.above = function (val) {
  this.assert(
      this.obj > val
    , 'expected ' + this.inspect + ' to be above ' + val
    , 'expected ' + this.inspect + ' to be below ' + val);

  return this;
};

/**
 * # .below(value)
 *
 * Assert less than `value`.
 *
 *      expect(5).to.be.below(10);
 *
 * @name below
 * @param {Number} value
 * @api public
 */

Assertion.prototype.below = function (val) {
  this.assert(
      this.obj < val
    , 'expected ' + this.inspect + ' to be below ' + val
    , 'expected ' + this.inspect + ' to be above ' + val);

  return this;
};

/**
 * # .within(start, finish)
 *
 * Assert that a number is within a range.
 *
 *      expect(7).to.be.within(5,10);
 *
 * @name within
 * @param {Number} start lowerbound inclusive
 * @param {Number} finish upperbound inclusive
 * @api public
 */

Assertion.prototype.within = function (start, finish) {
  var range = start + '..' + finish;

  this.assert(
      this.obj >= start && this.obj <= finish
    , 'expected ' + this.inspect + ' to be within ' + range
    , 'expected ' + this.inspect + ' to not be within ' + range);

  return this;
};

/**
 * # .a(type)
 *
 * Assert typeof.
 *
 *      expect('test').to.be.a('string');
 *
 * @name a
 * @param {String} type
 * @api public
 */

Assertion.prototype.a = function (type) {
  var klass = type.charAt(0).toUpperCase() + type.slice(1);

  this.assert(
      '[object ' + klass + ']' === toString.call(this.obj)
    , 'expected ' + this.inspect + ' to be a ' + type
    , 'expected ' + this.inspect + ' not to be a ' + type
    , '[object ' + klass + ']'
    , toString.call(this.obj)
  );

  return this;
};

/**
 * # .instanceof(constructor)
 *
 * Assert instanceof.
 *
 *      var Tea = function (name) { this.name = name; }
 *        , Chai = new Tea('chai');
 *
 *      expect(Chai).to.be.an.instanceOf(Tea);
 *
 * @name instanceof
 * @param {Constructor}
 * @alias instanceOf
 * @api public
 */

Assertion.prototype.instanceof = function (constructor) {
  var name = constructor.name;
  this.assert(
      this.obj instanceof constructor
    , 'expected ' + this.inspect + ' to be an instance of ' + name
    , 'expected ' + this.inspect + ' to not be an instance of ' + name);

  return this;
};

/**
 * # .property(name, [value])
 *
 * Assert that property of `name` exists, optionally with `value`.
 *
 *      var obj = { foo: 'bar' }
 *      expect(obj).to.have.property('foo');
 *      expect(obj).to.have.property('foo', 'bar');
 *      expect(obj).to.have.property('foo').to.be.a('string');
 *
 * @name property
 * @param {String} name
 * @param {*} value (optional)
 * @returns value of property for chaining
 * @api public
 */

Assertion.prototype.property = function (name, val) {
  if (this.negate && undefined !== val) {
    if (undefined === this.obj[name]) {
      throw new Error(this.inspect + ' has no property ' + inspect(name));
    }
  } else {
    this.assert(
        undefined !== this.obj[name]
      , 'expected ' + this.inspect + ' to have a property ' + inspect(name)
      , 'expected ' + this.inspect + ' to not have property ' + inspect(name));
  }

  if (undefined !== val) {
    this.assert(
        val === this.obj[name]
      , 'expected ' + this.inspect + ' to have a property ' + inspect(name) + ' of ' +
          inspect(val) + ', but got ' + inspect(this.obj[name])
      , 'expected ' + this.inspect + ' to not have a property ' + inspect(name) + ' of ' +  inspect(val)
      , val
      , this.obj[val]
    );
  }

  this.obj = this.obj[name];
  return this;
};

/**
 * # .ownProperty(name)
 *
 * Assert that has own property by `name`.
 *
 *      expect('test').to.have.ownProperty('length');
 *
 * @name ownProperty
 * @alias haveOwnProperty
 * @param {String} name
 * @api public
 */

Assertion.prototype.ownProperty = function (name) {
  this.assert(
      this.obj.hasOwnProperty(name)
    , 'expected ' + this.inspect + ' to have own property ' + inspect(name)
    , 'expected ' + this.inspect + ' to not have own property ' + inspect(name));
  return this;
};

/**
 * # .length(val)
 *
 * Assert that object has expected length.
 *
 *      expect([1,2,3]).to.have.length(3);
 *      expect('foobar').to.have.length(6);
 *
 * @name length
 * @alias lengthOf
 * @param {Number} length
 * @api public
 */

Assertion.prototype.length = function (n) {
  new Assertion(this.obj).to.have.property('length');
  var len = this.obj.length;

  this.assert(
      len == n
    , 'expected ' + this.inspect + ' to have a length of ' + n + ' but got ' + len
    , 'expected ' + this.inspect + ' to not have a length of ' + len
    , n
    , len
  );

  return this;
};

/**
 * # .match(regexp)
 *
 * Assert that matches regular expression.
 *
 *      expect('foobar').to.match(/^foo/);
 *
 * @name match
 * @param {RegExp} RegularExpression
 * @api public
 */

Assertion.prototype.match = function (re) {
  this.assert(
      re.exec(this.obj)
    , 'expected ' + this.inspect + ' to match ' + re
    , 'expected ' + this.inspect + ' not to match ' + re);

  return this;
};

/**
 * # .include(obj)
 *
 * Assert the inclusion of an object in an Array or substring in string.
 *
 *      expect([1,2,3]).to.include(2);
 *
 * @name include
 * @param {Object|String|Number} obj
 * @api public
 */

Assertion.prototype.include = function (obj) {
  this.assert(
      ~this.obj.indexOf(obj)
    , 'expected ' + this.inspect + ' to include ' + inspect(obj)
    , 'expected ' + this.inspect + ' to not include ' + inspect(obj));

  return this;
};

/**
 * # .string(string)
 *
 * Assert inclusion of string in string.
 *
 *      expect('foobar').to.have.string('bar');
 *
 * @name string
 * @param {String} string
 * @api public
 */

Assertion.prototype.string = function (str) {
  new Assertion(this.obj).is.a('string');

  this.assert(
      ~this.obj.indexOf(str)
    , 'expected ' + this.inspect + ' to contain ' + inspect(str)
    , 'expected ' + this.inspect + ' to not contain ' + inspect(str));

  return this;
};



/**
 * # contain
 *
 * Toggles the `contain` flag for the `keys` assertion.
 *
 * @name contain
 * @api public
 */

Object.defineProperty(Assertion.prototype, 'contain',
  { get: function () {
      this.contains = true;
      return this;
    },
    configurable: true
});

/**
 * # .keys(key1, [key2], [...])
 *
 * Assert exact keys or the inclusing of keys using the `contain` modifier.
 *
 *      expect({ foo: 1, bar: 2 }).to.have.keys(['foo', 'bar']);
 *      expect({ foo: 1, bar: 2, baz: 3 }).to.contain.keys('foo', 'bar');
 *
 * @name keys
 * @alias key
 * @param {String|Array} Keys
 * @api public
 */

Assertion.prototype.keys = function(keys) {
  var str
    , ok = true;

  keys = keys instanceof Array
    ? keys
    : Array.prototype.slice.call(arguments);

  if (!keys.length) throw new Error('keys required');

  var actual = Object.keys(this.obj)
    , len = keys.length;

  // Inclusion
  ok = keys.every(function(key){
    return ~actual.indexOf(key);
  });

  // Strict
  if (!this.negate && !this.contains) {
    ok = ok && keys.length == actual.length;
  }

  // Key string
  if (len > 1) {
    keys = keys.map(function(key){
      return inspect(key);
    });
    var last = keys.pop();
    str = keys.join(', ') + ', and ' + last;
  } else {
    str = inspect(keys[0]);
  }

  // Form
  str = (len > 1 ? 'keys ' : 'key ') + str;

  // Have / include
  str = (this.contains ? 'contain ' : 'have ') + str;

  // Assertion
  this.assert(
      ok
    , 'expected ' + this.inspect + ' to ' + str
    , 'expected ' + this.inspect + ' to not ' + str
    , keys
    , Object.keys(this.obj)
  );

  return this;
}

/**
 * # .throw(constructor)
 *
 * Assert that a function will throw a specific type of error or that error
 * thrown will match a RegExp or include a string.
 *
 *      var fn = function () { throw new ReferenceError('This is a bad function.'); }
 *      expect(fn).to.throw(ReferenceError);
 *      expect(fn).to.throw(/bad function/);
 *      expect(fn).to.not.throw('good function');
 *      expect(fn).to.throw(ReferenceError, /bad function/);
 *
 * Please note that when a throw expectation is negated, it will check each
 * parameter independently, starting with Error constructor type. The appropriate way
 * to check for the existence of a type of error but for a message that does not match
 * is to use `and`.
 *
 *      expect(fn).to.throw(ReferenceError).and.not.throw(/good function/);
 *
 * @name throw
 * @alias throws
 * @alias Throw
 * @param {ErrorConstructor} constructor
 * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
 * @api public
 */

Assertion.prototype.throw = function (constructor, msg) {
  new Assertion(this.obj).is.a('function');

  var thrown = false;

  if (arguments.length === 0) {
    msg = null;
    constructor = null;
  } else if (constructor && (constructor instanceof RegExp || 'string' === typeof constructor)) {
    msg = constructor;
    constructor = null;
  }

  try {
    this.obj();
  } catch (err) {
    // first, check constructor
    if (constructor && 'function' === typeof constructor) {
      this.assert(
          err instanceof constructor && err.name == constructor.name
        , 'expected ' + this.inspect + ' to throw ' + constructor.name + ' but a ' + err.name + ' was thrown'
        , 'expected ' + this.inspect + ' to not throw ' + constructor.name );
      if (!msg) return this;
    }
    // next, check message
    if (err.message && msg && msg instanceof RegExp) {
      this.assert(
          msg.exec(err.message)
        , 'expected ' + this.inspect + ' to throw error matching ' + msg + ' but got ' + inspect(err.message)
        , 'expected ' + this.inspect + ' to throw error not matching ' + msg
      );
      return this;
    } else if (err.message && msg && 'string' === typeof msg) {
      this.assert(
          ~err.message.indexOf(msg)
        , 'expected ' + this.inspect + ' to throw error including ' + inspect(msg) + ' but got ' + inspect(err.message)
        , 'expected ' + this.inspect + ' to throw error not including ' + inspect(msg)
      );
      return this;
    } else {
      thrown = true;
    }
  }

  var name = (constructor ? constructor.name : 'an error');

  this.assert(
      thrown === true
    , 'expected ' + this.inspect + ' to throw ' + name
    , 'expected ' + this.inspect + ' to not throw ' + name);

  return this;
};

/**
 * # .respondTo(method)
 *
 * Assert that object/class will respond to a method.
 *
 *      expect(Klass).to.respondTo('bar');
 *      expect(obj).to.respondTo('bar');
 *
 * @name respondTo
 * @param {String} method
 * @api public
 */

Assertion.prototype.respondTo = function (method) {
  var context = ('function' === typeof this.obj)
    ? this.obj.prototype[method]
    : this.obj[method];

  this.assert(
      'function' === typeof context
    , 'expected ' + this.inspect + ' to respond to ' + inspect(method)
    , 'expected ' + this.inspect + ' to not respond to ' + inspect(method)
    , 'function'
    , typeof context
  );

  return this;
};

/**
 * # .satisfy(method)
 *
 * Assert that passes a truth test.
 *
 *      expect(1).to.satisfy(function(num) { return num > 0; });
 *
 * @name satisfy
 * @param {Function} matcher
 * @api public
 */

Assertion.prototype.satisfy = function (matcher) {
  this.assert(
      matcher(this.obj)
    , 'expected ' + this.inspect + ' to satisfy ' + inspect(matcher)
    , 'expected ' + this.inspect + ' to not satisfy' + inspect(matcher)
    , this.negate ? false : true
    , matcher(this.obj)
  );

  return this;
};

/**
 * # .closeTo(expected, delta)
 *
 * Assert that actual is equal to +/- delta.
 *
 *      expect(1.5).to.be.closeTo(1, 0.5);
 *
 * @name closeTo
 * @param {Number} expected
 * @param {Number} delta
 * @api public
 */

Assertion.prototype.closeTo = function (expected, delta) {
  this.assert(
      (this.obj - delta === expected) || (this.obj + delta === expected)
    , 'expected ' + this.inspect + ' to be close to ' + expected + ' +/- ' + delta
    , 'expected ' + this.inspect + ' not to be close to ' + expected + ' +/- ' + delta);

  return this;
};

/*!
 * Aliases.
 */

(function alias(name, as){
  Assertion.prototype[as] = Assertion.prototype[name];
  return alias;
})
('length', 'lengthOf')
('keys', 'key')
('ownProperty', 'haveOwnProperty')
('above', 'greaterThan')
('below', 'lessThan')
('throw', 'throws')
('throw', 'Throw') // for troublesome browsers
('instanceof', 'instanceOf');

});

require.define("/node_modules/chai/lib/error.js", function (require, module, exports, __dirname, __filename) {
/*!
 * chai
 * Copyright(c) 2011 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var fail = require('./chai').fail;

module.exports = AssertionError;

/*!
 * Inspired by node.js assert module
 * https://github.com/joyent/node/blob/f8c335d0caf47f16d31413f89aa28eda3878e3aa/lib/assert.js
 */
function AssertionError (options) {
  options = options || {};
  this.name = 'AssertionError';
  this.message = options.message;
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
}

AssertionError.prototype.__proto__ = Error.prototype;

AssertionError.prototype.toString = function() {
  return this.message;
};

});

require.define("/node_modules/chai/lib/utils/eql.js", function (require, module, exports, __dirname, __filename) {
// This is directly from Node.js assert
// https://github.com/joyent/node/blob/f8c335d0caf47f16d31413f89aa28eda3878e3aa/lib/assert.js


module.exports = _deepEqual;

// For browser implementation
if (!Buffer) {
  var Buffer = {
    isBuffer: function () {
      return false;
    }
  };
}

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (Buffer.isBuffer(actual) && Buffer.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof actual != 'object' && typeof expected != 'object') {
    return actual === expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  try {
    var ka = Object.keys(a),
        kb = Object.keys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}
});

require.define("/node_modules/chai/lib/utils/inspect.js", function (require, module, exports, __dirname, __filename) {
// This is (almost) directly from Node.js utils
// https://github.com/joyent/node/blob/f8c335d0caf47f16d31413f89aa28eda3878e3aa/lib/util.js

module.exports = inspect;

/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Boolean} showHidden Flag that shows hidden (not enumerable)
 *    properties of objects.
 * @param {Number} depth Depth in which to descend in object. Default is 2.
 * @param {Boolean} colors Flag to turn on ANSI escape codes to color the
 *    output. Default is false (no coloring).
 */
function inspect(obj, showHidden, depth, colors) {
  var ctx = {
    showHidden: showHidden,
    seen: [],
    stylize: function (str) { return str; }
  };
  return formatValue(ctx, obj, (typeof depth === 'undefined' ? 2 : depth));
}

function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (value && typeof value.inspect === 'function' &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    return value.inspect(recurseTimes);
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var visibleKeys = Object.keys(value);
  var keys = ctx.showHidden ? Object.getOwnPropertyNames(value) : visibleKeys;

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (typeof value === 'function') {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toUTCString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (typeof value === 'function') {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  switch (typeof value) {
    case 'undefined':
      return ctx.stylize('undefined', 'undefined');

    case 'string':
      var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                               .replace(/'/g, "\\'")
                                               .replace(/\\"/g, '"') + '\'';
      return ctx.stylize(simple, 'string');

    case 'number':
      return ctx.stylize('' + value, 'number');

    case 'boolean':
      return ctx.stylize('' + value, 'boolean');
  }
  // For some reason typeof null is "object", so special case here.
  if (value === null) {
    return ctx.stylize('null', 'null');
  }
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (Object.prototype.hasOwnProperty.call(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str;
  if (value.__lookupGetter__) {
    if (value.__lookupGetter__(key)) {
      if (value.__lookupSetter__(key)) {
        str = ctx.stylize('[Getter/Setter]', 'special');
      } else {
        str = ctx.stylize('[Getter]', 'special');
      }
    } else {
      if (value.__lookupSetter__(key)) {
        str = ctx.stylize('[Setter]', 'special');
      }
    }
  }
  if (visibleKeys.indexOf(key) < 0) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(value[key]) < 0) {
      if (recurseTimes === null) {
        str = formatValue(ctx, value[key], null);
      } else {
        str = formatValue(ctx, value[key], recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (typeof name === 'undefined') {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}

function isArray(ar) {
  return Array.isArray(ar) ||
         (typeof ar === 'object' && objectToString(ar) === '[object Array]');
}

function isRegExp(re) {
  return typeof re === 'object' && objectToString(re) === '[object RegExp]';
}

function isDate(d) {
  return typeof d === 'object' && objectToString(d) === '[object Date]';
}

function isError(e) {
  return typeof e === 'object' && objectToString(e) === '[object Error]';
}

function objectToString(o) {
  return Object.prototype.toString.call(o);
}
});

require.define("/node_modules/chai/lib/interface/expect.js", function (require, module, exports, __dirname, __filename) {
/*!
 * chai
 * Copyright(c) 2011 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

module.exports = function (chai) {
  chai.expect = function (val, message) {
    return new chai.Assertion(val, message);
  };
};


});

require.define("/node_modules/chai/lib/interface/should.js", function (require, module, exports, __dirname, __filename) {
/*!
 * chai
 * Copyright(c) 2011 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

module.exports = function (chai) {
  var Assertion = chai.Assertion;

  chai.should = function () {
    // modify Object.prototype to have `should`
    Object.defineProperty(Object.prototype, 'should', {
      set: function(){},
      get: function(){
        if (this instanceof String || this instanceof Number) {
          return new Assertion(this.constructor(this));
        } else if (this instanceof Boolean) {
          return new Assertion(this == true);
        }
        return new Assertion(this);
      },
      configurable: true
    });

    var should = {};

    should.equal = function (val1, val2) {
      new Assertion(val1).to.equal(val2);
    };

    should.throw = function (fn, errt, errs) {
      new Assertion(fn).to.throw(errt, errs);
    };

    should.exist = function (val) {
      new Assertion(val).to.exist;
    }

    // negation
    should.not = {}

    should.not.equal = function (val1, val2) {
      new Assertion(val1).to.not.equal(val2);
    };

    should.not.throw = function (fn, errt, errs) {
      new Assertion(fn).to.not.throw(errt, errs);
    };

    should.not.exist = function (val) {
      new Assertion(val).to.not.exist;
    }

    return should;
  };
};

});

require.define("/node_modules/chai/lib/interface/assert.js", function (require, module, exports, __dirname, __filename) {
/*!
 * chai
 * Copyright(c) 2011 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### TDD Style Introduction
 *
 * The TDD style is exposed through `assert` interfaces. This provides
 * the classic assert.`test` notation, similiar to that packaged with
 * node.js. This assert module, however, provides several additional
 * tests and is browser compatible.
 *
 *      // assert
 *      var assert = require('chai').assert;
 *        , foo = 'bar';
 *
 *      assert.typeOf(foo, 'string');
 *      assert.equal(foo, 'bar');
 *
 * #### Configuration
 *
 * By default, Chai does not show stack traces upon an AssertionError. This can
 * be changed by modifying the `includeStack` parameter for chai.Assertion. For example:
 *
 *      var chai = require('chai');
 *      chai.Assertion.includeStack = true; // defaults to false
 */

module.exports = function (chai) {
  /*!
   * Chai dependencies.
   */
  var Assertion = chai.Assertion
    , inspect = chai.inspect;

  /*!
   * Module export.
   */

  var assert = chai.assert = {};

  /**
   * # .fail(actual, expect, msg, operator)
   *
   * Throw a failure. Node.js compatible.
   *
   * @name fail
   * @param {*} actual value
   * @param {*} expected value
   * @param {String} message
   * @param {String} operator
   * @api public
   */

  assert.fail = function (actual, expected, message, operator) {
    throw new chai.AssertionError({
        actual: actual
      , expected: expected
      , message: message
      , operator: operator
      , stackStartFunction: assert.fail
    });
  }

  /**
   * # .ok(object, [message])
   *
   * Assert object is truthy.
   *
   *      assert.ok('everthing', 'everything is ok');
   *      assert.ok(false, 'this will fail');
   *
   * @name ok
   * @param {*} object to test
   * @param {String} message
   * @api public
   */

  assert.ok = function (val, msg) {
    new Assertion(val, msg).is.ok;
  };

  /**
   * # .equal(actual, expected, [message])
   *
   * Assert strict equality.
   *
   *      assert.equal(3, 3, 'these numbers are equal');
   *
   * @name equal
   * @param {*} actual
   * @param {*} expected
   * @param {String} message
   * @api public
   */

  assert.equal = function (act, exp, msg) {
    var test = new Assertion(act, msg);

    test.assert(
        exp == test.obj
      , 'expected ' + test.inspect + ' to equal ' + inspect(exp)
      , 'expected ' + test.inspect + ' to not equal ' + inspect(exp));
  };

  /**
   * # .notEqual(actual, expected, [message])
   *
   * Assert not equal.
   *
   *      assert.notEqual(3, 4, 'these numbers are not equal');
   *
   * @name notEqual
   * @param {*} actual
   * @param {*} expected
   * @param {String} message
   * @api public
   */

  assert.notEqual = function (act, exp, msg) {
    var test = new Assertion(act, msg);

    test.assert(
        exp != test.obj
      , 'expected ' + test.inspect + ' to equal ' + inspect(exp)
      , 'expected ' + test.inspect + ' to not equal ' + inspect(exp));
  };

  /**
   * # .strictEqual(actual, expected, [message])
   *
   * Assert strict equality.
   *
   *      assert.strictEqual(true, true, 'these booleans are strictly equal');
   *
   * @name strictEqual
   * @param {*} actual
   * @param {*} expected
   * @param {String} message
   * @api public
   */

  assert.strictEqual = function (act, exp, msg) {
    new Assertion(act, msg).to.equal(exp);
  };

  /**
   * # .notStrictEqual(actual, expected, [message])
   *
   * Assert strict equality.
   *
   *      assert.notStrictEqual(1, true, 'these booleans are not strictly equal');
   *
   * @name notStrictEqual
   * @param {*} actual
   * @param {*} expected
   * @param {String} message
   * @api public
   */

  assert.notStrictEqual = function (act, exp, msg) {
    new Assertion(act, msg).to.not.equal(exp);
  };

  /**
   * # .deepEqual(actual, expected, [message])
   *
   * Assert not deep equality.
   *
   *      assert.deepEqual({ tea: 'green' }, { tea: 'green' });
   *
   * @name deepEqual
   * @param {*} actual
   * @param {*} expected
   * @param {String} message
   * @api public
   */

  assert.deepEqual = function (act, exp, msg) {
    new Assertion(act, msg).to.eql(exp);
  };

  /**
   * # .notDeepEqual(actual, expected, [message])
   *
   * Assert not deep equality.
   *
   *      assert.notDeepEqual({ tea: 'green' }, { tea: 'jasmine' });
   *
   * @name notDeepEqual
   * @param {*} actual
   * @param {*} expected
   * @param {String} message
   * @api public
   */

  assert.notDeepEqual = function (act, exp, msg) {
    new Assertion(act, msg).to.not.eql(exp);
  };

  /**
   * # .isTrue(value, [message])
   *
   * Assert `value` is true.
   *
   *      var tea_served = true;
   *      assert.isTrue(tea_served, 'the tea has been served');
   *
   * @name isTrue
   * @param {Boolean} value
   * @param {String} message
   * @api public
   */

  assert.isTrue = function (val, msg) {
    new Assertion(val, msg).is.true;
  };

  /**
   * # .isFalse(value, [message])
   *
   * Assert `value` is false.
   *
   *      var tea_served = false;
   *      assert.isFalse(tea_served, 'no tea yet? hmm...');
   *
   * @name isFalse
   * @param {Boolean} value
   * @param {String} message
   * @api public
   */

  assert.isFalse = function (val, msg) {
    new Assertion(val, msg).is.false;
  };

  /**
   * # .isNull(value, [message])
   *
   * Assert `value` is null.
   *
   *      assert.isNull(err, 'no errors');
   *
   * @name isNull
   * @param {*} value
   * @param {String} message
   * @api public
   */

  assert.isNull = function (val, msg) {
    new Assertion(val, msg).to.equal(null);
  };

  /**
   * # .isNotNull(value, [message])
   *
   * Assert `value` is not null.
   *
   *      var tea = 'tasty chai';
   *      assert.isNotNull(tea, 'great, time for tea!');
   *
   * @name isNotNull
   * @param {*} value
   * @param {String} message
   * @api public
   */

  assert.isNotNull = function (val, msg) {
    new Assertion(val, msg).to.not.equal(null);
  };

  /**
   * # .isUndefined(value, [message])
   *
   * Assert `value` is undefined.
   *
   *      assert.isUndefined(tea, 'no tea defined');
   *
   * @name isUndefined
   * @param {*} value
   * @param {String} message
   * @api public
   */

  assert.isUndefined = function (val, msg) {
    new Assertion(val, msg).to.equal(undefined);
  };

  /**
   * # .isDefined(value, [message])
   *
   * Assert `value` is not undefined.
   *
   *      var tea = 'cup of chai';
   *      assert.isDefined(tea, 'no tea defined');
   *
   * @name isUndefined
   * @param {*} value
   * @param {String} message
   * @api public
   */

  assert.isDefined = function (val, msg) {
    new Assertion(val, msg).to.not.equal(undefined);
  };

  /**
   * # .isFunction(value, [message])
   *
   * Assert `value` is a function.
   *
   *      var serve_tea = function () { return 'cup of tea'; };
   *      assert.isFunction(serve_tea, 'great, we can have tea now');
   *
   * @name isFunction
   * @param {Function} value
   * @param {String} message
   * @api public
   */

  assert.isFunction = function (val, msg) {
    new Assertion(val, msg).to.be.a('function');
  };

  /**
   * # .isObject(value, [message])
   *
   * Assert `value` is an object.
   *
   *      var selection = { name: 'Chai', serve: 'with spices' };
   *      assert.isObject(selection, 'tea selection is an object');
   *
   * @name isObject
   * @param {Object} value
   * @param {String} message
   * @api public
   */

  assert.isObject = function (val, msg) {
    new Assertion(val, msg).to.be.a('object');
  };

  /**
   * # .isArray(value, [message])
   *
   * Assert `value` is an instance of Array.
   *
   *      var menu = [ 'green', 'chai', 'oolong' ];
   *      assert.isArray(menu, 'what kind of tea do we want?');
   *
   * @name isArray
   * @param {*} value
   * @param {String} message
   * @api public
   */

  assert.isArray = function (val, msg) {
    new Assertion(val, msg).to.be.instanceof(Array);
  };

  /**
   * # .isString(value, [message])
   *
   * Assert `value` is a string.
   *
   *      var teaorder = 'chai';
   *      assert.isString(tea_order, 'order placed');
   *
   * @name isString
   * @param {String} value
   * @param {String} message
   * @api public
   */

  assert.isString = function (val, msg) {
    new Assertion(val, msg).to.be.a('string');
  };

  /**
   * # .isNumber(value, [message])
   *
   * Assert `value` is a number
   *
   *      var cups = 2;
   *      assert.isNumber(cups, 'how many cups');
   *
   * @name isNumber
   * @param {Number} value
   * @param {String} message
   * @api public
   */

  assert.isNumber = function (val, msg) {
    new Assertion(val, msg).to.be.a('number');
  };

  /**
   * # .isBoolean(value, [message])
   *
   * Assert `value` is a boolean
   *
   *      var teaready = true
   *        , teaserved = false;
   *
   *      assert.isBoolean(tea_ready, 'is the tea ready');
   *      assert.isBoolean(tea_served, 'has tea been served');
   *
   * @name isBoolean
   * @param {*} value
   * @param {String} message
   * @api public
   */

  assert.isBoolean = function (val, msg) {
    new Assertion(val, msg).to.be.a('boolean');
  };

  /**
   * # .typeOf(value, name, [message])
   *
   * Assert typeof `value` is `name`.
   *
   *      assert.typeOf('tea', 'string', 'we have a string');
   *
   * @name typeOf
   * @param {*} value
   * @param {String} typeof name
   * @param {String} message
   * @api public
   */

  assert.typeOf = function (val, type, msg) {
    new Assertion(val, msg).to.be.a(type);
  };

  /**
   * # .instanceOf(object, constructor, [message])
   *
   * Assert `value` is instanceof `constructor`.
   *
   *      var Tea = function (name) { this.name = name; }
   *        , Chai = new Tea('chai');
   *
   *      assert.instanceOf(Chai, Tea, 'chai is an instance of tea');
   *
   * @name instanceOf
   * @param {Object} object
   * @param {Constructor} constructor
   * @param {String} message
   * @api public
   */

  assert.instanceOf = function (val, type, msg) {
    new Assertion(val, msg).to.be.instanceof(type);
  };

  /**
   * # .include(value, includes, [message])
   *
   * Assert the inclusion of an object in another. Works
   * for strings and arrays.
   *
   *      assert.include('foobar', 'bar', 'foobar contains string `var`);
   *      assert.include([ 1, 2, 3], 3, 'array contains value);
   *
   * @name include
   * @param {Array|String} value
   * @param {*} includes
   * @param {String} message
   * @api public
   */

  assert.include = function (exp, inc, msg) {
    var obj = new Assertion(exp, msg);

    if (Array.isArray(exp)) {
      obj.to.include(inc);
    } else if ('string' === typeof exp) {
      obj.to.contain.string(inc);
    }
  };

  /**
   * # .match(value, regex, [message])
   *
   * Assert that `value` matches regular expression.
   *
   *      assert.match('foobar', /^foo/, 'Regexp matches');
   *
   * @name match
   * @param {*} value
   * @param {RegExp} RegularExpression
   * @param {String} message
   * @api public
   */

  assert.match = function (exp, re, msg) {
    new Assertion(exp, msg).to.match(re);
  };

  /**
   * # .length(value, constructor, [message])
   *
   * Assert that object has expected length.
   *
   *      assert.length([1,2,3], 3, 'Array has length of 3');
   *      assert.length('foobar', 5, 'String has length of 6');
   *
   * @name length
   * @param {*} value
   * @param {Number} length
   * @param {String} message
   * @api public
   */

  assert.length = function (exp, len, msg) {
    new Assertion(exp, msg).to.have.length(len);
  };

  /**
   * # .throws(function, [constructor/regexp], [message])
   *
   * Assert that a function will throw a specific
   * type of error.
   *
   *      assert.throw(fn, ReferenceError, 'function throw reference error');
   *
   * @name throws
   * @alias throw
   * @param {Function} function to test
   * @param {ErrorConstructor} constructor
   * @param {String} message
   * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
   * @api public
   */

  assert.throws = function (fn, type, msg) {
    if ('string' === typeof type) {
      msg = type;
      type = null;
    }

    new Assertion(fn, msg).to.throw(type);
  };

  /**
   * # .doesNotThrow(function, [constructor/regexp], [message])
   *
   * Assert that a function will throw a specific
   * type of error.
   *
   *      var fn = function (err) { if (err) throw Error(err) };
   *      assert.doesNotThrow(fn, Error, 'function throw reference error');
   *
   * @name doesNotThrow
   * @param {Function} function to test
   * @param {ErrorConstructor} constructor
   * @param {String} message
   * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
   * @api public
   */

  assert.doesNotThrow = function (fn, type, msg) {
    if ('string' === typeof type) {
      msg = type;
      type = null;
    }

    new Assertion(fn, msg).to.not.throw(type);
  };

  /**
   * # .operator(val, operator, val2, [message])
   *
   * Compare two values using operator.
   *
   *      assert.operator(1, '<', 2, 'everything is ok');
   *      assert.operator(1, '>', 2, 'this will fail');
   *
   * @name operator
   * @param {*} object to test
   * @param {String} operator
   * @param {*} second object
   * @param {String} message
   * @api public
   */

  assert.operator = function (val, operator, val2, msg) {
    if (!~['==', '===', '>', '>=', '<', '<=', '!=', '!=='].indexOf(operator)) {
      throw new Error('Invalid operator "' + operator + '"');
    }
    var test = new Assertion(eval(val + operator + val2), msg);
    test.assert(
        true === test.obj
      , 'expected ' + inspect(val) + ' to be ' + operator + ' ' + inspect(val2)
      , 'expected ' + inspect(val) + ' to not be ' + operator + ' ' + inspect(val2) );
  };

  /*!
   * Undocumented / untested
   */

  assert.ifError = function (val, msg) {
    new Assertion(val, msg).to.not.be.ok;
  };

  /*!
   * Aliases.
   */

  (function alias(name, as){
    assert[as] = assert[name];
    return alias;
  })
  ('length', 'lengthOf')
  ('throws', 'throw');
};

});

require.define("/lib/eve.js", function (require, module, exports, __dirname, __filename) {
(function() {
  var eve, exports, type, validator;

  eve = {};

  validator = require("./validator");

  type = require("./type");

  require("./number");

  require("./string");

  require("./date");

  require("./object");

  require("./array");

  require("./or");

  require("./and");

  require("./bool");

  eve.version = '0.0.5-metakeule';

  eve.validator = validator;

  eve.type = type;

  eve.message = require("./message");

  eve.error = require("./error");

  exports = module.exports = eve;

}).call(this);

});

require.define("/lib/validator.js", function (require, module, exports, __dirname, __filename) {
(function() {
  var validator;

  validator = (function() {

    function validator() {
      var i, types;
      this.class2type = {};
      types = "Boolean Number String Function Array Date RegExp Object".split(" ");
      i = types.length - 1;
      while (i >= 0) {
        this.class2type["[object " + types[i] + "]"] = types[i].toLowerCase();
        i--;
      }
    }

    validator.prototype.toString = Object.prototype.toString;

    validator.prototype.type = function(obj) {
      if (!(obj != null)) {
        return String(obj);
      } else {
        return this.class2type[this.toString.call(obj)] || "object";
      }
    };

    validator.prototype.isArray = function(obj) {
      return this.type(obj) === "array";
    };

    validator.prototype.isObject = function(obj) {
      return !!obj && this.type(obj) === "object";
    };

    validator.prototype.isNumber = function(obj) {
      return this.type(obj) === "number";
    };

    validator.prototype.isFunction = function(obj) {
      return this.type(obj) === "function";
    };

    validator.prototype.isDate = function(obj) {
      return this.type(obj) === "date";
    };

    validator.prototype.isRegExp = function(obj) {
      return this.type(obj) === "regexp";
    };

    validator.prototype.isBoolean = function(obj) {
      return this.type(obj) === "boolean";
    };

    validator.prototype.isString = function(obj) {
      return this.type(obj) === "string";
    };

    validator.prototype.isInteger = function(obj) {
      return this.type(obj) === "number" && !(obj % 1);
    };

    validator.prototype.isEmail = function(str) {
      return !!(str && str.match(/^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/));
    };

    validator.prototype.isUrl = function(str) {
      return !!(str && str.match(/^(?:(?:ht|f)tp(?:s?)\:\/\/|~\/|\/)?(?:\w+:\w+@)?((?:(?:[-\w\d{1-3}]+\.)+(?:com|org|net|gov|mil|biz|info|mobi|name|aero|jobs|edu|co\.uk|ac\.uk|it|fr|tv|museum|asia|local|travel|[a-z]{2}))|((\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)(\.(\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)){3}))(?::[\d]{1,5})?(?:(?:(?:\/(?:[-\w~!$+|.,=]|%[a-f\d]{2})+)+|\/)+|\?|#)?(?:(?:\?(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)(?:&(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)*)*(?:#(?:[-\w~!$ |\/.,*:;=]|%[a-f\d]{2})*)?$/));
    };

    validator.prototype.isAlpha = function(str) {
      return !!(str && str.match(/^[a-zA-Z]+$/));
    };

    validator.prototype.isNumeric = function(str) {
      return !!(str && str.match(/^-?[0-9]+$/));
    };

    validator.prototype.isAlphanumeric = function(str) {
      return !!(str && str.match(/^[a-zA-Z0-9]+$/));
    };

    validator.prototype.isIp = function(str) {
      return !!(str && str.match(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/));
    };

    validator.prototype.exists = function(obj) {
      return obj !== null && obj !== undefined;
    };

    validator.prototype.notEmpty = function(obj) {
      var key, val;
      if (this.isObject(obj)) {
        for (key in obj) {
          val = obj[key];
          if (val !== void 0) return true;
        }
        return false;
      }
      if (this.isNumber(obj)) return obj !== 0;
      return !!(obj !== null && obj !== undefined && !(obj + "").match(/^[\s\t\r\n]*$/));
    };

    validator.prototype.equals = function(obj, eql) {
      return obj === eql;
    };

    validator.prototype.contains = function(obj, item) {
      var i, n, t;
      if (!obj) return false;
      t = this.type(obj);
      if (this.type(obj.indexOf) === "function") {
        return obj.indexOf(item) !== -1;
      } else if (t === "array") {
        n = -1;
        i = obj.length - 1;
        while (i >= 0) {
          if (obj[i] === item) n = i;
          i--;
        }
        return n !== -1;
      }
      return false;
    };

    validator.prototype.len = function(obj, minOrLen, max) {
      if (!obj) return false;
      if (typeof max === "number") {
        return obj.length >= minOrLen && obj.length <= max;
      } else {
        return obj.length === minOrLen;
      }
    };

    validator.prototype.mod = function(val, by_, rem) {
      return val % (by_ || 1) === (rem || 0);
    };

    return validator;

  })();

  module.exports = new validator;

}).call(this);

});

require.define("/lib/type.js", function (require, module, exports, __dirname, __filename) {
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

});

require.define("/lib/message.js", function (require, module, exports, __dirname, __filename) {
(function() {
  var Message, fn;

  Message = (function() {

    Message.prototype.msg = function(key, msg, args) {
      var str;
      str = (msg && ("" + msg)) || (this.dictionary[this._locale] && this.dictionary[this._locale][key]) || "is invalid";
      return str = str.replace(/\{\{(.*?)\}\}/g, function(a, b) {
        if (str && args) return args[b] || "";
      });
    };

    function Message() {
      this.dictionary = {};
      this._locale = 'en-US';
      this.store("en-US", {
        "invalid": "is invalid",
        "required": "is required",
        "notEmpty": "can't be empty",
        "len": "should have length {{len}}",
        "wrongType": "should be a {{type}}",
        "len_in": "should have max length {{max}} and min length {{min}}",
        "match": "should match {{expression}}",
        "email": "must be an email address",
        "url": "must be a url",
        "min": "must be greater than or equal to {{count}}",
        "max": "must be less than or equal to {{count}}",
        "taken": "has already been taken",
        "enum": "must be included in {{items}}"
      });
    }

    Message.prototype.locale = function(name) {
      var path;
      if (!arguments.length) return this._locale;
      path = __dirname + "/message-" + name + ".js";
      try {
        require(path);
      } catch (e) {

      }
      return this._locale = name;
    };

    Message.prototype.store = function(locale, data) {
      var key, val, _results;
      if (typeof this.dictionary[locale] !== "object") {
        this.dictionary[locale] = {};
      }
      if (data && typeof data === "object") {
        _results = [];
        for (key in data) {
          val = data[key];
          _results.push(this.dictionary[locale][key] = val);
        }
        return _results;
      }
    };

    return Message;

  })();

  fn = function(key, msg, args) {
    return fn.message.msg(key, msg, args);
  };

  fn.message = new Message();

  module.exports = fn;

}).call(this);

});

require.define("/lib/error.js", function (require, module, exports, __dirname, __filename) {
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

});

require.define("/lib/moduler.js", function (require, module, exports, __dirname, __filename) {
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

});

require.define("/lib/number.js", function (require, module, exports, __dirname, __filename) {
(function() {
  var message, type, validator,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  validator = require("./validator");

  type = require("./type");

  message = require("./message");

  type._number = (function(_super) {

    __extends(_number, _super);

    function _number() {
      _number.__super__.constructor.apply(this, arguments);
    }

    _number.prototype.min = function(val, msg) {
      this.validator(function(num) {
        return num >= val;
      }, message("min", msg, {
        count: val
      }));
      return this;
    };

    _number.prototype.max = function(val, msg) {
      this.validator(function(num) {
        return num <= val;
      }, message("max", msg, {
        count: val
      }));
      return this;
    };

    _number.prototype["enum"] = function(items, msg) {
      this._enum = items;
      this.validator(function(num) {
        return validator.contains(items, num);
      }, message("enum", msg, {
        items: items.join(",")
      }));
      return this;
    };

    _number.alias = Number;

    _number.check = function(obj) {
      return validator.isNumber(obj);
    };

    _number.from = function(obj) {
      var parsed;
      if (validator.isNumber(obj)) return obj;
      if (validator.isString(obj)) {
        parsed = parseFloat(obj);
        if (parsed.toString() === obj) {
          return parsed;
        } else {
          return obj;
        }
      } else {
        return obj;
      }
    };

    return _number;

  })(type.Base);

  type.register('number', type._number);

  type._integer = (function(_super) {

    __extends(_integer, _super);

    function _integer() {
      _integer.__super__.constructor.apply(this, arguments);
    }

    _integer.check = function(obj) {
      return validator.isNumber(obj) && validator.mod(obj);
    };

    _integer.from = function(obj) {
      var parsed;
      if (validator.isNumber(obj) && validator.mod(obj)) return obj;
      if (validator.isString(obj)) {
        parsed = parseInt(obj, 10);
        if (parsed.toString() === obj) {
          return parsed;
        } else {
          return obj;
        }
      } else {
        return obj;
      }
    };

    return _integer;

  })(type._number);

  type.register('integer', type._integer);

}).call(this);

});

require.define("/lib/string.js", function (require, module, exports, __dirname, __filename) {
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
      return obj;
    };

    return _string;

  })(type.Base);

  type.register('string', type._string);

}).call(this);

});

require.define("/lib/date.js", function (require, module, exports, __dirname, __filename) {
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

});

require.define("/lib/object.js", function (require, module, exports, __dirname, __filename) {
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
      var i, len, ob, path, sc, schema;
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
          sc[1].value(null);
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

});

require.define("/lib/array.js", function (require, module, exports, __dirname, __filename) {
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

});

require.define("/lib/or.js", function (require, module, exports, __dirname, __filename) {
(function() {
  var error, message, type, validator,
    __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  validator = require("./validator");

  type = require("./type");

  message = require("./message");

  error = require("./error");

  type._or = (function(_super) {

    __extends(_or, _super);

    function _or(schemas) {
      var self;
      _or.__super__.constructor.call(this);
      self = this;
      self.schemas = schemas;
    }

    _or.prototype.clone = function() {
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

    _or.prototype.validate = function(callback) {
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

    _or.prototype.afterValue = function() {
      this.validate();
      if (this._valid_schema) {
        this._value = this._valid_schema.val(this._value).val();
      }
      return this;
    };

    _or.prototype.validateChild = function(err, callback) {
      var completed, done, errors, iterate, len, next, ob, schemas, self, _errors;
      ob = this._value;
      self = this;
      completed = 0;
      schemas = this.schemas;
      _errors = err || new error();
      len = schemas.length;
      this._valid_schema = void 0;
      iterate = function() {
        var sc;
        sc = schemas[completed];
        return sc.val(ob).validate(function(err) {
          if (!err) {
            self._valid_schema = sc;
            return next();
          } else {

          }
          if (err) _errors.on(completed, err);
          return next();
        });
      };
      next = function() {
        completed++;
        if (self._valid_schema || completed === len) {
          return done();
        } else {
          return iterate();
        }
      };
      errors = function() {
        if (self._valid_schema) return null;
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

    return _or;

  })(type.Base);

  type.register('or', type._or);

}).call(this);

});

require.define("/lib/and.js", function (require, module, exports, __dirname, __filename) {
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

});

require.define("/lib/bool.js", function (require, module, exports, __dirname, __filename) {
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

});

require.define("/test/array.test.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var assert, deepEqual, equal, eve, fail, notDeepEqual, notEqual, notStrictEqual, ok, strictEqual, _ref;

  _ref = require("./helper"), assert = _ref.assert, ok = _ref.ok, fail = _ref.fail, equal = _ref.equal, notEqual = _ref.notEqual, deepEqual = _ref.deepEqual, notDeepEqual = _ref.notDeepEqual, strictEqual = _ref.strictEqual, notStrictEqual = _ref.notStrictEqual, eve = _ref.eve;

  describe("type", function() {
    var type;
    type = eve.type;
    return describe("array", function() {
      it("should have array type", function() {
        return ok(type.array);
      });
      it("should be able to convert type", function() {
        return deepEqual(type.array().val([1, 2, 3]).val(), [1, 2, 3]);
      });
      it("should be able to validate length", function() {
        var err;
        err = type.array().len(5).val([1, 2, 3]).validate();
        ok(err);
        equal(err.messages().length, 1);
        err = type.array().len(4, 5).val([1, 2, 3]).validate();
        ok(err);
        return equal(err.messages().length, 1);
      });
      it("should have item schema", function() {
        var errs, schema;
        schema = type.array(type.number().max(2)).len(5).val([1, "2", 3]);
        deepEqual(schema.val(), [1, 2, 3]);
        errs = schema.validate(function(errs) {
          return equal(errs.messages().length, 2);
        });
        return equal(errs.messages().length, 2);
      });
      it("should validate required if required and embedded in object", function() {
        var errs, schema;
        schema = type.object({
          test: type.array(type.number().required()).required()
        }).required();
        errs = schema.val({
          test2: ["a"]
        }).validate(function(errs) {
          ok(errs);
          return equal(errs.messages().length, 1);
        });
        ok(errs);
        return equal(errs.messages().length, 1);
      });
      it("should be an array if embedded in object", function() {
        var errs, schema;
        schema = type.object({
          test: type.array().required()
        }).required();
        errs = schema.val({
          test: 3
        }).validate(function(errs) {
          ok(errs);
          return equal(errs.messages().length, 1);
        });
        ok(errs);
        return equal(errs.messages().length, 1);
      });
      it("should be an array", function() {
        var errs, schema;
        schema = type.array();
        errs = schema.val({}).validate(function(errs) {
          ok(errs);
          return equal(errs.messages().length, 1);
        });
        ok(errs);
        equal(errs.messages().length, 1);
        errs = schema.val(2).validate(function(errs) {
          ok(errs);
          return equal(errs.messages().length, 1);
        });
        ok(errs);
        equal(errs.messages().length, 1);
        errs = schema.val("").validate(function(errs) {
          ok(errs);
          return equal(errs.messages().length, 1);
        });
        ok(errs);
        return equal(errs.messages().length, 1);
      });
      it("should raise if empty", function() {
        var errs, schema;
        schema = type.object({
          test: type.array(type.number().required()).notEmpty()
        }).required();
        errs = schema.val({
          test: []
        }).validate(function(errs) {
          ok(errs);
          return equal(errs.messages().length, 1);
        });
        ok(errs);
        return equal(errs.messages().length, 1);
      });
      it("should validate inner object", function() {
        var errs, schema;
        schema = type.array(type.object({
          login: type.string().required()
        })).val([
          {
            nologin: true
          }, {
            login: true
          }, {
            nologin: true
          }
        ]);
        errs = schema.validate(function(errs) {
          ok(errs);
          return equal(errs.messages().length, 3);
        });
        ok(errs);
        return equal(errs.messages().length, 3);
      });
      it("should have item schema of clone", function() {
        var errs, schema;
        schema = type.array(type.number().max(2)).len(5).clone().val([1, "2", 3]);
        deepEqual(schema.val(), [1, 2, 3]);
        errs = schema.validate(function(errs) {
          return equal(errs.messages().length, 2);
        });
        return equal(errs.messages().length, 2);
      });
      return it("should be able to recognize type alias", function() {
        var data;
        data = type.array({
          login: String
        }).val([
          {
            login: "123"
          }
        ]).val();
        return strictEqual(data[0].login, "123");
      });
    });
  });

}).call(this);

});

require.define("/test/bool.test.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var assert, deepEqual, equal, eve, fail, notDeepEqual, notEqual, notStrictEqual, ok, strictEqual, _ref;

  _ref = require("./helper"), assert = _ref.assert, ok = _ref.ok, fail = _ref.fail, equal = _ref.equal, notEqual = _ref.notEqual, deepEqual = _ref.deepEqual, notDeepEqual = _ref.notDeepEqual, strictEqual = _ref.strictEqual, notStrictEqual = _ref.notStrictEqual, eve = _ref.eve;

  describe("type", function() {
    var type;
    type = eve.type;
    return describe("bool", function() {
      it("should have bool type", function() {
        return ok(type.bool);
      });
      it("should convert type", function() {
        strictEqual(type.bool().val(" true ").val(), true);
        strictEqual(type.bool().val(" Tr_ue").val(), " Tr_ue");
        return strictEqual(type.bool().val("fAlse ").val(), false);
      });
      it("should validate", function() {
        ok(type.bool().val("test").validate());
        ok(!type.bool().val(true).validate());
        ok(!type.bool().val(false).validate());
        ok(!type.bool().val("false").validate());
        return ok(!type.bool().val("true").validate());
      });
      it("should pass not required bools", function() {
        ok(!type.bool().val(undefined).validate());
        return ok(!type.bool().val(null).validate());
      });
      return it("should raise on required bools", function() {
        ok(type.bool().required().val(undefined).validate());
        return ok(type.bool().required().val(null).validate());
      });
    });
  });

}).call(this);

});

require.define("/test/error.test.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var assert, deepEqual, equal, eve, fail, notDeepEqual, notEqual, notStrictEqual, ok, strictEqual, _ref;

  _ref = require("./helper"), assert = _ref.assert, ok = _ref.ok, fail = _ref.fail, equal = _ref.equal, notEqual = _ref.notEqual, deepEqual = _ref.deepEqual, notDeepEqual = _ref.notDeepEqual, strictEqual = _ref.strictEqual, notStrictEqual = _ref.notStrictEqual, eve = _ref.eve;

  describe("error", function() {
    var error;
    error = eve.error;
    it("should have error object", function() {
      return ok(error);
    });
    it("should push message", function() {
      var err, msgs;
      err = new error();
      equal(err.ok, false);
      err.alias("Name");
      err.push("is invalid");
      err.push("is not empty");
      equal(err.ok, true);
      msgs = err.messages(true);
      ok(msgs);
      equal(msgs.length, 2);
      equal(msgs[0], "is invalid");
      msgs = err.messages();
      equal(msgs[0], "Name is invalid");
      return equal(err.message.match(/Name/g).length, 2);
    });
    it("should push error object", function() {
      var err, err1, err2, msgs;
      err = new error();
      err.alias("Name");
      err.push("is invalid");
      err1 = new error();
      err1.alias("Password");
      err1.push("is invalid");
      err2 = new error();
      err2.on("name", err);
      err2.on("password", err1);
      msgs = err2.messages(true);
      ok(msgs);
      equal(msgs.length, 2);
      equal(msgs[0], "is invalid");
      msgs = err2.messages();
      equal(msgs[0], "Name is invalid");
      msgs = err2.on("name").messages();
      equal(msgs.length, 1);
      equal(msgs[0], "Name is invalid");
      ok(err2.message.match(/Name/));
      return ok(err2.message.match(/Password/));
    });
    return it("should work with Error", function() {
      var err;
      err = new error();
      err.alias("Name");
      err.push("is invalid");
      err.push("is not empty");
      return ok(err instanceof Error);
    });
  });

}).call(this);

});

require.define("/test/examples.test.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var assert, deepEqual, equal, eve, fail, notDeepEqual, notEqual, notStrictEqual, ok, strictEqual, _ref;

  _ref = require("./helper"), assert = _ref.assert, ok = _ref.ok, fail = _ref.fail, equal = _ref.equal, notEqual = _ref.notEqual, deepEqual = _ref.deepEqual, notDeepEqual = _ref.notDeepEqual, strictEqual = _ref.strictEqual, notStrictEqual = _ref.notStrictEqual, eve = _ref.eve;

  describe("examples", function() {
    return describe("signup_user", function() {
      var schema, type, user;
      type = eve.type;
      user = {
        login: "test",
        name: "Test",
        email: "test@mail.com",
        password: "test",
        password_confirmation: "test",
        birthday: "1990-1-1",
        age: "20"
      };
      schema = type.object({
        login: type.string().lowercase().trim().notEmpty().len(3, 12).match(/^[a-zA-Z0-9]*$/).validator(function(val, done) {
          return setTimeout((function() {
            return done(val !== "admin");
          }), 100);
        }, "must be unique"),
        name: type.string().trim().notEmpty(),
        email: type.string().trim().notEmpty().email(),
        password: type.string().trim().notEmpty().len(6, 12),
        password_confirmation: type.string().trim().notEmpty().len(6, 12).validator(function(val) {
          return val === this.password;
        }, "must be equal to password"),
        birthday: type.date(),
        age: type.integer()
      });
      return schema.value(user).validate(function(errors) {});
    });
  });

}).call(this);

});

require.define("/test/extend.test.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var assert, deepEqual, equal, eve, fail, message, notDeepEqual, notEqual, notStrictEqual, ok, strictEqual, type, validator, _ref;
  var __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; };

  _ref = require("./helper"), assert = _ref.assert, ok = _ref.ok, fail = _ref.fail, equal = _ref.equal, notEqual = _ref.notEqual, deepEqual = _ref.deepEqual, notDeepEqual = _ref.notDeepEqual, strictEqual = _ref.strictEqual, notStrictEqual = _ref.notStrictEqual, eve = _ref.eve;

  type = eve.type;

  message = eve.message;

  validator = eve.validator;

  validator.isGood = function(str) {
    return this.isString(str) && str === 'good';
  };

  type._string.prototype.good = function(msg) {
    this._good = true;
    this.validator((function(str) {
      return str && validator.isGood(str);
    }), message("good", msg));
    return this;
  };

  type._my = (function() {

    __extends(_my, type.Base);

    function _my() {
      _my.__super__.constructor.call(this);
      this.validator(function(val) {
        return val === 'myval';
      }, message("invalid"));
    }

    return _my;

  })();

  type.register('my', type._my);

  describe("extend", function() {
    describe("my type", function() {
      it("should have my type", function() {
        return ok(type.my);
      });
      it("should validate", function() {
        ok(type.my().required().value("other").validate());
        return ok(!type.my().required().value("myval").validate());
      });
      it("should check exist and empty", function() {
        ok(type.my().required().value(null).validate());
        ok(!type.my().required().value("myval").validate());
        ok(!type.my().notEmpty().value(null).validate());
        return ok(type.my().notEmpty().value(" ").validate());
      });
      it("should return in callback", function(done) {
        return type.my().required().value(null).validate(function(err) {
          ok(err);
          return done();
        });
      });
      it("should skip validator when empty", function(done) {
        return type.my().validator(function(val) {
          return val === 10;
        }).value(null).validate(function(err) {
          ok(!err);
          return done();
        });
      });
      it("should set default value", function() {
        equal(type.my()["default"]("myval").value(null).value(), "myval");
        return equal(type.my()["default"]("myval").value(void 0).value(), "myval");
      });
      return it("should can add a processor", function() {
        var schema;
        schema = type.my().processor(function(val) {
          return val + "-modified";
        });
        return equal(schema.value("myval").value(), "myval-modified");
      });
    });
    return describe("good string", function() {
      return it("should validate", function() {
        ok(type.string().good().required().value("other").validate());
        return ok(!type.string().good().required().value("good").validate());
      });
    });
  });

}).call(this);

});

require.define("/test/message.test.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var assert, deepEqual, equal, eve, fail, notDeepEqual, notEqual, notStrictEqual, ok, strictEqual, _ref;

  _ref = require("./helper"), assert = _ref.assert, ok = _ref.ok, fail = _ref.fail, equal = _ref.equal, notEqual = _ref.notEqual, deepEqual = _ref.deepEqual, notDeepEqual = _ref.notDeepEqual, strictEqual = _ref.strictEqual, notStrictEqual = _ref.notStrictEqual, eve = _ref.eve;

  if ((typeof window) !== 'undefined') require('./../lib/message-zh-CN.js');

  describe("message", function() {
    var message;
    message = eve.message;
    it("should have message", function() {
      return ok(message);
    });
    it("should be able to set/get locale", function() {
      message.message.locale("en-US");
      equal(message.message.locale(), "en-US");
      message.message.locale("zh-CN");
      ok(message.message.dictionary["zh-CN"]);
      return ok(message.message.dictionary["zh-CN"]["invalid"]);
    });
    it("should be able to store message", function() {
      message.message.store("test", {
        invalid: "invalid"
      });
      message.message.locale("test");
      return equal(message("invalid"), "invalid");
    });
    it("should support default message", function() {
      return equal(message("invalid", "default message"), "default message");
    });
    return it("should replace options", function() {
      message.message.store("test", {
        invalid: "invalid {{msg}}"
      });
      message.message.locale("test");
      return equal(message("invalid", null, {
        msg: "test"
      }), "invalid test");
    });
  });

}).call(this);

});

require.define("/lib/message-zh-CN.js", function (require, module, exports, __dirname, __filename) {
(function() {
  var message;

  message = require("./message.js").message;

  message.store("zh-CN", {
    invalid: "是无效的",
    required: "必填",
    notEmpty: "不能留空",
    len: "长度为{{len}}",
    len_in: "长度为{{min}}到{{max}}",
    match: "应该{{expression}}",
    email: "必须是邮件地址",
    url: "必须是链接",
    min: "必须大于或等于 {{count}}",
    max: "必须小于或等于 {{count}}",
    taken: "已经被使用",
    "enum": "必须包含在({{items}})中"
  });

}).call(this);

});

require.define("/test/number.test.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var assert, deepEqual, equal, eve, fail, notDeepEqual, notEqual, notStrictEqual, ok, strictEqual, _ref;

  _ref = require("./helper"), assert = _ref.assert, ok = _ref.ok, fail = _ref.fail, equal = _ref.equal, notEqual = _ref.notEqual, deepEqual = _ref.deepEqual, notDeepEqual = _ref.notDeepEqual, strictEqual = _ref.strictEqual, notStrictEqual = _ref.notStrictEqual, eve = _ref.eve;

  describe("type", function() {
    var type;
    type = eve.type;
    describe("number", function() {
      it("should have number type", function() {
        return ok(type.number);
      });
      it("should convert type", function() {
        strictEqual(type.number().val("23dd").val(), "23dd");
        strictEqual(type.number().val("23.11").val(), 23.11);
        return strictEqual(type.number().val(23.11).val(), 23.11);
      });
      it("should be able to compare", function() {
        ok(!type.number().min(10).max(30).val(23.11).validate());
        ok(type.number().min(10).max(30).val(9).validate());
        return ok(type.number().min(10).max(30).val(40).validate());
      });
      return it("should not accept empty numbers", function() {
        ok(type.number().notEmpty().val(0).validate());
        ok(type.number().notEmpty().val(0.0).validate());
        return ok(!type.number().notEmpty().val(1).validate());
      });
    });
    return describe("integer", function() {
      it("should have integer type", function() {
        return ok(type.integer);
      });
      it("should convert type", function() {
        strictEqual(type.integer().val("23dd").val(), "23dd");
        strictEqual(type.integer().val("23.11").val(), "23.11");
        strictEqual(type.integer().val("23").val(), 23);
        strictEqual(type.integer().val(23.11).val(), 23.11);
        strictEqual(type.integer().val("sfd").val(), "sfd");
        strictEqual(type.integer().val(null).val(), null);
        return strictEqual(type.integer().val(0).val(), 0);
      });
      return it("should support enum validate", function() {
        var sc;
        ok(!type.integer()["enum"]([1, 2, 3]).val(1).validate());
        ok(type.integer()["enum"]([1, 2, 3]).val(0).validate());
        sc = type.integer()["enum"]([2, 4]);
        equal(2, sc._enum[0]);
        return equal(4, sc._enum[1]);
      });
    });
  });

}).call(this);

});

require.define("/test/object.test.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var assert, deepEqual, equal, eve, fail, notDeepEqual, notEqual, notStrictEqual, ok, strictEqual, _ref;

  _ref = require("./helper"), assert = _ref.assert, ok = _ref.ok, fail = _ref.fail, equal = _ref.equal, notEqual = _ref.notEqual, deepEqual = _ref.deepEqual, notDeepEqual = _ref.notDeepEqual, strictEqual = _ref.strictEqual, notStrictEqual = _ref.notStrictEqual, eve = _ref.eve;

  describe("type", function() {
    var type;
    type = eve.type;
    return describe("object", function() {
      var schema;
      it("should have object type", function() {
        return ok(type.object);
      });
      schema = type.object({
        login: type.string().trim().lowercase().notEmpty().len(3, 12),
        email: type.string().trim().notEmpty().email()
      });
      it("should process value", function() {
        var val;
        val = schema.val({
          login: " Test ",
          email: "t@g.com"
        }).val();
        equal(val.login, "test");
        return ok(!schema.validate());
      });
      it("should process value of clone", function() {
        var sc, val;
        sc = schema.clone();
        val = sc.val({
          login: " Test ",
          email: "t@g.com"
        }).val();
        equal(val.login, "test");
        return ok(!sc.validate());
      });
      it("should be able to validate", function(done) {
        var errs;
        schema.val({
          login: "t",
          email: "g.com"
        });
        errs = schema.validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 2);
          return done();
        });
        return ok(errs);
      });
      it("should be able to validate clone", function(done) {
        var errs, sc;
        sc = schema.clone();
        sc.val({
          login: "t",
          email: "g.com"
        });
        errs = sc.validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 2);
          return done();
        });
        return ok(errs);
      });
      it("should be able to validate async", function(done) {
        schema = type.object({
          login: type.string().validator(function(val, next) {
            return setTimeout((function() {
              return next(val !== "admin");
            }), 100);
          }, "must be unique"),
          email: type.string().trim().email().validator(function(val, next) {
            return setTimeout((function() {
              return next(val !== "t@g.com");
            }), 100);
          }, "must be unique")
        });
        return schema.val({
          login: "admin",
          email: "t@g.com"
        }).validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 2);
          return done();
        });
      });
      it("should allow a not required inner object that is not empty when it exists", function(done) {
        var errs;
        schema = type.object({
          login: type.object({
            inner: type.string()
          }).notEmpty()
        });
        errs = schema.val({
          other: {}
        }).validate();
        ok(!errs);
        errs = schema.val({
          login: {}
        }).validate();
        ok(errs);
        return done();
      });
      it("should allow a not required inner object even if it has required attributes", function(done) {
        var errs;
        schema = type.object({
          login: type.object({
            inner: type.string().required()
          })
        });
        errs = schema.val({
          login: {}
        }).validate();
        ok(errs);
        errs = schema.val({
          other: {}
        }).validate();
        ok(!errs);
        return done();
      });
      it("should validate an object within an invalid object", function(done) {
        schema = type.object({
          test: type.object({
            login: type.string().trim().lowercase().notEmpty().len(3, 12),
            email: type.string().trim().notEmpty().email()
          })
        });
        return schema.val({
          test: {
            login: "admin",
            email: "tg.com"
          }
        }).validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 1);
          return done();
        });
      });
      it("should validate an object within a valid object", function(done) {
        schema = type.object({
          test: type.object({
            login: type.string().trim().lowercase().notEmpty().len(3, 12),
            email: type.string().trim().notEmpty().email()
          })
        });
        return schema.val({
          test: {
            login: "admin",
            email: "t@g.com"
          }
        }).validate(function(errs) {
          ok(!errs);
          return done();
        });
      });
      it("should be able to ignore undefined attribute", function() {});
      it("should be able to validate required attribute", function(done) {
        var errs;
        schema = type.object({
          login: type.string().required()
        });
        schema.val({
          nologin: "t"
        });
        errs = schema.validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 1);
          return done();
        });
        return ok(errs);
      });
      it("should be able be required itself", function() {
        var errs;
        schema = type.object({
          login: type.object({
            user: type.string().required()
          }).required()
        });
        schema.val({
          nologin: "t"
        });
        errs = schema.validate(function(errs) {
          ok(errs);
          return equal(errs.messages().length, 1);
        });
        ok(errs);
        schema.val({
          login: {
            user: "test"
          }
        });
        errs = schema.validate();
        return ok(!errs);
      });
      it("should support context in coustom validator", function() {
        schema = type.object({
          login: type.string().validator(function(val) {
            ok(this.login);
            equal(this.login, "admin");
            return true;
          })
        });
        return schema.val({
          login: "admin"
        }).validate();
      });
      it("should output with alias", function() {
        schema = type.object({
          login: type.string().alias("Login").trim().lowercase().notEmpty().len(3, 12),
          email: type.string().alias("Email").trim().notEmpty().email()
        });
        return schema.val({
          login: "t",
          email: "e"
        }).validate(function(err) {
          var msgs;
          ok(err);
          msgs = err.messages();
          ok(!msgs[0].indexOf("Login"));
          return ok(!msgs[1].indexOf("Email"));
        });
      });
      return it("should be able to recognize type alias", function() {
        schema = type.object({
          login: String,
          email: String
        });
        return strictEqual(schema.val({
          login: "123"
        }).val().login, "123");
      });
    });
  });

}).call(this);

});

require.define("/test/or.test.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var assert, deepEqual, equal, eve, fail, notDeepEqual, notEqual, notStrictEqual, ok, strictEqual, type, _ref;

  _ref = require("./helper"), assert = _ref.assert, ok = _ref.ok, fail = _ref.fail, equal = _ref.equal, notEqual = _ref.notEqual, deepEqual = _ref.deepEqual, notDeepEqual = _ref.notDeepEqual, strictEqual = _ref.strictEqual, notStrictEqual = _ref.notStrictEqual, eve = _ref.eve;

  type = eve.type;

  describe("type", function() {
    beforeEach(function() {
      return this.schema = type.or([type.string().lowercase().notEmpty().len(3, 12), type.string().trim().notEmpty().email()]);
    });
    return describe("or", function() {
      it("should have or type", function() {
        return ok(type.or);
      });
      it("should process value a", function() {
        var val;
        val = this.schema.val("Test").val();
        equal(val, "test");
        return ok(!this.schema.validate());
      });
      it("should process value a for clones ", function() {
        var sc, val;
        sc = this.schema.clone();
        val = sc.val("Test").val();
        equal(val, "test");
        return ok(!sc.validate());
      });
      it("should process value b", function() {
        var val;
        val = this.schema.val("Ddddddddddddddddddddddddt@g.com ").val();
        equal(val, "Ddddddddddddddddddddddddt@g.com");
        return ok(!this.schema.validate());
      });
      it("should process value b for clone", function() {
        var sc, val;
        sc = this.schema.clone();
        val = sc.val("Ddddddddddddddddddddddddt@g.com ").val();
        equal(val, "Ddddddddddddddddddddddddt@g.com");
        return ok(!sc.validate());
      });
      it("should be able be required itself", function() {
        var errs, schema;
        schema = type.object({
          login: type.or([type.string().lowercase().notEmpty().len(3, 12), type.string().trim().notEmpty().email()]).required()
        });
        schema.val({
          nologin: "t"
        });
        errs = schema.validate(function(errs) {
          ok(errs);
          return equal(errs.messages().length, 1);
        });
        ok(errs);
        schema.val({
          login: "test"
        });
        errs = schema.validate();
        return ok(!errs);
      });
      it("should validate if not required", function() {
        var errs, schema;
        schema = type.object({
          login: type.or([type.string().lowercase().notEmpty().len(3, 12), type.string().trim().notEmpty().email()])
        });
        schema.val({
          nologin: "t"
        });
        errs = schema.validate();
        return ok(!errs);
      });
      it("should be able to validate if both fails", function(done) {
        var errs;
        this.schema.val("");
        errs = this.schema.validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 2);
          return done();
        });
        return ok(errs);
      });
      it("should be able to validate if one is valid", function(done) {
        var errs;
        this.schema.val("test");
        return errs = this.schema.validate(function(errs) {
          ok(!errs);
          return done();
        });
      });
      it("should be able to validate if both are valid", function(done) {
        var errs;
        this.schema.val("ddddt@g.com");
        return errs = this.schema.validate(function(errs) {
          ok(!errs);
          return done();
        });
      });
      it("should validate objects", function() {
        var schema, val;
        schema = type.or([
          type.object({
            login: type.string().trim().lowercase().notEmpty().len(3, 12),
            email: type.string().trim().notEmpty().email()
          })
        ]);
        val = schema.val({
          login: " Test ",
          email: "t@g.com"
        }).val();
        equal(val.login, "test");
        return ok(!schema.validate());
      });
      it("should validate invalid objects", function(done) {
        var errs, schema;
        schema = type.or([
          type.object({
            login: type.string().trim().lowercase().notEmpty().len(3, 12),
            email: type.string().trim().notEmpty().email()
          })
        ]);
        schema.val({
          login: "t",
          email: "g.com"
        });
        errs = schema.validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 2);
          return done();
        });
        return ok(errs);
      });
      it("should validate invalid objects for clones", function(done) {
        var errs, schema;
        schema = type.or([
          type.object({
            login: type.string().trim().lowercase().notEmpty().len(3, 12),
            email: type.string().trim().notEmpty().email()
          })
        ]).clone();
        schema.val({
          login: "t",
          email: "g.com"
        });
        errs = schema.validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 2);
          return done();
        });
        return ok(errs);
      });
      it("should be able to validate async", function(done) {
        var schema;
        schema = type.or([
          type.string().validator(function(val, next) {
            return setTimeout((function() {
              return next(val !== "admin");
            }), 100);
          }, "must not be admin"), type.string().trim().email().validator(function(val, next) {
            return setTimeout((function() {
              return next(val.length !== 5);
            }), 100);
          }, "must not have 5 chars")
        ]);
        return schema.val("admin").validate(function(errs) {
          ok(errs);
          equal(errs.messages().length, 3);
          return done();
        });
      });
      return it("should support custom validators", function() {
        var schema;
        schema = type.or([
          type.string().validator(function(val) {
            ok(this);
            equal(val, "admin");
            return true;
          })
        ]);
        return schema.val("admin").validate();
      });
    });
  });

}).call(this);

});

require.define("/test/string.test.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var assert, deepEqual, equal, eve, fail, notDeepEqual, notEqual, notStrictEqual, ok, strictEqual, _ref;

  _ref = require("./helper"), assert = _ref.assert, ok = _ref.ok, fail = _ref.fail, equal = _ref.equal, notEqual = _ref.notEqual, deepEqual = _ref.deepEqual, notDeepEqual = _ref.notDeepEqual, strictEqual = _ref.strictEqual, notStrictEqual = _ref.notStrictEqual, eve = _ref.eve;

  describe("type", function() {
    return describe("string", function() {
      var schema, type;
      type = eve.type;
      it("should have string type", function() {
        return ok(type.string);
      });
      schema = type.string().lowercase().trim().notEmpty().len(3, 12).match(/^[a-zA-Z0-9]*$/).validator(function(val, done) {
        return setTimeout((function() {
          return done(val !== "admin");
        }), 100);
      });
      it("should trim and lowercase", function() {
        return equal(schema.val(" Test ").val(), "test");
      });
      it("should have length in 3~12", function() {
        ok(schema.val("dd").validate());
        ok(type.string().len(3).val("dd").validate());
        return ok(!schema.val("test").validate());
      });
      it("should be a valid match", function() {
        return ok(schema.val("test-").validate());
      });
      it("should be unique", function(done) {
        return schema.val("admin").validate(function(err) {
          ok(err && err.messages());
          return done();
        });
      });
      it("should be an email address", function(done) {
        type.string().email().val("dd").validate(function(err) {
          return ok(err && err.messages());
        });
        type.string().email().val("sdf@wer.com").validate(function(err) {
          return ok(!err);
        });
        type.string().email("be an email").val("dd").validate(function(err) {
          ok(err);
          equal(err.messages().length, 1);
          equal(err.messages(true)[0], "be an email");
          return done();
        });
        return ok(type.string().email()._email);
      });
      it("should handle 'required' seperate from 'notEmpty'", function(done) {
        type.string().notEmpty().val(null).validate(function(err) {
          return ok(!err);
        });
        type.string().notEmpty().val("").validate(function(err) {
          return ok(err);
        });
        return done();
      });
      it("should be a url", function() {
        type.string().url().val("http").validate(function(err) {
          return ok(err && err.messages());
        });
        type.string().url().val("http://google.com").validate(function(err) {
          return ok(!err);
        });
        return ok(type.string().url()._url);
      });
      it("should be a string", function() {
        type.string().val(new Date()).validate(function(err) {
          return ok(err && err.messages());
        });
        type.string().val({}).validate(function(err) {
          return ok(err && err.messages());
        });
        type.string().val([]).validate(function(err) {
          return ok(err && err.messages());
        });
        return type.string().val(4).validate(function(err) {
          return ok(err && err.messages());
        });
      });
      return it("should support enum validate", function() {
        var sc;
        ok(!type.string()["enum"](["male", "famale"]).val("male").validate());
        ok(type.string()["enum"](["male", "famale"]).val("other").validate());
        sc = type.string()["enum"](["a", "b"]);
        equal("a", sc._enum[0]);
        return equal("b", sc._enum[1]);
      });
    });
  });

}).call(this);

});

require.define("/test/type.test.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var assert, deepEqual, equal, eve, fail, notDeepEqual, notEqual, notStrictEqual, ok, strictEqual, type, _ref;

  _ref = require("./helper"), assert = _ref.assert, ok = _ref.ok, fail = _ref.fail, equal = _ref.equal, notEqual = _ref.notEqual, deepEqual = _ref.deepEqual, notDeepEqual = _ref.notDeepEqual, strictEqual = _ref.strictEqual, notStrictEqual = _ref.notStrictEqual, eve = _ref.eve;

  type = eve.type;

  describe("type", function() {
    return describe("any", function() {
      it("should have any type", function() {
        return ok(type.any);
      });
      it("should check exist and empty", function() {
        ok(type.any().required().value(null).validate());
        ok(!type.any().required().value("").validate());
        ok(!type.any().notEmpty().value(null).validate());
        return ok(type.any().notEmpty().value("  ").validate());
      });
      it("should return in callback", function(done) {
        return type.any().required().value(null).validate(function(err) {
          ok(err);
          return done();
        });
      });
      it("should skip validator when empty", function(done) {
        return type.any().validator(function(val) {
          return val === 10;
        }).value(null).validate(function(err) {
          ok(!err);
          return done();
        });
      });
      it("should can add sync validator", function(done) {
        var schema;
        schema = type.any().validator(function(val) {
          return val === 10;
        }, "equal 10");
        ok(schema.value(9).validate());
        ok(!schema.value(10).validate());
        return schema.value(10).validate(function(err) {
          ok(!err);
          return done();
        });
      });
      it("should can add async validator", function(done) {
        var schema;
        schema = type.any().notEmpty().validator(function(val, done) {
          return setTimeout(function() {
            return done(val === 10);
          }, 100);
        }, "equal 10");
        return schema.value(10).validate(function(err) {
          ok(!err);
          return done();
        });
      });
      it("should set default value", function() {
        equal(type.any()["default"]("ok").value(null).value(), "ok");
        return equal(type.any()["default"]("ok").value(void 0).value(), "ok");
      });
      it("should can add a processor", function() {
        var schema;
        schema = type.any().processor(function(val) {
          return val * 2;
        });
        return equal(schema.value(10).value(), 20);
      });
      it("should output mssage with alias", function() {
        var err, schema;
        schema = type.any().alias("Name").notEmpty().validator(function(val) {
          return false;
        }, "is invalid");
        err = schema.val("test").validate();
        ok(err);
        return equal(err.messages()[0], "Name is invalid");
      });
      return it("should enable map Object to type", function() {
        ok(type(String) instanceof type._string);
        ok(type(type.string()) instanceof type._string);
        return ok(!type("not a type"));
      });
    });
  });

}).call(this);

});

require.define("/test/validator.test.coffee", function (require, module, exports, __dirname, __filename) {
(function() {
  var assert, deepEqual, equal, eve, fail, notDeepEqual, notEqual, notStrictEqual, ok, strictEqual, _ref;

  _ref = require("./helper"), assert = _ref.assert, ok = _ref.ok, fail = _ref.fail, equal = _ref.equal, notEqual = _ref.notEqual, deepEqual = _ref.deepEqual, notDeepEqual = _ref.notDeepEqual, strictEqual = _ref.strictEqual, notStrictEqual = _ref.notStrictEqual, eve = _ref.eve;

  describe("validator", function() {
    describe("version", function() {
      return it("should have version", function() {
        return ok(eve.version);
      });
    });
    describe("type", function() {
      it("should recognise array", function() {
        return ok(eve.validator.isArray([]));
      });
      it("should recognise function", function() {
        ok(eve.validator.isFunction(function() {}));
        return ok(!eve.validator.isFunction(/d/));
      });
      it("should recognise object", function() {
        ok(eve.validator.isObject({}));
        ok(!eve.validator.isObject(""));
        ok(!eve.validator.isObject([]));
        ok(!eve.validator.isObject(function() {}));
        ok(!eve.validator.isObject(/d/));
        return ok(!eve.validator.isObject(new Date()));
      });
      it("should recognise data", function() {
        return ok(eve.validator.isDate(new Date()));
      });
      it("should recognise regexp", function() {
        return ok(eve.validator.isRegExp(/d/));
      });
      it("should recognise boolean", function() {
        ok(eve.validator.isBoolean(false));
        return ok(eve.validator.isBoolean(true));
      });
      return it("should recognise number", function() {
        ok(eve.validator.isNumber(1.2));
        ok(eve.validator.isInteger(1));
        return ok(!eve.validator.isInteger(1.2));
      });
    });
    describe("email", function() {
      return it("should recognise email", function() {
        ok(eve.validator.isEmail("test@mail.com"));
        ok(eve.validator.isEmail("test.pub@mail.com"));
        ok(eve.validator.isEmail("test-pub@mail.com"));
        return ok(!eve.validator.isEmail("test.mail.com"));
      });
    });
    describe("url", function() {
      return it("should recognise url", function() {
        ok(eve.validator.isUrl("http://g.com"));
        ok(eve.validator.isUrl("https://g.com"));
        ok(eve.validator.isUrl("https://g.cn"));
        return ok(eve.validator.isUrl("g.cn"));
      });
    });
    return describe("len", function() {
      it("should check right length of string", function() {
        ok(eve.validator.len("100", 3));
        ok(!eve.validator.len("100", 2, "4"));
        ok(eve.validator.len("100", 3, 4));
        return ok(!eve.validator.len("100", 4));
      });
      return it("should check right length of array", function() {
        ok(eve.validator.len([1, 3, 4], 3));
        ok(eve.validator.len([1, 3, 4], 3, 4));
        return ok(!eve.validator.len([1, 3, 4], 4));
      });
    });
  });

}).call(this);

});

require.define("/browser.tests.js", function (require, module, exports, __dirname, __filename) {
    /*
	add all tests here that should be served to the browser
*/

require('./test/and.test.coffee');
require('./test/array.test.coffee');
require('./test/bool.test.coffee');
require('./test/error.test.coffee');
require('./test/examples.test.coffee');
require('./test/extend.test.coffee');
require('./test/message.test.coffee');
require('./test/number.test.coffee');
require('./test/object.test.coffee');
require('./test/or.test.coffee');
require('./test/string.test.coffee');
require('./test/type.test.coffee');
require('./test/validator.test.coffee');

});
require("/browser.tests.js");
