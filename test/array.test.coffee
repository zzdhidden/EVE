{assert, ok, fail, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual, eve} = require "./helper"

describe "type", ->
  type = eve.type
  describe "array", ->
    it "should have array type", ->
      ok type.array

    it "should be able to convert type", ->
      deepEqual type.array().val([ 1, 2, 3 ]).val(), [ 1, 2, 3 ]

    it "should be able to validate length", ->
      err = type.array().len(5).val([ 1, 2, 3 ]).validate()
      ok err
      equal err.messages().length, 1
      err = type.array().len(4, 5).val([ 1, 2, 3 ]).validate()
      ok err
      equal err.messages().length, 1

    it "should have item schema", ->
      schema = type.array(type.number().max(2)).len(5).val([ 1, "2", 3 ])
      deepEqual schema.val(), [ 1, 2, 3 ]
      errs = schema.validate((errs) ->
        equal errs.messages().length, 2
      )
      equal errs.messages().length, 2

    it "should validate required if required and embedded in object", ->
      schema = type.object(test: type.array(type.number().required()).required()).required()
      errs = schema.val(test2: [ "a" ]).validate((errs) ->
        ok errs
        equal errs.messages().length, 1
      )
      ok errs
      equal errs.messages().length, 1

    it "should be an array if embedded in object", ->
      schema = type.object(test: type.array().required()).required()
      errs = schema.val(test: 3).validate((errs) ->
        ok errs
        equal errs.messages().length, 1
      )
      ok errs
      equal errs.messages().length, 1

    it "should be an array", ->
      schema = type.array()
      errs = schema.val({}).validate((errs) ->
        ok errs
        equal errs.messages().length, 1
      )
      ok errs
      equal errs.messages().length, 1
      errs = schema.val(2).validate((errs) ->
        ok errs
        equal errs.messages().length, 1
      )
      ok errs
      equal errs.messages().length, 1
      errs = schema.val("").validate((errs) ->
        ok errs
        equal errs.messages().length, 1
      )
      ok errs
      equal errs.messages().length, 1

    it "should raise if empty", ->
      schema = type.object(test: type.array(type.number().required()).notEmpty()).required()
      errs = schema.val(test: []).validate((errs) ->
        ok errs
        equal errs.messages().length, 1
      )
      ok errs
      equal errs.messages().length, 1

    it "should validate inner object", ->
      schema = type.array(type.object(login: type.string().required())).val([{nologin: true},{login: true},{nologin: true}])
      errs = schema.validate((errs) ->
        ok errs
        equal errs.messages().length, 3
      )
      ok errs
      equal errs.messages().length, 3

    it "should have item schema of clone", ->
      schema = type.array(type.number().max(2)).len(5).clone().val([ 1, "2", 3 ])
      deepEqual schema.val(), [ 1, 2, 3 ]
      errs = schema.validate((errs) ->
        equal errs.messages().length, 2
      )
      equal errs.messages().length, 2

    it "should be able to recognize type alias", ->
      data = type.array(login: String).val([ login: "123" ]).val()
      strictEqual data[0].login, "123"
