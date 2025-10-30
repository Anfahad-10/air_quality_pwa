if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered successfully.'))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}

const checkButton = document.getElementById('check-btn');

checkButton.addEventListener('click', () => {
  askForNotificationPermission();
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

function getAqiMeaning(aqi) {
  switch (aqi) {
    case 1: return 'Good, Enjoy Brother 😍';
    case 2: return 'Fair, Have Fun 👍';
    case 3: return 'Moderate, Be Aware 😊';
    case 4: return 'Poor, Mask UP Brother 😷';
    case 5: return 'Very Poor, RUN 🏃‍♂️‍➡️';
    default: return 'Unknown 💀';
  }
}

function showError(error) {
  console.error('Error getting location:', error.message);
}


function askForNotificationPermission() {
  console.log('Asking for notification permission...');
  Notification.requestPermission().then(result => {
    if (result === 'granted') {
      console.log('Notification permission granted!');
      subscribeUserToPush(); 
    } else {
      console.log('Notification permission was not granted.');
    }
  });
}

function subscribeUserToPush() {
  navigator.serviceWorker.ready.then(registration => {
    const vapidPublicKey = 'BHxm0p2XF2eth1XCM8Ku0WQKykmN2tOAxq0jhNQiS0MR1QQ7lgrN9guzPlX9vgUYP-IkpxEEh64zzhYMwVn2if8';

    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    };

    return registration.pushManager.subscribe(subscribeOptions);
  })

  .then(pushSubscription => {
    console.log('Success! Received PushSubscription: ', pushSubscription);
    return fetch('http://localhost:3000/subscribe', {
      method: 'POST',
      body: JSON.stringify(pushSubscription),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  })
  .then(res => {
    if (!res.ok) {
      throw new Error('Server responded with an error.');
    }
    return res.json();
  })
  .then(responseData => {
    console.log('Server response:', responseData.message);
  })
  .catch(err => {
    console.error('Failed to subscribe the user or send to server: ', err);
  });
}



function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}