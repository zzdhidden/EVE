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
