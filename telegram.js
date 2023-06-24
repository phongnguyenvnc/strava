const axios = require('axios');

const config = {
  'url': 'https://api.telegram.org/bot',
  'endpoints': '/sendMessage',
  'sendPhoto': '/sendPhoto'
}
const telegram = async (groupId, botToken, message, parseMode, urlImage) => {
  let urlTelegram = config.url + botToken
  const params = {
    chat_id: groupId,
    photo: urlImage
  }
  if (parseMode) {
    params.parse_mode = parseMode
  }
  if (urlImage) {
    params.photo = urlImage
    params.caption = message
    params.disable_web_page_preview = true
    urlTelegram += config.sendPhoto
  } else {
    params.text = message
    urlTelegram += config.endpoints
  }
  try {
    await axios.get(urlTelegram, {
      params
    })
    return true
  } catch (err) {
    console.log(err);
    return false
  }
}

exports.telegram = telegram;
