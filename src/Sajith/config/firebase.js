import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ඔයාගේ Firebase Project එකේ Keys ටික
const firebaseConfig = {
  apiKey: "AIzaSyBlLhk5NyeFjmdyHXOjLXw7SIl1KLUOQxo",
  authDomain: "sujith-chem.firebaseapp.com",
  projectId: "sujith-chem",
  storageBucket: "sujith-chem.firebasestorage.app",
  messagingSenderId: "254929740526",
  appId: "1:254929740526:web:6579267be190117a5d49ff",
  measurementId: "G-4B47KL8SHY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// ⚠️ මේ පේළි දෙක තමයි වැදගත්ම! මේවා අනිවාර්යයෙන්ම තියෙන්න ඕනේ.
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;