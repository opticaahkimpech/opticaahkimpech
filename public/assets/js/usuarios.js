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

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

import { auth, db } from "./firebase-config.js"

// Variables globales
const currentUser = null

let currentPage = 1;
const pageSize = 10;
let totalPages = 1;
let lastFiltros = {};

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Página de usuarios cargada")

  // Eventos para paginador
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        loadUsers(lastFiltros);
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++;
        loadUsers(lastFiltros);
      }
    });
  }

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
  toast.className = `bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 mb-3 flex items-center justify-between border-l-4 ${type === "success"
    ? "border-green-500"
    : type === "danger"
      ? "border-red-500"
      : type === "warning"
        ? "border-yellow-500"
        : "border-blue-500"
    }`

  toast.innerHTML = `
        <div class="flex items-center">
            <span class="${type === "success"
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

        // Mostrar u ocultar campo de email según el rol seleccionado
        updateEmailFieldVisibility();
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

// Función para actualizar la visibilidad del campo de email según el rol
function updateEmailFieldVisibility() {
  const rolSelect = document.getElementById("rol");
  const emailField = document.getElementById("email");
  const emailLabel = document.querySelector('label[for="email"]');

  if (rolSelect && emailField && emailLabel) {
    const isAdmin = rolSelect.value === "admin";

    // Mostrar u ocultar campo de email según el rol
    emailField.style.display = isAdmin ? "block" : "none";
    emailLabel.style.display = isAdmin ? "block" : "none";
    emailField.required = isAdmin;

    // Si no es admin, limpiar el campo de email
    if (!isAdmin) {
      emailField.value = "";
    }
  }
}

// Configurar eventos para los formularios
function setupFormEvents() {
  // Configurar formulario de usuario
  const userForm = document.getElementById("userForm")
  if (userForm) {
    // Agregar campo de email al formulario si no existe
    if (!document.getElementById("email")) {
      const rolField = document.getElementById("rol").parentNode;
      const emailGroup = document.createElement("div");
      emailGroup.className = "form-group";
      emailGroup.innerHTML = `
        <label for="email">Correo Electrónico</label>
        <input type="email" id="email" name="email" class="form-control">
      `;
      rolField.parentNode.insertBefore(emailGroup, rolField.nextSibling);
    }

    // Configurar evento para cambio de rol
    const rolSelect = document.getElementById("rol");
    if (rolSelect) {
      rolSelect.addEventListener("change", updateEmailFieldVisibility);
    }

    // Inicializar visibilidad del campo de email
    updateEmailFieldVisibility();

    userForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      try {
        const userId = document.getElementById("userId").value
        const username = document.getElementById("username").value
        const password = document.getElementById("password").value
        const nombre = document.getElementById("nombre").value
        const rol = document.getElementById("rol").value
        const activo = document.getElementById("activo").value === "1"
        const email = document.getElementById("email").value

        // Validar campos requeridos
        if (!username || (!userId && !password) || !nombre) {
          showToast("Por favor, complete los campos requeridos", "warning")
          return
        }

        // Validar email para administradores
        if (rol === "admin" && !email) {
          showToast("El correo electrónico es requerido para administradores", "warning")
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
          let newUserId;

          if (rol === "admin") {
            // Para administradores, crear usuario en Firebase Auth
            try {
              // Crear usuario en Firebase Authentication
              const userCredential = await createUserWithEmailAndPassword(auth, email, password)
              newUserId = userCredential.user.uid

              // Verificar que el usuario se creó correctamente intentando iniciar sesión
              // Esto es opcional, pero puede ayudar a detectar problemas
              try {
                // Cerrar sesión actual (si hay)
                if (auth.currentUser) {
                  await auth.signOut()
                }

                // Intentar iniciar sesión con las nuevas credenciales
                await signInWithEmailAndPassword(auth, email, password)

                // Si llegamos aquí, la autenticación fue exitosa
                console.log("Verificación de autenticación exitosa para el nuevo administrador")

                // Volver a cerrar sesión para no interferir con la sesión actual
                await auth.signOut()
              } catch (verifyError) {
                console.error("Error al verificar credenciales del nuevo administrador:", verifyError)
                // Continuamos de todos modos, ya que el usuario se creó
              }
            } catch (authError) {
              console.error("Error al crear usuario en Firebase Auth:", authError)
              showToast("Error al crear usuario: " + authError.message, "danger")
              return
            }
          } else {
            // Para empleados, generar un ID único
            newUserId = generateUniqueId()
          }

          // Crear objeto de usuario para Firestore
          const userData = {
            username,
            nombre,
            rol,
            activo,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }

          // Agregar email solo para administradores
          if (rol === "admin") {
            userData.email = email
          }

          // Agregar contraseña solo para empleados (no para administradores)
          if (rol !== "admin") {
            userData.password = password
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
          const isAdmin = userData.rol === "admin"
          const changingToAdmin = rol === "admin" && !isAdmin
          const changingFromAdmin = rol !== "admin" && isAdmin

          // Validar email si se está cambiando a admin
          if (changingToAdmin && !email) {
            showToast("El correo electrónico es requerido para administradores", "warning")
            return
          }

          // Actualizar datos básicos
          const updateData = {
            username,
            nombre,
            rol,
            activo,
            updatedAt: serverTimestamp(),
          }

          // Actualizar email solo para administradores
          if (rol === "admin") {
            updateData.email = email
          } else if (userData.email) {
            // Si se cambia de admin a empleado, mantener el email por compatibilidad
            updateData.email = userData.email
          }

          // Si se proporcionó una nueva contraseña
          if (password) {
            // Para empleados, actualizar contraseña en Firestore
            if (rol !== "admin") {
              updateData.password = password
            }

            // Para administradores, no guardamos la contraseña en Firestore
            // Aquí deberíamos actualizar la contraseña en Firebase Auth
            // Pero esto requiere reautenticación o usar Firebase Admin SDK
          }

          // Si está cambiando de admin a empleado, necesitamos agregar contraseña
          if (changingFromAdmin && password) {
            updateData.password = password
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

// Función para generar un ID único para empleados
function generateUniqueId() {
  // Generar un ID único con prefijo 'emp_' seguido de timestamp y caracteres aleatorios
  return 'emp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Configurar eventos para las búsquedas
function setupSearchEvents() {
  const searchUser = document.getElementById("searchUser");
  const filtroRol = document.getElementById("filtroRol");
  const filtroEstado = document.getElementById("filtroEstado");
  const filtroFechaInicio = document.getElementById("filtroFechaInicio");
  const filtroFechaFin = document.getElementById("filtroFechaFin");
  const aplicarFiltrosBtn = document.getElementById("aplicarFiltrosBtn");
  const limpiarFiltrosBtn = document.getElementById("limpiarFiltrosBtn");
  const toggleFiltrosBtn = document.getElementById("toggleFiltrosBtn");
  const filtrosPanel = document.getElementById("filtrosPanel");

  // Mostrar/ocultar panel de filtros
  if (toggleFiltrosBtn && filtrosPanel) {
    toggleFiltrosBtn.addEventListener("click", () => {
      filtrosPanel.style.display = filtrosPanel.style.display === "none" ? "block" : "none";
    });
  }

  // Búsqueda en tiempo real
  if (searchUser) {
    searchUser.addEventListener("input", () => {
      currentPage = 1;
      loadUsers(getFiltros());
    });
  }

  // Botón aplicar filtros
  if (aplicarFiltrosBtn) {
    aplicarFiltrosBtn.addEventListener("click", () => {
      currentPage = 1;
      loadUsers(getFiltros());
    });
  }

  // Botón limpiar filtros
  if (limpiarFiltrosBtn) {
    limpiarFiltrosBtn.addEventListener("click", () => {
      if (filtroRol) filtroRol.value = "";
      if (filtroEstado) filtroEstado.value = "";
      if (filtroFechaInicio) filtroFechaInicio.value = "";
      if (filtroFechaFin) filtroFechaFin.value = "";
      currentPage = 1;
      loadUsers(getFiltros());
    });
  }
}

// Obtener los filtros actuales
function getFiltros() {
  return {
    search: document.getElementById("searchUser")?.value.trim() || "",
    rol: document.getElementById("filtroRol")?.value || "",
    estado: document.getElementById("filtroEstado")?.value || "",
    fechaInicio: document.getElementById("filtroFechaInicio")?.value || "",
    fechaFin: document.getElementById("filtroFechaFin")?.value || "",
  };
}

// Función para cargar usuarios

async function loadUsers(filtros = {}) {
  const tableBody = document.getElementById("usersTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center">Cargando usuarios...</td></tr>';

  try {
    const usersRef = collection(db, "usuarios");
    const q = query(usersRef, orderBy("username"));
    const querySnapshot = await getDocs(q);

    let users = [];
    querySnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Filtro por búsqueda
    if (filtros.search) {
      const term = filtros.search.toLowerCase();
      users = users.filter(
        (user) =>
          (user.username && user.username.toLowerCase().includes(term)) ||
          (user.nombre && user.nombre.toLowerCase().includes(term)) ||
          (user.email && user.email.toLowerCase().includes(term))
      );
    }

    // Filtro por rol
    if (filtros.rol) {
      users = users.filter((user) => {
        if (filtros.rol === "employee") {
          return user.rol !== "admin";
        }
        return user.rol === filtros.rol;
      });
    }

    // Filtro por estado
    if (filtros.estado) {
      users = users.filter((user) => {
        if (filtros.estado === "active") return user.activo;
        if (filtros.estado === "inactive") return !user.activo;
        return true;
      });
    }

    // Filtro por fechas (createdAt)
    if (filtros.fechaInicio) {
      const inicio = new Date(filtros.fechaInicio);
      users = users.filter((user) => user.createdAt && user.createdAt.toDate && user.createdAt.toDate() >= inicio);
    }
    if (filtros.fechaFin) {
      const fin = new Date(filtros.fechaFin + "T23:59:59");
      users = users.filter((user) => user.createdAt && user.createdAt.toDate && user.createdAt.toDate() <= fin);
    }

    totalPages = Math.max(1, Math.ceil(users.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const usersToShow = users.slice(startIdx, endIdx);

    tableBody.innerHTML = "";

    if (usersToShow.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center">No se encontraron usuarios</td></tr>';
      updatePagination();
      return;
    }

    usersToShow.forEach((user) => {
      const row = document.createElement("tr");
      row.className = "hover:bg-gray-50 dark:hover:bg-gray-700";
      const estadoClass = user.activo ? "text-green-500" : "text-red-500";
      const estadoText = user.activo ? "Activo" : "Inactivo";
      const rolText = user.rol === "admin" ? "Administrador" : "Empleado";
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
      `;
      tableBody.appendChild(row);
    });

    updatePagination();
    setupUserEvents();
  } catch (error) {
    console.error("Error al cargar usuarios:", error);
    tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-red-500">Error al cargar usuarios</td></tr>';
    showToast("Error al cargar usuarios", "danger");
  }
}

