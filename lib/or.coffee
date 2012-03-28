validator = require "./validator"
type = require "./type"
message = require "./message"
error = require "./error"

class type._or extends type.Base
  constructor: (schemas) ->
    super()
    self = @
    self.schemas = schemas

  validate: (callback) ->
    self = @
    er1 = undefined
    er2 = @_validate (err) -> er1 = self.validateChild(err, callback)
    er1 or er2

  afterValue: ->
    @validate()
    @_value = @_valid_schema.val(@_value).val() if @_valid_schema
    @

  validateChild: (err, callback) ->
    ob = @_value
    self = @
    completed = 0
    schemas = @schemas
    _errors = err or new error()
    len = schemas.length
    @_valid_schema = undefined

    iterate = ->
      sc = schemas[completed]
      sc.val(ob).validate (err) ->        
        unless err
          self._valid_schema = sc
          return next()
        else
        _errors.on completed, err  if err
        next()
    next = ->
      completed++
      if self._valid_schema or completed is len
        done()
      else
        iterate()
    errors = -> 
      return null if self._valid_schema
      _errors.ok and _errors or null
    done = ->
      e = errors()
      callback and callback(e)
      e
    iterate()
    return errors()

#  @alias: Or

type.register 'or', type._or