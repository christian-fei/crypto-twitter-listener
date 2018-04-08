const http = require('http')
const serveStatic = require('serve-static')
const serve = serveStatic('build', {'index': ['index.html']})
const finalhandler = require('finalhandler')

const connections = []

main()

async function main () {
  console.log('SSE SERVER START', new Date().toISOString())

  http.createServer(function (req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Request-Method', '*')
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET')
    res.setHeader('Access-Control-Allow-Headers', '*')
    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    if (req.headers.accept && req.headers.accept.indexOf('text/event-stream') >= 0) {
      return handleSSE(req, res)
    }

    serve(req, res, finalhandler(req, res))
  }).listen(process.env.SSE_PORT || 8081)
}

function handleSSE (req, res) {
  connections.push(res)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })
}

function writeSSE (data) {
  connections.forEach(connection => {
    if (!connection) return
    const id = new Date().toISOString()
    connection.write('id: ' + id + '\n')
    connection.write('data: ' + data + '\n\n')
  })
}
