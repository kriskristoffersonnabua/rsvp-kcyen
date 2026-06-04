// ─────────────────────────────────────────────
//  FIREBASE CONFIG — replace with your values
// ─────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBNR5gjFPe2dLUFcbLIFevW0O6oy6yy8Nc",
  authDomain: "rsvp-kcyen.firebaseapp.com",
  projectId: "rsvp-kcyen",
  storageBucket: "rsvp-kcyen.firebasestorage.app",
  messagingSenderId: "688726060156",
  appId: "1:688726060156:web:3964be265dfee1c0116df9",
  databaseURL: "https://rsvp-kcyen-default-rtdb.asia-southeast1.firebasedatabase.app/",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
