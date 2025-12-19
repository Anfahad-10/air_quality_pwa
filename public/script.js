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
        const components = aqiData.components;

        // Calculate exact Indian AQI
        const indiaAQI = calculateIndianAQI(components);

        const currentHealthConditions = [];
        document.querySelectorAll('input[name="conditions"]:checked').forEach(c => currentHealthConditions.push(c.value));

        const maskRec = getMaskRecommendation(indiaAQI, currentHealthConditions);
        const meaning = getAqiMeaning(indiaAQI);
        const rotationAngle = getAqiRotation(indiaAQI);

        // Recommendations based on new scale
        const recommendation = getRecommendations(indiaAQI, currentHealthConditions);
        const colorClass = getAqiColorClass(indiaAQI);
        const resultContainer = document.getElementById('result-container');

        // Update Gauge
        const aqiTextEl = document.getElementById('aqi-value-text') || document.getElementById('aqi-value');
        if (aqiTextEl) aqiTextEl.textContent = indiaAQI;

        document.getElementById('aqi-meaning').textContent = meaning;

        // Update needle rotation (SVG group)
        const needleGroup = document.getElementById('needle-group');
        if (needleGroup) {
          needleGroup.style.transform = `rotate(${rotationAngle}deg)`;
        }

        document.getElementById('mask-image').src = maskRec.image;
        document.getElementById('mask-text').textContent = maskRec.text;
        // Populate Pollutant Bars
        updatePollutantBars(components);

        // Populate Recommendations Box
        document.getElementById('recommendations-text').innerHTML = recommendation;


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
    { name: 'PM2.5', key: 'pm2_5', max: 250 }, // Adjusted max for bars visual
    { name: 'PM10', key: 'pm10', max: 430 },
    { name: 'SO₂', key: 'so2', max: 1600 },
    { name: 'NO₂', key: 'no2', max: 400 }
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

// 1. Rotation: Map 0-500 AQI to 0-180 degrees
function getAqiRotation(aqi) {
  // min 0 -> 0 deg
  // max 500 -> 180 deg
  // Cap at 500 for rotation visual
  const val = Math.min(aqi, 500);
  return (val / 500) * 180;
}

// 2. Meaning: CPCB Categories
function getAqiMeaning(aqi) {
  if (aqi <= 50) return 'Good 😍';
  if (aqi <= 100) return 'Satisfactory 😊';
  if (aqi <= 200) return 'Moderate 😐';
  if (aqi <= 300) return 'Poor 😷';
  if (aqi <= 400) return 'Very Poor ⚠️';
  return 'Severe ☠️';
}

// 3. Color Class
function getAqiColorClass(aqi) {
  if (aqi <= 50) return 'aqi-good';
  if (aqi <= 100) return 'aqi-fair'; // Mapping Satisfactory to 'Fair' class
  if (aqi <= 200) return 'aqi-moderate';
  if (aqi <= 300) return 'aqi-poor';
  if (aqi <= 400) return 'aqi-very-poor';
  return 'aqi-very-poor'; // Severe maps to same or new class
}

// 4. Bar Color
function getBarColor(percentage) {
  if (percentage < 25) return '#28a745';
  if (percentage < 50) return '#ffc107';
  if (percentage < 75) return '#fd7e14';
  return '#dc3545';
}

// 5. Update Recommendation Text Helper
function updateRecommendationText() {
  const aqiEl = document.getElementById('aqi-value-text') || document.getElementById('aqi-value');
  if (!aqiEl) return;

  const aqi = parseInt(aqiEl.textContent, 10);

  if (isNaN(aqi)) return;

  const recommendation = getRecommendations(aqi, currentHealthConditions);
  document.getElementById('recommendations-text').innerHTML = recommendation;
}

