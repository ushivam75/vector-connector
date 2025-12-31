// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getDatabase, ref, set } from 'firebase/database';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyAkzeReLRgzmH8L7bF3I5FHLJY_AwEy8Fs',
  authDomain: 'vector-vvison.firebaseapp.com',
  databaseURL: 'https://vector-vvison-default-rtdb.firebaseio.com',
  projectId: 'vector-vvison',
  storageBucket: 'vector-vvison.firebasestorage.app',
  messagingSenderId: '74732604806',
  appId: '1:74732604806:web:662474618a2827d6b23007',
  measurementId: 'G-JTEGVFXYKQ',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
const db = getDatabase(app);

export const updateCameraUrl = (cameraId: string, publicUrl: string) => {
  // This saves the URL to: /cameras/home_1/streamUrl
  set(ref(db, 'cameras/' + cameraId), {
    streamUrl: publicUrl,
    lastUpdated: Date.now(),
    status: 'online',
  });
  console.log(
    `🔥 Firebase Updated: Camera ${cameraId} is live at ${publicUrl}`,
  );
};
