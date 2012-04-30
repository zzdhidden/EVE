# Get twitter statuses and then automatic convert date string to date type

eve = require "../index"
type = eve.type
statuses = require "./fixtures/public_timeline.json"

statusSchema = type.object 
	created_at: type.date() 
	user:
		"profile_link_color": type.string()
		"created_at": type.date()

statuses = type.array( statusSchema ).val( statuses ).val()


statuses.forEach ( status ) ->
	#console.log typeof status.created_at
	console.log status.created_at + " " + status.text[0..20]
	console.log status.created_at.constructor

