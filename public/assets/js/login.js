import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

const firebaseConfig = {
  apiKey: "AIzaSyC3H2EbvZMf8gZF4eEzajXBzLK2ETNg5_s",
  authDomain: "opticaahkimpech-6e935.firebaseapp.com",
  projectId: "opticaahkimpech-6e935",
  storageBucket: "opticaahkimpech-6e935.firebasestorage.app",
  messagingSenderId: "930923890271",
  appId: "1:930923890271:web:db2d05cc7972aa3e27bdea",
  measurementId: "G-8PXXHF2MPY",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

// Sistema de Alertas Mejorado
class AlertSystem {
  constructor() {
    this.container = document.getElementById('alertContainer');
    this.alerts = [];
  }

  show(message, type = 'info', duration = 5000, persistent = false) {
    const alertId = Date.now().toString();
    const alert = this.createAlert(alertId, message, type, persistent);
    
    this.container.appendChild(alert);
    this.alerts.push({ id: alertId, element: alert, persistent });

    // Trigger animation
    setTimeout(() => {
      alert.classList.add('show');
    }, 10);

    // Auto remove if not persistent
    if (!persistent && duration > 0) {
      setTimeout(() => {
        this.remove(alertId);
      }, duration);
    }

    return alertId;
  }

  createAlert(id, message, type, persistent) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.setAttribute('data-alert-id', id);

    const icons = {
      success: '✓',
      warning: '⚠',
      danger: '✕',
      info: 'ℹ'
    };

    alert.innerHTML = `
      <span class="alert-icon">${icons[type] || icons.info}</span>
      <span class="alert-message">${message}</span>
      ${!persistent ? '<button type="button" class="alert-close">&times;</button>' : ''}
    `;

    // Add close event if not persistent
    if (!persistent) {
      const closeBtn = alert.querySelector('.alert-close');
      closeBtn.addEventListener('click', () => {
        this.remove(id);
      });
    }

    return alert;
  }

  remove(alertId) {
    const alertIndex = this.alerts.findIndex(a => a.id === alertId);
    if (alertIndex === -1) return;

    const alert = this.alerts[alertIndex];
    alert.element.style.opacity = '0';
    alert.element.style.transform = 'translateX(100%)';

    setTimeout(() => {
      if (alert.element.parentNode) {
        alert.element.parentNode.removeChild(alert.element);
      }
      this.alerts.splice(alertIndex, 1);
    }, 300);
  }

  clear() {
    this.alerts.forEach(alert => {
      if (!alert.persistent) {
        this.remove(alert.id);
      }
    });
  }

  success(message, duration = 5000) {
    return this.show(message, 'success', duration);
  }

  warning(message, duration = 7000) {
    return this.show(message, 'warning', duration);
  }

  error(message, duration = 8000) {
    return this.show(message, 'danger', duration);
  }

  info(message, duration = 5000) {
    return this.show(message, 'info', duration);
  }
}

// Sistema de Modal
class ModalSystem {
  constructor() {
    this.modals = new Map();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.close(e.target.id);
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAll();
      }
    });
  }

  show(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.style.display = 'block';
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);

    this.modals.set(modalId, modal);
  }

  close(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('show');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);

    this.modals.delete(modalId);
  }

  closeAll() {
    this.modals.forEach((modal, modalId) => {
      this.close(modalId);
    });
  }
}

// Inicializar sistemas
const alertSystem = new AlertSystem();
const modalSystem = new ModalSystem();

// Variables globales
let isLoading = false;

// Función para validar inputs
function validateInput(input, isValid) {
  if (!input) return;
  input.classList.remove('input-error', 'input-success');
  if (isValid === true) {
    input.classList.add('input-success');
  } else if (isValid === false) {
    input.classList.add('input-error');
  }
}

function clearInputValidation() {
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.classList.remove('input-error', 'input-success');
  });
}

