# string type.


validator = require "./validator"
type = require "./type"
message = require "./message"
_trimRe = /^\s+|\s+$/g
_trim = String.prototype.trim

trim = (val) -> val && if _trim then _trim.call val else val.replace _trimRe, ""

class type._string extends type.Base

	len: ( minOrLen, max, msg ) ->
		last = arguments[ arguments.length - 1 ]
		msg = if typeof last == "number" then null else last
		@validator (( str ) -> validator.len str, minOrLen, max),
			if (typeof max == "number" ) 
			then message("len_in", msg, min: minOrLen, max: max)
			else message("len", msg, len: minOrLen)
		@

	match: ( re, msg ) ->
		@validator (( str ) -> if str && str.match re then true else false ), 
			message("match", msg, expression: "" + re)
		@
		
	enum: (items, msg) ->
		@_enum = items
		@validator (( str ) -> validator.contains items, str ),
			message("enum", msg, items: items.join ",")
		@
	
	email: ( msg ) ->
		@_email = true
		@validator (( str ) -> if str && validator.isEmail(str) then true else false ), message("email", msg)
		@
	
	url: ( msg ) ->
		@_url = true
		@validator (( str ) -> if str && validator.isUrl(str) then true else false ), message("url", msg)
		@
	
	lowercase: () -> 
		@processors.push (str) -> if str then str.toLowerCase() else str
		@

	uppercase: () -> 
		@processors.push (str) -> if str then str.toUpperCase() else str
		@

	trim: () -> 
		@processors.push (str) -> if str then trim str else str
		@

	@alias: String
	@check: (obj) -> validator.isString obj
	@from: (obj) -> 
		if validator.isNumber(obj)
			obj.toString()
		else
			obj

type.register 'string', type._string