objectPath = (obj, selector) ->
  @obj = obj
  @selector = selector.split "."
  @

validator = require "./validator"
type = require "./type"
message = require "./message"
error = require "./error"

class type._object extends type.Base
  constructor: (schema) ->
    super()
    self = @
    @original_schema = schema
    ar = self.schema = []
    push = (path, val) ->
      sc = type(val)
      if sc
        ar.push [ path, sc ]
      else if validator.isArray(val) and type.array
        ar.push [ path, type.array.apply(null, val) ]  if path
      else if validator.isObject(val)
        for key, v of val
          push (if path then (path + "." + key) else key), v
    
    push null, schema

  clone: ->
    new_schema = {}
    for k,v of @original_schema
      new_schema[k] = v.clone()
    obj = new @constructor new_schema
    for key, val of @
      if @hasOwnProperty(key) && key != '_value' && key != 'schema'
        obj[key] = val
    return obj

  afterValue: ->
    ob = @_value
    schema = @schema
    len = schema.length
    i = 0

    while i < len
      sc = schema[i]
      path = new objectPath(ob, sc[0])
      if path.exists()
        path.set sc[1].value(path.get()).value()
      else
        default_ = sc[1].value(null).value()
        if default_
          path.set default_
        else
          sc[1].value null
      i++
    @

  validate: (callback) ->
    self = @
    er1 = undefined
    er2 = @_validate (err) -> er1 = self.validateChild(err, false, callback)
    er1 or er2

  validateChild: (err, ignoreUndefined, callback) ->
    ob = @_value
    completed = 0
    schema = @schema
    _errors = err or new error()
    len = schema.length
    iterate = ->
      sc = schema[completed]
      path = new objectPath(ob, sc[0])
      return next() if ob == null
      return next()  if ignoreUndefined and not path.exists()
      sc[1].context(ob).validate ((err) ->
        _errors.on sc[0], err  if err
        next()
      ), ignoreUndefined
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
    iterate()
    return errors()

  @alias: Object
  @check: (obj) -> validator.isObject obj
  @from: (obj) -> (if validator.exists(obj) then (if validator.isObject(obj) then obj else obj) else obj)
  @path: objectPath

hasOwnProperty = Object::hasOwnProperty
objectPath::exists = ->
  val = @obj
  selector = @selector
  i = 0
  len = selector.length

  while i < len
    key = selector[i]
    return false  if not val or not hasOwnProperty.call(val, key)
    val = val[key]
    i++
  true

objectPath::get = ->
  val = @obj
  selector = @selector
  i = 0
  len = selector.length

  while i < len
    key = selector[i]
    return `undefined`  if not val or not hasOwnProperty.call(val, key)
    val = val[key]
    i++
  val

objectPath::set = (value) ->
  val = @obj
  selector = @selector
  return  unless val
  i = 0
  len = selector.length

  while i < len
    key = selector[i]
    if i is (len - 1)
      val[key] = value
    else
      val[key] = {}  unless val[key]
      val = val[key]
    i++

type.register 'object', type._object