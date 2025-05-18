import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC3H2EbvZMf8gZF4eEzajXBzLK2ETNg5_s",
  authDomain: "opticaahkimpech-6e935.firebaseapp.com",
  projectId: "opticaahkimpech-6e935",
  storageBucket: "opticaahkimpech-6e935.firebasestorage.app",
  messagingSenderId: "930923890271",
  appId: "1:930923890271:web:db2d05cc7972aa3e27bdea",
  measurementId: "G-8PXXHF2MPY"
};

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

export { app, auth, db }