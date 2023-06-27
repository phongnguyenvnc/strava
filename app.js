require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cron = require("node-cron");
const { cache } = require("./src/cache");
const { telegram } = require("./src/telegram.js");
const { getAccessToken } = require("./src/strava.js");

const app = express();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});

let dafaultActivitiesString = [
  "ATHL:Phong N.-DIST:5.07-TIME:2473",
  'ATHL:Be B.-DIST:5.03-TIME:2402',
  "ATHL:Cong N.-DIST:4.16-TIME:1483",
  "ATHL:Kỳ T.-DIST:1.01-TIME:974",
  "ATHL:Truong B.-DIST:5.03-TIME:2402"
];
// let dafaultActivitiesString = [];
cache.set("listActivityString", dafaultActivitiesString);
let accessToken = null;
let hasNew = 0;

const getKilometerDistance = (distance) => {
  return distance
    ? ` ${(distance / 1000).toFixed(1).replace(/\.0$/, "")}km`
    : "";
};

const getCommonActivityMessage = (time, distance) => {
  if (time && distance) {
    return `với avg pace là ${new Date((time / distance) * 1000000)
      .toISOString()
      .slice(14, 19)}/km`;
  }
  return "";
};

const getSwimActivityMessage = (time, distance) => {
  if (time && distance) {
    return `với avg pace là ${((time / distance) * 100).toFixed(0)}s/100m`;
  }
  return "";
};

const getRideActivityMessage = (time, distance) => {
  if (time && distance) {
    return `với avg pace là ${(distance / 1000 / ((1 / 60) * (time / 60)))
      .toFixed(1)
      .replace(/\.0$/, "")}km/h`;
  }
  return "";
};

const getDuration = (time) => {
  return time ? `${new Date(time * 1000).toISOString().slice(11, 19)}` : "";
};

const getActivityString = (athlete, dist, seconds) => {
  return "ATHL:" + athlete + "-DIST:" + dist + "-TIME:" + seconds;
};

cron.schedule("0,10,20,30,40,50 * * * *", async () => {
  const listActivityString = cache.get("listActivityString", null) || [];
  console.log("Cached activity strings: ", listActivityString);

  await getAccessToken()
    .then((token) => {
      accessToken = token;
    })
    .catch((error) => {
      console.log("Failed to get access token");
      console.error(error);
    });

  if (process.env.STRAVA_CLUB_ID) {
    await axios
      .get(
        `https://www.strava.com/api/v3/clubs/${process.env.STRAVA_CLUB_ID}/activities?page=1&per_page=5`,
        {
          headers: {
            Authorization: "Bearer " + accessToken,
          },
        }
      )
      .then((response) => {
        const data = response.data;
        // map message and calculate pace, time
        const activities = data?.map((activity) => {
          const result = { ...activity };
          if (result.sport_type === "WeightTraining") {
            result.action = "tập weight training";
            result.duration = getDuration(activity.moving_time);
            result.message = "";
            result.dist = "";
          } else if (result.sport_type === "Workout") {
            result.action = "tập workout";
            result.duration = getDuration(activity.moving_time);
            result.message = "";
            result.dist = "";
          } else if (result.sport_type === "Run") {
            result.action = "chạy";
            result.message = getCommonActivityMessage(
              activity.moving_time,
              activity.distance
            );
            result.duration = getDuration(activity.moving_time);
            result.dist = getKilometerDistance(activity.distance);
          } else if (result.sport_type === "Ride") {
            result.message = getRideActivityMessage(
              activity.moving_time,
              activity.distance
            );
            result.action = "đạp";
            result.duration = getDuration(activity.moving_time);
            result.dist = getKilometerDistance(activity.distance);
          } else if (result.sport_type === "Walk") {
            result.action = "đi bộ";
            result.message = getCommonActivityMessage(
              activity.moving_time,
              activity.distance
            );
            result.duration = getDuration(activity.moving_time);
            result.dist = getKilometerDistance(activity.distance);
          } else if (result.sport_type === "Swim") {
            result.action = "bơi";
            result.message = getSwimActivityMessage(
              activity.moving_time,
              activity.distance
            );
            result.duration = getDuration(activity.moving_time);
            result.dist = getKilometerDistance(activity.distance);
          } else if (result.sport_type === "Yoga") {
            result.duration = getDuration(activity.moving_time);
            result.action = "tập yoga";
            result.message = "";
            result.dist = "";
          } else {
            result.duration = getDuration(activity.moving_time);
            result.action = activity.sport_type;
            result.message = "";
            result.dist = "";
          }
          return result;
        });
        for (activity of activities) {
          const athlete =
            activity.athlete.firstname + " " + activity.athlete.lastname;
          const dist = Number((activity.distance / 1000).toFixed(2));
          const seconds = activity.moving_time;
          const activityString = getActivityString(athlete, dist, seconds);
          
          // find out new one to push messege
          if (!Array.from(listActivityString).includes(activityString)) {
            console.log("New activity string: ", activityString);
            let telegramMessage;
            const activityName = activity.name;
            const action = activity.action;
            const duration = activity.duration;
            const distance = activity.dist;
            const message = activity.message;
            const athlete =
              activity.athlete.firstname + " " + activity.athlete.lastname;

            telegramMessage =
              activityName +
              "\n" +
              athlete +
              " " +
              action?.toLowerCase() +
              distance +
              " trong " +
              duration +
              "\n" +
              message;

            // push messege
            try {
              telegram(
                process.env.TELEGRAM_GROUP,
                process.env.TELEGRAM_BOT_TOKEN,
                telegramMessage,
                "HTML"
              );
            } catch (error) {
              console.error(
                `Can not send Telegram message ${telegramMessage}. Error: ${error?.message}`
              );
            }

            hasNew += 1;
            listActivityString.push(activityString);
          }
        }
        if (!hasNew) {
          telegramMessage = "There is no new activity, cron job is still running!";
          try {
            telegram(
              process.env.TELEGRAM_TEST_GROUP,
              process.env.TELEGRAM_BOT_TOKEN,
              telegramMessage,
              "HTML"
            );
          } catch (error) {
            console.error(
              `Can not send Telegram message ${telegramMessage} to test group. Error: ${error?.message}`
            );
          }
        }

        console.log(`New activity counted: ${hasNew}`);
        cache.set("listActivityString", listActivityString);
      })
      .catch((error) => {
        console.error(error);
      });
  } else {
    console.log("Can not find STRAVA_CLUB_ID");
  }
});
