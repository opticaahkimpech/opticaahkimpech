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

document.addEventListener("DOMContentLoaded", () => {
  // Verificar si hay un usuario ya autenticado
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // Si hay un usuario autenticado, redirigir a inventario.html
      redirectToInventario(user.uid)
    }
  })

  // Manejar el envío del formulario de login
  const loginForm = document.getElementById("loginForm")
  const errorMessage = document.getElementById("error-message")

  // Mostrar/ocultar contraseña para administradores
  const togglePassword = document.getElementById("togglePassword")
  if (togglePassword) {
    togglePassword.addEventListener("click", function () {
      const password = document.getElementById("password")
      const type = password.getAttribute("type") === "password" ? "text" : "password"
      password.setAttribute("type", type)
      this.textContent = type === "password" ? "👁️" : "🔒"
    })
  }

  // Mostrar/ocultar contraseña para empleados
  const toggleEmployeePassword = document.getElementById("toggleEmployeePassword")
  if (toggleEmployeePassword) {
    toggleEmployeePassword.addEventListener("click", function () {
      const password = document.getElementById("employeePassword")
      const type = password.getAttribute("type") === "password" ? "text" : "password"
      password.setAttribute("type", type)
      this.textContent = type === "password" ? "👁️" : "🔒"
    })
  }

  // Cambiar entre modos de inicio de sesión (admin/empleado)
  const toggleLoginMode = document.getElementById("toggleLoginMode")
  const adminLoginFields = document.getElementById("adminLoginFields")
  const employeeLoginFields = document.getElementById("employeeLoginFields")
  const loginModeText = document.getElementById("loginModeText")

  if (toggleLoginMode) {
    toggleLoginMode.addEventListener("click", (e) => {
      e.preventDefault()
      const isAdminMode = adminLoginFields.style.display !== "none"

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

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault()

    const isAdminMode = adminLoginFields.style.display !== "none"

    try {
      let user

      if (isAdminMode) {
        // Inicio de sesión con correo electrónico (administrador)
        const email = document.getElementById("email").value
        const password = document.getElementById("password").value

        if (!email || !password) {
          throw { code: "auth/missing-fields" }
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password)
        user = userCredential.user
      } else {
        // Inicio de sesión con nombre de usuario (empleado)
        const username = document.getElementById("username").value
        const password = document.getElementById("employeePassword").value

        if (!username || !password) {
          throw { code: "auth/missing-fields" }
        }

        // Buscar el usuario en Firestore por nombre de usuario
        const usersRef = collection(db, "usuarios")
        const q = query(usersRef, where("username", "==", username))
        const querySnapshot = await getDocs(q)

        if (querySnapshot.empty) {
          throw { code: "auth/user-not-found" }
        }

        // Obtener el documento del usuario
        const userDoc = querySnapshot.docs[0]
        const userData = userDoc.data()

        // Verificar si el usuario está activo
        if (userData.activo === false) {
          throw { code: "auth/user-disabled" }
        }

        // Verificar la contraseña (en un sistema real, esto debería hacerse en el servidor)
        if (userData.password !== password) {
          throw { code: "auth/wrong-password" }
        }

        // Si llegamos aquí, el usuario y contraseña son correctos
        // Iniciar sesión con el correo asociado al usuario
        const userCredential = await signInWithEmailAndPassword(auth, userData.email, password)
        user = userCredential.user
      }

      // Redirigir al usuario a la página de inventario
      redirectToInventario(user.uid)
    } catch (error) {
      // Manejar errores de autenticación
      console.error("Error de autenticación:", error)

      let message = "Error al iniciar sesión. Inténtalo de nuevo."

      if (error.code === "auth/user-not-found") {
        message = "Usuario no encontrado."
      } else if (error.code === "auth/wrong-password") {
        message = "Contraseña incorrecta."
      } else if (error.code === "auth/too-many-requests") {
        message = "Demasiados intentos fallidos. Inténtalo más tarde."
      } else if (error.code === "auth/user-disabled") {
        message = "Esta cuenta está desactivada. Contacta al administrador."
      } else if (error.code === "auth/missing-fields") {
        message = "Por favor, completa todos los campos requeridos."
      }

      errorMessage.textContent = message
    }
  })

  // Manejar el clic en "¿Olvidaste tu contraseña?"
  const forgotPasswordLink = document.getElementById("forgotPasswordLink")
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", async (e) => {
      e.preventDefault()

      const email = document.getElementById("email").value
      if (!email) {
        errorMessage.textContent = "Por favor, ingresa tu correo electrónico para recuperar tu contraseña."
        return
      }

      try {
        // Enviar correo de recuperación de contraseña
        await sendPasswordResetEmail(auth, email)
        errorMessage.textContent =
          "Se ha enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada."
        errorMessage.style.color = "green"
      } catch (error) {
        console.error("Error al enviar correo de recuperación:", error)
        let message = "Error al enviar el correo de recuperación. Inténtalo de nuevo."

        if (error.code === "auth/user-not-found") {
          message = "No se encontró una cuenta con ese correo electrónico."
        }

        errorMessage.textContent = message
        errorMessage.style.color = "red"
      }
    })
  }
})

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
        document.getElementById("error-message").textContent = "Tu cuenta está desactivada. Contacta al administrador."
        return
      }

      // Asegurarse de que el rol esté correctamente almacenado
      const userRole = userData.rol || "vendedor" // Valor por defecto si no existe

      console.log("Rol del usuario:", userRole)

      // Guardar información del usuario en sessionStorage
      sessionStorage.setItem(
        "currentUser",
        JSON.stringify({
          uid: uid,
          email: userData.email,
          username: userData.username,
          nombre: userData.nombre,
          role: userRole, // Usar siempre la misma propiedad 'role'
          rol: userRole, // Mantener 'rol' para compatibilidad
          activo: userData.activo !== false, // Asegurar que activo sea booleano
        }),
      )

      // Redirigir a inventario.html
      window.location.href = "./views/inventario.html"
    } else {
      console.error("No se encontró información del usuario en la base de datos")
      document.getElementById("error-message").textContent =
        "Error: No se encontró información del usuario. Contacta al administrador."
    }
  } catch (error) {
    console.error("Error al obtener datos del usuario:", error)
    document.getElementById("error-message").textContent = "Error al cargar datos del usuario. Inténtalo de nuevo."
  }
}
