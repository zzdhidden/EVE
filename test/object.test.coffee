{assert, ok, fail, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual, eve} = require "./helper"

describe "type", ->
  type = eve.type
  describe "object", ->
    it "should have object type", ->
      ok type.object

    schema = type.object(
      login: type.string().trim().lowercase().notEmpty().len(3, 12)
      email: type.string().trim().notEmpty().email()
    )
    it "should process value", ->
      val = schema.val(
        login: " Test "
        email: "t@g.com"
      ).val()
      equal val.login, "test"
      ok not schema.validate()

    it "should process value of clone", ->
      sc = schema.clone()
      val = sc.val(
        login: " Test "
        email: "t@g.com"
      ).val()
      equal val.login, "test"
      ok not sc.validate()

    it "should be able to validate", (done) ->
      schema.val
        login: "t"
        email: "g.com"

      errs = schema.validate((errs) ->
        ok errs
        equal errs.messages().length, 2
        done()
      )
      ok errs

    it "should be able to validate clone", (done) ->
      sc = schema.clone()
      sc.val
        login: "t"
        email: "g.com"

      errs = sc.validate((errs) ->
        ok errs
        equal errs.messages().length, 2
        done()
      )
      ok errs

    it "should be able to validate async", (done) ->
      schema = type.object(
        login: type.string().validator((val, next) ->
          setTimeout (->
            next val isnt "admin"
          ), 100
        , "must be unique")
        email: type.string().trim().email().validator((val, next) ->
          setTimeout (->
            next val isnt "t@g.com"
          ), 100
        , "must be unique")
      )
      schema.val(
        login: "admin"
        email: "t@g.com"
      ).validate (errs) ->
        ok errs
        equal errs.messages().length, 2
        done()

    it "should allow a not required inner object that is not empty when it exists", (done) ->
      schema = type.object(login: type.object(inner: type.string()).notEmpty())
      errs = schema.val(other: {}).validate()
      ok not errs
      errs = schema.val(login: {}).validate()
      ok errs
      done()

    it "should allow a not required inner object even if it has required attributes", (done) ->
      schema = type.object(login: type.object(inner: type.string().required()))
      errs = schema.val(login: {}).validate()
      ok errs
      errs = schema.val(other: {}).validate()
      ok not errs
      done()

    it "should validate an object within an invalid object", (done) ->
      schema = type.object(test: type.object(
        login: type.string().trim().lowercase().notEmpty().len(3, 12)
        email: type.string().trim().notEmpty().email()
      ))
      schema.val(test:
        login: "admin"
        email: "tg.com"
      ).validate (errs) ->
        ok errs
        equal errs.messages().length, 1
        done()

    it "should validate an object within a valid object", (done) ->
      schema = type.object(test: type.object(
        login: type.string().trim().lowercase().notEmpty().len(3, 12)
        email: type.string().trim().notEmpty().email()
      ))
      schema.val(test:
        login: "admin"
        email: "t@g.com"
      ).validate (errs) ->
        ok not errs
        done()

    it "should add defaults to inner objects", (done) ->
      schema = type.object(test: type.object(
        login: type.string().default('a').required()
        email: type.string().default('a@example.com').required().email()
      ))
      obj = schema.val(test:
        login: "b"
      );
      obj.validate (errs, doc) ->
        equal obj.value().test.login, 'b'
        equal obj.value().test.email, 'a@example.com'
        ok not errs
        done()

    it "should be able to ignore undefined attribute", ->

    it "should be able to validate required attribute", (done) ->
      schema = type.object(login: type.string().required())
      schema.val nologin: "t"
      errs = schema.validate((errs) ->
        ok errs
        equal errs.messages().length, 1
        done()
      )
      ok errs

    it "should be able be required itself", ->
      schema = type.object(login: type.object(user: type.string().required()).required())
      schema.val nologin: "t"
      errs = schema.validate((errs) ->
        ok errs
        equal errs.messages().length, 1
      )
      ok errs
      schema.val login:
        user: "test"

      errs = schema.validate()
      ok not errs

    it "should support context in coustom validator", ->
      schema = type.object(login: type.string().validator((val) ->
        ok @login
        equal @login, "admin"
        true
      ))
      schema.val(login: "admin").validate()

    it "should output with alias", ->
      schema = type.object(
        login: type.string().alias("Login").trim().lowercase().notEmpty().len(3, 12)
        email: type.string().alias("Email").trim().notEmpty().email()
      )
      schema.val(
        login: "t"
        email: "e"
      ).validate (err) ->
        ok err
        msgs = err.messages()
        ok not msgs[0].indexOf("Login")
        ok not msgs[1].indexOf("Email")

    it "should be able to recognize type alias", ->
      schema = type.object(
        login: String
        email: String
      )
      strictEqual schema.val(login: "123").val().login, "123"
