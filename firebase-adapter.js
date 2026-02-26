/**
 * LEGENDS BARBERIA - FIREBASE ADAPTER
 * Adaptador completo utilizando Firebase SDK Compat (v9/v10)
 */

class FirebaseAuthAdapter {
    constructor() {
        this.auth = null;
        this.db = null;
        this.initialized = false;
    }

    async initFirebase() {
        if (this.initialized) return;

        const firebaseConfig = {
            apiKey: "AIzaSyDnIUuKk8ALsRtIXjzWVEzfQWXayfii2J0",
            authDomain: "legends-barber-9862c.firebaseapp.com",
            projectId: "legends-barber-9862c",
            storageBucket: "legends-barber-9862c.firebasestorage.app",
            messagingSenderId: "935307950602",
            appId: "1:935307950602:web:a8c6927b43a00515f17df3",
            measurementId: "G-NDGSX7515E"
        };

        if (typeof firebase === 'undefined') {
            console.error('🔥 Firebase SDK no cargado');
            return;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.initialized = true;
        console.log('✓ Firebase Inicializado Core');
    }

    async signInWithGoogle() {
        if (!this.initialized) await this.initFirebase();
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            const result = await this.auth.signInWithPopup(provider);
            return await this.ensureUserDocument(result.user);
        } catch (error) {
            console.error('Error in Google Sign-In:', error);
            alert('Error al iniciar sesión con Google: ' + error.message);
            throw error;
        }
    }

    async signInWithApple() {
        if (!this.initialized) await this.initFirebase();
        const provider = new firebase.auth.OAuthProvider('apple.com');
        try {
            const result = await this.auth.signInWithPopup(provider);
            return await this.ensureUserDocument(result.user);
        } catch (error) {
            console.error('Error in Apple Sign-In:', error);
            alert('Error al iniciar sesión con Apple: ' + error.message);
            throw error;
        }
    }

    async signOut() {
        if (!this.initialized) return;
        return await this.auth.signOut();
    }

    async ensureUserDocument(firebaseUser) {
        const userRef = this.db.collection('users').doc(firebaseUser.uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            const newUserData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                role: 'cliente',
                displayName: firebaseUser.displayName || 'Nuevo Usuario',
                photoURL: firebaseUser.photoURL || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                metadata: {
                    loyaltyPoints: 0,
                    tier: 'Plata',
                    totalVisits: 0
                }
            };
            await userRef.set(newUserData);
            return newUserData;
        }

        return doc.data();
    }

    async getUserRole(uid) {
        if (!this.initialized) return 'cliente';
        const doc = await this.db.collection('users').doc(uid).get();
        return doc.exists ? doc.data().role : 'cliente';
    }

    async updateUserRole(uid, newRole) {
        if (!this.initialized) return;
        const userRef = this.db.collection('users').doc(uid);
        return await userRef.update({ role: newRole });
    }

    async getUserData(uid) {
        if (!this.initialized) return null;
        const doc = await this.db.collection('users').doc(uid).get();
        return doc.exists ? doc.data() : null;
    }

    integrateWithRoleManager(roleManager) {
        if (!this.initialized) this.initFirebase();

        // Limpiar mock defaults
        roleManager.loadUserFromStorage = () => null;
        roleManager.saveUserToStorage = () => { };

        this.auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                console.log('✓ Usuario autenticado en Firebase:', firebaseUser.email);
                const userData = await this.ensureUserDocument(firebaseUser);

                // Setear rol
                roleManager.currentUser = userData;
                roleManager.currentRole = userData.role;
                roleManager.initialized = true;
                roleManager.renderForRole();

                // Mostrar app
                const splash = document.getElementById('splash-screen');
                const app = document.getElementById('main-app');

                if (splash && splash.classList.contains('active')) {
                    splash.style.opacity = '0';
                    setTimeout(() => {
                        splash.classList.remove('active');
                        splash.classList.add('hidden');
                        app.classList.remove('hidden');
                        app.classList.add('active');
                        app.style.opacity = '0';
                        setTimeout(() => app.style.opacity = '1', 50);
                    }, 500);
                }
            } else {
                console.log('✓ Usuario desconectado de Firebase');
                roleManager.currentUser = null;
                roleManager.currentRole = null;
                roleManager.hideAllTabs();
                const navContainer = document.querySelector('.bottom-nav-container');
                if (navContainer) navContainer.innerHTML = '';
                roleManager.toggleFAB(false);

                // Mostrar splash
                const splash = document.getElementById('splash-screen');
                const app = document.getElementById('main-app');

                if (app && app.classList.contains('active')) {
                    app.style.opacity = '0';
                    setTimeout(() => {
                        app.classList.remove('active');
                        app.classList.add('hidden');
                        splash.classList.remove('hidden');
                        splash.classList.add('active');
                        splash.style.opacity = '0';
                        setTimeout(() => splash.style.opacity = '1', 50);
                    }, 500);
                }
            }
        });
    }
}

// Instancia global
const firebaseAdapter = new FirebaseAuthAdapter();

// Exponer en la ventana para botones de interfaz
window.handleGoogleLogin = () => firebaseAdapter.signInWithGoogle();
window.handleAppleLogin = () => firebaseAdapter.signInWithApple();
window.handleSignOut = () => firebaseAdapter.signOut();

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Firebase tan pronto carga la página
    firebaseAdapter.initFirebase().then(() => {
        // Enlazar onAuthStateChanged con roleManager
        if (typeof roleManager !== 'undefined') {
            firebaseAdapter.integrateWithRoleManager(roleManager);
        }
    });

    // Sobreescribir enterApp normal para impedir saltar login si está desconectado
    window.enterApp = () => {
        alert("Por favor inicia sesión para continuar.");
    };
});
