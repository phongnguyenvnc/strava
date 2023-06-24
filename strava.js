require('dotenv').config();

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

  const reauthorizeResponse = await fetch(
    "https://www.strava.com/api/v3/oauth/token",
    {
      method: "POST",
      headers,
      body,
    }
  );

  const result = await reauthorizeResponse.json();
  const access = result.access_token;

  return access;
};

exports.getAccessToken = getAccessToken;
