# i18n from:
# https://github.com/svenfuchs/rails-i18n/tree/master/rails/locale

class Message
	msg: (key, msg, args) ->
		str = (msg && ("" + msg)) || (@dictionary[@_locale] && @dictionary[@_locale][key]) || "is invalid"
		str = str.replace /\{\{(.*?)\}\}/g, (a,b) -> args[b] || "" if str && args

	constructor: () ->
		@dictionary = {}
		@_locale = 'en-US'
		@store "en-US",
			"invalid": "is invalid",
			"required": "is required",
			"notEmpty": "can't be empty",
			"len": "should have length {{len}}",
			"wrongType": "should be a {{type}}"
			"len_in": "should have max length {{max}} and min length {{min}}",
			"match": "should match {{expression}}",
			"email": "must be an email address",
			"url": "must be a url",
			"min": "must be greater than or equal to {{count}}",
			"max": "must be less than or equal to {{count}}",
			"taken": "has already been taken",
			"enum": "must be included in {{items}}"

	locale: ( name ) ->
		if !arguments.length
			#getter
			return @_locale

		#Store messages in message-en-US.js
		path = __dirname + "/message-" + name + ".js"
		try
			require path
		catch e
		@_locale = name

	store: (locale, data) ->
		@dictionary[locale] = {} if typeof @dictionary[locale] != "object"
		if data && typeof data == "object"
			@dictionary[locale][key] = val for key, val of data

fn = (key, msg, args) -> fn.message.msg key, msg, args
fn.message = new Message()

module.exports = fn
