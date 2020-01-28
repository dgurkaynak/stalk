const http = require('http');
const port = 9411;

const server = http.createServer((request, response) => {

  // TODO: Check if coming to `/api/v2/spans` with a POST request

  let body = [];
  request.on('data', (chunk) => {
    body.push(chunk);
  }).on('end', () => {
    const buffer = Buffer.concat(body);

    // at this point, `body` has the entire request body stored in it as a string
    console.log(JSON.parse(buffer.toString()));

    response.statusCode = 202;
    response.end();
  });
})

server.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err)
  }

  console.log(`server is listening on ${port}`)
});
