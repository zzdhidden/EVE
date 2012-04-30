# any type
# required,notEmpty,default,validator,processor

validator = require "./validator"
message = require "./message"
error = require "./error"
moduler = require './moduler'

# map key -> type 
#  type( Date ) => type.date()
#
_mapper = {} 

process = (schema, val, context) ->
  processors = schema.processors
  len = processors.length
  fn = (processor) -> val = processor.call(context || null, val)
  fn processor for processor in processors
  val

type = module.exports = ( key ) ->
  if key && key.type && type[key.type] && key instanceof type["_" + key.type]
    #Check type
    return key
  if _mapper[key]
    key = _mapper[key]
  else 
    key = null
  
  return key && type[ key ] && type[ key ]() || null

class type.Base
  constructor: () ->
    @_default = null
    @_value = null
    @_required = false
    @_notEmpty = false
    @validators = []
    @processors = []
    @type = @constructor.type
    @value = @valFn
    @val = @valFn
  
  clone: ->
    obj = new @constructor()
    for key, val of @
      if @hasOwnProperty(key) && key != '_value'
        obj[key] = val
    return obj


  required: ( msg ) ->
    @_required = message("required", msg)
    return @
  
  notEmpty: ( msg ) ->
    @_notEmpty = message("notEmpty", msg)
    return @
  
  # Set/Get default value
  default: (value) ->
    if( !arguments.length ) 
      return if (typeof @_default == 'function') then @_default() else @_default
    @_default = value
    return @
  
  # Set/Get alias value
  alias: ( value ) ->
    if( !arguments.length ) 
      return if (typeof @_alias == 'function') then @_alias() else @_alias
    @_alias = value
    return @
  
  context: ( context ) ->
    @_context = context
    return @
  
  validator: (fn, msg) ->
    @validators.push([fn, message("invalid", msg)])
    return @
  
  processor: (fn) ->
    @processors.push(fn)
    return @
  
  _validate: ( callback ) -> validate @, @_value, callback, @_context
  validate: ( callback ) -> @_validate callback
  process: () -> @_value = process @, @_value
  exists: -> @required

  valFn: (value) ->
    return @_value if !arguments.length
    if validator.exists(value)
      #value = value 
    else 
      value = (@default() || value)
    if (typeof @constructor.from == "function") 
      @_value = @constructor.from( value )       
    else 
      @_value = value
    @process()
    @afterValue && @afterValue()
    return @

  @check: () -> true
  @from: (val) -> val

validate = (schema, val, callback, context) ->
  validators = schema.validators
  len = validators.length
  required = schema._required
  notExists = !validator.exists val
  notEmpty = schema._notEmpty
  completed = 0
  _errors = new error()
  _errors.alias schema.alias()
  errors = () -> _errors.ok && _errors || null
  done = () ->
    e = errors()
    validator.isFunction( callback ) && callback(e)
    e

  #Check required
  if required && notExists
    _errors.push required
    return done()
  
  if notExists
    return done()

  if !schema.constructor.check(val)
    _errors.push message("wrongType", "", type: schema.constructor.name)
    return done()

  #Check empty
  if notEmpty && !validator.notEmpty(val)
    _errors.push( notEmpty )
    return done()

  if !len
    return done()

  iterate = () ->
    __validator = validators[completed]
    fn = __validator[0]
    msg = __validator[1]
    async = true
    stopWhenError = __validator[2]
    #async
    valid = fn.call context || null, val, (ok) ->
      if ( !async ) then return
      if(!ok)
        _errors.push( msg )
        if( stopWhenError ) then return done()
      next()
    
    #sync valid
    if typeof valid == "boolean"
      async = false
      if !valid
        _errors.push msg
        if stopWhenError then return done()
      next()

  next = () =>
    completed++
    if( completed == len ) 
      done()
    else
      iterate()

  iterate()
  return errors()

type.register = (name, klass) ->
  klass.type = name
  _mapper[klass.alias] = name if klass.alias 
  type[name] = (args) -> return new klass(args)

class type._any extends type.Base

type.register 'any', type._any