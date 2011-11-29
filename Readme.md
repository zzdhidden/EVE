
EVE(Development)
=============================

A JavaScript object schema, processor and validation lib.

	var type = require("EVE").type;
	var schema = type.object({
		login: type.string().lowercase().trim().notEmpty().len(3,12).match(/^[a-zA-Z0-9]*$/).validator(function(val, done) {
			setTimout(function() {
				done(val != "admin");
			}, 100);
		}, "must be unique")
		, name: type.string().trim().notEmpty()
		, email: type.string().trim().notEmpty().email()
		, password: type.string().trim().notEmpty().len(6,12)
		, password_confirmation: type.string().trim().notEmpty().len(6,12).validator(function(val){
			return val == this.password;
		}, "must be equal to password")
		, birthday: type.date()
		, age: type.integer()
	});


## License 

Released under the MIT, BSD, and GPL Licenses.

Copyright (c) 2011 hidden &lt;zzdhidden@gmail.com&gt;

