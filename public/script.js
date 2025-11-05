let currentSubscription = null;
let currentLocation = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('Service Worker registered successfully.');
        reg.pushManager.getSubscription().then(sub => {
          if (sub) {
            currentSubscription = sub;
            console.log('User IS subscribed.');
          } else {
            console.log('User IS NOT subscribed.');
          }
          
        });
      })
      .catch(err => console.error('Service Worker registration failed:', err));
      setupModernDropdown(); 
  });
}

const checkButton = document.getElementById('check-btn');
checkButton.addEventListener('click', () => {
  console.log('Button clicked! Getting location...');
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(handleLocationSuccess, showError);
  } else {
    console.error('Geolocation is not supported by this browser.');
  }
});

// public/script.js

const searchButton = document.getElementById('search-btn');
const cityInput = document.getElementById('city-input');

searchButton.addEventListener('click', () => {
  const cityName = cityInput.value.trim();
  if (cityName) {
    console.log(`Searching for city: ${cityName}`);
    // Call a new function to handle the search
    fetchCoordsForCity(cityName);
  }
});
cityInput.addEventListener('keyup', (event) => {
  // Check if the key pressed was the "Enter" key
  if (event.key === 'Enter') {
    // If it was, simply trigger a click on the search button
    searchButton.click();
  }
});

// public/script.js

