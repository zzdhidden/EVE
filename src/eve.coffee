# EVE
#
# A JavaScript object schema, processor and validation lib.
#
# Copyright (c) 2011 Hidden
# Copyright (c) 2012 Marc René Arns
# Released under the MIT, BSD, and GPL Licenses.

eve = {}
validator = require "./validator"
type = require "./type"

require "./number"
require "./string"
require "./date"
require "./object"
require "./array"
require "./or"
require "./and"
require "./bool"

# Library version.
#eve.version = require(__dirname + "./../package.json")['version']
eve.version = '0.0.5-metakeule'

# Basic validator
eve.validator = validator

# Schema type
eve.type = type

# Error message
eve.message = require "./message"

# Error object
eve.error = require "./error"

exports = module.exports = eve