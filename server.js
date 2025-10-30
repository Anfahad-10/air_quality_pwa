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
    const subscription = req.body;
    console.log('Received new subscription:', subscription);

    await db.collection('subscriptions').add(subscription);
    
    res.status(201).json({ message: 'Subscription saved to Firestore.' });
  } catch (error) {
    console.error("Error saving subscription:", error);
    res.status(500).json({ error: 'Failed to save subscription.' });
  }
});




app.post('/send-test-notification', async (req, res) => {
  console.log('Attempting to send a test notification...');
  try {
    const snapshot = await db.collection('subscriptions').limit(1).get();
    if (snapshot.empty) {
      console.log('No subscriptions to notify.');
      return res.status(404).json({ error: 'No subscriptions found.' });
    }
    const subscription = snapshot.docs[0].data();

    const payload = JSON.stringify({
      title: 'Hello from the Server! 👋',
      body: 'This is your first push notification.'
    });

    await webpush.sendNotification(subscription, payload);
    console.log('Test notification sent successfully.');
    res.status(200).json({ message: 'Notification sent!' });

  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send notification.' });
  }
});






app.listen(port, () => {
  console.log(`Server is running and listening on http://localhost:${port}`);
});