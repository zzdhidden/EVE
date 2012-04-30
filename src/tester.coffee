_ = require 'underscore'

console.log _.isEmpty({})
return

mix = (A, B) ->
  B.prototype.prototype = A.prototype
  x1 = {}
  x1.prototype = A.prototype

  x2 = {}
  x2.prototype = 
  A.prototype = B.prototype
  

Function::include = (argv...) ->
  for cl in argv
    for key, value of cl::
      @::[key]=value
  @

Function::extend = (argv...) ->
  for cl in argv
    for key, value of cl::
      @[key]=value
  @


class Tester1
  constructor: (name) -> 
    @name = name
  my_name: -> 
    console.log "Tester1 name is " + @name

class Tester2
  constructor: (name) -> 
    @name = name
  my_name: -> 
    console.log "Tester2 name is " + @name
  other: -> console.log "other"

class C
  constructor: (name) -> 
    @name = name
  @include Tester1, Tester2

class D
  constructor: (name) -> 
    @name = name
  @extend Tester2


#c = new C 'C'
#c.other()
#c.my_name()

#D.other()


class T
  constructor: (num=0) ->
    @num = num
    if num == 1
      @child = new arguments.callee
    #console.log arguments.callee.toString()

  cal: () ->
    console.log @
    #console.log arguments.callee.toString()

#t = new T 1
#t.cal()


class S
  constructor: () ->
    @c = () ->
      console.log @
    @a = "b"
    @prot = arguments.callee.prototype

  s: () ->
    console.log @
    @c()


s = new S
console.log s.constructor.prototype
#s.c()
#s.s()

#p = class extends S
#s = new p
#s.c()

#mix t1, t2
#t1.my_name()
#console.log t1.prototype
#console.log t2.prototype

#mix Tester1, Tester2
#console.log Tester1.prototype

#t1 = new Tester1

#t1.other()




#b = new Tester false
#b.type 'hiho'

