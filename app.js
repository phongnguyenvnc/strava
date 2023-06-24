require('dotenv').config()

const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const { cache } = require('./cache.js');
const { telegram } = require('./telegram.js');
const { getAccessToken } = require('./strava.js');

const app = express();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});

let lastActivityString = null;
let accessToken = null;

const getKilometerDistance = (distance) => {
  return ` ${(distance / 1000).toFixed(1).replace(/\.0$/,'')}km`;
}

const getCommonActivityMessage = (time, distance) => {
  return `với avg pace là ${new Date(time / distance * 1000000).toISOString().slice(14, 19)}/km`;
}

const getSwimActivityMessage = (time, distance) => {
  return `với avg pace là ${(time / distance * 100).toFixed(0)}s/100m`
}

const getRideActivityMessage = (time, distance) => {
  return `với avg pace là ${(distance / 1000 / (1 / 60 * (time / 60))).toFixed(1).replace(/\.0$/,'')}km/h`
}

const getDuration = (time) => {
  return `${new Date(time * 1000).toISOString().slice(11, 19)}`;
}


// cron.schedule('0,10,20,30,40,50 * * * *', function() {
// });

setInterval(() => {
  const lastActivityString =
    cache.get('lastActivityString', null) || 'No activities';

  console.log('Last Activity: ' + cache.get('lastActivityString', null));

  getAccessToken()
    .then((token) => {
      accessToken = token;
    })
    .catch((error) => {
      console.error(error);
    });

  axios
    .get(
      'https://www.strava.com/api/v3/clubs/1042053/activities?page=1&per_page=1',
      {
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
      }
    )
    .then((response) => {
      const data = response.data;

      const athlete =
        data[0].athlete.firstname + ' ' + data[0].athlete.lastname;
      const dist = Number((data[0].distance / 1609.34).toFixed(2));
      const seconds = data[0].moving_time;
      const activityString =
        'ATHL:' + athlete + '-DIST:' + dist + '-TIME:' + seconds;
      cache.set('lastActivityString', activityString);

      if (lastActivityString === activityString) {
        console.log('Last Activity String: ' + lastActivityString);
        console.log('No New Activites');
      } else {
        let telegramMessage;
        const activities = data?.map(activity => {
          const result = {...activity}
          if (result.sport_type === 'WeightTraining' || result.sport_type === 'Workout') {
            result.action = 'tập'
            result.duration = getDuration(activity.moving_time)
            result.message = ''
            result.dist = ''
          } else if (result.sport_type === 'Run') {
            result.action = 'chạy'
            result.message = getCommonActivityMessage(activity.moving_time, activity.distance)
            result.duration = getDuration(activity.moving_time)
            result.dist = getKilometerDistance(activity.distance)
          } else if (result.sport_type === 'Ride') {
            result.message = getRideActivityMessage(activity.moving_time, activity.distance)
            result.action = 'đạp'
            result.duration = getDuration(activity.moving_time)
            result.dist = getKilometerDistance(activity.distance)
          } else if (result.sport_type === 'Walk') {
            result.action = 'đi bộ'
            result.message = getCommonActivityMessage(activity.moving_time, activity.distance)
            result.duration = getDuration(activity.moving_time)
            result.dist = getKilometerDistance(activity.distance)
          } else if (result.sport_type === 'Swim') {
            result.action = 'bơi'
            result.message = getSwimActivityMessage(activity.moving_time, activity.distance)
            result.duration = getDuration(activity.moving_time)
            result.dist = getKilometerDistance(activity.distance)
          } else if (result.sport_type === 'Yoga') {
            result.duration = getDuration(activity.moving_time)
            result.action = 'tập yoga'
            result.message = ''
            result.dist = ''
          } else {
            result.duration = getDuration(activity.moving_time)
            result.action = activity.sport_type
            result.message = ''
            result.dist = ''
          }
          return result
        })

        const activityName = activities[0].name;
        const action = activities[0].action;
        const duration = activities[0].duration;
        const distance = activities[0].dist;
        const message = activities[0].message;
        const athlete = activities[0].athlete.firstname + ' ' + activities[0].athlete.lastname;

        telegramMessage =
          activityName +
          '\n' +
          athlete +
          ' ' +
          action?.toLowerCase() +
          distance +
          ' trong ' +
          duration +
          '\n' +
          message;

        try {
          telegram(
            process.env.TELEGRAM_GROUP,
            process.env.TELEGRAM_BOT_TOKEN,
            telegramMessage,
            'HTML'
          );
        } catch (error) {
          console.error(
            `Can not send Telegram message ${telegramMessage}. Error: ${error?.message}`
          );
        }
      }
    })
    .catch((error) => {
      console.error(error);
    });
}, 900000);



