import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6gXvi6bmPd5GCKQ-1kZ66YPCb-A34tqo",
  authDomain: "studio-6680101022-359df.firebaseapp.com",
  projectId: "studio-6680101022-359df",
  storageBucket: "studio-6680101022-359df.firebasestorage.app",
  messagingSenderId: "938584797960",
  appId: "1:938584797960:web:e57f885a6be9bb4deab2bd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable persistence globally
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Firebase Persistence Error:", error);
});

export { app, auth, db };
