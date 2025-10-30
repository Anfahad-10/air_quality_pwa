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

function handleLocationSuccess(position) {
  currentLocation = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude
  };
  console.log(`Location found!`, currentLocation);

  fetchAirQualityFromServer(currentLocation);

  handleSubscription();
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
  const serverUrl = `http://localhost:3000/air-quality?lat=${location.latitude}&lon=${location.longitude}`;
  fetch(serverUrl)
    .then(response => response.json())
    .then(data => {
      if (data.list && data.list.length > 0) {
        const aqi = data.list[0].main.aqi;
        document.getElementById('aqi-value').textContent = aqi;
        document.getElementById('aqi-meaning').textContent = getAqiMeaning(aqi);
      }
    })
    .catch(error => console.error('Error fetching AQI from server:', error));
}

function sendSubscriptionToServer(subscription, location) {
  console.log('Sending subscription and location to server...');
  fetch('http://localhost:3000/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription, location }),
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => res.json())
  .then(data => console.log('Server response:', data.message))
  .catch(err => console.error('Error sending data to server:', err));
}

function getAqiMeaning(aqi) {
  switch (aqi) {
    case 1: return 'Good, Enjoy Brother 😍';
    case 2: return 'Fair, Have Fun 👍';
    case 3: return 'Moderate, Be Aware 😊';
    case 4: return 'Poor, Mask UP Brother 😷';
    case 5: return 'Very Poor, RUN 🏃‍♂️‍➡️ and VOTE OUT Govt 🪧';
    default: return 'Unknown';
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