// Actualiza la info y botones del paginador
function updatePagination() {
  const currentPageSpan = document.getElementById("currentPage");
  const totalPagesSpan = document.getElementById("totalPages");
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");

  if (currentPageSpan) currentPageSpan.textContent = currentPage;
  if (totalPagesSpan) totalPagesSpan.textContent = totalPages;

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
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

      // Llenar campo de email si existe
      const emailField = document.getElementById("email")
      if (emailField) {
        emailField.value = userData.email || ""
      }

      // Ocultar campo de contraseña (opcional en edición)
      const passwordField = document.getElementById("password")
      const passwordLabel = document.querySelector('label[for="password"]')
      if (passwordField && passwordLabel) {
        passwordField.value = ""
        passwordField.required = false
        passwordField.placeholder = "Dejar en blanco para mantener la actual"
      }

      // Actualizar visibilidad del campo de email
      updateEmailFieldVisibility();
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

    // Obtener datos del usuario para verificar si es admin
    const userRef = doc(db, "usuarios", userId)
    const userDoc = await getDoc(userRef)

    if (userDoc.exists()) {
      const userData = userDoc.data()

      // Eliminar usuario de Firestore
      await deleteDoc(userRef)

      // Si es admin, deberíamos eliminar también de Firebase Auth
      // Esto normalmente requeriría usar Firebase Admin SDK en un backend
      if (userData.rol === "admin") {
        console.warn("El usuario eliminado era un administrador. La cuenta en Firebase Authentication debe eliminarse manualmente o mediante Firebase Admin SDK.")
      }

      showToast("Usuario eliminado correctamente", "success")
    } else {
      showToast("Usuario no encontrado", "warning")
    }

    // Recargar usuarios
    await loadUsers()
  } catch (error) {
    console.error("Error al eliminar usuario:", error)
    showToast("Error al eliminar el usuario", "danger")
  }
}