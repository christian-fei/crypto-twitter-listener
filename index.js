const Twitter = require('twitter')
const client = new Twitter({
  consumer_key: process.env.npm_config_twitter_consumer_key,
  consumer_secret: process.env.npm_config_twitter_consumer_secret,
  access_token_key: process.env.npm_config_twitter_access_token_key,
  access_token_secret: process.env.npm_config_twitter_access_token_secret
})

const stream = client.stream('statuses/filter', {track: '#bitcoin, #litecoin, #ethereum'})

stream.on('data', (event) => {
  if (!event.retweeted_status || !event.retweeted_status.extended_tweet) return
  console.log(event.retweeted_status.extended_tweet.full_text)
  console.log('-----------------------------')
  client.post('favorites/create', {id: event.id_str}, (error, response) => {
    if (error) return console.error(`failed to like: ${error.message}`)
    console.log('Tweet ID: ' + response.id_str + ' Liked! - "' + response.text + '"')
  })
})

stream.on('error', (error) => {
  throw error
})
