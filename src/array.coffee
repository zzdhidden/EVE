error = require "./error"
validator = require "./validator"
type = require "./type"
message = require "./message"

class type._array extends type.Base
  constructor: (schema) ->
    super()
    @original_schema = schema
    sc = type schema
    sc = type.object(schema) if not sc and validator.isObject(schema) and type.object
    @schema = sc

  clone: ->
    #console.log @original_schema
    obj = new @constructor(@original_schema.clone())
    for key, val of @
      if @hasOwnProperty(key) && key != '_value' && key != 'schema'
        obj[key] = val
    return obj
    
  len: (minOrLen, max, msg) ->
    last = arguments[arguments.length - 1]
    msg = if typeof last is "number" then null else last
    @validator ((ar) ->
      validator.len ar, minOrLen, max
    ), (if (typeof max is "number") then message("len_in", msg,
      min: minOrLen
      max: max
    ) else message("len", msg,
      len: minOrLen
    ))
    @

  afterValue: ->
    ob = @_value
    schema = @schema
    len = ob and ob.length
    if schema and len
      i = 0
      while i < len
        ob[i] = schema.val(ob[i]).val()
        i++
    @

  validate: (callback) ->
    self = @
    er1 = undefined
    if (@_value == null || @_value == undefined || @_value.length == 0)
      er2 = @_validate (err) -> callback(err) if callback
    else
      er2 = @_validate (err) ->        
        er1 = self.schema and self._value and self._value.length and self.validateChild(err, callback) or null
        callback(err) if err and callback
      
    er1 or er2

  validateChild: (err, callback) ->
    iterate = ->
      item = ob[completed]
      schema.val(item).validate (err) ->
        _errors.on completed, err  if err
        next()
    next = ->
      completed++
      if completed is len
        done()
      else
        iterate()
    errors = -> _errors.ok and _errors or null
    done = ->
      e = errors()
      callback and callback(e)
      e
    ob = @_value
    completed = 0
    schema = @schema
    _errors = err or new error()
    len = ob.length
    iterate()
    return errors()

  @alias: Array
  @check: (obj) -> validator.isArray obj
  @from: (obj) -> obj

type.register 'array', type._array
