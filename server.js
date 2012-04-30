/*
  a simple static file server to serve the browser tests
*/

var static = require('node-static');
var url = require('url');
var port = process.argv[2] || 8888;
var file = new(static.Server)('./');

require('http').createServer(function (request, response) {
  request.addListener('end', function () {
    var uri = url.parse(request.url).pathname;

    if(uri == '' || uri == '/'){
      response.writeHead(302, {"Location": "/test"});
      response.end();
      return;
    }

    file.serve(request, response);
  });
}).listen(parseInt(port, 10));

console.log("Serving Browser Tests at\n\thttp://localhost:" + port + "/\nCTRL + C to shutdown");
