{assert, ok, fail, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual, eve} = require "./helper"

type = eve.type

describe "type", ->
  
  describe "and", ->

    beforeEach ->
      @schema = type.and([ type.string().lowercase().notEmpty().len(3, 12), type.string().trim().notEmpty().email() ])      

    it "should have and type", ->
      ok type.and

    it "should process values", ->
      val = @schema.val(" Test@g.com ").val()
      equal val, "test@g.com"
      ok not @schema.validate()

    it "should validate required if required and embedded in object", ->
      sc = type.object(test: type.and([ type.string().len(5), type.string().email() ]).required())
      errs = sc.val(test2: [ "a" ]).validate((errs) ->
        ok errs
        equal errs.messages().length, 1
      )
      ok errs
      equal errs.messages().length, 1

    it "should not validate required if not required and embedded in object", ->
      sc = type.object(test: type.and([ type.string().len(5), type.string().email() ]))
      errs = sc.val(test2: [ "a" ]).validate((errs) ->
        ok not errs
      )
      ok not errs

    it "should process values for clones", ->
      sc = @schema.clone()
      val = sc.val(" Test@g.com ").val()
      equal val, "test@g.com"
      ok not sc.validate()

    it "should be able to validate if both fails", (done) ->
      @schema.val ""
      errs = @schema.validate((errs) ->
        ok errs
        equal errs.messages().length, 2
        done()
      )
      ok errs

    it "should be able to validate if both fails for clones", (done) ->
      sc = @schema.clone()
      sc.val ""
      errs = sc.validate((errs) ->
        ok errs
        equal errs.messages().length, 2
        done()
      )
      ok errs

    it "should be able to validate if one is valid", (done) ->
      @schema.val "test"
      errs = @schema.validate((errs) ->
        ok errs
        equal errs.messages().length, 1
        done()
      )
      ok errs

    it "should be able to validate if one is valid for clones", (done) ->
      sc = @schema.clone()
      sc.val "test"
      errs = sc.validate((errs) ->
        ok errs
        equal errs.messages().length, 1
        done()
      )
      ok errs

    it "should be able to validate if both are valid", (done) ->
      @schema.val "ddddt@g.com"
      errs = @schema.validate((errs) ->
        ok not errs
        done()
      )

    it "should be able to validate if both are valid for clones", (done) ->
      sc = @schema.clone()
      sc.val "ddddt@g.com"
      errs = sc.validate((errs) ->
        ok not errs
        done()
      )

    it "should be able to validate async", (done) ->
      sc = type.and([ type.string().validator((val, next) ->
        setTimeout (->
          next val isnt "admin"
        ), 100
      , "must not be admin"), type.string().trim().email().validator((val, next) ->
        setTimeout (->
          next val.length isnt 5
        ), 100
      , "must not have 5 chars") ])
      sc.val("admin").validate (errs) ->
        ok errs
        equal errs.messages().length, 3
        done()

    it "should support custom validators", ->
      sc = type.and([ type.string().validator((val) ->
        ok this
        equal val, "admin"
        true
      ) ])
      sc.val("admin").validate()
