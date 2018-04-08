const Twitter = require('twitter')
const client = new Twitter({
  consumer_key: process.env.npm_config_twitter_consumer_key,
  consumer_secret: process.env.npm_config_twitter_consumer_secret,
  access_token_key: process.env.npm_config_twitter_access_token_key,
  access_token_secret: process.env.npm_config_twitter_access_token_secret
})

const r2 = require('r2')
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
      let coordinates = await r2(`https://geocode.xyz/${location}?geoit=csv`).text
      coordinates = coordinates.split(',').map(parseFloat)
      if (coordinates.find(x => Number.isNaN(x))) { return console.log('failed to get coordinates') }
      const lat = avgGeoCoordinatesLat(coordinates)
      const lon = avgGeoCoordinatesLon(coordinates)
      console.log('-> ', coordinates, lat, lon)
      writeSSE(JSON.stringify({lat, lon}))
    }
  } else {
    console.log('has coordinates')
    const lat = avgTwitterCoordinatesLat(data.retweeted_status.place.bounding_box.coordinates[0])
    const lon = avgTwitterCoordinatesLon(data.retweeted_status.place.bounding_box.coordinates[0])
    console.log('twitter: lat, lon', lat, lon)
    writeSSE(JSON.stringify({lat, lon}))
  }
  // console.log(data.retweeted_status.extended_tweet.full_text)
  // console.log(JSON.stringify(data))
  // console.log('new tweet', data.text)
  // console.log('----------------------------------------------')
  // writeSSE(JSON.stringify(data))
  // client.post('favorites/create', {id: data.id_str}, (error, response) => {
  //   if (error) return console.error(`failed to like: ${error.message}`)
  //   console.log('Tweet ID: ' + response.id_str + ' Liked! - "' + response.text + '"')
  // })
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

function avgGeoCoordinatesLat (coordinates) {
  return coordinates.reduce((sum, curr, i) => sum + (i % 2 === 0 ? curr : 0), 0) / coordinates.length / 2
}
function avgGeoCoordinatesLon (coordinates) {
  return coordinates.reduce((sum, curr, i) => sum + (i % 2 === 1 ? curr : 0), 0) / coordinates.length / 2
}
