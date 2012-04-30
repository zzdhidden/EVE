{assert, ok, fail, equal, notEqual, deepEqual, notDeepEqual, strictEqual, notStrictEqual, eve} = require "./helper"

describe "examples", ->
  describe "signup_user", ->
    type = eve.type
    user =
      login: "test"
      name: "Test"
      email: "test@mail.com"
      password: "test"
      password_confirmation: "test"
      birthday: "1990-1-1"
      age: "20"

    schema = type.object(
      login: type.string().lowercase().trim().notEmpty().len(3, 12).match(/^[a-zA-Z0-9]*$/).validator((val, done) ->
        setTimeout (->
          done val isnt "admin"
        ), 100
      , "must be unique")
      name: type.string().trim().notEmpty()
      email: type.string().trim().notEmpty().email()
      password: type.string().trim().notEmpty().len(6, 12)
      password_confirmation: type.string().trim().notEmpty().len(6, 12).validator((val) ->
        val is @password
      , "must be equal to password")
      birthday: type.date()
      age: type.integer()
    )
    schema.value(user).validate (errors) ->
      #ok !errors