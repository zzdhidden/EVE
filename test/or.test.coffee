{assert, ok, fail, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual, eve} = require "./helper"

type = eve.type

describe "type", ->

  beforeEach ->
    @schema = type.or([ type.string().lowercase().notEmpty().len(3, 12), type.string().trim().notEmpty().email() ]) 

  describe "or", ->
    it "should have or type", ->
      ok type.or

    it "should process value a", ->
      val = @schema.val("Test").val()
      equal val, "test"
      ok not @schema.validate()

    it "should process value a for clones ", ->
      sc = @schema.clone()
      val = sc.val("Test").val()
      equal val, "test"
      ok not sc.validate()

    it "should process value b", ->
      val = @schema.val("Ddddddddddddddddddddddddt@g.com ").val()
      equal val, "Ddddddddddddddddddddddddt@g.com"
      ok not @schema.validate()

    it "should process value b for clone", ->
      sc = @schema.clone()
      val = sc.val("Ddddddddddddddddddddddddt@g.com ").val()
      equal val, "Ddddddddddddddddddddddddt@g.com"
      ok not sc.validate()

    it "should be able be required itself", ->
      schema = type.object(login: type.or([ type.string().lowercase().notEmpty().len(3, 12), type.string().trim().notEmpty().email() ]).required())
      schema.val nologin: "t"
      errs = schema.validate((errs) ->
        ok errs
        equal errs.messages().length, 1
      )
      ok errs
      schema.val login: "test"
      errs = schema.validate()
      ok not errs

    it "should validate if not required", ->
      schema = type.object(login: type.or([ type.string().lowercase().notEmpty().len(3, 12), type.string().trim().notEmpty().email() ]))
      schema.val nologin: "t"
      errs = schema.validate()
      ok not errs

    it "should be able to validate if both fails", (done) ->
      @schema.val ""
      errs = @schema.validate((errs) ->
        ok errs
        equal errs.messages().length, 2
        done()
      )
      ok errs

    it "should be able to validate if one is valid", (done) ->
      @schema.val "test"
      errs = @schema.validate((errs) ->
        ok not errs
        done()
      )

    it "should be able to validate if both are valid", (done) ->
      @schema.val "ddddt@g.com"
      errs = @schema.validate((errs) ->
        ok not errs
        done()
      )

    it "should validate objects", ->
      schema = type.or([ type.object(
        login: type.string().trim().lowercase().notEmpty().len(3, 12)
        email: type.string().trim().notEmpty().email()
      ) ])
      val = schema.val(
        login: " Test "
        email: "t@g.com"
      ).val()
      equal val.login, "test"
      ok not schema.validate()

    it "should validate invalid objects", (done) ->
      schema = type.or([ type.object(
        login: type.string().trim().lowercase().notEmpty().len(3, 12)
        email: type.string().trim().notEmpty().email()
      ) ])
      schema.val
        login: "t"
        email: "g.com"

      errs = schema.validate((errs) ->
        ok errs
        equal errs.messages().length, 2
        done()
      )
      ok errs

    it "should validate invalid objects for clones", (done) ->
      schema = type.or([ type.object(
        login: type.string().trim().lowercase().notEmpty().len(3, 12)
        email: type.string().trim().notEmpty().email()
      ) ]).clone()
      schema.val
        login: "t"
        email: "g.com"

      errs = schema.validate((errs) ->
        ok errs
        equal errs.messages().length, 2
        done()
      )
      ok errs

    it "should be able to validate async", (done) ->
      schema = type.or([ type.string().validator((val, next) ->
        setTimeout (->
          next val isnt "admin"
        ), 100
      , "must not be admin"), type.string().trim().email().validator((val, next) ->
        setTimeout (->
          next val.length isnt 5
        ), 100
      , "must not have 5 chars") ])
      schema.val("admin").validate (errs) ->
        ok errs
        equal errs.messages().length, 3
        done()

    it "should support custom validators", ->
      schema = type.or([ type.string().validator((val) ->
        ok this
        equal val, "admin"
        true
      ) ])
      schema.val("admin").validate()
