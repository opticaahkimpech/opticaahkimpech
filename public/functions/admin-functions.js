// Este archivo debe ser desplegado como una función de Firebase Cloud Functions
// No se ejecutará en el navegador, sino en el servidor de Firebase

const admin = require("firebase-admin")
const functions = require("firebase-functions")

// Inicializar la aplicación de Firebase Admin
admin.initializeApp()

// Función para eliminar un usuario
exports.deleteUser = functions.https.onCall(async (data, context) => {
  // Verificar si el usuario que llama es un administrador
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "El usuario debe estar autenticado")
  }

  try {
    // Obtener el usuario actual
    const callerUid = context.auth.uid
    const callerSnapshot = await admin.firestore().collection("usuarios").doc(callerUid).get()

    if (!callerSnapshot.exists) {
      throw new functions.https.HttpsError("permission-denied", "Usuario no encontrado")
    }

    const callerData = callerSnapshot.data()

    // Verificar si el usuario es administrador
    if (callerData.rol !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Solo los administradores pueden eliminar usuarios")
    }

    // Obtener el ID del usuario a eliminar
    const { userId } = data

    if (!userId) {
      throw new functions.https.HttpsError("invalid-argument", "Se requiere el ID del usuario")
    }

    // Verificar que no se esté eliminando a sí mismo
    if (userId === callerUid) {
      throw new functions.https.HttpsError("failed-precondition", "No puedes eliminar tu propia cuenta")
    }

    // Eliminar el usuario de Authentication
    await admin.auth().deleteUser(userId)

    // Eliminar el documento del usuario de Firestore
    await admin.firestore().collection("usuarios").doc(userId).delete()

    return { success: true, message: "Usuario eliminado correctamente" }
  } catch (error) {
    console.error("Error al eliminar usuario:", error)
    throw new functions.https.HttpsError("internal", "Error al eliminar usuario", error)
  }
})

// Función para actualizar la contraseña de un usuario
exports.updateUserPassword = functions.https.onCall(async (data, context) => {
  // Verificar si el usuario que llama es un administrador
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "El usuario debe estar autenticado")
  }

  try {
    // Obtener el usuario actual
    const callerUid = context.auth.uid
    const callerSnapshot = await admin.firestore().collection("usuarios").doc(callerUid).get()

    if (!callerSnapshot.exists) {
      throw new functions.https.HttpsError("permission-denied", "Usuario no encontrado")
    }

    const callerData = callerSnapshot.data()

    // Verificar si el usuario es administrador
    if (callerData.rol !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Solo los administradores pueden cambiar contraseñas")
    }

    // Obtener el ID del usuario y la nueva contraseña
    const { userId, newPassword } = data

    if (!userId || !newPassword) {
      throw new functions.https.HttpsError("invalid-argument", "Se requiere el ID del usuario y la nueva contraseña")
    }

    // Actualizar la contraseña en Authentication
    await admin.auth().updateUser(userId, {
      password: newPassword,
    })

    // Actualizar la contraseña en Firestore
    await admin.firestore().collection("usuarios").doc(userId).update({
      password: newPassword,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    return { success: true, message: "Contraseña actualizada correctamente" }
  } catch (error) {
    console.error("Error al actualizar contraseña:", error)
    throw new functions.https.HttpsError("internal", "Error al actualizar contraseña", error)
  }
})

// Función para procesar solicitudes de cambio de contraseña
exports.processPasswordChangeRequests = functions.https.onCall(async (data, context) => {
  // Verificar si el usuario que llama es un administrador
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "El usuario debe estar autenticado")
  }

  try {
    // Obtener el usuario actual
    const callerUid = context.auth.uid
    const callerSnapshot = await admin.firestore().collection("usuarios").doc(callerUid).get()

    if (!callerSnapshot.exists) {
      throw new functions.https.HttpsError("permission-denied", "Usuario no encontrado")
    }

    const callerData = callerSnapshot.data()

    // Verificar si el usuario es administrador
    if (callerData.rol !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Solo los administradores pueden procesar solicitudes")
    }

    // Obtener el ID del usuario y la nueva contraseña
    const { userId, newPassword, approve } = data

    if (!userId) {
      throw new functions.https.HttpsError("invalid-argument", "Se requiere el ID del usuario")
    }

    // Obtener el usuario
    const userSnapshot = await admin.firestore().collection("usuarios").doc(userId).get()

    if (!userSnapshot.exists) {
      throw new functions.https.HttpsError("not-found", "Usuario no encontrado")
    }

    const userData = userSnapshot.data()

    // Verificar si hay una solicitud pendiente
    if (!userData.passwordChangeRequested) {
      throw new functions.https.HttpsError("failed-precondition", "No hay solicitud de cambio de contraseña pendiente")
    }

    if (approve) {
      if (!newPassword) {
        throw new functions.https.HttpsError("invalid-argument", "Se requiere la nueva contraseña")
      }

      // Actualizar la contraseña en Authentication
      await admin.auth().updateUser(userId, {
        password: newPassword,
      })

      // Actualizar la contraseña en Firestore
      await admin.firestore().collection("usuarios").doc(userId).update({
        password: newPassword,
        passwordChangeRequested: false,
        passwordChangeRequestedAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      return { success: true, message: "Solicitud aprobada y contraseña actualizada" }
    } else {
      // Rechazar la solicitud
      await admin.firestore().collection("usuarios").doc(userId).update({
        passwordChangeRequested: false,
        passwordChangeRequestedAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })

      return { success: true, message: "Solicitud rechazada" }
    }
  } catch (error) {
    console.error("Error al procesar solicitud:", error)
    throw new functions.https.HttpsError("internal", "Error al procesar solicitud", error)
  }
})
