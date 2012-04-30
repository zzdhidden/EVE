
class validator
  constructor: ->
    @class2type = {}
    types = "Boolean Number String Function Array Date RegExp Object".split " "
    i = types.length - 1
    while i >= 0
      @class2type["[object " + types[i] + "]"] = types[i].toLowerCase()
      i--

  toString: Object::toString
  type:             (obj) -> (if not obj? then String(obj) else @class2type[@toString.call(obj)] or "object")
  isArray:          (obj) -> @type(obj) is "array"
  isObject:         (obj) -> !!obj and @type(obj) is "object"
  isNumber:         (obj) -> @type(obj) is "number"
  isFunction:       (obj) -> @type(obj) is "function"
  isDate:           (obj) -> @type(obj) is "date"
  isRegExp:         (obj) -> @type(obj) is "regexp"
  isBoolean:        (obj) -> @type(obj) is "boolean"
  isString:         (obj) -> @type(obj) is "string"
  isInteger:        (obj) -> @type(obj) is "number" and not (obj % 1)
  isEmail:          (str) -> !!(str and str.match(/^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/))
  isUrl:            (str) -> !!(str and str.match(/^(?:(?:ht|f)tp(?:s?)\:\/\/|~\/|\/)?(?:\w+:\w+@)?((?:(?:[-\w\d{1-3}]+\.)+(?:com|org|net|gov|mil|biz|info|mobi|name|aero|jobs|edu|co\.uk|ac\.uk|it|fr|tv|museum|asia|local|travel|[a-z]{2}))|((\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)(\.(\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)){3}))(?::[\d]{1,5})?(?:(?:(?:\/(?:[-\w~!$+|.,=]|%[a-f\d]{2})+)+|\/)+|\?|#)?(?:(?:\?(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)(?:&(?:[-\w~!$+|.,*:]|%[a-f\d{2}])+=?(?:[-\w~!$+|.,*:=]|%[a-f\d]{2})*)*)*(?:#(?:[-\w~!$ |\/.,*:;=]|%[a-f\d]{2})*)?$/))
  isAlpha:          (str) -> !!(str and str.match(/^[a-zA-Z]+$/))
  isNumeric:        (str) -> !!(str and str.match(/^-?[0-9]+$/))
  isAlphanumeric:   (str) -> !!(str and str.match(/^[a-zA-Z0-9]+$/))
  isIp:             (str) -> !!(str and str.match(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/))
  exists:           (obj) -> obj isnt null and obj isnt `undefined`
  notEmpty:         (obj) -> 
    if @isObject(obj)
      for key, val of obj
        if val != undefined
          return true
      return false
    if @isNumber(obj) 
      return obj != 0
    !!(obj isnt null and obj isnt `undefined` and not (obj + "").match(/^[\s\t\r\n]*$/))
  equals:           (obj, eql) -> obj is eql
  contains:         (obj, item) ->
    return false  unless obj
    t = @type(obj)
    if @type(obj.indexOf) is "function"
      return obj.indexOf(item) isnt -1
    else if t is "array"
      n = -1
      i = obj.length - 1

      while i >= 0
        n = i  if obj[i] is item
        i--
      return n isnt -1
    false
  len:              (obj, minOrLen, max) ->
    return false  unless obj
    (if typeof max is "number" then obj.length >= minOrLen and obj.length <= max else obj.length is minOrLen)
  mod:              (val, by_, rem) -> val % (by_ or 1) is (rem or 0)

module.exports = new validator