// Función para establecer estado de carga
function setLoadingState(loading) {
  isLoading = loading;
  const loginBtn = document.getElementById('loginBtn');
  const loginBtnText = document.getElementById('loginBtnText');
  
  if (loginBtn) {
    loginBtn.disabled = loading;
  }
  
  if (loginBtnText) {
    if (loading) {
      loginBtnText.innerHTML = '<span class="spinner"></span>Iniciando sesión...';
    } else {
      loginBtnText.textContent = 'Iniciar sesión';
    }
  }
}

// Función para mostrar errores mejorados
function showError(error, isAdminMode) {
  const errorMessage = document.getElementById("error-message");
  
  let message = "Error al iniciar sesión. Inténtalo de nuevo.";
  let alertType = 'danger';

  switch (error.code) {
    case "auth/user-not-found":
      message = isAdminMode ? 
        "No se encontró una cuenta con este correo electrónico." : 
        "Usuario no encontrado. Verifica tu nombre de usuario.";
      alertType = 'warning';
      break;
    case "auth/wrong-password":
      message = "Contraseña incorrecta.";
      if (isAdminMode) {
        message += " ¿Olvidaste tu contraseña?";
      }
      alertType = 'warning';
      break;
    case "auth/too-many-requests":
      message = "Demasiados intentos fallidos. Inténtalo más tarde.";
      alertType = 'warning';
      break;
    case "auth/user-disabled":
      message = isAdminMode ? 
        "Esta cuenta está desactivada. Contacta al administrador." :
        "Tu cuenta está desactivada. Contacta al administrador.";
      alertType = 'danger';
      break;
    case "auth/missing-fields":
      message = "Por favor, completa todos los campos requeridos.";
      alertType = 'warning';
      break;
    case "auth/invalid-email":
      message = "Formato de correo electrónico inválido.";
      alertType = 'warning';
      break;
    case "auth/network-request-failed":
      message = "Error de conexión. Verifica tu conexión a internet.";
      alertType = 'danger';
      break;
    case "auth/invalid-credential":
      message = isAdminMode ? 
        "Credenciales inválidas. Verifica tu correo y contraseña." :
        "Credenciales inválidas. Verifica tu usuario y contraseña.";
      alertType = 'warning';
      break;
    case "auth/invalid-username":
      message = error.message || "Nombre de usuario inválido.";
      alertType = 'warning';
      break;
  }

  // Mostrar en el contenedor de error del formulario
  if (errorMessage) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    errorMessage.style.color = "red";

    // Ocultar el mensaje después de 8 segundos
    setTimeout(() => {
      errorMessage.classList.remove('show');
    }, 8000);
  }

  // También mostrar como alerta
  alertSystem.show(message, alertType, 8000);
}