// 6. Detailed Recommendations based on India AQI
function getRecommendations(aqi, healthConditions = []) {
  const isSensitive = healthConditions.length > 0;

  let recommendations = {
    dos: [],
    donts: [],
    sensitive_dos: [],
    sensitive_donts: []
  };

  if (aqi <= 50) { // Good
    recommendations.dos.push("Air quality is good. Minimal impact.");
    recommendations.dos.push("Enjoy outdoor activities!");
  } else if (aqi <= 100) { // Satisfactory
    recommendations.dos.push("Minor breathing discomfort to sensitive people.");
    recommendations.sensitive_donts.push("Reduce prolonged exertion if you feel discomfort.");
  } else if (aqi <= 200) { // Moderate
    recommendations.dos.push("Breathing discomfort to the people with lungs, asthma and heart diseases.");
    recommendations.sensitive_dos.push("Keep medicine handy.");
    recommendations.sensitive_donts.push("Avoid heavy exertion outdoors.");
  } else if (aqi <= 300) { // Poor
    recommendations.dos.push("Breathing discomfort to most people on prolonged exposure.");
    recommendations.dos.push("Wear a mask if outside.");
    recommendations.donts.push("Avoid long walks or running.");
    recommendations.sensitive_dos.push("Stay indoors.");
  } else if (aqi <= 400) { // Very Poor
    recommendations.dos.push("Respiratory illness on prolonged exposure.");
    recommendations.dos.push("Wear N95 masks.");
    recommendations.donts.push("Avoid all outdoor exercise.");
    recommendations.sensitive_donts.push("Remain indoors and keep activity levels low.");
  } else { // Severe (>400)
    recommendations.dos.push("Affects healthy people and seriously impacts those with existing diseases.");
    recommendations.dos.push("Close windows, use air purifiers.");
    recommendations.donts.push("Do not go outside unless emergency.");
  }

  // Build HTML
  let html = '';
  if (recommendations.dos.length > 0) {
    html += '<h4>Do:</h4><ul>';
    recommendations.dos.forEach(item => { html += `<li>${item}</li>`; });
    html += '</ul>';
  }
  if (recommendations.donts.length > 0) {
    html += '<h4>Don\'t:</h4><ul>';
    recommendations.donts.forEach(item => { html += `<li>${item}</li>`; });
    html += '</ul>';
  }

  if (isSensitive && (recommendations.sensitive_dos.length > 0 || recommendations.sensitive_donts.length > 0)) {
    html += '<hr><h4>For Your Health Condition:</h4>';
    if (recommendations.sensitive_dos.length > 0) {
      html += '<ul>';
      recommendations.sensitive_dos.forEach(item => { html += `<li>${item}</li>`; });
      html += '</ul>';
    }
    if (recommendations.sensitive_donts.length > 0) {
      html += '<h5>Extra Precautions:</h5><ul>';
      recommendations.sensitive_donts.forEach(item => { html += `<li>${item}</li>`; });
      html += '</ul>';
    }
  }

  return html;
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

// 7. Mask Recommendation (New Scale)
function getMaskRecommendation(aqi, healthConditions = []) {
  const isSensitive = healthConditions.length > 0;
  let recommendation = {
    image: 'no-mask.png',
    text: 'No mask needed. Enjoy the fresh air!'
  };

  if (aqi > 100 && aqi <= 200) { // Moderate
    if (isSensitive) {
      recommendation.image = 'cloth-mask.png';
      recommendation.text = 'Sensitive groups should considering wearing a mask.';
    }
  } else if (aqi > 200 && aqi <= 300) { // Poor
    recommendation.image = 'n95-mask.png';
    recommendation.text = isSensitive ? 'N95 mask is strongly recommended.' : 'Wear a mask for outdoor activities.';
  } else if (aqi > 300) { // Very Poor & Severe
    recommendation.image = 'n95-mask.png';
    recommendation.text = 'N95/FFP2 mask is essential. Avoid outdoors.';
  }

  return recommendation;
}

// --- INDIAN AQI CALCULATION HELPER ---

function calculateIndianAQI(components) {
  // CPCB Breakpoints (C_low, C_high, I_low, I_high)
  // Format: [C_low, C_high, I_low, I_high]

  const breakingPoints = {
    pm2_5: [
      [0, 30, 0, 50],
      [31, 60, 51, 100],
      [61, 90, 101, 200],
      [91, 120, 201, 300],
      [121, 250, 301, 400],
      [250, 1000, 401, 500] // Catch all for severe
    ],
    pm10: [
      [0, 50, 0, 50],
      [51, 100, 51, 100],
      [101, 250, 101, 200],
      [251, 350, 201, 300],
      [351, 430, 301, 400],
      [430, 1000, 401, 500]
    ],
    so2: [
      [0, 40, 0, 50],
      [41, 80, 51, 100],
      [81, 380, 101, 200],
      [381, 800, 201, 300],
      [801, 1600, 301, 400],
      [1600, 5000, 401, 500]
    ],
    no2: [
      [0, 40, 0, 50],
      [41, 80, 51, 100],
      [81, 180, 101, 200],
      [181, 280, 201, 300],
      [281, 400, 301, 400],
      [400, 1000, 401, 500]
    ]
  };

  const calculateSubIndex = (concentration, param) => {
    if (concentration === undefined || concentration === null) return 0;

    const ranges = breakingPoints[param];
    if (!ranges) return 0;

    // Find range
    for (let i = 0; i < ranges.length; i++) {
      const [cLo, cHi, iLo, iHi] = ranges[i];
      if (concentration <= cHi) {
        // Formula: Ip = [ (IHi - ILo) / (CHi - CLo) ] * (Cp - CLo) + ILo
        return Math.round(((iHi - iLo) / (cHi - cLo)) * (concentration - cLo) + iLo);
      }
    }
    // If exceeds max known range, use last range linear projection or cap
    const [cLo, cHi, iLo, iHi] = ranges[ranges.length - 1];
    return Math.round(((iHi - iLo) / (cHi - cLo)) * (concentration - cLo) + iLo);
  };

  const subIndices = [
    calculateSubIndex(components.pm2_5, 'pm2_5'),
    calculateSubIndex(components.pm10, 'pm10'),
    calculateSubIndex(components.so2, 'so2'),
    calculateSubIndex(components.no2, 'no2')
  ];

  // Final AQI is the max of all sub-indices
  return Math.max(...subIndices);
}