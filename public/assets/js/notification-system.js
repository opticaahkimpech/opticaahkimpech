// Sistema de notificaciones para alertas de inventario
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  addDoc,
  getDocs,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
import { db } from "./firebase-config.js"

// Configuración de niveles de stock
const CONFIG = {
  STOCK_MINIMO_PRODUCTO: 5,
  STOCK_CRITICO_PRODUCTO: 2,
  STOCK_MINIMO_ARMAZON: 3,
  STOCK_CRITICO_ARMAZON: 1,
}

// Clase para manejar las notificaciones
class NotificationSystem {
  constructor() {
    this.notifications = []
    this.notificationDropdown = document.getElementById("notificationDropdown")
    this.notificationList = document.getElementById("notificationList")
    this.notificationCount = document.getElementById("notificationCount")
    this.clearAllBtn = document.getElementById("clearAllNotifications")
    this.markAllReadBtn = document.getElementById("markAllAsRead")

    this.setupEventListeners()
    this.loadNotificationsFromFirestore()
    this.startListeningForStockChanges()
  }

  setupEventListeners() {
    // Botón para limpiar todas las notificaciones
    if (this.clearAllBtn) {
      this.clearAllBtn.addEventListener("click", () => {
        this.clearAllNotifications()
      })
    }

    // Botón para marcar todas como leídas
    if (this.markAllReadBtn) {
      this.markAllReadBtn.addEventListener("click", () => {
        this.markAllAsRead()
      })
    }

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener("click", (e) => {
      const notificationBell = document.getElementById("notificationBell")
      if (notificationBell && this.notificationDropdown) {
        if (!notificationBell.contains(e.target) && !this.notificationDropdown.contains(e.target)) {
          this.notificationDropdown.style.display = "none"
        }
      }
    })

    // Botón de notificaciones
    const notificationBell = document.getElementById("notificationBell")
    if (notificationBell && this.notificationDropdown) {
      notificationBell.addEventListener("click", () => {
        if (this.notificationDropdown.style.display === "block") {
          this.notificationDropdown.style.display = "none"
        } else {
          this.notificationDropdown.style.display = "block"
          this.updateNotificationList()
        }
      })
    }
  }

