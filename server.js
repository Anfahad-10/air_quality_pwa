const cron = require('node-cron');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();


const webpush = require('web-push');

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY; 
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  'mailto:your-email@example.com', // Change IT AFTERWARD
  vapidPublicKey,
  vapidPrivateKey
);





const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.get('/air-quality', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
          return res.status(500).json({ error: 'API Key not found on server' });
        }
        const apiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
        const apiResponse = await fetch(apiUrl);
        const data = await apiResponse.json();
        res.json(data);
      } catch (error) {
        console.error("Error in /air-quality endpoint:", error);
        res.status(500).json({ error: 'Failed to fetch air quality' });
      }
});



app.post('/subscribe', async (req, res) => {
  try {
    const { subscription, location } = req.body; 
    console.log('Received new subscription with location:', subscription.endpoint);
    console.log('Location:', location);

    const docId = encodeURIComponent(subscription.endpoint);

    await db.collection('subscriptions').doc(docId).set({
      subscription: subscription,
      location: location
    });
    
    res.status(201).json({ message: 'Subscription and location saved.' });
  } catch (error) {
    console.error("Error saving subscription:", error);
    res.status(500).json({ error: 'Failed to save subscription.' });
  }
});





async function checkAirQualityAndNotify() {
  console.log('Running scheduled check: Fetching all subscriptions...');
  try {
    const snapshot = await db.collection('subscriptions').get();
    if (snapshot.empty) {
      console.log('No subscriptions to process.');
      return;
    }

    snapshot.forEach(async (doc) => {
      //const subscription = doc.data();
      
      const { subscription, location } = doc.data();

      console.log(`Checking AQI for subscription:`, subscription.endpoint);

      const apiKey = process.env.API_KEY;
      const apiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${location.latitude}&lon=${location.longitude}&appid=${apiKey}`;
      const apiResponse = await fetch(apiUrl);
      const data = await apiResponse.json();
      
      if (data.list && data.list.length > 0) {
        const aqi = data.list[0].main.aqi;
        console.log(`AQI is ${aqi}`);

        if (aqi >= 3) { 
          const payload = JSON.stringify({
            title: 'Air Quality Alert! 💨',
            body: `The AQI in your area is now ${aqi} (${getAqiMeaning(aqi)}). Please take precautions.`
          });

          console.log('AQI is poor, sending notification...');
          await webpush.sendNotification(subscription, payload);
          console.log('Notification sent successfully.');
        } else {
          console.log('AQI is good, no notification needed.');
        }
      }
    });
  } catch (error) {
    console.error('Error during scheduled check:', error);
  }
}

function getAqiMeaning(aqi) {
  switch (aqi) {
    case 1: return 'Good, Enjoy Brother 😍';
    case 2: return 'Fair, Have Fun 👍';
    case 3: return 'Moderate, Be Aware 😊';
    case 4: return 'Poor, Mask UP Brother 😷';
    case 5: return 'Very Poor, RUN 🏃‍♂️‍➡️ and VOTE OUT Govt 🪧';
    default: return 'Unknown 💀';
  }
}



// This cron expression means "at minute 0 of every 8th hour".
// It will run at 00:00, 08:00, and 16:00 UTC time.
cron.schedule('0 */8 * * *', () => {
  console.log('---------------------');
  console.log('Running the scheduled 8-hour AQI check...');
  checkAirQualityAndNotify();
});



app.listen(port, () => {
  console.log(`Server is running and listening on http://localhost:${port}`);
});