// Función para verificar si el email existe en la base de datos
async function checkEmailExistsInDatabase(email) {
  try {
    // Buscar en la colección de usuarios por email
    const usersRef = collection(db, "usuarios");
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error al verificar email en la base de datos:", error);
    return false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Verificar si hay un usuario ya autenticado
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Si hay un usuario autenticado, redirigir a inventario.html
      redirectToInventario(user.uid)
    }
  })

  // Elementos del DOM
  const loginForm = document.getElementById("loginForm")
  const errorMessage = document.getElementById("error-message")
  const togglePassword = document.getElementById("togglePassword")
  const toggleEmployeePassword = document.getElementById("toggleEmployeePassword")
  const toggleLoginMode = document.getElementById("toggleLoginMode")
  const adminLoginFields = document.getElementById("adminLoginFields")
  const employeeLoginFields = document.getElementById("employeeLoginFields")
  const loginModeText = document.getElementById("loginModeText")
  const forgotPasswordLink = document.getElementById("forgotPasswordLink")

  // Mostrar/ocultar contraseña para administradores
  if (togglePassword) {
    togglePassword.addEventListener("click", function () {
      const password = document.getElementById("password")
      const type = password.getAttribute("type") === "password" ? "text" : "password"
      password.setAttribute("type", type)
      this.textContent = type === "password" ? "👁️" : "🔒"
    })
  }

  // Mostrar/ocultar contraseña para empleados
  if (toggleEmployeePassword) {
    toggleEmployeePassword.addEventListener("click", function () {
      const password = document.getElementById("employeePassword")
      const type = password.getAttribute("type") === "password" ? "text" : "password"
      password.setAttribute("type", type)
      this.textContent = type === "password" ? "👁️" : "🔒"
    })
  }

  // Cambiar entre modos de inicio de sesión (admin/empleado)
  if (toggleLoginMode) {
    toggleLoginMode.addEventListener("click", (e) => {
      e.preventDefault()
      const isAdminMode = adminLoginFields.style.display !== "none"

      // Limpiar alertas y validaciones al cambiar modo
      alertSystem.clear();
      clearInputValidation();
      if (errorMessage) {
        errorMessage.classList.remove('show');
      }

      if (isAdminMode) {
        // Cambiar a modo empleado
        adminLoginFields.style.display = "none"
        employeeLoginFields.style.display = "block"
        loginModeText.textContent = "Iniciar como Administrador"

        // Desactivar campos de administrador
        document.getElementById("email").required = false
        document.getElementById("password").required = false

        // Activar campos de empleado
        document.getElementById("username").required = true
        document.getElementById("employeePassword").required = true
      } else {
        // Cambiar a modo administrador
        adminLoginFields.style.display = "block"
        employeeLoginFields.style.display = "none"
        loginModeText.textContent = "Iniciar como Empleado"

        // Activar campos de administrador
        document.getElementById("email").required = true
        document.getElementById("password").required = true

        // Desactivar campos de empleado
        document.getElementById("username").required = false
        document.getElementById("employeePassword").required = false
      }
    })
  }

  // Manejar el envío del formulario de login
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      if (isLoading) return;

      const isAdminMode = adminLoginFields.style.display !== "none"

      // Limpiar alertas y validaciones previas
      alertSystem.clear();
      clearInputValidation();
      if (errorMessage) {
        errorMessage.classList.remove('show');
      }
      setLoadingState(true);

      try {
        let user

        if (isAdminMode) {
          // Inicio de sesión con correo electrónico (administrador)
          const email = document.getElementById("email").value.trim()
          const password = document.getElementById("password").value

          if (!email || !password) {
            validateInput(document.getElementById("email"), !email ? false : null);
            validateInput(document.getElementById("password"), !password ? false : null);
            throw { code: "auth/missing-fields" }
          }

          // Validar formato de email
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            validateInput(document.getElementById("email"), false);
            throw { code: "auth/invalid-email" }
          }

          validateInput(document.getElementById("email"), true);
          validateInput(document.getElementById("password"), true);

          const userCredential = await signInWithEmailAndPassword(auth, email, password)
          user = userCredential.user
        } else {
          // Inicio de sesión con nombre de usuario (empleado)
          const username = document.getElementById("username").value.trim()
          const password = document.getElementById("employeePassword").value

          if (!username || !password) {
            validateInput(document.getElementById("username"), !username ? false : null);
            validateInput(document.getElementById("employeePassword"), !password ? false : null);
            throw { code: "auth/missing-fields" }
          }

          // Validar longitud mínima del username
          if (username.length < 3) {
            validateInput(document.getElementById("username"), false);
            throw { code: "auth/invalid-username", message: "El nombre de usuario debe tener al menos 3 caracteres." }
          }

          validateInput(document.getElementById("username"), true);
          validateInput(document.getElementById("employeePassword"), true);

          // Buscar el usuario en Firestore por nombre de usuario
          const usersRef = collection(db, "usuarios")
          const q = query(usersRef, where("username", "==", username))
          const querySnapshot = await getDocs(q)

          if (querySnapshot.empty) {
            validateInput(document.getElementById("username"), false);
            throw { code: "auth/user-not-found" }
          }

          // Obtener el documento del usuario
          const userDoc = querySnapshot.docs[0]
          const userData = userDoc.data()
          const userId = userDoc.id

          // Verificar si el usuario está activo
          if (userData.activo === false) {
            throw { code: "auth/user-disabled" }
          }

          // Verificar la contraseña
          if (userData.password !== password) {
            validateInput(document.getElementById("employeePassword"), false);
            throw { code: "auth/wrong-password" }
          }

          // Si llegamos aquí, el usuario y contraseña son correctos
          // Verificar si el usuario tiene un correo electrónico asociado
          if (!userData.email) {
            // Si no tiene correo, establecer información en sessionStorage
            sessionStorage.setItem(
              "currentUser",
              JSON.stringify({
                uid: userId,
                username: userData.username,
                nombre: userData.nombre || userData.username,
                role: userData.rol || "vendedor",
                rol: userData.rol || "vendedor",
                activo: userData.activo !== false,
              })
            )
            
            // Mostrar mensaje de éxito y redirigir
            alertSystem.success("¡Inicio de sesión exitoso! Redirigiendo...", 2000);
            setTimeout(() => {
              window.location.href = "./views/inventario.html"
            }, 2000);
            return
          }

          // Si tiene correo, iniciar sesión con Firebase Auth
          try {
            const userCredential = await signInWithEmailAndPassword(auth, userData.email, password)
            user = userCredential.user
          } catch (authError) {
            console.error("Error de autenticación con Firebase:", authError)
            
            // Si falla Firebase Auth pero las credenciales son correctas en Firestore
            sessionStorage.setItem(
              "currentUser",
              JSON.stringify({
                uid: userId,
                username: userData.username,
                nombre: userData.nombre || userData.username,
                role: userData.rol || "vendedor",
                rol: userData.rol || "vendedor",
                activo: userData.activo !== false,
                email: userData.email || null,
              })
            )
            
            // Mostrar mensaje de éxito y redirigir
            alertSystem.success("¡Inicio de sesión exitoso! Redirigiendo...", 2000);
            setTimeout(() => {
              window.location.href = "./views/inventario.html"
            }, 2000);
            return
          }
        }

        // Si llegamos aquí, el login fue exitoso
        alertSystem.success("¡Inicio de sesión exitoso! Redirigiendo...", 2000);
        
        // Redirigir al usuario a la página de inventario
        setTimeout(() => {
          redirectToInventario(user.uid)
        }, 2000);

      } catch (error) {
        // Manejar errores de autenticación
        console.error("Error de autenticación:", error)
        showError(error, isAdminMode);
      } finally {
        setLoadingState(false);
      }
    })
  }

  // Configurar modal de recuperación de contraseña
  setupPasswordRecoveryModal();

  // Manejar el clic en "¿Olvidaste tu contraseña?"
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault()
      
      // Pre-llenar el email si está disponible
      const emailInput = document.getElementById("email");
      const recoveryEmailInput = document.getElementById("recoveryEmail");
      if (emailInput && recoveryEmailInput && emailInput.value) {
        recoveryEmailInput.value = emailInput.value;
      }
      
      modalSystem.show('passwordRecoveryModal');
    })
  }
})

