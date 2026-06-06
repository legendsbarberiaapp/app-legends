/**
 * LEGENDS BARBERIA - FIREBASE ADAPTER
 * Adaptador completo utilizando Firebase SDK Compat (v9/v10)
 */

// =============================================
// EMAILS ADMIN HARDCODEADOS
// Los usuarios con estos emails reciben rol 'admin' automáticamente
// al iniciar sesión y no pueden ser degradados desde la UI.
// Para agregar/quitar admins: editar este array y desplegar.
// =============================================
const ADMIN_EMAILS = [
    'legends.barberia.app@gmail.com',
    'sinfiniity@gmail.com'
];

// Retrocompat: algunos archivos todavía referencian ADMIN_EMAIL singular.
// Mantenemos como alias del primer admin (el principal del negocio).
const ADMIN_EMAIL = ADMIN_EMAILS[0];

function isAdminEmail(email) {
    if (!email) return false;
    const lower = String(email).toLowerCase();
    return ADMIN_EMAILS.some(e => e.toLowerCase() === lower);
}

/**
 * Detecta si la app corre como PWA instalada en iOS. En iOS standalone WebKit
 * bloquea los popups de OAuth, así que ahí vamos directo a redirect. En el
 * resto (escritorio, web móvil, Android PWA) el popup funciona bien.
 */
