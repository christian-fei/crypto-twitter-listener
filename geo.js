const googleMapsClient = require('@google/maps').createClient({
  key: process.env.npm_config_google_api_key,
  Promise
})

module.exports = {
  geocode
}

function geocode (address) {
  return googleMapsClient.geocode({address}).asPromise().catch((err) => console.error(err))
}
