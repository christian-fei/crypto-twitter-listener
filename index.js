const Twitter = require('twitter')
const client = new Twitter({
  consumer_key: process.env.npm_config_twitter_consumer_key,
  consumer_secret: process.env.npm_config_twitter_consumer_secret,
  access_token_key: process.env.npm_config_twitter_access_token_key,
  access_token_secret: process.env.npm_config_twitter_access_token_secret
})

const sentiment = require('sentiment')

const http = require('http')
const serveStatic = require('serve-static')
const serve = serveStatic('.', {'index': ['index.html']})
const finalhandler = require('finalhandler')

const connections = []

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
}).listen(process.env.HTTP_PORT || 8080)

function handleSSE (req, res) {
  connections.push(res)
  req.on('close', () => {
    console.log('client closed connection')
  })
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

const stream = client.stream('statuses/filter', {track: '#bitcoin, #litecoin, #ethereum, #javascript'})

stream.on('data', async (data) => {
  if (!data.retweeted_status || !data.retweeted_status.extended_tweet) return
  const text = data.retweeted_status.extended_tweet.full_text
  const {positive} = sentiment(text)
  console.log(text)
  console.log('result', positive)
  console.log('---------------------------')
  writeSSE(JSON.stringify(data))
})

stream.on('error', (error) => {
  throw error
})
