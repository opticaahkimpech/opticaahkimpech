import {
  collection,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

import { auth, db } from "./firebase-config.js"

// Variables globales
const currentUser = null

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Página de usuarios cargada")

  try {
    // Verificar si el usuario actual es administrador
    const userData = JSON.parse(sessionStorage.getItem("currentUser"))
    if (!userData || (userData.role !== "admin" && userData.rol !== "admin")) {
      // Mostrar mensaje de acceso restringido
      const adminOnlyMessage = document.getElementById("adminOnlyMessage")
      if (adminOnlyMessage) {
        adminOnlyMessage.style.display = "block"
      }

      // Ocultar contenido de administración
      const addUserBtn = document.getElementById("addUserBtn")
      if (addUserBtn) {
        addUserBtn.style.display = "none"
      }

      // Redirigir después de 3 segundos
      setTimeout(() => {
        window.location.href = "inventario.html"
      }, 3000)

      return
    }

    // Configurar eventos para los modales
    setupModalEvents()

    // Configurar eventos para los formularios
    setupFormEvents()

    // Configurar eventos para las búsquedas
    setupSearchEvents()

    // Cargar datos iniciales
    await loadUsers()
  } catch (error) {
    console.error("Error al inicializar la página de usuarios:", error)
    showToast("Error al cargar la página de usuarios", "danger")
  }
})

// Función para mostrar notificaciones toast
function showToast(message, type = "info") {
  // Crear contenedor de toast si no existe
  let toastContainer = document.getElementById("toastContainer")
  if (!toastContainer) {
    toastContainer = document.createElement("div")
    toastContainer.id = "toastContainer"
    toastContainer.className = "fixed top-4 right-4 z-50 max-w-xs"
    document.body.appendChild(toastContainer)
  }

  const toast = document.createElement("div")
  toast.className = `bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 mb-3 flex items-center justify-between border-l-4 ${
    type === "success"
      ? "border-green-500"
      : type === "danger"
        ? "border-red-500"
        : type === "warning"
          ? "border-yellow-500"
          : "border-blue-500"
  }`

  toast.innerHTML = `
        <div class="flex items-center">
            <span class="${
              type === "success"
                ? "text-green-500"
                : type === "danger"
                  ? "text-red-500"
                  : type === "warning"
                    ? "text-yellow-500"
                    : "text-blue-500"
            }">${message}</span>
        </div>
        <button type="button" class="ml-4 text-gray-400 hover:text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    `

  toastContainer.appendChild(toast)

  // Agregar evento para cerrar el toast
  const closeBtn = toast.querySelector("button")
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      toast.remove()
    })
  }

  // Cerrar automáticamente después de 5 segundos
  setTimeout(() => {
    if (toastContainer.contains(toast)) {
      toast.remove()
    }
  }, 5000)
}

// Configurar eventos para los modales
function setupModalEvents() {
  // Configurar botón para agregar usuario
  const addUserBtn = document.getElementById("addUserBtn")
  if (addUserBtn) {
    addUserBtn.addEventListener("click", () => {
      // Mostrar modal de usuario
      const modal = document.getElementById("userModal")
      if (modal) {
        modal.style.display = "block"
        document.getElementById("userModalTitle").textContent = "Nuevo Usuario"
        document.getElementById("userForm").reset()
        document.getElementById("userId").value = ""

        // Mostrar campo de contraseña
        const passwordField = document.getElementById("password")
        const passwordLabel = document.querySelector('label[for="password"]')
        if (passwordField && passwordLabel) {
          passwordField.style.display = "block"
          passwordField.required = true
          passwordLabel.style.display = "block"
        }
      }
    })
  }

  // Configurar botones para cerrar modales
  const closeButtons = document.querySelectorAll(".close, .close-modal")
  closeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".modal").forEach((modal) => {
        modal.style.display = "none"
      })
    })
  })

  // Cerrar modal al hacer clic fuera del contenido
  window.addEventListener("click", (event) => {
    document.querySelectorAll(".modal").forEach((modal) => {
      if (event.target === modal) {
        modal.style.display = "none"
      }
    })
  })
}

