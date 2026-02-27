/**
 * LEGENDS BARBERIA - FIREBASE ADAPTER
 * Adaptador completo utilizando Firebase SDK Compat (v9/v10)
 */

// =============================================
// EMAIL ADMIN HARDCODEADO - ÚNICO ADMINISTRADOR
// =============================================
const ADMIN_EMAIL = 'legends.barberia.app@gmail.com';

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

    /**
     * Crear o recuperar documento de usuario en Firestore.
     * Si el email es ADMIN_EMAIL, forzar rol 'admin'.
     */
    async ensureUserDocument(firebaseUser) {
        const userRef = this.db.collection('users').doc(firebaseUser.uid);
        const doc = await userRef.get();

        // Determinar el rol: admin si es el email hardcodeado
        const isAdmin = firebaseUser.email && firebaseUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

        if (!doc.exists) {
            const newUserData = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                role: isAdmin ? 'admin' : 'cliente',
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
            console.log(`✓ Nuevo usuario creado: ${newUserData.displayName} (${newUserData.role})`);
            return newUserData;
        }

        const existingData = doc.data();

        // Si es admin pero en Firestore no tiene rol admin, actualizarlo
        if (isAdmin && existingData.role !== 'admin') {
            await userRef.update({ role: 'admin' });
            existingData.role = 'admin';
            console.log('✓ Rol actualizado a admin para:', firebaseUser.email);
        }

        return existingData;
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

    /**
     * Obtener TODOS los usuarios registrados (para panel de admin).
     */
    async getAllUsers() {
        if (!this.initialized) return [];
        try {
            const snapshot = await this.db.collection('users').get();
            const users = [];
            snapshot.forEach(doc => {
                users.push({ uid: doc.id, ...doc.data() });
            });
            console.log(`✓ ${users.length} usuarios cargados desde Firestore`);
            return users;
        } catch (error) {
            console.error('❌ Error cargando usuarios:', error);
            return [];
        }
    }

    /**
     * Cambiar el rol de un usuario en Firestore.
     * No permite cambiar el rol del admin.
     */
    async setUserRole(uid, newRole) {
        if (!this.initialized) return false;

        try {
            // Verificar que no se esté cambiando al admin
            const userDoc = await this.db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.email && userData.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
                    console.warn('⚠ No se puede cambiar el rol del administrador');
                    return false;
                }
            }

            await this.db.collection('users').doc(uid).update({ role: newRole });
            console.log(`✓ Rol de ${uid} cambiado a: ${newRole}`);
            return true;
        } catch (error) {
            console.error('❌ Error cambiando rol:', error);
            return false;
        }
    }

    integrateWithRoleManager(roleManager) {
        if (!this.initialized) this.initFirebase();

        // Limpiar mock defaults
        roleManager.loadUserFromStorage = () => null;
        roleManager.saveUserToStorage = () => { };

        this.auth.onAuthStateChanged(async (firebaseUser) => {
            const loadingState = document.getElementById('auth-loading-state');
            const loginButtons = document.getElementById('auth-login-buttons');

            if (firebaseUser) {
                console.log('✓ Usuario autenticado en Firebase:', firebaseUser.email);
                const userData = await this.ensureUserDocument(firebaseUser);

                // Setear rol
                roleManager.currentUser = userData;
                roleManager.currentRole = userData.role;
                roleManager.viewingAsRole = userData.role;  // Admin empieza viendo su propia vista
                roleManager.initialized = true;
                roleManager.renderForRole();

                // Mostrar app directamente (sin mostrar botones de login)
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

                // Ocultar spinner y mostrar botones de login
                if (loadingState) loadingState.style.display = 'none';
                if (loginButtons) {
                    loginButtons.style.display = 'block';
                    loginButtons.style.animation = 'fadeIn 0.5s ease-out';
                }

                roleManager.currentUser = null;
                roleManager.currentRole = null;
                roleManager.hideAllTabs();
                const navContainer = document.querySelector('.bottom-nav-container');
                if (navContainer) navContainer.innerHTML = '';
                roleManager.toggleFAB(false);

                // Mostrar splash (si no está ya visible)
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

// Protección contra doble clic en login
let isLoginInProgress = false;

// Exponer en la ventana para botones de interfaz
window.handleGoogleLogin = async () => {
    if (isLoginInProgress) {
        console.log('⚠ Login ya en progreso, ignorando clic duplicado');
        return;
    }

    const btn = document.getElementById('google-login-btn');
    isLoginInProgress = true;

    // Deshabilitar botón visualmente
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.pointerEvents = 'none';
    }

    try {
        await firebaseAdapter.signInWithGoogle();
    } catch (error) {
        console.error('Error en login:', error);
        // Rehabilitar botón si hay error
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        }
    } finally {
        isLoginInProgress = false;
    }
};

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