function fetchCoordsForCity(city) {
  // Call our new geocoding endpoint on the server
  fetch(`/api/geocode?city=${city}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('City not found');
      }
      return response.json();
    })
    .then(coords => {
      console.log('Coordinates found:', coords);
      // We already have a function to get AQI from coordinates!
      // Let's reuse it.
      fetchAirQualityFromServer(coords);
      
      // Also, scroll to the result
      document.getElementById('result-container').scrollIntoView({ behavior: 'smooth' });
    })
    .catch(error => {
      console.error('Geocoding error:', error);
      // Display the error to the user
      document.getElementById('aqi-meaning').textContent = "City not found.";
    });
}

function handleLocationSuccess(position) {
  currentLocation = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude
  };
  console.log(`Location found!`, currentLocation);

  fetchAirQualityFromServer(currentLocation);

  handleSubscription();
  document.getElementById('result-container').scrollIntoView({ behavior: 'smooth' });
}

function handleSubscription() {
  if (currentSubscription) {
    console.log('User already subscribed. Updating server with latest info.');
    sendSubscriptionToServer(currentSubscription, currentLocation);
  } else {
    console.log('User not subscribed. Asking for permission...');
    askForNotificationPermission();
  }
}

function askForNotificationPermission() {
  Notification.requestPermission().then(result => {
    if (result === 'granted') {
      console.log('Permission granted. Subscribing...');
      subscribeUserToPush();
    } else {
      console.log('Permission not granted.');
    }
  });
}

async function subscribeUserToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = 'BHxm0p2XF2eth1XCM8Ku0WQKykmN2tOAxq0jhNQiS0MR1QQ7lgrN9guzPlX9vgUYP-IkpxEEh64zzhYMwVn2if8';

    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    };

    currentSubscription = await registration.pushManager.subscribe(subscribeOptions);
    console.log('User subscribed successfully.');
    
    sendSubscriptionToServer(currentSubscription, currentLocation);
  } catch (err) {
    console.error('Failed to subscribe the user: ', err);
  }
}

function fetchAirQualityFromServer(location) {
  const serverUrl = `/air-quality?lat=${location.latitude}&lon=${location.longitude}`;
  fetch(serverUrl)
    .then(response => response.json())
    // script.js ... inside fetchAirQualityFromServer

.then(data => {
  if (data.list && data.list.length > 0) {
    const aqiData = data.list[0];
    const aqi = aqiData.main.aqi;
    const components = aqiData.components;

    const meaning = getAqiMeaning(aqi);
    const rotationAngle = getAqiRotation(aqi);
    const recommendation = getRecommendations(aqi);
    const colorClass = getAqiColorClass(aqi);
    const resultContainer = document.getElementById('result-container');

    // --- Update Gauge ---
    document.getElementById('aqi-value').textContent = aqi;
    document.getElementById('aqi-meaning').textContent = meaning;
    document.getElementById('gauge-needle').style.transform = `translateX(-80px) rotate(${rotationAngle}deg)`;

    // --- NEW: Populate Pollutant Data ---
    // public/script.js ... inside the .then(data => { ... }) block

    // --- NEW: Populate Pollutant Data with Bar Charts ---
    const pollutantContainer = document.getElementById('pollutant-data-container');
    pollutantContainer.innerHTML = ''; // Clear any old data

    // Define the pollutants we want to display and their "Very Poor" threshold
    // These are based on the AQI index chart you shared
    const pollutantsToShow = [
      { name: 'PM2.5', key: 'pm2_5', max: 75 },
      { name: 'PM10', key: 'pm10', max: 200 },
      { name: 'SO₂', key: 'so2', max: 350 },
      { name: 'NO₂', key: 'no2', max: 200 }
    ];

    pollutantsToShow.forEach(pollutant => {
      const value = components[pollutant.key];
      // Calculate the width percentage, capping at 100%
      const percentage = Math.min((value / pollutant.max) * 100, 100);
      const barColor = getBarColor(percentage);

      // Create the new HTML elements for each pollutant
      const itemHTML = `
        <div class="pollutant-item">
          <div class="pollutant-info">
            <span class="name">${pollutant.name}</span>
            <span class="value">${value} µg/m³</span>
          </div>
          <div class="bar-container">
            <div class="bar" style="width: ${percentage}%; background-color: ${barColor};"></div>
          </div>
        </div>
      `;
      
      // Add the new element to the container
      pollutantContainer.insertAdjacentHTML('beforeend', itemHTML);
    });

    document.getElementById('recommendations-text').textContent = recommendation;
    resultContainer.className = '';
    resultContainer.classList.add(colorClass);
    
  } else {
    throw new Error('API data format is incorrect.');
  }
})
    .catch(error => console.error('Error fetching AQI from server:', error));
}


function getAqiRotation(aqi) {
  const minAngle = 0;
  const maxAngle = 180;
  
  const aqiMin = 1;
  const aqiMax = 5;
  
  const anglePerAqiUnit = maxAngle / (aqiMax - aqiMin);
  
  const adjustedAqi = aqi - aqiMin;
  
  const angle = (adjustedAqi * anglePerAqiUnit) + (anglePerAqiUnit / 2);

  return Math.min(maxAngle, Math.max(minAngle, angle));
}



function sendSubscriptionToServer(subscription, location) {
  console.log('Sending subscription and location to server...');
  
  const dropdown = document.getElementById('frequency-dropdown');
  const frequency = dropdown.dataset.selectedValue || '28800000';
  console.log(`With selected frequency: ${frequency}ms`);

  fetch('/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription, location, frequency }),
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => res.json())
  .then(data => console.log('Server response:', data.message))
  .catch(err => console.error('Error sending data to server:', err));
}


function getAqiColorClass(aqi) {
  switch (aqi) {
    case 1: return 'aqi-good';
    case 2: return 'aqi-fair';
    case 3: return 'aqi-moderate';
    case 4: return 'aqi-poor';
    case 5: return 'aqi-very-poor';
    default: return ''; // Default gray
  }
}



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
function showError(error) { console.error('Error getting location:', error.message); }
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}

function getRecommendations(aqi) {
  switch (aqi) {
    case 1: return 'It’s a great day to be active outside. Enjoy the fresh air!';
    case 2: return 'Air quality is acceptable. Unusually sensitive individuals should consider reducing prolonged or heavy exertion.';
    case 3: return 'Sensitive groups may experience health effects. The general public is less likely to be affected. Limit prolonged outdoor exertion.';
    case 4: return 'Everyone may begin to experience health effects. Members of sensitive groups may experience more serious health effects. Avoid prolonged outdoor exertion.';
    case 5: return 'This is a health alert. Everyone is likely to be affected. Everyone should avoid all outdoor exertion.';
    default: return 'Check the air quality to see recommendations.';
  }
}




function setupModernDropdown() {
  const dropdown = document.getElementById('frequency-dropdown');
  const dropdownText = document.getElementById('dropdown-text');
  const dropdownCheckbox = document.getElementById('dropdown-checkbox');
  const dropdownItems = document.querySelectorAll('.dropdown__items li');

  dropdownItems.forEach(item => {
    item.addEventListener('click', () => {
      const newText = item.textContent;
      const newValue = item.dataset.value;

      dropdownText.textContent = newText;

      dropdown.dataset.selectedValue = newValue;

      dropdownCheckbox.checked = false;
    });
  });
}


// public/script.js

// ADD THIS NEW HELPER FUNCTION at the bottom
function getBarColor(percentage) {
  if (percentage < 25) return '#28a745'; // Green
  if (percentage < 50) return '#ffc107'; // Yellow
  if (percentage < 75) return '#fd7e14'; // Orange
  return '#dc3545'; // Red
}