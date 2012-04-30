{assert, ok, fail, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual, eve} = require "./helper"

describe "type", ->
  type = eve.type
  describe "number", ->
    it "should have number type", ->
      ok type.number

    it "should convert type", ->
      strictEqual type.number().val("23dd").val(), "23dd"
      strictEqual type.number().val("23.11").val(), 23.11
      strictEqual type.number().val(23.11).val(), 23.11

    it "should be able to compare", ->
      ok not type.number().min(10).max(30).val(23.11).validate()
      ok type.number().min(10).max(30).val(9).validate()
      ok type.number().min(10).max(30).val(40).validate()

    it "should not accept empty numbers", ->
      ok type.number().notEmpty().val(0).validate()
      ok type.number().notEmpty().val(0.0).validate()
      ok not type.number().notEmpty().val(1).validate()

  describe "integer", ->
    it "should have integer type", ->
      ok type.integer

    it "should convert type", ->
      strictEqual type.integer().val("23dd").val(), "23dd"
      strictEqual type.integer().val("23.11").val(), "23.11"
      strictEqual type.integer().val("23").val(), 23
      strictEqual type.integer().val(23.11).val(), 23.11
      strictEqual type.integer().val("sfd").val(), "sfd"
      strictEqual type.integer().val(null).val(), null
      strictEqual type.integer().val(0).val(), 0

    it "should support enum validate", ->
      ok not type.integer().enum([ 1, 2, 3 ]).val(1).validate()
      ok type.integer().enum([ 1, 2, 3 ]).val(0).validate()
      sc = type.integer().enum([ 2, 4 ])
      equal 2, sc._enum[0]
      equal 4, sc._enum[1]