// Configurar eventos para los formularios
function setupFormEvents() {
  // Configurar formulario de usuario
  const userForm = document.getElementById("userForm")
  if (userForm) {
    userForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      try {
        const userId = document.getElementById("userId").value
        const username = document.getElementById("username").value
        const password = document.getElementById("password").value
        const nombre = document.getElementById("nombre").value
        const rol = document.getElementById("rol").value
        const activo = document.getElementById("activo").value === "1"

        // Validar campos requeridos
        if (!username || (!userId && !password) || !nombre) {
          showToast("Por favor, complete los campos requeridos", "warning")
          return
        }

        // Verificar si el nombre de usuario ya existe
        if (!userId) {
          const usersRef = collection(db, "usuarios")
          const q = query(usersRef, where("username", "==", username))
          const querySnapshot = await getDocs(q)

          if (!querySnapshot.empty) {
            showToast("El nombre de usuario ya existe", "warning")
            return
          }
        }

        if (!userId) {
          // Crear nuevo usuario

          // Generar un correo electrónico único para Firebase Auth
          const email = `${username.toLowerCase()}@ahkimpech.com`

          // Crear usuario en Firebase Auth
          const userCredential = await createUserWithEmailAndPassword(auth, email, password)
          const newUserId = userCredential.user.uid

          // Crear objeto de usuario
          const userData = {
            uid: newUserId,
            username,
            email,
            password, // En un sistema real, NO almacenar contraseñas en texto plano
            nombre,
            rol,
            activo,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }

          // Guardar en Firestore
          await setDoc(doc(db, "usuarios", newUserId), userData)

          showToast("Usuario creado correctamente", "success")
        } else {
          // Actualizar usuario existente
          const userRef = doc(db, "usuarios", userId)
          const userDoc = await getDoc(userRef)

          if (!userDoc.exists()) {
            showToast("Usuario no encontrado", "danger")
            return
          }

          const userData = userDoc.data()

          // Actualizar datos
          const updateData = {
            username,
            nombre,
            rol,
            activo,
            updatedAt: serverTimestamp(),
          }

          // Si se proporcionó una nueva contraseña, actualizarla
          if (password) {
            updateData.password = password

            // Actualizar contraseña en Firebase Auth
            // Esto normalmente requeriría reautenticación, pero como es un admin quien lo hace,
            // podríamos usar funciones de Firebase Admin SDK en un backend real
          }

          // Actualizar en Firestore
          await updateDoc(userRef, updateData)

          showToast("Usuario actualizado correctamente", "success")
        }

        // Cerrar modal
        document.getElementById("userModal").style.display = "none"

        // Recargar usuarios
        await loadUsers()
      } catch (error) {
        console.error("Error al guardar usuario:", error)
        showToast("Error al guardar el usuario: " + error.message, "danger")
      }
    })
  }
}

// Configurar eventos para las búsquedas
function setupSearchEvents() {
  // Búsqueda de usuarios
  const searchUserBtn = document.getElementById("searchUserBtn")
  const searchUser = document.getElementById("searchUser")

  if (searchUserBtn && searchUser) {
    searchUserBtn.addEventListener("click", () => {
      loadUsers(searchUser.value.trim())
    })

    searchUser.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        loadUsers(searchUser.value.trim())
      }
    })
  }
}

