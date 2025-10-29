const checkButton = document.getElementById('check-btn');

checkButton.addEventListener('click', () => {
  console.log('Button clicked! Getting location...');
  
  // Ask for the user's location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(fetchAirQuality, showError);
  } else {
    console.error('Geolocation is not supported by this browser.');
  }
});

// This function runs ONLY after we have the user's location

// This function runs ONLY after we have the user's location
function fetchAirQuality(position) {
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;

  console.log(`Location found! Lat: ${latitude}, Lon: ${longitude}`);
  console.log('Fetching Air Quality...');

  const apiKey = '5ae758f881b4520aafc30ec3fea1503c'; // <-- Remember to put your key here

  const apiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${apiKey}`;

  fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      console.log('Success! API Data for your location:', data);

      // --- ADD THIS NEW LOGIC ---
      // 1. Get the important data from the API response
      const aqi = data.list[0].main.aqi;

      // 2. Select the HTML elements we created
      const aqiValueElement = document.getElementById('aqi-value');
      const aqiMeaningElement = document.getElementById('aqi-meaning');

      // 3. Update the text on the page
      aqiValueElement.textContent = aqi;
      aqiMeaningElement.textContent = getAqiMeaning(aqi);
      // --- END OF NEW LOGIC ---
    })
    .catch(error => {
      console.error('Error fetching API data:', error);
    });
}

// This is a new helper function to explain the AQI value
function getAqiMeaning(aqi) {
  switch (aqi) {
    case 1:
      return 'Good';
    case 2:
      return 'Fair';
    case 3:
      return 'Moderate';
    case 4:
      return 'Poor';
    case 5:
      return 'Very Poor';
    default:
      return 'Unknown';
  }
}










// This function runs if there's an error getting the location
function showError(error) {
  console.error('Error getting location:', error.message);
}