# date type.
#
# date from number,date,string

validator = require "./validator"
type = require "./type"
message = require "./message"

class type._date extends type.Base
	@alias: Date
	@check: (obj) -> validator.isDate obj
	@from: (obj) ->
		return obj if obj instanceof Date
			
		if 'string' == typeof obj
			#number
			if "" + parseInt(obj, 10) == obj
				return new Date parseInt(obj, 10) * Math.pow(10, 13 - obj.length)
			if obj.length == 14
				return new Date obj.obj.replace(/^(\d\d\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/, "$1-$2-$3 $4:$5:$6")

			#TODO: test rfc3339 for browser IE...
			time = Date.parse obj
			return if time then new Date time else obj

		if 'number' == typeof obj
			return new Date obj * Math.pow(10, 13 - ("" + obj).length)
		
		return obj

type.register 'date', type._date