function isIOSPWA() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.navigator.standalone === true ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return isIOS && standalone;
}

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

        // iOS PWA instalada: el popup está bloqueado por WebKit → redirect directo.
        // (Tras el redirect, onAuthStateChanged crea/recupera el doc del usuario.)
        if (isIOSPWA()) {
            return await this.auth.signInWithRedirect(provider);
        }

        try {
            const result = await this.auth.signInWithPopup(provider);
            return await this.ensureUserDocument(result.user);
        } catch (error) {
            // Cerrar el popup o cancelarlo es una acción NORMAL del usuario:
            // no es un error que haya que mostrar. Lo dejamos pasar en silencio.
            if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                throw error;
            }
            // Popup bloqueado o no soportado (PWA/navegadores restrictivos):
            // caemos a redirect, que es más robusto en móvil instalado.
            if (error.code === 'auth/popup-blocked'
                || error.code === 'auth/operation-not-supported-in-this-environment'
                || error.code === 'auth/internal-error') {
                console.warn('Popup falló (' + error.code + '), reintentando con redirect…');
                return await this.auth.signInWithRedirect(provider);
            }
            console.error('Error in Google Sign-In:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('No se pudo iniciar sesión con Google. Intenta de nuevo.', 'error');
            }
            throw error;
        }
    }

    async signOut() {
        if (!this.initialized) return;
        return await this.auth.signOut();
    }

    /**
     * Crear o recuperar documento de usuario en Firestore.
     * Si el email está en ADMIN_EMAILS, forzar rol 'admin'.
     */
    async ensureUserDocument(firebaseUser) {
        const userRef = this.db.collection('users').doc(firebaseUser.uid);
        const doc = await userRef.get();

        // Determinar el rol: admin si está en la lista de emails admin
        const isAdmin = isAdminEmail(firebaseUser.email);

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

        // Si es admin pero en Firestore no tiene rol admin, intentar actualizarlo.
        // Las reglas de Firestore bloquean que un usuario cambie su propio `role`
        // (anti escalación de privilegios), así que este self-heal puede fallar;
        // lo envolvemos para no romper el login. En la práctica los emails admin
        // se crean ya con rol admin, así que esta rama casi nunca se ejecuta.
        if (isAdmin && existingData.role !== 'admin') {
            try {
                await userRef.update({ role: 'admin' });
                existingData.role = 'admin';
                console.log('✓ Rol actualizado a admin para:', firebaseUser.email);
            } catch (e) {
                console.warn('⚠ No se pudo auto-promover a admin (ajustar rol en consola):', e.code || e.message);
            }
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

    /**
     * Guardar el teléfono del usuario (usado para WhatsApp del admin).
     * Se pide una sola vez en la primera reserva y queda en su perfil.
     */
    async updateUserPhone(uid, phone) {
        if (!this.initialized) return false;
        try {
            await this.db.collection('users').doc(uid).update({ phone });
            console.log(`✓ Teléfono guardado para ${uid}`);
            return true;
        } catch (error) {
            console.error('❌ Error guardando teléfono:', error);
            return false;
        }
    }

    async getUserData(uid) {
        if (!this.initialized) return null;
        const doc = await this.db.collection('users').doc(uid).get();
        return doc.exists ? doc.data() : null;
    }

    /**
     * Obtener TODOS los usuarios registrados (para panel de admin).
     * ⚠ Úsalo con cuidado: trae todos los docs. Preferir getUsersByRole() en UI.
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
     * Obtener usuarios de UN solo rol (filtrado en servidor).
     * Mucho más barato que traer todos y filtrar en cliente.
     */
    async getUsersByRole(role) {
        if (!this.initialized) return [];
        try {
            const snapshot = await this.db.collection('users').where('role', '==', role).get();
            const users = [];
            snapshot.forEach(doc => {
                users.push({ uid: doc.id, ...doc.data() });
            });
            console.log(`✓ ${users.length} usuarios con rol "${role}" cargados`);
            return users;
        } catch (error) {
            console.error(`❌ Error cargando usuarios con rol ${role}:`, error);
            return [];
        }
    }

    /**
     * Cambiar el rol de un usuario en Firestore.
     * No permite cambiar el rol del admin.
     *
     * @param {string} uid
     * @param {string} newRole
     * @param {object} [extraFields] - campos adicionales a setear en el mismo update
     *                                  (ej. { sedeId: 'abc' } al promover a recepcionista).
     *                                  Si el nuevo rol NO es 'recepcionista', se limpia sedeId
     *                                  automáticamente para evitar datos huérfanos.
     */
    async setUserRole(uid, newRole, extraFields) {
        if (!this.initialized) return false;

        try {
            // Verificar que no se esté cambiando el rol de un admin hardcodeado
            const userDoc = await this.db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (isAdminEmail(userData.email)) {
                    console.warn('⚠ No se puede cambiar el rol de un administrador hardcodeado');
                    return false;
                }
            }

            const update = { role: newRole, ...(extraFields || {}) };
            // Limpia sedeId si el nuevo rol no la necesita (recepcionista es el único
            // rol con sede en F1; barbero la tiene en su doc `barberos`, no en `users`).
            if (newRole !== 'recepcionista' && !('sedeId' in update)) {
                update.sedeId = firebase.firestore.FieldValue.delete();
            }

            await this.db.collection('users').doc(uid).update(update);
            console.log(`✓ Rol de ${uid} cambiado a: ${newRole}`);
            return true;
        } catch (error) {
            console.error('❌ Error cambiando rol:', error);
            return false;
        }
    }

    integrateWithRoleManager(roleManager) {
        if (!this.initialized) this.initFirebase();

        this.auth.onAuthStateChanged(async (firebaseUser) => {
            authStateResolved = true; // Firebase respondió → desactiva el safety-net.
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

                // Arrancar listeners real-time según rol
                if (userData.role === 'cliente') {
                    if (typeof window.startClienteCitasListener === 'function') {
                        window.startClienteCitasListener(userData.uid);
                    }
                    // F7: recordatorios "tu cita es en 2h" (mientras app abierta)
                    if (typeof window.refrescarRecordatoriosCitas === 'function') {
                        window.refrescarRecordatoriosCitas(userData.uid);
                    }
                }
                if (userData.role === 'admin' && typeof window.startAdminPendingListener === 'function') {
                    window.startAdminPendingListener();
                }
                // F7: recepcionista también recibe ping de nuevas citas pendientes
                // — filtradas por su sede.
                if (userData.role === 'recepcionista' && userData.sedeId
                    && typeof window.startRecepcionistaPendingListener === 'function') {
                    window.startRecepcionistaPendingListener(userData.sedeId);
                }

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

                // Detener listeners real-time (si estaban activos)
                if (typeof window.stopClienteCitasListener === 'function') {
                    window.stopClienteCitasListener();
                }
                if (typeof window.stopAdminPendingListener === 'function') {
                    window.stopAdminPendingListener();
                }
                // F7
                if (typeof window.stopRecepcionistaPendingListener === 'function') {
                    window.stopRecepcionistaPendingListener();
                }
                if (typeof window.stopRecordatoriosCitas === 'function') {
                    window.stopRecordatoriosCitas();
                }

                // Ocultar spinner y mostrar botones de login
                if (loadingState) loadingState.style.display = 'none';
                if (loginButtons) {
                    loginButtons.style.display = 'block';
                    loginButtons.style.animation = 'fadeIn 0.5s ease-out';
                }

                // Restablecer botón de Google por si quedó deshabilitado de una sesión anterior
                const googleBtn = document.getElementById('google-login-btn');
                if (googleBtn) {
                    googleBtn.disabled = false;
                    googleBtn.style.opacity = '1';
                    googleBtn.style.pointerEvents = 'auto';
                }
                isLoginInProgress = false;

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

// Safety-net del splash: se pone true en cuanto onAuthStateChanged responde
// (con o sin usuario). Si Firebase se cuelga y nunca responde, un timeout
// revela igual los botones de login para no dejar el spinner eterno.
let authStateResolved = false;

/** Oculta el spinner "Verificando sesión…" y muestra los botones de login. */
function revealLoginButtons() {
    const loadingState = document.getElementById('auth-loading-state');
    const loginButtons = document.getElementById('auth-login-buttons');
    if (loadingState) loadingState.style.display = 'none';
    if (loginButtons) {
        loginButtons.style.display = 'block';
        loginButtons.style.animation = 'fadeIn 0.5s ease-out';
    }
}

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

window.handleSignOut = () => firebaseAdapter.signOut();

document.addEventListener('DOMContentLoaded', () => {
    // Safety-net: si Firebase no responde en 8s (init colgada o mala red),
    // mostramos igual los botones de login para no dejar el spinner
    // "Verificando sesión…" eterno.
    setTimeout(() => {
        if (!authStateResolved) {
            console.warn('⚠ Auth no respondió en 8s — mostrando login (safety-net)');
            revealLoginButtons();
        }
    }, 8000);

    // Inicializar Firebase tan pronto carga la página
    firebaseAdapter.initFirebase().then(() => {
        // Enlazar onAuthStateChanged con roleManager
        if (typeof roleManager !== 'undefined') {
            firebaseAdapter.integrateWithRoleManager(roleManager);
        }
        // Consumir el resultado de un posible login por redirect (PWA/iOS).
        // Al usuario lo maneja onAuthStateChanged; aquí solo capturamos errores
        // del redirect para avisar con un toast sin romper el splash.
        if (firebaseAdapter.auth) {
            firebaseAdapter.auth.getRedirectResult().catch((err) => {
                console.error('Error al volver del redirect de login:', err);
                if (typeof window.showToast === 'function') {
                    window.showToast('No se pudo completar el inicio de sesión. Intenta de nuevo.', 'error');
                }
            });
        }
    }).catch((e) => {
        // Si la init de Firebase falla, no dejamos al usuario en el spinner:
        // mostramos los botones para que al menos pueda intentar entrar.
        console.error('Error inicializando Firebase:', e);
        authStateResolved = true;
        revealLoginButtons();
    });
});
