import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"

import {
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

import { auth, db } from "./firebase-config.js"

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Verificando autenticación...")

  // Configurar el botón de cerrar sesión PRIMERO
  setupLogoutButton();

  // Cargar información del usuario desde sessionStorage
  let currentUser = JSON.parse(sessionStorage.getItem("currentUser"))

  // Si hay un usuario en sessionStorage, consideramos que está autenticado
  if (currentUser) {
    console.log("Usuario encontrado en sessionStorage:", currentUser)

    try {
      // Verificar si existe la colección de inventario
      await checkAndCreateInventoryCollection()

      // Verificar si el usuario está activo
      if (currentUser.activo === false) {
        console.error("Usuario inactivo, cerrando sesión...")
        await signOut(auth)
        sessionStorage.removeItem("currentUser")
        window.location.href = "../../index.html?error=inactive"
        return
      }

      // Verificar si el usuario existe en Firestore
      const userDocRef = doc(db, "usuarios", currentUser.uid)
      const userDocSnap = await getDoc(userDocRef)

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data()

        // Verificar si el usuario está activo en Firestore
        if (userData.activo === false) {
          console.error("Usuario inactivo en Firestore, cerrando sesión...")
          await signOut(auth)
          sessionStorage.removeItem("currentUser")
          window.location.href = "../../index.html?error=inactive"
          return
        }

        // Actualizar datos del usuario si es necesario
        const userRole = userData.rol || userData.role || "vendedor"

        if (currentUser.role !== userRole || currentUser.rol !== userRole) {
          currentUser.role = userRole
          currentUser.rol = userRole
          sessionStorage.setItem("currentUser", JSON.stringify(currentUser))
        }
      } else {
        console.warn("Usuario no encontrado en Firestore pero existe en sessionStorage")
      }

      setupUserInterface(currentUser)
      checkPageAccess()
      return
    } catch (error) {
      console.error("Error al verificar usuario desde sessionStorage:", error)
    }
  }

  // Si no hay usuario en sessionStorage o hubo un error, verificar con Firebase Auth
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Si no hay usuario autenticado, redirigir al login
      console.log("No hay usuario autenticado, redirigiendo al login...")
      window.location.href = "../../index.html"
      return
    }

    console.log("Usuario autenticado con Firebase:", user.email)

    try {
      // Verificar si existe la colección de inventario
      await checkAndCreateInventoryCollection()

      // Si no hay información en sessionStorage, intentar obtenerla de Firestore
      console.log("Obteniendo información del usuario desde Firestore...")
      const userDocRef = doc(db, "usuarios", user.uid)
      const userDocSnap = await getDoc(userDocRef)

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data()
        console.log("Datos del usuario obtenidos de Firestore:", userData)

        // Verificar si el usuario está activo
        if (userData.activo === false) {
          console.error("Usuario inactivo, cerrando sesión...")
          await signOut(auth)
          window.location.href = "../../index.html?error=inactive"
          return
        }

        // Asegurarse de que el rol esté correctamente almacenado
        const userRole = userData.rol || userData.role || "vendedor" // Valor por defecto si no existe

        currentUser = {
          uid: user.uid,
          email: userData.email,
          username: userData.username,
          nombre: userData.nombre,
          role: userRole, // Usar siempre la misma propiedad 'role'
          rol: userRole, // Mantener 'rol' para compatibilidad
          activo: userData.activo !== false, // Asegurar que activo sea booleano
        }

        sessionStorage.setItem("currentUser", JSON.stringify(currentUser))
        console.log("Usuario guardado en sessionStorage:", currentUser)
      } else {
        console.error("No se encontró información del usuario en la base de datos")
        await signOut(auth)
        window.location.href = "../../index.html"
        return
      }

      setupUserInterface(currentUser)
      checkPageAccess()
    } catch (error) {
      console.error("Error al verificar usuario o colecciones:", error)
      await signOut(auth)
      window.location.href = "../../index.html"
    }
  })
})

// Función para configurar el botón de cerrar sesión
function setupLogoutButton() {
  console.log("Configurando botón de cerrar sesión...");
  
  // Buscar el botón de cerrar sesión
  const logoutBtn = document.getElementById("logoutBtn");
  
  if (logoutBtn) {
    console.log("Botón de cerrar sesión encontrado, configurando evento...");
    
    // Eliminar cualquier evento previo para evitar duplicados
    logoutBtn.removeEventListener("click", handleLogout);
    
    // Agregar el nuevo evento
    logoutBtn.addEventListener("click", handleLogout);
  } else {
    console.warn("No se encontró el botón de cerrar sesión");
  }
}

// Función para manejar el cierre de sesión
async function handleLogout(event) {
  console.log("Evento de cierre de sesión activado");
  event.preventDefault();
  
  try {
    console.log("Intentando cerrar sesión...");
    await signOut(auth);
    console.log("Sesión cerrada en Firebase Auth");
    
    // Limpiar sessionStorage
    sessionStorage.removeItem("currentUser");
    console.log("Usuario eliminado de sessionStorage");
    
    // Redirigir al login
    console.log("Redirigiendo a la página de inicio de sesión...");
    window.location.href = "../../index.html";
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    
    // Asegurarse de limpiar sessionStorage incluso si falla el signOut
    sessionStorage.removeItem("currentUser");
    
    // Redirigir al login de todos modos
    window.location.href = "../../index.html";
  }
}

