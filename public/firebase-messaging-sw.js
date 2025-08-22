// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAjljNiqn9ywPZeJmqJrE-y-Q_0QS1qGck",
  authDomain: "oc-system-3910d.firebaseapp.com",
  projectId: "oc-system-3910d",
  storageBucket: "oc-system-3910d.firebaseapp.com",
  messagingSenderId: "12901498656",
  appId: "1:12901498656:web:93c4d28bad0cd31786e145"
});

// Inicializa messaging
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo-navbar.png',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
