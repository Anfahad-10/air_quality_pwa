const checkButton = document.getElementById('check-btn');

checkButton.addEventListener('click', () => {
  console.log('Button clicked! Fetching from server...');

  // Use the fetch API to make a request to our server's /ping endpoint
  fetch('http://localhost:3000/ping')
    .then(response => response.json()) // Take the response and parse it as JSON
    .then(data => {
      // We got the data back from the server!
      console.log('Success! Data from server:', data);
    })
    .catch(error => {
      // If something went wrong, log the error
      console.error('Error fetching from server:', error);
    });
});