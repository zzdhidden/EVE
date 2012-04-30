{assert, ok, fail, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual, eve} = require "./helper"
if (typeof window) != 'undefined'
  require './../lib/message-zh-CN.js'

describe "message", ->
  message = eve.message
  it "should have message", ->
    ok message

  it "should be able to set/get locale", ->
    message.message.locale "en-US"
    equal message.message.locale(), "en-US"
    message.message.locale "zh-CN"
    ok message.message.dictionary["zh-CN"]
    ok message.message.dictionary["zh-CN"]["invalid"]

  it "should be able to store message", ->
    message.message.store "test",
      invalid: "invalid"

    message.message.locale "test"
    equal message("invalid"), "invalid"

  it "should support default message", ->
    equal message("invalid", "default message"), "default message"

  it "should replace options", ->
    message.message.store "test",
      invalid: "invalid {{msg}}"

    message.message.locale "test"
    equal message("invalid", null,
      msg: "test"
    ), "invalid test"
