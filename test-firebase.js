const firebase = require('firebase/app');
try {
    let app = firebase.initializeApp({
        apiKey: "AIzaSyDnIUuKk8ALsRtIXjzWVEzfQWXayfii2J0",
        authDomain: "legends-barber-9862c.firebaseapp.com",
        projectId: "legends-barber-9862c",
        storageBucket: "legends-barber-9862c.firebasestorage.app",
        messagingSenderId: "935307950602",
        appId: "1:935307950602:web:a8c6927b43a00515f17df3",
        measurementId: "G-NDGSX7515E"
    });
    console.log("SDK Initialized correctly");
} catch (error) {
    console.log("Error initializing SDK:", error.message);
}
