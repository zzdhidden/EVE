validator = require "./validator"
type = require "./type"
message = require "./message"
error = require "./error"

class type._and extends type.Base
  constructor: (schemas) ->
    super()
    self = @
    self.schemas = schemas

  clone: ->
    cloned_schemas = []
    for schema in @schemas
      cloned_schemas.push schema.clone()
    obj = new @constructor(cloned_schemas)
    for key, val of @
      if @hasOwnProperty(key) && key != '_value' && key != 'schemas'
        obj[key] = val
    return obj

  validate: (callback) ->
    self = @
    er1 = undefined
    if (@_value == null || @_value == undefined)
      er2 = @_validate (err) -> 
        callback(err) if callback
    else
      er2 = @_validate (err) -> er1 = self.validateChild(err, callback)
    er1 or er2

  afterValue: ->
    @validate()
    if @_valid_schemas
      for sc in @_valid_schemas
        @_value = sc.val(@_value).val()
    @

  validateChild: (err, callback) ->
    ob = @_value
    self = @
    completed = 0
    schemas = @schemas
    _errors = err or new error()
    len = schemas.length
    @_valid_schemas = []

    iterate = ->
      sc = schemas[completed]
      sc.val(ob).validate (err) ->        
        self._valid_schemas.push sc unless err
        _errors.on completed, err  if err
        next()
    next = ->
      completed++
      return done() if completed is len
      iterate()
    errors = -> 
      return null if self._valid_schemas.length is len
      _errors.ok and _errors or null
    done = ->
      e = errors()
      callback and callback(e)
      e
    iterate()
    return errors()

#  @alias: Or

type.register 'and', type._and