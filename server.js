const path = require('path');
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();
const admin = require('firebase-admin'); 
const cron = require('node-cron');
const webpush = require('web-push');


let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} else {
  serviceAccount = require('./serviceAccountKey.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();


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
    const { subscription, location, frequency } = req.body; 
    console.log('Received new subscription with location and frequency.');

    const docId = encodeURIComponent(subscription.endpoint);

    await db.collection('subscriptions').doc(docId).set({
      subscription: subscription,
      location: location,
      frequency: parseInt(frequency, 10),
      lastCheckedTimestamp: new Date() 
    });
    
    res.status(201).json({ message: 'Subscription, location, and frequency saved.' });
  } catch (error) {
    console.error("Error saving subscription:", error);
    res.status(500).json({ error: 'Failed to save subscription.' });
  }
});





async function masterCheckAndNotify() {
  console.log('Master checker running...');
  const now = new Date();

  try {
    const snapshot = await db.collection('subscriptions').get();
    if (snapshot.empty) {
      console.log('No subscriptions to process.');
      return;
    }

    for (const doc of snapshot.docs) {
      const userData = doc.data();
      const { subscription, location, frequency, lastCheckedTimestamp } = userData;

      const lastChecked = lastCheckedTimestamp.toDate();
      const timeSinceLastCheck = now - lastChecked; 

      console.log(`Checking user ${doc.id}. Time since last check: ${timeSinceLastCheck}ms. Frequency: ${frequency}ms.`);

      if (timeSinceLastCheck >= frequency) {
        console.log(`It's time to check for ${doc.id}. Fetching AQI...`);

        const apiKey = process.env.API_KEY;
        const apiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${location.latitude}&lon=${location.longitude}&appid=${apiKey}`;
        
        try {
          const apiResponse = await fetch(apiUrl);
          const data = await apiResponse.json();

          if (data.list && data.list.length > 0) {
            const aqi = data.list[0].main.aqi; 
            console.log(`AQI for ${doc.id} is ${aqi}.`);

            if (aqi >= 3) {
              const payload = JSON.stringify({
                title: 'Air Quality Alert! 💨',
                body: `The AQI in your area is now ${aqi} (${getAqiMeaning(aqi)}). Please take precautions.`
              });
              await webpush.sendNotification(subscription, payload);
              console.log(`Notification sent to ${doc.id}.`);
            }
          }

          await db.collection('subscriptions').doc(doc.id).update({
            lastCheckedTimestamp: now
          });
          console.log(`Updated timestamp for ${doc.id}.`);

        } catch (apiError) {
          console.error(`Failed to check AQI or notify for ${doc.id}:`, apiError);
          if (apiError.statusCode === 410) {
            console.log(`Subscription for ${doc.id} is expired. Deleting from DB.`);
            await db.collection('subscriptions').doc(doc.id).delete();
          }
        }
      }
    }
    console.log('Master checker finished.');

  } catch (error) {
    console.error('Error during master check:', error);
  }
}

// Set up the cron job to run our master checker.
// Let's run it every 5 minutes.
cron.schedule('*/5 * * * *', () => {
  console.log('---------------------');
  console.log('Cron job triggered: Running master checker...');
  masterCheckAndNotify();
});


function getAqiMeaning(aqi) {
  switch (aqi) {
    case 1: return 'Good 😍';
    case 2: return 'Fair 👍';
    case 3: return 'Moderate 😊';
    case 4: return 'Poor 😷';
    case 5: return 'Very Poor, RUN 🏃‍♂️‍➡️';
    default: return 'Unknown 💀';
  }
}

app.listen(port, () => {
  console.log(`Server is running and listening on http://localhost:${port}`);
});