// Función para verificar y crear la colección de inventario si no existe
export async function checkAndCreateInventoryCollection() {
  try {
    console.log("Verificando colecciones de inventario...")

    // Verificar si existe la colección de categorías
    const categoriasSnapshot = await getDocs(collection(db, "categorias"))
    if (categoriasSnapshot.empty) {
      console.log("Creando colección de categorías...")
      // Crear categorías iniciales
      const categoriasIniciales = [
        { nombre: "General", descripcion: "Productos generales" },
        { nombre: "Lentes de Contacto", descripcion: "Lentes de contacto" },
        { nombre: "Lentes Solares", descripcion: "Lentes para sol" },
        { nombre: "Lentes Fotocromáticos", descripcion: "Lentes fotocromáticos" },
        { nombre: "Lentes Oftálmicos", descripcion: "Lentes oftálmicos" },
        { nombre: "Armazones", descripcion: "Armazones para lentes" },
        { nombre: "Accesorios", descripcion: "Accesorios para lentes" },
        { nombre: "Limpieza", descripcion: "Productos de limpieza" },
      ]

      for (const categoria of categoriasIniciales) {
        await addDoc(collection(db, "categorias"), {
          ...categoria,
          createdAt: serverTimestamp(),
        })
      }
    }

    // Verificar si existe la colección de proveedores
    const proveedoresSnapshot = await getDocs(collection(db, "proveedores"))
    if (proveedoresSnapshot.empty) {
      console.log("Creando colección de proveedores...")
      // Crear un proveedor inicial
      await addDoc(collection(db, "proveedores"), {
        nombre: "Proveedor General",
        telefono: "",
        email: "",
        direccion: "",
        createdAt: serverTimestamp(),
      })
    }

    // Verificar si existe la colección de productos
    const productosSnapshot = await getDocs(collection(db, "productos"))
    if (productosSnapshot.empty) {
      console.log("Creando colección de productos...")
      // Crear un documento vacío para inicializar la colección
      await setDoc(doc(db, "productos", "placeholder"), {
        isPlaceholder: true,
        createdAt: serverTimestamp(),
      })
    }

    // Verificar si existe la colección de armazones
    const armazonesSnapshot = await getDocs(collection(db, "armazones"))
    if (armazonesSnapshot.empty) {
      console.log("Creando colección de armazones...")
      // Crear un documento vacío para inicializar la colección
      await setDoc(doc(db, "armazones", "placeholder"), {
        isPlaceholder: true,
        createdAt: serverTimestamp(),
      })
    }

    // Verificar si existe la colección de usuarios
    const usuariosSnapshot = await getDocs(collection(db, "usuarios"))
    if (usuariosSnapshot.empty) {
      console.log("Creando colección de usuarios...")
      // No es necesario crear un documento placeholder, ya que el usuario admin ya existe
    }

    console.log("Verificación de colecciones completada")
  } catch (error) {
    console.error("Error al verificar o crear colecciones:", error)
    throw error // Propagar el error para manejarlo en el nivel superior
  }
}

// Configurar la interfaz de usuario según el rol
function setupUserInterface(userData) {
  console.log("Configurando interfaz para usuario:", userData)

  // Agregar badge de rol en el header
  const header = document.querySelector(".main-header .logo")
  if (header) {
    // Eliminar badge existente si hay uno
    const existingBadge = header.querySelector(".role-badge")
    if (existingBadge) {
      existingBadge.remove()
    }

    // Crear nuevo badge
    const roleBadge = document.createElement("div")
    roleBadge.className = "role-badge"

    // Determinar clase y texto según el rol
    // Verificar ambas propiedades para mayor compatibilidad
    const isAdmin = userData.role === "admin" || userData.rol === "admin"

    console.log("¿Es administrador?", isAdmin, "role:", userData.role, "rol:", userData.rol)

    if (isAdmin) {
      roleBadge.classList.add("admin-badge")
      roleBadge.textContent = "Administrador"
    } else {
      roleBadge.classList.add("employee-badge")
      roleBadge.textContent = "Empleado"
    }

    // Agregar badge al header
    header.appendChild(roleBadge)
  }

  // Mostrar/ocultar enlaces según el rol
  const isAdmin = userData.role === "admin" || userData.rol === "admin"

  // Ocultar enlace a usuarios para empleados
  const usuariosLink = document.querySelector('.main-nav a[href="usuarios.html"]')
  if (usuariosLink && !isAdmin) {
    usuariosLink.parentElement.style.display = "none"
  }

  console.log(`Interfaz configurada para usuario con rol: ${userData.role || userData.rol}`)
}

// Verificar acceso a la página actual según el rol
function checkPageAccess() {
  const currentUser = JSON.parse(sessionStorage.getItem("currentUser"))
  if (!currentUser) return

  const isAdmin = currentUser.role === "admin" || currentUser.rol === "admin"

  // Verificar si estamos en la página de usuarios
  const currentPath = window.location.pathname
  if (currentPath.includes("usuarios.html") && !isAdmin) {
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
  }
}