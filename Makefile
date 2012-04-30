
test:
	@NODE_ENV=test ./node_modules/.bin/mocha --compilers coffee:coffee-script --slow 20 --growl \
		./test/*.test.coffee 

.PHONY: test
