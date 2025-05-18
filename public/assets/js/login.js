import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyC3H2EbvZMf8gZF4eEzajXBzLK2ETNg5_s",
  authDomain: "opticaahkimpech-6e935.firebaseapp.com",
  projectId: "opticaahkimpech-6e935",
  storageBucket: "opticaahkimpech-6e935.firebasestorage.app",
  messagingSenderId: "930923890271",
  appId: "1:930923890271:web:db2d05cc7972aa3e27bdea",
  measurementId: "G-8PXXHF2MPY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    // Verificar si hay un usuario ya autenticado
    onAuthStateChanged(auth, user => {
        if (user) {
            // Si hay un usuario autenticado, redirigir a inventario.html
            redirectToInventario(user.uid);
        }
    });

    // Manejar el envío del formulario de login
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');

    // Mostrar/ocultar contraseña
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            const password = document.getElementById('password');
            const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
            password.setAttribute('type', type);
            this.textContent = type === 'password' ? '👁️' : '🔒';
        });
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            // Intentar iniciar sesión con Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Redirigir al usuario a la página de inventario
            redirectToInventario(user.uid);
        } catch (error) {
            // Manejar errores de autenticación
            console.error("Error de autenticación:", error);
            
            let message = "Error al iniciar sesión. Inténtalo de nuevo.";
            
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                message = "Correo electrónico o contraseña incorrectos.";
            } else if (error.code === 'auth/too-many-requests') {
                message = "Demasiados intentos fallidos. Inténtalo más tarde.";
            }
            
            errorMessage.textContent = message;
        }
    });

    // Manejar el clic en "¿Olvidaste tu contraseña?"
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            if (!email) {
                errorMessage.textContent = "Por favor, ingresa tu correo electrónico para recuperar tu contraseña.";
                return;
            }

            try {
                // Enviar correo de recuperación de contraseña
                await sendPasswordResetEmail(auth, email);
                errorMessage.textContent = "Se ha enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.";
                errorMessage.style.color = "green";
            } catch (error) {
                console.error("Error al enviar correo de recuperación:", error);
                let message = "Error al enviar el correo de recuperación. Inténtalo de nuevo.";
                
                if (error.code === 'auth/user-not-found') {
                    message = "No se encontró una cuenta con ese correo electrónico.";
                }
                
                errorMessage.textContent = message;
                errorMessage.style.color = "red";
            }
        });
    }
});

// Función para redirigir al usuario a inventario.html
async function redirectToInventario(uid) {
    try {
        // Obtener información del usuario desde Firestore
        const userDocRef = doc(db, 'usuarios', uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Guardar información básica del usuario en sessionStorage
            sessionStorage.setItem('currentUser', JSON.stringify({
                uid: uid,
                email: userData.email,
                role: userData.role
            }));
            
            // Redirigir a inventario.html - Corregir la ruta
            window.location.href = './views/inventario.html';
        } else {
            console.error("No se encontró información del usuario en la base de datos");
            document.getElementById('error-message').textContent = 
                "Error: No se encontró información del usuario. Contacta al administrador.";
        }
    } catch (error) {
        console.error("Error al obtener datos del usuario:", error);
        document.getElementById('error-message').textContent = 
            "Error al cargar datos del usuario. Inténtalo de nuevo.";
    }
}