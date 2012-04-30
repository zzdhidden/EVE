{assert, ok, fail, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual, eve} = require "./helper"

describe "validator", ->
  describe "version", ->
    it "should have version", ->
      ok eve.version

  describe "type", ->
    it "should recognise array", ->
      ok eve.validator.isArray([])

    it "should recognise function", ->
      ok eve.validator.isFunction(->
      )
      ok not eve.validator.isFunction(/d/)

    it "should recognise object", ->
      ok eve.validator.isObject({})
      ok not eve.validator.isObject("")
      ok not eve.validator.isObject([])
      ok not eve.validator.isObject(->
      )
      ok not eve.validator.isObject(/d/)
      ok not eve.validator.isObject(new Date())

    it "should recognise data", ->
      ok eve.validator.isDate(new Date())

    it "should recognise regexp", ->
      ok eve.validator.isRegExp(/d/)

    it "should recognise boolean", ->
      ok eve.validator.isBoolean(false)
      ok eve.validator.isBoolean(true)

    it "should recognise number", ->
      ok eve.validator.isNumber(1.2)
      ok eve.validator.isInteger(1)
      ok not eve.validator.isInteger(1.2)

  describe "email", ->
    it "should recognise email", ->
      ok eve.validator.isEmail("test@mail.com")
      ok eve.validator.isEmail("test.pub@mail.com")
      ok eve.validator.isEmail("test-pub@mail.com")
      ok not eve.validator.isEmail("test.mail.com")

  describe "url", ->
    it "should recognise url", ->
      ok eve.validator.isUrl("http://g.com")
      ok eve.validator.isUrl("https://g.com")
      ok eve.validator.isUrl("https://g.cn")
      ok eve.validator.isUrl("g.cn")

  describe "len", ->
    it "should check right length of string", ->
      ok eve.validator.len("100", 3)
      ok not eve.validator.len("100", 2, "4")
      ok eve.validator.len("100", 3, 4)
      ok not eve.validator.len("100", 4)

    it "should check right length of array", ->
      ok eve.validator.len([ 1, 3, 4 ], 3)
      ok eve.validator.len([ 1, 3, 4 ], 3, 4)
      ok not eve.validator.len([ 1, 3, 4 ], 4)
