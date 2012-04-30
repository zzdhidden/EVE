{assert, ok, fail, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual, eve} = require "./helper"

type = eve.type
message = eve.message
validator = eve.validator

validator.isGood =  (str) -> @isString(str) && str == 'good'

type._string::good = ( msg ) ->
  @_good = true
  @validator (( str ) -> str && validator.isGood(str) ), message("good", msg)
  @


class type._my extends type.Base
  constructor: () ->
    super()
    @validator ( val ) ->
      val == 'myval'
    , message("invalid")

type.register 'my', type._my

describe "extend", ->
  describe "my type", ->

    it "should have my type", ->
      ok( type.my )
    
    it "should validate", ->
      ok( type.my().required().value("other").validate() )
      ok( !type.my().required().value("myval").validate() )

    it "should check exist and empty", ->
      ok( type.my().required().value(null).validate() )
      ok( !type.my().required().value("myval").validate() )

      ok( !type.my().notEmpty().value(null).validate() )
      ok( type.my().notEmpty().value(" ").validate() )
    

    it "should return in callback", (done) ->
      type.my().required().value(null).validate (err) ->
        ok( err )
        done()
      
    it "should skip validator when empty", (done) ->
      type.my().validator( (val) ->
        return val == 10
      ).value(null).validate( (err) ->
        ok(!err)
        done()
      )

    it "should set default value", ->
      equal(type.my().default("myval").value(null).value(), "myval")
      equal(type.my().default("myval").value(undefined).value(), "myval")
    

    it "should can add a processor", ->
      schema = type.my().processor((val) ->
        return val + "-modified"
      )
      equal(schema.value("myval").value(), "myval-modified")
    
  describe "good string", ->
    it "should validate", ->
      ok( type.string().good().required().value("other").validate() )
      ok( !type.string().good().required().value("good").validate() )
