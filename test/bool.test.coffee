{assert, ok, fail, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual, eve} = require "./helper"

describe "type", ->
  type = eve.type
  describe "bool", ->
    it "should have bool type", ->
      ok type.bool

    it "should convert type", ->
      strictEqual type.bool().val(" true ").val(), true
      strictEqual type.bool().val(" Tr_ue").val(), " Tr_ue"
      strictEqual type.bool().val("fAlse ").val(), false

    it "should validate", ->
      ok type.bool().val("test").validate()
      ok not type.bool().val(true).validate()
      ok not type.bool().val(false).validate()
      ok not type.bool().val("false").validate()
      ok not type.bool().val("true").validate()

    it "should pass not required bools", ->
      ok not type.bool().val(`undefined`).validate()
      ok not type.bool().val(null).validate()

    it "should raise on required bools", ->
      ok type.bool().required().val(`undefined`).validate()
      ok type.bool().required().val(null).validate()
