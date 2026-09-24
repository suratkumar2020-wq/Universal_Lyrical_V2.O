import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore/lite";

const firebaseConfig = {
  apiKey: "AIzaSyDWFpqOtRYW-Pw1tm9iVB1UUMOIBRh3Rfg",
  authDomain: "universal-lyrics-database.firebaseapp.com",
  projectId: "universal-lyrics-database",
  storageBucket: "universal-lyrics-database.firebasestorage.app",
  messagingSenderId: "962151933726",
  appId: "1:962151933726:web:c385965d56a7fe29bdcb0f"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Export lightweight Firestore Lite instance (drastically reduces extension bundle size)
export const db = getFirestore(app);