// =======================================================
// ======== FULL AND COMPLETE SCRIPT.JS (FINAL) ========
// =======================================================

// --- Global Variables ---
let currentSubscription = null;
let currentLocation = null;
let currentHealthConditions = [];

// --- Main Setup - Runs after the page is fully loaded ---
window.addEventListener('load', () => {

  // 1. Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('Service Worker registered successfully.');
        // After registration, check if the user is already subscribed
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
  }

  // 2. Setup for the Modern "Gooey" Dropdown
  setupModernDropdown();

  // 3. Setup for the "Bubbly" Search Button Animation
  setupBubblyButton();

  // 4. Setup for the Health Condition Modal buttons
  setupHealthModal();

}); // --- End of window.onload ---


// --- Main Button Event Listeners ---
const checkButton = document.getElementById('check-btn');
const searchButton = document.getElementById('search-btn');
const cityInput = document.getElementById('city-input');

// Listener for "Check My Current Location" button
checkButton.addEventListener('click', () => {
  console.log('Button clicked! Getting location...');
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(handleLocationSuccess, showError);
  } else {
    console.error('Geolocation is not supported by this browser.');
  }
});

// Listener for the "Search" button
searchButton.addEventListener('click', () => {
  const cityName = cityInput.value.trim();
  if (cityName) {
    console.log(`Searching for city: ${cityName}`);
    fetchCoordsForCity(cityName);
  }
});

// Listener for the "Enter" key in the search input
cityInput.addEventListener('keyup', (event) => {
  if (event.key === 'Enter') {
    searchButton.click(); // Trigger the search button's click event
  }
});


// --- Core Logic Functions ---

// Runs after successfully getting the user's current location
function handleLocationSuccess(position) {
  currentLocation = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude
  };
  console.log(`Location found!`, currentLocation);

  // Get data, handle subscription, and scroll
  fetchAirQualityFromServer(currentLocation);
  handleSubscription();
  document.getElementById('result-container').scrollIntoView({ behavior: 'smooth' });
}

// Decides whether to subscribe a new user or update an existing one
function handleSubscription() {
  // We only proceed if we have a location
  if (!currentLocation) return; 
  
  if (currentSubscription) {
    console.log('User already subscribed. Updating server with latest info.');
    sendSubscriptionToServer(currentSubscription, currentLocation);
  } else {
    console.log('User not subscribed. Asking for permission...');
    askForNotificationPermission();
  }
}

// Asks the user for permission to send notifications
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

// Subscribes the user to the push service
async function subscribeUserToPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = 'YOUR_PUBLIC_VAPID_KEY_HERE'; // Make sure this is correct

    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    };

    currentSubscription = await registration.pushManager.subscribe(subscribeOptions);
    console.log('User subscribed successfully.');
    
    // Now send the new subscription to the server
    sendSubscriptionToServer(currentSubscription, currentLocation);
  } catch (err) {
    console.error('Failed to subscribe the user: ', err);
  }
}


// --- API Communication Functions ---

// Fetches coordinates for a given city name
function fetchCoordsForCity(city) {
  fetch(`/api/geocode?city=${city}`)
    .then(response => {
      if (!response.ok) throw new Error('City not found');
      return response.json();
    })
    .then(coords => {
      console.log('Coordinates found:', coords);
      fetchAirQualityFromServer(coords);
      document.getElementById('result-container').scrollIntoView({ behavior: 'smooth' });
    })
    .catch(error => {
      console.error('Geocoding error:', error);
      document.getElementById('aqi-meaning').textContent = "City not found.";
    });
}

// Fetches AQI data from our server using coordinates
function fetchAirQualityFromServer(location) {
  const serverUrl = `/api/air-quality?lat=${location.latitude}&lon=${location.longitude}`;
  fetch(serverUrl)
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch AQI data');
      return response.json();
    })
    .then(data => {
      if (data.list && data.list.length > 0) {
        // --- All the logic to update the UI ---
        const aqiData = data.list[0];
        const aqi = data.list[0].main.aqi;
        const components = aqiData.components;
        const meaning = getAqiMeaning(aqi);
        const rotationAngle = getAqiRotation(aqi);
        const selectedConditions = [];

        const recommendation = getRecommendations(aqi, []); 
        const colorClass = getAqiColorClass(aqi);
        const resultContainer = document.getElementById('result-container');

        // Update Gauge
        document.getElementById('aqi-value').textContent = aqi;
        document.getElementById('aqi-meaning').textContent = meaning;
        document.getElementById('gauge-needle').style.transform = `translateX(-80px) rotate(${rotationAngle}deg)`;
        // Populate Pollutant Bars
        updatePollutantBars(components);
        
        // Populate Recommendations Box
        document.getElementById('recommendations-text').textContent = recommendation;
        
        // Apply dynamic class for coloring
        resultContainer.className = '';
        resultContainer.classList.add(colorClass);

        // Check if we should show the health modal
        checkAndShowModal();
      } else {
        throw new Error('API data format is incorrect.');
      }
    })
    .catch(error => console.error('Error fetching AQI from server:', error));
}

// Sends subscription data to our server
function sendSubscriptionToServer(subscription, location) {
  const dropdown = document.getElementById('frequency-dropdown');
  const frequency = dropdown.dataset.selectedValue || '28800000';
  const healthConditions = JSON.parse(localStorage.getItem('healthConditions')) || [];

  fetch('/api/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription, location, frequency, healthConditions }),
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => res.json())
  .then(data => console.log('Server response:', data.message))
  .catch(err => console.error('Error sending data to server:', err));
}


