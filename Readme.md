EVE(Development)
=============================

A JavaScript object schema, processor and validation lib.

![EVE](https://github.com/zzdhidden/EVE/raw/master/eve.png)

	var schema = type.object({
		login: 
			type.string()
			.lowercase().trim()
			.notEmpty().len(3,12)
			.match(/^[a-zA-Z0-9]*$/)
			.validator(function(val, done) {
				setTimeout(function() {
					done(val != "admin");
				}, 100);
			}, "must be unique")
		, name: 
			type.string()
			.trim().notEmpty()
		, email: 
			type.string()
			.trim().notEmpty()
			.email()
		, password: 
			type.string()
			.trim().notEmpty()
			.len(6,12)
		, password_confirmation: 
			type.string()
			.trim().notEmpty()
			.len(6,12)
			.validator(function(val){
				return val == this.password;
			}, "must be equal to password")
		, birthday: 
			type.date()
		, age: 
			type.integer()
	});

Run 

	cake browser-tests

to build and serve the browser tests.

## License 

Released under the MIT, BSD, and GPL Licenses.

Copyright (c) 2011 hidden &lt;zzdhidden@gmail.com&gt;


[evepngfrom]: http://9yart.cn/a/201003/24058.html
