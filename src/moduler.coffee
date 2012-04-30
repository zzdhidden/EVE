# modules

Function::includer = (obj, argv...) ->
  for cl in argv
    for key, value of cl::
      obj::[key]=value
  obj

Function::extender = (obj, argv...) ->
  for cl in argv
    for key, value of cl::
      obj[key]=value
  obj


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

fn = 
  includer: (obj, argv...) ->
    for cl in argv
      for key, value of cl::
        obj::[key]=value
    obj

  extender: (obj, argv...) ->
    for cl in argv
      for key, value of cl::
        obj[key]=value
    obj

  mixer: (obj, argv...) ->
    for cl in argv
      for key, value of cl
        obj[key]=value
    obj

module.exports = fn