// --- UI and Helper Functions ---

function updatePollutantBars(components) {
  const pollutantContainer = document.getElementById('pollutant-data-container');
  pollutantContainer.innerHTML = ''; 

  const pollutantsToShow = [
    { name: 'PM2.5', key: 'pm2_5', max: 75 },
    { name: 'PM10', key: 'pm10', max: 200 },
    { name: 'SO₂', key: 'so2', max: 350 },
    { name: 'NO₂', key: 'no2', max: 200 }
  ];

  pollutantsToShow.forEach(pollutant => {
    const value = components[pollutant.key];
    const percentage = Math.min((value / pollutant.max) * 100, 100);
    const barColor = getBarColor(percentage);

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
    pollutantContainer.insertAdjacentHTML('beforeend', itemHTML);
  });
}

// --- Health Modal Functions ---
function showHealthModal() { document.getElementById('health-modal-overlay').classList.remove('hidden'); }
function hideHealthModal() { document.getElementById('health-modal-overlay').classList.add('hidden'); }
function checkAndShowModal() {
  // Always show the modal after a short delay
  setTimeout(showHealthModal, 1500);
}
function setupHealthModal() {
  document.getElementById('condition-no-btn').addEventListener('click', () => {
    //localStorage.setItem('hasAnsweredHealthQuestion', 'true');
    //localStorage.setItem('healthConditions', JSON.stringify([]));
    currentHealthConditions = [];
    updateRecommendationText();  
    hideHealthModal();
  });
  document.getElementById('condition-yes-btn').addEventListener('click', () => {
    document.getElementById('conditions-list').classList.add('visible');
  });
  document.getElementById('save-conditions-btn').addEventListener('click', () => {
    const selectedConditions = [];
    document.querySelectorAll('input[name="conditions"]:checked').forEach(checkbox => {
      selectedConditions.push(checkbox.value);
    });
    //localStorage.setItem('healthConditions', JSON.stringify(selectedConditions));
    //localStorage.setItem('hasAnsweredHealthQuestion', 'true');
    currentHealthConditions = selectedConditions;
    updateRecommendationText(); 
    hideHealthModal();
  });
}

// --- Animation and Setup Functions ---
function setupModernDropdown() {
  // ... (Your existing setupModernDropdown function) ...
}
function setupBubblyButton() {
  // We moved this logic into the checkButton's event listener, so this can be empty or removed
}

// --- Other Helper Functions ---
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
function getBarColor(percentage) {
  if (percentage < 25) return '#28a745'; // Green
  if (percentage < 50) return '#ffc107'; // Yellow
  if (percentage < 75) return '#fd7e14'; // Orange
  return '#dc3545'; // Red
}
function updateRecommendationText() {
  // Get the current AQI value from the gauge on the page
  const aqi = parseInt(document.getElementById('aqi-value').textContent, 10);
  
  // If there's no valid AQI number, do nothing
  if (isNaN(aqi)) return; 

  // Generate the new recommendation using our global health variable
  const recommendation = getRecommendations(aqi, currentHealthConditions);
  
  // Update the text on the page
  document.getElementById('recommendations-text').textContent = recommendation;
}

// REPLACE the old function with this new, smarter version
function getRecommendations(aqi, healthConditions = []) {
  // Check if the user has indicated any sensitive conditions
  const isSensitive = healthConditions.includes('Asthma') || 
                      healthConditions.includes('Alleries') || 
                      healthConditions.includes('COPD');

  // --- Base Recommendations (for everyone) ---
  let baseRecommendation = '';
  switch (aqi) {
    case 1: // Good
      baseRecommendation = "It's a beautiful day for outdoor activities. Enjoy the fresh air!";
      break;
    case 2: // Fair
      baseRecommendation = "The air quality is acceptable. A great day for most activities.";
      break;
    case 3: // Moderate
      baseRecommendation = "The air quality is moderate. Consider reducing prolonged or heavy outdoor exertion.";
      break;
    case 4: // Poor
      baseRecommendation = "Air quality is poor. It's recommended to wear a mask (like an N95) if you are outdoors for an extended period. Try to keep windows closed.";
      break;
    case 5: // Very Poor
      baseRecommendation = "Health Alert: Air quality is very poor. It is strongly advised to avoid all outdoor exertion. Keep windows closed and use an air purifier if available.";
      break;
    default:
      return 'Check the air quality to see recommendations.';
  }

  // --- Personalized Additions (for sensitive groups) ---
  let personalAddition = '';
  if (isSensitive) {
    if (aqi === 2) { // Fair
      personalAddition = " As a precaution, you may want to limit heavy outdoor exercise.";
    }
    if (aqi === 3) { // Moderate
      personalAddition = " You are more likely to feel effects. It's a good idea to limit your time outdoors.";
    }
    if (aqi >= 4) { // Poor or Very Poor
      personalAddition = " You are at higher risk. It is very important to avoid outdoor activities and ensure your indoor air is clean. Keep any necessary medication, like an inhaler, readily available.";
    }
  }

  // Combine the base recommendation with the personalized advice
  return baseRecommendation + personalAddition;
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

