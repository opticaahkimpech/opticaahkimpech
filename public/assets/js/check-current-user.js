import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
import { db } from "./firebase-config.js"

// Esta función se ejecutará al cargar la página para verificar y actualizar el usuario actual
export async function checkCurrentUser() {
  try {
    // Obtener el usuario actual del sessionStorage
    const currentUserStr = sessionStorage.getItem("currentUser")
    if (!currentUserStr) {
      console.log("No hay usuario en sessionStorage")
      return
    }

    const currentUser = JSON.parse(currentUserStr)
    console.log("Usuario actual:", currentUser)

    // Verificar si tiene los campos necesarios
    let needsUpdate = false

    // Asegurarse de que ambos campos role y rol existan y tengan el mismo valor
    if (!currentUser.role && currentUser.rol) {
      currentUser.role = currentUser.rol
      needsUpdate = true
      console.log("Actualizando campo role con valor de rol:", currentUser.rol)
    }

    if (!currentUser.rol && currentUser.role) {
      currentUser.rol = currentUser.role
      needsUpdate = true
      console.log("Actualizando campo rol con valor de role:", currentUser.role)
    }

    if (currentUser.activo === undefined) {
      currentUser.activo = true
      needsUpdate = true
      console.log("Estableciendo campo activo a true")
    }

    // Actualizar en sessionStorage si es necesario
    if (needsUpdate) {
      console.log("Actualizando usuario en sessionStorage:", currentUser)
      sessionStorage.setItem("currentUser", JSON.stringify(currentUser))

      // También actualizar en Firestore
      try {
        const userRef = doc(db, "usuarios", currentUser.uid)
        const userDoc = await getDoc(userRef)

        if (userDoc.exists()) {
          const userData = userDoc.data()
          const firestoreUpdates = {}

          if (!userData.role) {
            firestoreUpdates.role = userData.rol || currentUser.role || "vendedor"
          }

          if (!userData.rol) {
            firestoreUpdates.rol = userData.role || currentUser.rol || "vendedor"
          }

          if (userData.activo === undefined) {
            firestoreUpdates.activo = true
          }

          if (Object.keys(firestoreUpdates).length > 0) {
            console.log("Actualizando usuario en Firestore:", firestoreUpdates)
            await updateDoc(userRef, firestoreUpdates)
          }
        }
      } catch (error) {
        console.error("Error al actualizar usuario en Firestore:", error)
      }
    }

    return currentUser
  } catch (error) {
    console.error("Error al verificar usuario actual:", error)
  }
}

// Función para forzar la actualización del usuario actual
export async function forceUpdateCurrentUser() {
  try {
    const currentUserStr = sessionStorage.getItem("currentUser")
    if (!currentUserStr) {
      console.log("No hay usuario en sessionStorage para actualizar")
      return false
    }

    const currentUser = JSON.parse(currentUserStr)

    // Obtener datos actualizados de Firestore
    const userRef = doc(db, "usuarios", currentUser.uid)
    const userDoc = await getDoc(userRef)

    if (!userDoc.exists()) {
      console.log("No se encontró el usuario en Firestore")
      return false
    }

    const userData = userDoc.data()
    console.log("Datos del usuario obtenidos de Firestore:", userData)

    // Actualizar los datos en sessionStorage
    const updatedUser = {
      ...currentUser,
      role: userData.role || userData.rol || currentUser.role || "vendedor",
      rol: userData.rol || userData.role || currentUser.rol || "vendedor",
      activo: userData.activo !== false,
    }

    console.log("Usuario actualizado:", updatedUser)
    sessionStorage.setItem("currentUser", JSON.stringify(updatedUser))

    return true
  } catch (error) {
    console.error("Error al forzar actualización del usuario:", error)
    return false
  }
}

// Ejecutar al cargar
document.addEventListener("DOMContentLoaded", async () => {
  await checkCurrentUser()

  // Agregar un botón oculto para forzar la actualización (para depuración)
  const debugButton = document.createElement("button")
  debugButton.style.position = "fixed"
  debugButton.style.bottom = "10px"
  debugButton.style.right = "10px"
  debugButton.style.zIndex = "9999"
  debugButton.style.opacity = "0.1"
  debugButton.style.padding = "5px"
  debugButton.textContent = "Actualizar usuario"
  debugButton.addEventListener("click", async () => {
    const updated = await forceUpdateCurrentUser()
    if (updated) {
      alert("Usuario actualizado. Recarga la página para ver los cambios.")
    } else {
      alert("No se pudo actualizar el usuario.")
    }
  })
  document.body.appendChild(debugButton)
})

// Exportar para uso en consola
window.checkCurrentUser = checkCurrentUser
window.forceUpdateCurrentUser = forceUpdateCurrentUser
