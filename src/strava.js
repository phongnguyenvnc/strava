require('dotenv').config();
const axios = require("axios");

const getAccessToken = async () => {
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
  };

  const body = JSON.stringify({
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    refresh_token: process.env.STRAVA_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });

  let access = null;

  const { data } = await axios
    .post('https://www.strava.com/api/v3/oauth/token', body, {
    headers
  })

  access = data.access_token;

  return access;
};

exports.getAccessToken = getAccessToken;
