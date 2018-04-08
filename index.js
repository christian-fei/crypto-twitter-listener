const Twitter = require('twitter')
const client = new Twitter({
  consumer_key: process.env.npm_config_twitter_consumer_key,
  consumer_secret: process.env.npm_config_twitter_consumer_secret,
  access_token_key: process.env.npm_config_twitter_access_token_key,
  access_token_secret: process.env.npm_config_twitter_access_token_secret
})

const googleMapsClient = require('@google/maps').createClient({
  key: process.env.npm_config_google_api_key,
  Promise
})
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

  if (!data.retweeted_status || !data.retweeted_status.place || !data.retweeted_status.place.bounding_box || !data.retweeted_status.place.bounding_box.coordinates) {
    console.log('no coordinates')
    if (data.retweeted_status.user.location) {
      const location = data.retweeted_status.user.location
      console.log('has location', location)
      const response = await googleMapsClient.geocode({address: location}).asPromise().catch((err) => console.error(err))
      if (!response) return console.log('no response')
      if (!response.json) return console.log('no response.json')
      if (!response.json.results) return console.log('no json.results')
      if (!response.json.results[0]) return console.log('no json.results[0]')

      const {lat, lng: lon} = response.json.results[0].geometry.location
      console.log('{lat, lon}', JSON.stringify({lat, lon}, null, 2))

      writeSSE(JSON.stringify({lat, lon}))
    }
  } else {
    console.log('has coordinates')
    const lat = avgTwitterCoordinatesLat(data.retweeted_status.place.bounding_box.coordinates[0])
    const lon = avgTwitterCoordinatesLon(data.retweeted_status.place.bounding_box.coordinates[0])
    console.log('twitter: lat, lon', lat, lon)
    writeSSE(JSON.stringify({lat, lon}))
  }
})

stream.on('error', (error) => {
  throw error
})

function avgTwitterCoordinatesLat (coordinates) {
  return coordinates.reduce((sum, [curr]) => sum + curr, 0) / coordinates.length
}
function avgTwitterCoordinatesLon (coordinates) {
  return coordinates.reduce((sum, [_, curr]) => sum + curr, 0) / coordinates.length
}