// Función para cargar usuarios
async function loadUsers(searchTerm = "") {
  const tableBody = document.getElementById("usersTableBody")
  if (!tableBody) return

  // Limpiar tabla
  tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center">Cargando usuarios...</td></tr>'

  try {
    // Obtener todos los usuarios
    const usersRef = collection(db, "usuarios")
    const q = query(usersRef, orderBy("username"))
    const querySnapshot = await getDocs(q)

    // Filtrar usuarios según término de búsqueda
    let users = []
    querySnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      users = users.filter(
        (user) =>
          (user.username && user.username.toLowerCase().includes(term)) ||
          (user.nombre && user.nombre.toLowerCase().includes(term)) ||
          (user.email && user.email.toLowerCase().includes(term)),
      )
    }

    // Limpiar tabla
    tableBody.innerHTML = ""

    if (users.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center">No se encontraron usuarios</td></tr>'
      return
    }

    // Agregar usuarios a la tabla
    users.forEach((user) => {
      const row = document.createElement("tr")
      row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

      // Determinar clase para el estado
      const estadoClass = user.activo ? "text-green-500" : "text-red-500"
      const estadoText = user.activo ? "Activo" : "Inactivo"

      // Determinar texto del rol
      const rolText = user.rol === "admin" ? "Administrador" : "Empleado"

      row.innerHTML = `
                <td class="py-3 px-4">${user.id.substring(0, 8)}...</td>
                <td class="py-3 px-4">${user.username || ""}</td>
                <td class="py-3 px-4">${user.nombre || ""}</td>
                <td class="py-3 px-4">${rolText}</td>
                <td class="py-3 px-4">
                    <span class="${estadoClass} font-semibold">${estadoText}</span>
                </td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        <button class="edit-user text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${user.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button class="delete-user text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${user.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            `

      tableBody.appendChild(row)
    })

    // Configurar eventos para los botones de editar y eliminar
    setupUserEvents()
  } catch (error) {
    console.error("Error al cargar usuarios:", error)
    tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-red-500">Error al cargar usuarios</td></tr>'
    showToast("Error al cargar usuarios", "danger")
  }
}

// Configurar eventos para los usuarios
function setupUserEvents() {
  // Configurar botones para editar usuarios
  const editButtons = document.querySelectorAll(".edit-user")
  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const userId = button.getAttribute("data-id")
      editUser(userId)
    })
  })

  // Configurar botones para eliminar usuarios
  const deleteButtons = document.querySelectorAll(".delete-user")
  deleteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const userId = button.getAttribute("data-id")
      confirmDeleteUser(userId)
    })
  })
}

// Función para editar un usuario
async function editUser(userId) {
  try {
    // Obtener datos del usuario
    const userRef = doc(db, "usuarios", userId)
    const userDoc = await getDoc(userRef)

    if (!userDoc.exists()) {
      showToast("Usuario no encontrado", "danger")
      return
    }

    const userData = userDoc.data()

    // Mostrar modal de usuario
    const modal = document.getElementById("userModal")
    if (modal) {
      modal.style.display = "block"
      document.getElementById("userModalTitle").textContent = "Editar Usuario"

      // Llenar formulario con datos del usuario
      document.getElementById("userId").value = userId
      document.getElementById("username").value = userData.username || ""
      document.getElementById("nombre").value = userData.nombre || ""
      document.getElementById("rol").value = userData.rol || "vendedor"
      document.getElementById("activo").value = userData.activo ? "1" : "0"

      // Ocultar campo de contraseña (opcional en edición)
      const passwordField = document.getElementById("password")
      const passwordLabel = document.querySelector('label[for="password"]')
      if (passwordField && passwordLabel) {
        passwordField.value = ""
        passwordField.required = false
        passwordField.placeholder = "Dejar en blanco para mantener la actual"
      }
    }
  } catch (error) {
    console.error("Error al obtener usuario:", error)
    showToast("Error al obtener el usuario", "danger")
  }
}

// Función para confirmar eliminación de un usuario
function confirmDeleteUser(userId) {
  if (confirm("¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.")) {
    deleteUser(userId)
  }
}

// Función para eliminar un usuario
async function deleteUser(userId) {
  try {
    // Verificar que no sea el usuario actual
    const currentUser = JSON.parse(sessionStorage.getItem("currentUser"))
    if (currentUser && currentUser.uid === userId) {
      showToast("No puedes eliminar tu propio usuario", "warning")
      return
    }

    // Eliminar usuario de Firestore
    await deleteDoc(doc(db, "usuarios", userId))

    // También deberíamos eliminar el usuario de Firebase Auth
    // Esto normalmente requeriría usar Firebase Admin SDK en un backend

    showToast("Usuario eliminado correctamente", "success")

    // Recargar usuarios
    await loadUsers()
  } catch (error) {
    console.error("Error al eliminar usuario:", error)
    showToast("Error al eliminar el usuario", "danger")
  }
}