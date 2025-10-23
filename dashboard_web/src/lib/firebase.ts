import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCMhkO5vTgedYHobkBo8njpy24yJPGPU_E",
  authDomain: "juliaca-transporte-hack.firebaseapp.com",
  projectId: "juliaca-transporte-hack",
  storageBucket: "juliaca-transporte-hack.firebasestorage.app",
  messagingSenderId: "929349685383",
  appId: "1:929349685383:web:53d5242e5d1186f2bf6822"
};

// Inicializar Firebase (con la protección para Next.js para evitar errores)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Inicializa los servicios que usaremos
const db = getFirestore(app);
const auth = getAuth(app);

// Exporta los servicios para usarlos en el resto de la app
export { app, db, auth };