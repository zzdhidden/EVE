{assert, ok, fail, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual, eve} = require "./helper"

type = eve.type

describe "type", ->
  describe "any", ->

    it "should have any type", ->
      ok( type.any )
    

    it "should check exist and empty", ->
      ok( type.any().required().value(null).validate() )
      ok( !type.any().required().value("").validate() )

      ok( !type.any().notEmpty().value(null).validate() )
      ok( type.any().notEmpty().value("  ").validate() )
    

    it "should return in callback", (done) ->
      type.any().required().value(null).validate (err) ->
        ok( err )
        done()
      
    it "should skip validator when empty", (done) ->
      type.any().validator( (val) ->
        return val == 10
      ).value(null).validate( (err) ->
        ok(!err)
        done()
      )

    it "should can add sync validator", (done) ->
      schema = type.any().validator( (val) ->
          return val == 10
        , "equal 10")
      ok( schema.value(9).validate() )
      ok( !schema.value(10).validate() )
      schema.value(10).validate( (err) ->
        ok(!err)
        done() 
      )
    

    it "should can add async validator", (done) ->
      schema = type.any().notEmpty().validator(
        (val, done) ->
          setTimeout(->
              done( val == 10 )
            , 100)
        , "equal 10")
      schema.value(10).validate((err) ->
        ok(!err)
        done() 
      )
       

    it "should set default value", ->
      equal(type.any().default("ok").value(null).value(), "ok")
      equal(type.any().default("ok").value(undefined).value(), "ok")
    

    it "should can add a processor", ->
      schema = type.any().processor((val) ->
        return val * 2
      )
      equal(schema.value(10).value(), 20)
    

    it "should output mssage with alias", ->
      schema = type.any().alias("Name").notEmpty().validator((val) ->
          return false
        , "is invalid")
      err = schema.val("test").validate()
      ok( err )
      equal(err.messages()[0], "Name is invalid")
    
    it "should enable map Object to type", ->
      ok( type( String ) instanceof type._string )
      ok( type( type.string() ) instanceof type._string )
      ok( !type("not a type") )
