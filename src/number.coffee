# number and integer type.

validator = require "./validator"
type = require "./type"
message = require "./message"

class type._number extends type.Base
	min: (val, msg) ->
		@validator ( num ) ->
			num >= val
		, message("min", msg, count: val)
		@
	
	max: (val, msg) ->
		@validator ( num ) ->
			num <= val
		, message("max", msg, count: val)
		@
	
	enum: (items, msg) ->
		@_enum = items
		@validator ( num ) ->
			validator.contains( items, num )
		, message("enum", msg, items: items.join ",")
		@

	@alias: Number
	@check: ( obj ) -> validator.isNumber obj
	@from: ( obj ) ->
		return obj if validator.isNumber( obj )
		if validator.isString( obj )
			parsed = parseFloat( obj )
			if parsed.toString() == obj
				return parsed
			else
				return obj
		else
			obj

		#obj = parseFloat( obj )
		#if obj then obj else ( if obj == 0 then 0 else null )

type.register 'number', type._number

class type._integer extends type._number
	@check: ( obj ) -> validator.isNumber( obj ) && validator.mod( obj )
	
	@from: ( obj ) ->
		return obj if validator.isNumber( obj ) && validator.mod( obj )
		if validator.isString( obj )
			parsed = parseInt( obj, 10 )
			if parsed.toString() == obj
				return parsed
			else
				return obj
		else
			obj
		#obj = parseInt obj, 10
		#if obj then obj else ( if obj == 0 then 0 else null )


type.register 'integer', type._integer