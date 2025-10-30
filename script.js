// Register Service Worker at the top
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered successfully.'))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}

const checkButton = document.getElementById('check-btn');

checkButton.addEventListener('click', () => {
  console.log('Button clicked! Getting location...');
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(fetchAirQualityFromServer, showError);
  } else {
    console.error('Geolocation is not supported by this browser.');
  }
});

function fetchAirQualityFromServer(position) {
  const { latitude, longitude } = position.coords;
  console.log(`Location found! Lat: ${latitude}, Lon: ${longitude}`);

  // We now call OUR server, which is much more secure.
  const serverUrl = `http://localhost:3000/air-quality?lat=${latitude}&lon=${longitude}`;

  fetch(serverUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Success! Data from our server:', data);
      if (data.list && data.list.length > 0) {
        const aqi = data.list[0].main.aqi;
        document.getElementById('aqi-value').textContent = aqi;
        document.getElementById('aqi-meaning').textContent = getAqiMeaning(aqi);
      } else {
        throw new Error('API data format is incorrect.');
      }
    })
    .catch(error => {
      console.error('Error fetching data from our server:', error);
      document.getElementById('aqi-meaning').textContent = "Could not fetch data.";
    });
}

// Helper function to explain the AQI value
function getAqiMeaning(aqi) {
  switch (aqi) {
    case 1: return 'Good';
    case 2: return 'Fair';
    case 3: return 'Moderate';
    case 4: return 'Poor';
    case 5: return 'Very Poor';
    default: return 'Unknown';
  }
}

// This function runs if there's an error getting the location
function showError(error) {
  console.error('Error getting location:', error.message);
}