// Configurar modal de recuperación de contraseña
function setupPasswordRecoveryModal() {
  const closeModal = document.getElementById('closeModal');
  const cancelRecovery = document.getElementById('cancelRecovery');
  const sendRecovery = document.getElementById('sendRecovery');
  const sendRecoveryText = document.getElementById('sendRecoveryText');
  const recoveryErrorMessage = document.getElementById('recovery-error-message');

  if (closeModal) {
    closeModal.addEventListener('click', () => {
      modalSystem.close('passwordRecoveryModal');
    });
  }

  if (cancelRecovery) {
    cancelRecovery.addEventListener('click', () => {
      modalSystem.close('passwordRecoveryModal');
    });
  }

  if (sendRecovery) {
    sendRecovery.addEventListener('click', async () => {
      const email = document.getElementById('recoveryEmail').value.trim();
      
      // Limpiar errores previos
      if (recoveryErrorMessage) {
        recoveryErrorMessage.classList.remove('show');
      }
      
      if (!email) {
        if (recoveryErrorMessage) {
          recoveryErrorMessage.textContent = 'Por favor, ingresa tu correo electrónico.';
          recoveryErrorMessage.classList.add('show');
        }
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        if (recoveryErrorMessage) {
          recoveryErrorMessage.textContent = 'Por favor, ingresa un correo electrónico válido.';
          recoveryErrorMessage.classList.add('show');
        }
        return;
      }

      // Set loading state
      sendRecovery.disabled = true;
      if (sendRecoveryText) {
        sendRecoveryText.innerHTML = '<span class="spinner"></span>Enviando...';
      }

      try {
        // Verificar si el email existe en la base de datos antes de enviar
        const emailExists = await checkEmailExistsInDatabase(email);
        
        if (!emailExists) {
          if (recoveryErrorMessage) {
            recoveryErrorMessage.textContent = 'No se encontró una cuenta con ese correo electrónico en nuestro sistema.';
            recoveryErrorMessage.classList.add('show');
          }
          return;
        }

        // Enviar correo de recuperación de contraseña
        await sendPasswordResetEmail(auth, email);
        
        modalSystem.close('passwordRecoveryModal');
        alertSystem.success(`Se ha enviado un enlace de recuperación a ${email}. Revisa tu bandeja de entrada.`, 8000);
        
        // Limpiar el formulario
        document.getElementById('recoveryEmail').value = '';
        
      } catch (error) {
        console.error("Error al enviar correo de recuperación:", error);
        
        let message = "Error al enviar el correo de recuperación. Inténtalo de nuevo.";
        
        if (error.code === "auth/user-not-found") {
          message = "No se encontró una cuenta con ese correo electrónico.";
        } else if (error.code === "auth/invalid-email") {
          message = "Formato de correo electrónico inválido.";
        } else if (error.code === "auth/too-many-requests") {
          message = "Demasiadas solicitudes. Inténtalo más tarde.";
        }
        
        if (recoveryErrorMessage) {
          recoveryErrorMessage.textContent = message;
          recoveryErrorMessage.classList.add('show');
        }
        
      } finally {
        sendRecovery.disabled = false;
        if (sendRecoveryText) {
          sendRecoveryText.textContent = 'Enviar enlace';
        }
      }
    });
  }
}

