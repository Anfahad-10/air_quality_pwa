// 1. Import the express library
const express = require('express');
const cors = require('cors');

// 2. Create an instance of the express app
const app = express();

// 3. Define a port for our server to listen on
const port = 3000;

app.use(cors());

// 4. Define our "/ping" endpoint
// This will run when someone visits http://localhost:3000/ping
app.get('/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// 5. Start the server and listen for incoming requests
app.listen(port, () => {
  console.log(`Server is running and listening on http://localhost:${port}`);
});