if (typeof window) != 'undefined'
  exporter = window.chai.assert
else
  exporter = require("chai").assert

exporter.eve = require("./../lib/eve.js")
exports = module.exports = exporter