// Función para redirigir al usuario a inventario.html
async function redirectToInventario(uid) {
  try {
    // Obtener información del usuario desde Firestore
    const userDocRef = doc(db, "usuarios", uid)
    const userDoc = await getDoc(userDocRef)

    if (userDoc.exists()) {
      const userData = userDoc.data()

      // Verificar si el usuario está activo
      if (userData.activo === false) {
        auth.signOut()
        alertSystem.error("Tu cuenta está desactivada. Contacta al administrador.");
        return
      }

      // Asegurarse de que el rol esté correctamente almacenado
      const userRole = userData.rol || "vendedor"

      console.log("Rol del usuario:", userRole)

      // Guardar información del usuario en sessionStorage
      sessionStorage.setItem(
        "currentUser",
        JSON.stringify({
          uid: uid,
          email: userData.email,
          username: userData.username,
          nombre: userData.nombre,
          role: userRole,
          rol: userRole,
          activo: userData.activo !== false,
        }),
      )

      // Redirigir a inventario.html
      window.location.href = "./views/inventario.html"
    } else {
      console.error("No se encontró información del usuario en la base de datos")
      alertSystem.error("Error: No se encontró información del usuario. Contacta al administrador.");
    }
  } catch (error) {
    console.error("Error al obtener datos del usuario:", error)
    alertSystem.error("Error al cargar datos del usuario. Inténtalo de nuevo.");
  }
}