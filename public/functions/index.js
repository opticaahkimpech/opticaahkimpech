const functions = require("firebase-functions")
const admin = require("firebase-admin")
const adminFunctions = require("./admin-functions")

// Inicializar la aplicación de Firebase Admin
admin.initializeApp()

// Exportar las funciones
exports.deleteUser = adminFunctions.deleteUser
exports.updateUserPassword = adminFunctions.updateUserPassword
exports.processPasswordChangeRequests = adminFunctions.processPasswordChangeRequests
