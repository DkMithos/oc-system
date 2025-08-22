// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyAjljNiqn9ywPZeJmqJrE-y-Q_0QS1qGck",
  authDomain: "oc-system-3910d.firebaseapp.com",
  projectId: "oc-system-3910d",
  storageBucket: "oc-system-3910d.firebasestorage.app",
  messagingSenderId: "12901498656",
  appId: "1:12901498656:web:93c4d28bad0cd31786e145"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, db, storage };
export const auth = getAuth(app);
