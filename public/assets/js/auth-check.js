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

  // Verificar si hay un usuario autenticado
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Si no hay usuario autenticado, redirigir al login
      console.log("No hay usuario autenticado, redirigiendo al login...")
      window.location.href = "../../index.html"
      return
    }

    console.log("Usuario autenticado:", user.email)

    try {
      // Verificar si existe la colección de inventario
      await checkAndCreateInventoryCollection()

      // Cargar información del usuario desde sessionStorage
      let currentUser = JSON.parse(sessionStorage.getItem("currentUser"))

      if (!currentUser) {
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
      }

      // Verificar si el usuario está activo
      if (currentUser.activo === false) {
        console.error("Usuario inactivo, cerrando sesión...")
        await signOut(auth)
        sessionStorage.removeItem("currentUser")
        window.location.href = "../../index.html?error=inactive"
        return
      }

      // Usar la información del usuario desde sessionStorage
      console.log("Usando información del usuario desde sessionStorage:", currentUser)
      console.log("Rol del usuario:", currentUser.role || currentUser.rol)

      // Forzar la actualización de los campos role y rol
      if (!currentUser.role && currentUser.rol) {
        currentUser.role = currentUser.rol
        sessionStorage.setItem("currentUser", JSON.stringify(currentUser))
      } else if (!currentUser.rol && currentUser.role) {
        currentUser.rol = currentUser.role
        sessionStorage.setItem("currentUser", JSON.stringify(currentUser))
      }

      setupUserInterface(currentUser)

      // Verificar acceso a la página actual según el rol
      checkPageAccess()
    } catch (error) {
      console.error("Error al verificar usuario o colecciones:", error)
      await signOut(auth)
      window.location.href = "../../index.html"
    }
  })

  // Configurar el botón de cerrar sesión
  const logoutBtn = document.getElementById("logoutBtn")
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth)
        // Limpiar sessionStorage
        sessionStorage.removeItem("currentUser")
        // Redirigir al login
        window.location.href = "../../index.html"
      } catch (error) {
        console.error("Error al cerrar sesión:", error)
      }
    })
  }
})

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