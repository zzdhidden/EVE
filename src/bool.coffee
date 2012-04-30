# bool type.

validator = require "./validator"
type = require "./type"
message = require "./message"

_trimRe = /^\s+|\s+$/g
_trim = String.prototype.trim

trim = (val) -> val && if _trim then _trim.call val else val.replace _trimRe, ""

class type._bool extends type.Base
  constructor: () ->
    super()
    @validator ( val ) ->
      validator.isBoolean val
    , message("invalid")

  @check: ( obj ) -> validator.isBoolean obj
  
  @from: ( obj ) ->
    if validator.isString obj
      val = trim(obj).toLowerCase()
      return false if val == "false"
      return true if val == "true"
    return obj

type.register 'bool', type._bool