  // Cargar notificaciones desde Firestore
  async loadNotificationsFromFirestore() {
    try {
      // Solo cargar notificaciones no archivadas y no leídas
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("archived", "==", false),
        where("read", "==", false),
        orderBy("date", "desc"),
      )

      // Usar onSnapshot para mantener las notificaciones actualizadas en tiempo real
      onSnapshot(notificationsQuery, (snapshot) => {
        this.notifications = []
        snapshot.forEach((doc) => {
          const notification = {
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate() || new Date(),
          }
          this.notifications.push(notification)
        })

        this.updateNotificationCount()
        this.updateNotificationList()
      })
    } catch (error) {
      console.error("Error al cargar notificaciones:", error)
    }
  }

  // Iniciar escucha de cambios en el stock
  startListeningForStockChanges() {
    // Escuchar cambios en productos
    const productosQuery = query(collection(db, "productos"))
    onSnapshot(productosQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const producto = { id: change.doc.id, ...change.doc.data() }

        if (change.type === "added" || change.type === "modified") {
          this.checkProductStock(producto)
        }
      })
    })

    // Escuchar cambios en armazones
    const armazonesQuery = query(collection(db, "armazones"))
    onSnapshot(armazonesQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const armazon = { id: change.doc.id, ...change.doc.data() }

        if (change.type === "added" || change.type === "modified") {
          this.checkArmazonStock(armazon)
        }
      })
    })
  }

  // Verificar stock de producto
  async checkProductStock(producto) {
    // Verificar si el producto ya tiene una notificación activa
    const existingNotificationsQuery = query(
      collection(db, "notifications"),
      where("itemId", "==", producto.id),
      where("itemType", "==", "producto"),
      where("archived", "==", false),
      where("read", "==", false),
    )

    const existingNotificationsSnapshot = await getDocs(existingNotificationsQuery)
    const existingNotification = existingNotificationsSnapshot.docs[0]

    // Si el stock es 0, crear notificación de stock agotado
    if (producto.stock === 0) {
      if (existingNotification) {
        // Actualizar notificación existente si es de tipo diferente
        if (existingNotification.data().type !== "danger") {
          await updateDoc(doc(db, "notifications", existingNotification.id), {
            type: "danger",
            title: "Stock Agotado",
            message: `El producto ${producto.nombre} está agotado (0 unidades)`,
            read: false,
            date: serverTimestamp(),
            updatedAt: serverTimestamp(),
            hasAction: true,
          })
        }
      } else {
        // Crear nueva notificación
        await this.addNotificationToFirestore({
          type: "danger",
          title: "Stock Agotado",
          message: `El producto ${producto.nombre} está agotado (0 unidades)`,
          itemId: producto.id,
          itemType: "producto",
          itemName: producto.nombre,
          hasAction: true,
        })
      }
    }
    // Si el stock es crítico, crear notificación de stock crítico
    else if (producto.stock <= producto.stockCritico || producto.stock <= CONFIG.STOCK_CRITICO_PRODUCTO) {
      if (existingNotification) {
        // Actualizar notificación existente si es de tipo diferente
        if (existingNotification.data().type !== "warning") {
          await updateDoc(doc(db, "notifications", existingNotification.id), {
            type: "warning",
            title: "Stock Crítico",
            message: `El producto ${producto.nombre} tiene stock crítico (${producto.stock} unidades)`,
            read: false,
            date: serverTimestamp(),
            updatedAt: serverTimestamp(),
            hasAction: true,
          })
        }
      } else {
        // Crear nueva notificación
        await this.addNotificationToFirestore({
          type: "warning",
          title: "Stock Crítico",
          message: `El producto ${producto.nombre} tiene stock crítico (${producto.stock} unidades)`,
          itemId: producto.id,
          itemType: "producto",
          itemName: producto.nombre,
          hasAction: true,
        })
      }
    }
    // Si el stock es bajo, crear notificación de stock bajo
    else if (producto.stock <= producto.stockMinimo || producto.stock <= CONFIG.STOCK_MINIMO_PRODUCTO) {
      if (existingNotification) {
        // Actualizar notificación existente si es de tipo diferente
        if (existingNotification.data().type !== "info") {
          await updateDoc(doc(db, "notifications", existingNotification.id), {
            type: "info",
            title: "Stock Bajo",
            message: `El producto ${producto.nombre} tiene stock bajo (${producto.stock} unidades)`,
            read: false,
            date: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }
      } else {
        // Crear nueva notificación
        await this.addNotificationToFirestore({
          type: "info",
          title: "Stock Bajo",
          message: `El producto ${producto.nombre} tiene stock bajo (${producto.stock} unidades)`,
          itemId: producto.id,
          itemType: "producto",
          itemName: producto.nombre,
        })
      }
    }
    // Si el stock es normal, archivar notificación si existe
    else if (existingNotification) {
      await updateDoc(doc(db, "notifications", existingNotification.id), {
        archived: true,
        updatedAt: serverTimestamp(),
      })
    }
  }

  // Verificar stock de armazón
  async checkArmazonStock(armazon) {
    // Verificar si el armazón ya tiene una notificación activa
    const existingNotificationsQuery = query(
      collection(db, "notifications"),
      where("itemId", "==", armazon.id),
      where("itemType", "==", "armazon"),
      where("archived", "==", false),
      where("read", "==", false),
    )

    const existingNotificationsSnapshot = await getDocs(existingNotificationsQuery)
    const existingNotification = existingNotificationsSnapshot.docs[0]

    // Si el stock es 0, crear notificación de stock agotado
    if (armazon.stock === 0) {
      if (existingNotification) {
        // Actualizar notificación existente si es de tipo diferente
        if (existingNotification.data().type !== "danger") {
          await updateDoc(doc(db, "notifications", existingNotification.id), {
            type: "danger",
            title: "Stock Agotado",
            message: `El armazón ${armazon.nombre} está agotado (0 unidades)`,
            read: false,
            date: serverTimestamp(),
            updatedAt: serverTimestamp(),
            hasAction: true,
          })
        }
      } else {
        // Crear nueva notificación
        await this.addNotificationToFirestore({
          type: "danger",
          title: "Stock Agotado",
          message: `El armazón ${armazon.nombre} está agotado (0 unidades)`,
          itemId: armazon.id,
          itemType: "armazon",
          itemName: armazon.nombre,
          hasAction: true,
        })
      }
    }
    // Si el stock es crítico, crear notificación de stock crítico
    else if (armazon.stock <= armazon.stockCritico || armazon.stock <= CONFIG.STOCK_CRITICO_ARMAZON) {
      if (existingNotification) {
        // Actualizar notificación existente si es de tipo diferente
        if (existingNotification.data().type !== "warning") {
          await updateDoc(doc(db, "notifications", existingNotification.id), {
            type: "warning",
            title: "Stock Crítico",
            message: `El armazón ${armazon.nombre} tiene stock crítico (${armazon.stock} unidades)`,
            read: false,
            date: serverTimestamp(),
            updatedAt: serverTimestamp(),
            hasAction: true,
          })
        }
      } else {
        // Crear nueva notificación
        await this.addNotificationToFirestore({
          type: "warning",
          title: "Stock Crítico",
          message: `El armazón ${armazon.nombre} tiene stock crítico (${armazon.stock} unidades)`,
          itemId: armazon.id,
          itemType: "armazon",
          itemName: armazon.nombre,
          hasAction: true,
        })
      }
    }
    // Si el stock es bajo, crear notificación de stock bajo
    else if (armazon.stock <= armazon.stockMinimo || armazon.stock <= CONFIG.STOCK_MINIMO_ARMAZON) {
      if (existingNotification) {
        // Actualizar notificación existente si es de tipo diferente
        if (existingNotification.data().type !== "info") {
          await updateDoc(doc(db, "notifications", existingNotification.id), {
            type: "info",
            title: "Stock Bajo",
            message: `El armazón ${armazon.nombre} tiene stock bajo (${armazon.stock} unidades)`,
            read: false,
            date: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }
      } else {
        // Crear nueva notificación
        await this.addNotificationToFirestore({
          type: "info",
          title: "Stock Bajo",
          message: `El armazón ${armazon.nombre} tiene stock bajo (${armazon.stock} unidades)`,
          itemId: armazon.id,
          itemType: "armazon",
          itemName: armazon.nombre,
        })
      }
    }
    // Si el stock es normal, archivar notificación si existe
    else if (existingNotification) {
      await updateDoc(doc(db, "notifications", existingNotification.id), {
        archived: true,
        updatedAt: serverTimestamp(),
      })
    }
  }

  // Agregar una nueva notificación a Firestore
  async addNotificationToFirestore(notification) {
    try {
      const newNotification = {
        type: notification.type || "info",
        title: notification.title || "Notificación",
        message: notification.message,
        itemId: notification.itemId,
        itemType: notification.itemType,
        itemName: notification.itemName,
        date: serverTimestamp(),
        read: false,
        archived: false,
        hasAction: notification.hasAction || false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      const docRef = await addDoc(collection(db, "notifications"), newNotification)
      return docRef.id
    } catch (error) {
      console.error("Error al agregar notificación:", error)
      return null
    }
  }

  // Marcar una notificación como leída
  async markAsRead(id) {
    try {
      // Marcar como leída en Firestore (esto la eliminará de la lista debido a la consulta)
      await updateDoc(doc(db, "notifications", id), {
        read: true,
        updatedAt: serverTimestamp(),
      })

      // Eliminar la notificación del DOM con animación
      const notificationElement = document.querySelector(`[data-notification-id="${id}"]`)
      if (notificationElement) {
        notificationElement.style.animation = "fadeOut 0.3s forwards"
        setTimeout(() => {
          if (notificationElement.parentNode) {
            notificationElement.parentNode.removeChild(notificationElement)

            // Verificar si no hay más notificaciones
            if (this.notificationList.children.length === 0) {
              this.notificationList.innerHTML = `
                <div class="notification-empty">
                    No hay notificaciones
                </div>
              `
            }
          }
        }, 300)
      }

      // Actualizar contador
      this.updateNotificationCount()
    } catch (error) {
      console.error("Error al marcar notificación como leída:", error)
    }
  }

  // Archivar una notificación
  async archiveNotification(id) {
    try {
      // Archivar en Firestore (esto la eliminará de la lista debido a la consulta)
      await updateDoc(doc(db, "notifications", id), {
        archived: true,
        updatedAt: serverTimestamp(),
      })

      // Eliminar la notificación del DOM con animación
      const notificationElement = document.querySelector(`[data-notification-id="${id}"]`)
      if (notificationElement) {
        notificationElement.style.animation = "fadeOut 0.3s forwards"
        setTimeout(() => {
          if (notificationElement.parentNode) {
            notificationElement.parentNode.removeChild(notificationElement)

            // Verificar si no hay más notificaciones
            if (this.notificationList.children.length === 0) {
              this.notificationList.innerHTML = `
                <div class="notification-empty">
                    No hay notificaciones
                </div>
              `
            }
          }
        }, 300)
      }

      // Actualizar contador
      this.updateNotificationCount()
    } catch (error) {
      console.error("Error al archivar notificación:", error)
    }
  }

  // Eliminar una notificación
  async removeNotification(id) {
    try {
      await deleteDoc(doc(db, "notifications", id))

      // Eliminar la notificación del DOM con animación
      const notificationElement = document.querySelector(`[data-notification-id="${id}"]`)
      if (notificationElement) {
        notificationElement.style.animation = "fadeOut 0.3s forwards"
        setTimeout(() => {
          if (notificationElement.parentNode) {
            notificationElement.parentNode.removeChild(notificationElement)

            // Verificar si no hay más notificaciones
            if (this.notificationList.children.length === 0) {
              this.notificationList.innerHTML = `
                <div class="notification-empty">
                    No hay notificaciones
                </div>
              `
            }
          }
        }, 300)
      }

      // Actualizar contador
      this.updateNotificationCount()
    } catch (error) {
      console.error("Error al eliminar notificación:", error)
    }
  }

  // Marcar todas las notificaciones como leídas
  async markAllAsRead() {
    try {
      const unreadNotificationsQuery = query(
        collection(db, "notifications"),
        where("read", "==", false),
        where("archived", "==", false),
      )

      const unreadNotificationsSnapshot = await getDocs(unreadNotificationsQuery)

      if (unreadNotificationsSnapshot.empty) {
        this.showToast("No hay notificaciones para marcar como leídas", "info")
        return
      }

      const batch = db.batch()
      unreadNotificationsSnapshot.forEach((doc) => {
        batch.update(doc.ref, {
          read: true,
          updatedAt: serverTimestamp(),
        })
      })

      await batch.commit()

      // Limpiar la lista de notificaciones en el DOM
      this.notificationList.innerHTML = `
        <div class="notification-empty">
            No hay notificaciones
        </div>
      `

      // Actualizar contador
      this.updateNotificationCount()

      this.showToast("Todas las notificaciones han sido marcadas como leídas", "success")
    } catch (error) {
      console.error("Error al marcar todas las notificaciones como leídas:", error)
      this.showToast("Error al marcar las notificaciones como leídas", "danger")
    }
  }

  // Limpiar todas las notificaciones (archivarlas)
  async clearAllNotifications() {
    try {
      const activeNotificationsQuery = query(collection(db, "notifications"), where("archived", "==", false))

      const activeNotificationsSnapshot = await getDocs(activeNotificationsQuery)

      if (activeNotificationsSnapshot.empty) {
        this.showToast("No hay notificaciones para archivar", "info")
        return
      }

      const batch = db.batch()
      activeNotificationsSnapshot.forEach((doc) => {
        batch.update(doc.ref, {
          archived: true,
          updatedAt: serverTimestamp(),
        })
      })

      await batch.commit()

      // Limpiar la lista de notificaciones en el DOM
      this.notificationList.innerHTML = `
        <div class="notification-empty">
            No hay notificaciones
        </div>
      `

      // Actualizar contador
      this.updateNotificationCount()

      this.showToast("Todas las notificaciones han sido archivadas", "success")
    } catch (error) {
      console.error("Error al archivar todas las notificaciones:", error)
      this.showToast("Error al archivar las notificaciones", "danger")
    }
  }

  // Actualizar el contador de notificaciones
  updateNotificationCount() {
    if (this.notificationCount) {
      const unreadCount = this.notifications.filter((item) => !item.read && !item.archived).length

      if (unreadCount > 0) {
        this.notificationCount.textContent = unreadCount > 99 ? "99+" : unreadCount
        this.notificationCount.classList.remove("hidden")
      } else {
        this.notificationCount.classList.add("hidden")
      }
    }
  }

  // Formatear tiempo relativo
  formatRelativeTime(date) {
    if (!date) return ""

    const now = new Date()
    const diffMs = now - date
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffMin < 1) {
      return "ahora mismo"
    } else if (diffMin < 60) {
      return `${diffMin} min atrás`
    } else if (diffHour < 24) {
      return `${diffHour} hora${diffHour > 1 ? "s" : ""} atrás`
    } else if (diffDay < 7) {
      return `${diffDay} día${diffDay > 1 ? "s" : ""} atrás`
    } else {
      return date.toLocaleDateString()
    }
  }

  // Actualizar la lista de notificaciones en el dropdown
  updateNotificationList() {
    if (!this.notificationList) return

    // Filtrar notificaciones no archivadas y no leídas
    const activeNotifications = this.notifications.filter((item) => !item.archived && !item.read)

    if (activeNotifications.length === 0) {
      this.notificationList.innerHTML = `
        <div class="notification-empty">
            No hay notificaciones
        </div>
      `
      return
    }

    this.notificationList.innerHTML = ""

    activeNotifications.forEach((notification) => {
      const item = document.createElement("div")
      item.className = `notification-item ${notification.type}`
      item.setAttribute("data-notification-id", notification.id)

      // Obtener el color del círculo según el tipo
      let circleColor = ""
      switch (notification.type) {
        case "info":
          circleColor = "bg-blue-500"
          break
        case "warning":
          circleColor = "bg-yellow-500"
          break
        case "danger":
          circleColor = "bg-red-500"
          break
        case "success":
          circleColor = "bg-green-500"
          break
        default:
          circleColor = "bg-gray-500"
      }

      // Formatear la fecha como tiempo relativo
      const formattedDate = this.formatRelativeTime(notification.date)

      item.innerHTML = `
        <div class="flex items-start p-3">
            <div class="flex-shrink-0 mr-3">
                <div class="w-8 h-8 rounded-full ${circleColor} flex items-center justify-center text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
            </div>
            <div class="flex-1">
                <div class="flex justify-between">
                    <p class="font-medium">${notification.title}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${formattedDate}</p>
                </div>
                <p class="text-sm mt-1">${notification.message}</p>
                <div class="flex mt-2 space-x-2">
                    <button class="mark-as-read text-xs text-blue-500 hover:text-blue-700 flex items-center" data-id="${notification.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Marcar como leído
                    </button>
                    <button class="archive-notification text-xs text-gray-500 hover:text-gray-700 flex items-center" data-id="${notification.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        Archivar
                    </button>
                </div>
            </div>
        </div>
      `

      // Agregar evento para abrir modal de stock crítico solo al hacer clic en la notificación
      if (notification.hasAction) {
        // Hacer que toda la notificación sea clickeable, excepto los botones
        const notificationContent = item.querySelector(".flex.items-start.p-3")
        if (notificationContent) {
          notificationContent.style.cursor = "pointer"
        }

        item.addEventListener("click", (e) => {
          // No ejecutar si se hizo clic en los botones
          if (e.target.closest(".mark-as-read") || e.target.closest(".archive-notification")) {
            return
          }

          // Extraer el stock del mensaje de la notificación
          let stock = 0
          if (notification.type === "danger") {
            stock = 0
          } else {
            const stockMatch = notification.message.match(/$$(\d+) unidades$$/)
            if (stockMatch && stockMatch[1]) {
              stock = Number.parseInt(stockMatch[1])
            }
          }

          this.showOutOfStockModal(
            notification.itemName,
            stock,
            notification.itemType,
            notification.itemId,
            notification.id,
          )
        })
      }

      this.notificationList.appendChild(item)
    })

    // Agregar eventos para marcar como leído y archivar
    document.querySelectorAll(".mark-as-read").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation()
        const id = btn.getAttribute("data-id")
        this.markAsRead(id)
      })
    })

    document.querySelectorAll(".archive-notification").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation()
        const id = btn.getAttribute("data-id")
        this.archiveNotification(id)
      })
    })
  }

  // Mostrar modal para productos con stock crítico o agotado
  showOutOfStockModal(itemName, stock, itemType, itemId, notificationId) {
    const outOfStockModal = document.getElementById("outOfStockModal")
    const outOfStockTitle = document.getElementById("outOfStockTitle")
    const outOfStockMessage = document.getElementById("outOfStockMessage")
    const keepProduct = document.getElementById("keepProduct")
    const removeProduct = document.getElementById("removeProduct")

    if (outOfStockModal && outOfStockTitle && outOfStockMessage && keepProduct && removeProduct) {
      outOfStockTitle.textContent = `¡Stock Crítico!`
      outOfStockMessage.textContent = `El ${itemType} ${itemName} tiene un stock de ${stock}. ¿Deseas eliminarlo del inventario o conservarlo para un posible reabastecimiento?`

      outOfStockModal.style.display = "block"

      // Configurar evento para el botón de mantener
      const handleKeep = () => {
        outOfStockModal.style.display = "none"
        this.showToast(`Se conservará el ${itemType} ${itemName} en el inventario`, "info")

        // Marcar la notificación como leída (lo que la eliminará de la lista)
        if (notificationId) {
          this.markAsRead(notificationId)
        }

        keepProduct.removeEventListener("click", handleKeep)
      }

      // Configurar evento para el botón de eliminar
      const handleRemove = async () => {
        try {
          await deleteDoc(doc(db, itemType === "producto" ? "productos" : "armazones", itemId))
          this.showToast(`${itemType === "producto" ? "Producto" : "Armazón"} eliminado correctamente`, "success")

          // Archivar la notificación (lo que la eliminará de la lista)
          if (notificationId) {
            this.archiveNotification(notificationId)
          }

          outOfStockModal.style.display = "none"
          removeProduct.removeEventListener("click", handleRemove)
        } catch (error) {
          console.error(`Error al eliminar ${itemType}:`, error)
          this.showToast(`Error al eliminar el ${itemType}`, "danger")
        }
      }

      // Remover eventos anteriores para evitar duplicados
      keepProduct.removeEventListener("click", handleKeep)
      removeProduct.removeEventListener("click", handleRemove)

      // Agregar nuevos eventos
      keepProduct.addEventListener("click", handleKeep)
      removeProduct.addEventListener("click", handleRemove)
    }
  }

  // Mostrar notificación toast
  showToast(message, type = "info") {
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
}

// Exportar la clase para poder usarla desde otros módulos
export { NotificationSystem }