const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Use the fetch we installed
require('dotenv').config(); // This line loads the .env file

const app = express();
const port = 3000;

app.use(cors());

// A new, secure endpoint to get air quality
app.get('/air-quality', async (req, res) => {
  try {
    const { lat, lon } = req.query; // Get lat and lon from the request
    const apiKey = process.env.API_KEY; // Get the key safely from the environment
    
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

app.listen(port, () => {
  console.log(`Server is running and listening on http://localhost:${port}`);
});