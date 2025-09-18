// public/firebase-messaging-sw.js
/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Config del mismo proyecto que tu frontend
firebase.initializeApp({
  apiKey: "AIzaSyAjljNiqn9ywPZeJmqJrE-y-Q_0QS1qGck",
  authDomain: "oc-system-3910d.firebaseapp.com",
  projectId: "oc-system-3910d",
  storageBucket: "oc-system-3910d.appspot.com",
  messagingSenderId: "12901498656",
  appId: "1:12901498656:web:93c4d28bad0cd31786e145",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title =
    payload?.notification?.title || payload?.data?.title || "Notificación";
  const body =
    payload?.notification?.body || payload?.data?.body || "";

  // Si tu server manda webpush.fcmOptions.link, no siempre llega en payload.
  // Tomamos prioridad por data.link y luego por ocId.
  const link =
    payload?.data?.link ||
    (payload?.data?.ocId ? `/ver?id=${payload.data.ocId}` : "/");

  const options = {
    body,
    icon: "/logo-navbar.png",
    data: { link },
  };

  self.registration.showNotification(title, options);
});

// Abrir o enfocar pestaña al hacer clic
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.link || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Enfocar una existente si coincide
      const client = list.find((c) => c.url.includes(url));
      if (client) return client.focus();
      // O abrir una nueva
      return clients.openWindow(url);
    })
  );
});
