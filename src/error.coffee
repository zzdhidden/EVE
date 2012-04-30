validator = require "./validator"

class error extends Error
	constructor: () ->
		Error.call @
		Error.captureStackTrace && Error.captureStackTrace @, arguments.callee
		@ok = false
		@name = 'EveError'
		@_messages = []
		@_hasChildren = false
		@_children = {}

	toString: () -> @name + ': ' + @message
	alias: (name) -> @_alias = name
	push: ( msg ) ->
		@_messages.push msg
		@message = @concat @message, (if @_alias then @_alias + " " else "") + msg
		@ok = true

	on: ( key, er ) ->
		l = arguments.length
		return @_children[ key ] || null if l == 1
		if er instanceof error
			@_hasChildren = true
			@ok = er.ok if !@ok
			@_children[ key ] = er
			@message = @concat @message, er.message

	at: on

	messages: ( withoutName ) ->
		messages = []
		name = if withoutName then '' else @_alias || ''
		name = if name then name + " " else ""
		messages.push( name + msg ) for msg in @_messages
		if ( @_hasChildren )
			@merge messages, val.messages(withoutName) for key, val of @_children
		if messages.length then messages else null

	concat: (s1, s2) -> if s1 && s2 then s1 + "\n" + s2 else s1 || s2
	merge: (ar1, ar2) ->
		return if !ar2
		ar1.push val for val in ar2

module.exports = error