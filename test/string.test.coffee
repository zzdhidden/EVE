{assert, ok, fail, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual, eve} = require "./helper"

describe "type", ->
  describe "string", ->
    type = eve.type
    it "should have string type", ->
      ok type.string

    schema = type.string().lowercase().trim().notEmpty().len(3, 12).match(/^[a-zA-Z0-9]*$/).validator((val, done) ->
      setTimeout (->
        done val isnt "admin"
      ), 100
    )
    it "should trim and lowercase", ->
      equal schema.val(" Test ").val(), "test"

    it "should have length in 3~12", ->
      ok schema.val("dd").validate()
      ok type.string().len(3).val("dd").validate()
      ok not schema.val("test").validate()

    it "should be a valid match", ->
      ok schema.val("test-").validate()

    it "should be unique", (done) ->
      schema.val("admin").validate (err) ->
        ok err and err.messages()
        done()

    it "should be an email address", (done) ->
      type.string().email().val("dd").validate (err) ->
        ok err and err.messages()

      type.string().email().val("sdf@wer.com").validate (err) ->
        ok not err

      type.string().email("be an email").val("dd").validate (err) ->
        ok err
        equal err.messages().length, 1
        equal err.messages(true)[0], "be an email"
        done()

      ok type.string().email()._email

    it "should handle 'required' seperate from 'notEmpty'", (done) ->
      type.string().notEmpty().val(null).validate (err) ->
        ok not err

      type.string().notEmpty().val("").validate (err) ->
        ok err

      done()

    it "should be a url", ->
      type.string().url().val("http").validate (err) ->
        ok err and err.messages()

      type.string().url().val("http://google.com").validate (err) ->
        ok not err

      ok type.string().url()._url

    it "should be a string", ->
      type.string().val(new Date()).validate (err) ->
        ok err and err.messages()

      type.string().val({}).validate (err) ->
        ok err and err.messages()

      type.string().val([]).validate (err) ->
        ok err and err.messages()

    it "should convert numbers", ->
      type.string().val(4).validate (err) ->
        ok not err

      type.string().val(4.5).validate (err) ->
        ok not err

    it "should support enum validate", ->
      ok not type.string().enum([ "male", "famale" ]).val("male").validate()
      ok type.string().enum([ "male", "famale" ]).val("other").validate()
      sc = type.string().enum([ "a", "b" ])
      equal "a", sc._enum[0]
      equal "b", sc._enum[1]
