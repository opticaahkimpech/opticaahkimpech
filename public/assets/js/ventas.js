import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

import { db } from "./firebase-config.js"
import { checkAndCreateInventoryCollection } from "./auth-check.js"

// Variables globales
let currentSale = null
const lastVisible = null
let currentPage = 1
let totalPages = 1
const SALES_PER_PAGE = 10
let clientes = []
let productos = []
let armazones = []
let empresas = []
let miembrosConvenio = []
let currentClientId = null
let searchTimeout = null
let allVentas = []
let filteredVentas = []

// Variables para estado de armazón - AGREGADO
let currentFrameStatusSale = null
let pendingDeliveryUpdate = null // NUEVO: Para manejar la entrega pendiente

// Cache para optimización
const ventasCache = new Map()
const clientesCache = new Map()
const saldoCache = new Map()
let lastCacheUpdate = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

// Filtros activos
let filtrosVentas = {
  cliente: "",
  estado: "",
  fechaInicio: "",
  fechaFin: "",
  convenio: "",
  busqueda: "",
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Página de ventas cargada")

  try {
    // Verificar autenticación
    await checkAndCreateInventoryCollection()
    await checkAndCreateVentasCollection()

    // Verificar si hay un cliente en la URL
    checkClienteFromURL()

    // Cargar datos necesarios en paralelo
    await Promise.all([loadClientes(), loadProductos(), loadArmazones(), loadEmpresas(), loadMiembrosConvenio()])

    // Configurar eventos
    setupModalEvents()
    setupFormEvents()
    setupSearchEvents()
    setupFilterEvents()
    setupPaginationEvents()
    setupFrameStatusEvents() // AGREGADO
    setupDeliveryEvents() // NUEVO

    // Cargar datos iniciales de ventas
    await loadVentas()

    // Configurar actualización automática cada 30 segundos
    setInterval(async () => {
      if (Date.now() - lastCacheUpdate > CACHE_DURATION) {
        await loadVentas()
      }
    }, 30000)
  } catch (error) {
    console.error("Error al inicializar la página de ventas:", error)
    showToast("Error al cargar la página de ventas", "danger")
  }
})

// Función para verificar y crear colecciones necesarias para ventas
async function checkAndCreateVentasCollection() {
  try {
    console.log("Verificando colecciones de ventas...")

    // Verificar colecciones necesarias
    const collections = ["ventas", "abonos", "pagos"]

    for (const collectionName of collections) {
      const snapshot = await getDocs(collection(db, collectionName))
      if (snapshot.empty) {
        console.log(`Creando colección de ${collectionName}...`)
      }
    }

    // Crear métodos de pago iniciales si no existen
    const metodosPagoSnapshot = await getDocs(collection(db, "metodosPago"))
    if (metodosPagoSnapshot.empty) {
      const metodosPagoIniciales = [
        { nombre: "Efectivo", descripcion: "Pago en efectivo" },
        { nombre: "Tarjeta de crédito", descripcion: "Pago con tarjeta de crédito" },
        { nombre: "Tarjeta de débito", descripcion: "Pago con tarjeta de débito" },
        { nombre: "Transferencia", descripcion: "Pago por transferencia bancaria" },
        { nombre: "Crédito convenio", descripcion: "Pago con crédito de convenio" },
      ]

      for (const metodoPago of metodosPagoIniciales) {
        await addDoc(collection(db, "metodosPago"), {
          ...metodoPago,
          createdAt: serverTimestamp(),
        })
      }
    }

    console.log("Verificación de colecciones de ventas completada")
  } catch (error) {
    console.error("Error al verificar o crear colecciones de ventas:", error)
    throw error
  }
}

// Función para verificar si hay un cliente en la URL
function checkClienteFromURL() {
  const urlParams = new URLSearchParams(window.location.search)
  const clientId = urlParams.get("clientId")

  if (clientId) {
    currentClientId = clientId
    console.log("Cliente seleccionado desde URL:", currentClientId)

    setTimeout(() => {
      const addSaleBtn = document.getElementById("addSaleBtn")
      if (addSaleBtn) {
        addSaleBtn.click()
      }
    }, 500)
  }
}

// Función para cargar clientes con cache
async function loadClientes() {
  try {
    const clientesSnapshot = await getDocs(collection(db, "clientes"))
    clientes = []
    clientesCache.clear()

    clientesSnapshot.forEach((doc) => {
      const clienteData = {
        id: doc.id,
        ...doc.data(),
      }
      clientes.push(clienteData)
      clientesCache.set(doc.id, clienteData)
    })

    console.log("Clientes cargados:", clientes.length)
  } catch (error) {
    console.error("Error al cargar clientes:", error)
    showToast("Error al cargar clientes", "danger")
  }
}

// Función para cargar productos
async function loadProductos() {
  try {
    const productosSnapshot = await getDocs(collection(db, "productos"))
    productos = []

    productosSnapshot.forEach((doc) => {
      if (doc.id !== "placeholder" && !doc.data().isPlaceholder) {
        productos.push({
          id: doc.id,
          ...doc.data(),
        })
      }
    })

    console.log("Productos cargados:", productos.length)
  } catch (error) {
    console.error("Error al cargar productos:", error)
    showToast("Error al cargar productos", "danger")
  }
}

// Función para cargar armazones
async function loadArmazones() {
  try {
    const armazonesSnapshot = await getDocs(collection(db, "armazones"))
    armazones = []

    armazonesSnapshot.forEach((doc) => {
      if (doc.id !== "placeholder" && !doc.data().isPlaceholder) {
        armazones.push({
          id: doc.id,
          ...doc.data(),
        })
      }
    })

    console.log("Armazones cargados:", armazones.length)
  } catch (error) {
    console.error("Error al cargar armazones:", error)
    showToast("Error al cargar armazones", "danger")
  }
}

// Función para cargar empresas
async function loadEmpresas() {
  try {
    const empresasSnapshot = await getDocs(collection(db, "empresas"))
    empresas = []

    empresasSnapshot.forEach((doc) => {
      empresas.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    console.log("Empresas cargadas:", empresas.length)
  } catch (error) {
    console.error("Error al cargar empresas:", error)
    showToast("Error al cargar empresas", "danger")
  }
}

// Función para cargar miembros de convenio
async function loadMiembrosConvenio() {
  try {
    const miembrosSnapshot = await getDocs(collection(db, "miembrosConvenio"))
    miembrosConvenio = []

    miembrosSnapshot.forEach((doc) => {
      miembrosConvenio.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    console.log("Miembros de convenio cargados:", miembrosConvenio.length)
  } catch (error) {
    console.error("Error al cargar miembros de convenio:", error)
    showToast("Error al cargar miembros de convenio", "danger")
  }
}

// Función para determinar estado inicial del armazón - CORREGIDA
function determineInitialFrameStatus(abono, total) {
  if (abono <= 0) {
    return "apartado"
  } else if (abono >= total) {
    return "en-proceso" // CORREGIDO: Si se paga completo, va a "en-proceso"
  } else if (abono > 0) {
    return "en-proceso"
  }
  return "apartado"
}

// Función para obtener texto del estado de armazón - AGREGADO
function getFrameStatusText(status) {
  const estados = {
    apartado: "Apartado",
    "en-proceso": "En Proceso",
    "pendiente-entrega": "Pendiente",
    entregado: "Entregado",
  }
  return estados[status] || "Sin estado"
}

// Función para verificar si una venta tiene armazones - AGREGADO
function hasFrames(productos) {
  return productos && productos.some((producto) => producto.tipo === "armazon")
}

// Configurar eventos para el modal de estado de armazón - MODIFICADO
function setupFrameStatusEvents() {
  const frameStatusModal = document.getElementById("frameStatusModal")
  const cancelFrameStatus = document.getElementById("cancelFrameStatus")
  const statusOptions = document.querySelectorAll(".status-option")

  if (cancelFrameStatus) {
    cancelFrameStatus.addEventListener("click", () => {
      frameStatusModal.style.display = "none"
      currentFrameStatusSale = null
    })
  }

  statusOptions.forEach((option) => {
    option.addEventListener("click", async () => {
      const newStatus = option.getAttribute("data-status")
      if (currentFrameStatusSale && newStatus) {
        // MODIFICADO: Si el estado es "entregado", mostrar modal de confirmación
        if (newStatus === "entregado") {
          frameStatusModal.style.display = "none"
          pendingDeliveryUpdate = {
            saleId: currentFrameStatusSale.id,
            status: newStatus,
          }
          showDeliveryConfirmModal()
        } else {
          await updateFrameStatus(currentFrameStatusSale.id, newStatus)
          frameStatusModal.style.display = "none"
          currentFrameStatusSale = null
        }
      }
    })
  })

  // Cerrar modal al hacer clic fuera
  frameStatusModal.addEventListener("click", (e) => {
    if (e.target === frameStatusModal) {
      frameStatusModal.style.display = "none"
      currentFrameStatusSale = null
    }
  })
}

// Configurar eventos para los modales de entrega - NUEVO
function setupDeliveryEvents() {
  const deliveryConfirmModal = document.getElementById("deliveryConfirmModal")
  const recipientModal = document.getElementById("recipientModal")

  // Botones del modal de confirmación
  const skipRecipientBtn = document.getElementById("skipRecipientBtn")
  const cancelDeliveryBtn = document.getElementById("cancelDeliveryBtn")
  const registerRecipientBtn = document.getElementById("registerRecipientBtn")

  // Botones del modal de registro
  const cancelRecipientBtn = document.getElementById("cancelRecipientBtn")
  const recipientForm = document.getElementById("recipientForm")

  if (skipRecipientBtn) {
    skipRecipientBtn.addEventListener("click", async () => {
      deliveryConfirmModal.style.display = "none"
      if (pendingDeliveryUpdate) {
        await updateFrameStatus(pendingDeliveryUpdate.saleId, pendingDeliveryUpdate.status)
        pendingDeliveryUpdate = null
      }
    })
  }

  if (cancelDeliveryBtn) {
    cancelDeliveryBtn.addEventListener("click", () => {
      deliveryConfirmModal.style.display = "none"
      pendingDeliveryUpdate = null
      currentFrameStatusSale = null
    })
  }

  if (registerRecipientBtn) {
    registerRecipientBtn.addEventListener("click", () => {
      deliveryConfirmModal.style.display = "none"
      showRecipientModal()
    })
  }

  if (cancelRecipientBtn) {
    cancelRecipientBtn.addEventListener("click", () => {
      recipientModal.style.display = "none"
      pendingDeliveryUpdate = null
      currentFrameStatusSale = null
    })
  }

  if (recipientForm) {
    recipientForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      await handleRecipientSubmit()
    })
  }

  // Cerrar modales al hacer clic fuera
  deliveryConfirmModal.addEventListener("click", (e) => {
    if (e.target === deliveryConfirmModal) {
      deliveryConfirmModal.style.display = "none"
      pendingDeliveryUpdate = null
      currentFrameStatusSale = null
    }
  })

  recipientModal.addEventListener("click", (e) => {
    if (e.target === recipientModal) {
      recipientModal.style.display = "none"
      pendingDeliveryUpdate = null
      currentFrameStatusSale = null
    }
  })
}

// Mostrar modal de confirmación de entrega - NUEVO
function showDeliveryConfirmModal() {
  const deliveryConfirmModal = document.getElementById("deliveryConfirmModal")
  deliveryConfirmModal.style.display = "block"
}

// Mostrar modal de registro de receptor - NUEVO
function showRecipientModal() {
  const recipientModal = document.getElementById("recipientModal")
  const recipientNameInput = document.getElementById("recipientName")

  recipientModal.style.display = "block"

  // Enfocar el input y limpiar valor previo
  setTimeout(() => {
    recipientNameInput.value = ""
    recipientNameInput.focus()
  }, 100)
}

// Manejar envío del formulario de receptor - NUEVO
async function handleRecipientSubmit() {
  try {
    const recipientName = document.getElementById("recipientName").value.trim()

    if (!recipientName) {
      showToast("Por favor ingresa el nombre de quien recibió el armazón", "warning")
      return
    }

    if (pendingDeliveryUpdate) {
      await updateFrameStatus(pendingDeliveryUpdate.saleId, pendingDeliveryUpdate.status, recipientName)

      document.getElementById("recipientModal").style.display = "none"
      pendingDeliveryUpdate = null
      currentFrameStatusSale = null
    }
  } catch (error) {
    console.error("Error al procesar el receptor:", error)
    showToast("Error al registrar el receptor", "danger")
  }
}

// Función para mostrar modal de estado de armazón - AGREGADO
function showFrameStatusModal(sale) {
  currentFrameStatusSale = sale
  const frameStatusModal = document.getElementById("frameStatusModal")
  frameStatusModal.style.display = "block"
}

// Función para actualizar estado de armazón - MODIFICADA para incluir receptor
async function updateFrameStatus(saleId, newStatus, recipientName = null) {
  try {
    const updateData = {
      estadoArmazon: newStatus,
      updatedAt: serverTimestamp(),
    }

    // Si el estado es "entregado", agregar fecha de entrega y receptor
    if (newStatus === "entregado") {
      updateData.fechaEntrega = serverTimestamp()
      if (recipientName) {
        updateData.receptorEntrega = recipientName
      }
    }

    await updateDoc(doc(db, "ventas", saleId), updateData)

    let mensaje = `Estado del armazón actualizado a: ${getFrameStatusText(newStatus)}`
    if (newStatus === "entregado" && recipientName) {
      mensaje += ` - Recibido por: ${recipientName}`
    }

    showToast(mensaje, "success")

    // Limpiar cache y recargar
    ventasCache.clear()
    await loadVentas()
  } catch (error) {
    console.error("Error al actualizar estado del armazón:", error)
    showToast("Error al actualizar el estado del armazón", "danger")
  }
}

// Función corregida para calcular crédito usado
async function calcularCreditoUsadoCliente(clienteId) {
  try {
    const ventasQuery = query(
      collection(db, "ventas"),
      where("clienteId", "==", clienteId),
      where("convenio", "==", true),
      where("estado", "!=", "cancelada"),
    )

    const ventasSnapshot = await getDocs(ventasQuery)
    let creditoUsado = 0

    for (const ventaDoc of ventasSnapshot.docs) {
      const venta = ventaDoc.data()
      creditoUsado += venta.total || 0
    }

    return creditoUsado
  } catch (error) {
    console.error("Error al calcular crédito usado:", error)
    return 0
  }
}

// Función para obtener información de crédito de un cliente con convenio
async function obtenerInfoCreditoCliente(clienteId) {
  try {
    const miembro = miembrosConvenio.find((m) => m.clienteId === clienteId)
    if (!miembro) {
      return null
    }

    const empresa = empresas.find((e) => e.id === miembro.empresaId)
    const creditoUsado = await calcularCreditoUsadoCliente(clienteId)
    const limiteCredito = miembro.limiteCredito || 0
    const creditoDisponible = Math.max(0, limiteCredito - creditoUsado)

    return {
      miembro,
      empresa,
      limiteCredito,
      creditoUsado,
      creditoDisponible,
    }
  } catch (error) {
    console.error("Error al obtener información de crédito:", error)
    return null
  }
}

// Función para mostrar notificaciones toast mejorada
function showToast(message, type = "info", duration = 5000) {
  let toastContainer = document.getElementById("toastContainer")
  if (!toastContainer) {
    toastContainer = document.createElement("div")
    toastContainer.id = "toastContainer"
    toastContainer.className = "fixed top-4 right-4 z-50 max-w-xs space-y-2"
    document.body.appendChild(toastContainer)
  }

  const toast = document.createElement("div")
  const typeClasses = {
    success: "bg-green-500 border-green-600",
    danger: "bg-red-500 border-red-600",
    warning: "bg-yellow-500 border-yellow-600",
    info: "bg-blue-500 border-blue-600",
  }

  toast.className = `${typeClasses[type]} text-white px-4 py-3 rounded-lg shadow-lg border-l-4 transform transition-all duration-300 ease-in-out`
  toast.style.transform = "translateX(100%)"

  toast.innerHTML = `
        <div class="flex items-center justify-between">
            <span class="text-sm font-medium">${message}</span>
            <button type="button" class="ml-3 text-white hover:text-gray-200 transition-colors">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    `

  toastContainer.appendChild(toast)

  // Animar entrada
  setTimeout(() => {
    toast.style.transform = "translateX(0)"
  }, 10)

  // Configurar botón de cerrar
  const closeBtn = toast.querySelector("button")
  closeBtn.addEventListener("click", () => {
    removeToast(toast)
  })

  // Auto-cerrar
  setTimeout(() => {
    removeToast(toast)
  }, duration)
}

function removeToast(toast) {
  toast.style.transform = "translateX(100%)"
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast)
    }
  }, 300)
}

// Función para mostrar alertas personalizadas
function showCustomAlert(title, message, type = "info", confirmCallback = null) {
  const alertContainer = document.getElementById("customAlertContainer")

  const alertModal = document.createElement("div")
  alertModal.className = "modal custom-alert-modal"
  alertModal.style.display = "block"

  const typeIcons = {
    success:
      '<svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>',
    danger:
      '<svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>',
    warning:
      '<svg class="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>',
    info: '<svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
  }

  alertModal.innerHTML = `
        <div class="custom-alert-content">
            <div class="p-6">
                <div class="flex items-center mb-4">
                    <div class="flex-shrink-0 mr-3">
                        ${typeIcons[type]}
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${title}</h3>
                </div>
                <p class="text-gray-600 dark:text-gray-300 mb-6">${message}</p>
                <div class="flex justify-end space-x-3">
                    ${
                      confirmCallback
                        ? `
                        <button class="cancel-btn px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                            Cancelar
                        </button>
                        <button class="confirm-btn px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors">
                            Confirmar
                        </button>
                    `
                        : `
                        <button class="ok-btn px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded transition-colors">
                            Entendido
                        </button>
                    `
                    }
                </div>
            </div>
        </div>
    `

  alertContainer.appendChild(alertModal)

  // Configurar eventos
  const cancelBtn = alertModal.querySelector(".cancel-btn")
  const confirmBtn = alertModal.querySelector(".confirm-btn")
  const okBtn = alertModal.querySelector(".ok-btn")

  const closeAlert = () => {
    alertModal.style.display = "none"
    setTimeout(() => {
      if (alertContainer.contains(alertModal)) {
        alertContainer.removeChild(alertModal)
      }
    }, 300)
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeAlert)
  }

  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      closeAlert()
      if (confirmCallback) confirmCallback()
    })
  }

  if (okBtn) {
    okBtn.addEventListener("click", closeAlert)
  }

  // Cerrar al hacer clic fuera
  alertModal.addEventListener("click", (e) => {
    if (e.target === alertModal) {
      closeAlert()
    }
  })
}

// Configurar eventos para los modales
function setupModalEvents() {
  const addSaleBtn = document.getElementById("addSaleBtn")
  if (addSaleBtn) {
    addSaleBtn.addEventListener("click", () => {
      openSaleModal()
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

  // Configurar botón para agregar producto
  const addProductoBtn = document.getElementById("addProductoBtn")
  if (addProductoBtn) {
    addProductoBtn.addEventListener("click", () => {
      addProductoItem()
    })
  }
}

// Función para abrir el modal de venta
function openSaleModal() {
  const modal = document.getElementById("saleModal")
  if (modal) {
    modal.style.display = "block"
    document.getElementById("modalTitle").textContent = "Registrar Nueva Venta"

    // Limpiar formulario
    document.getElementById("saleForm").reset()
    document.getElementById("saleId").value = ""

    // Establecer fecha actual
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, "0")
    const day = String(today.getDate()).padStart(2, "0")
    document.getElementById("fechaVenta").value = `${year}-${month}-${day}`

    // Limpiar contenedor de productos
    const productosContainer = document.getElementById("productosContainer")
    if (productosContainer) {
      productosContainer.innerHTML = ""
      addProductoItem()
    }

    // Configurar selector de cliente
    setupClientSelector()

    // Ocultar información de convenio
    const convenioInfo = document.getElementById("convenioInfo")
    if (convenioInfo) {
      convenioInfo.style.display = "none"
    }

    // Si hay un cliente preseleccionado desde la URL
    if (currentClientId) {
      const cliente = clientes.find((c) => c.id === currentClientId)
      if (cliente) {
        document.getElementById("clienteSelector").value = cliente.nombre
        document.getElementById("clienteId").value = cliente.id
        updateConvenioInfo(cliente)
      }
    }
  }
}

// Configurar selector de cliente mejorado
function setupClientSelector() {
  const clienteSelector = document.getElementById("clienteSelector")
  const clienteDropdown = document.getElementById("clienteDropdown")
  const clienteIdInput = document.getElementById("clienteId")

  if (!clienteSelector || !clienteDropdown || !clienteIdInput) return

  // Limpiar valores
  clienteSelector.value = ""
  clienteIdInput.value = ""

  function renderDropdown(searchTerm = "") {
    const term = searchTerm.toLowerCase()
    const options = [
      {
        id: "",
        nombre: "Venta de mostrador",
        isShowroom: true,
      },
    ]
    const filteredClientes = clientes.filter(
      (cliente) =>
        cliente.nombre.toLowerCase().includes(term) ||
        cliente.telefono?.includes(term) ||
        cliente.email?.toLowerCase().includes(term),
    )
    options.push(...filteredClientes)

    if (options.length > 0) {
      clienteDropdown.innerHTML = ""
      options.forEach((option) => {
        const optionElement = document.createElement("div")
        optionElement.className = "client-option"
        optionElement.innerHTML = `
                    <div class="font-medium">${option.nombre}</div>
                    ${!option.isShowroom ? `<div class="text-sm text-gray-500">${option.telefono || ""} ${option.email || ""}</div>` : ""}
                `
        optionElement.addEventListener("click", async () => {
          clienteSelector.value = option.nombre
          clienteIdInput.value = option.id
          clienteDropdown.style.display = "none"
          if (option.isShowroom) {
            hideConvenioInfo()
          } else {
            await updateConvenioInfo(option)
          }
          updateAbonoVisibility()
        })
        clienteDropdown.appendChild(optionElement)
      })
      clienteDropdown.style.display = "block"
    } else {
      clienteDropdown.style.display = "none"
    }
  }

  // Configurar eventos
  clienteSelector.addEventListener("input", (e) => {
    renderDropdown(e.target.value)
  })

  // Mostrar dropdown al enfocar el input
  clienteSelector.addEventListener("focus", (e) => {
    renderDropdown(e.target.value)
  })

  // Ocultar dropdown al hacer clic fuera
  document.addEventListener("mousedown", (e) => {
    if (!clienteSelector.contains(e.target) && !clienteDropdown.contains(e.target)) {
      clienteDropdown.style.display = "none"
    }
  })

  // Manejar teclas
  clienteSelector.addEventListener("keydown", (e) => {
    const options = clienteDropdown.querySelectorAll(".client-option")
    const selectedIndex = Array.from(options).findIndex((option) => option.classList.contains("selected"))

    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (selectedIndex < options.length - 1) {
        if (selectedIndex >= 0) options[selectedIndex].classList.remove("selected")
        options[selectedIndex + 1].classList.add("selected")
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (selectedIndex > 0) {
        options[selectedIndex].classList.remove("selected")
        options[selectedIndex - 1].classList.add("selected")
      }
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (selectedIndex >= 0) {
        options[selectedIndex].click()
      }
    } else if (e.key === "Escape") {
      clienteDropdown.style.display = "none"
    }
  })
}

// Función corregida para actualizar información de convenio
async function updateConvenioInfo(cliente) {
  const convenioInfo = document.getElementById("convenioInfo")
  const empresaConvenio = document.getElementById("empresaConvenio")
  const sucursalConvenio = document.getElementById("sucursalConvenio")
  const descuentoConvenio = document.getElementById("descuentoConvenio")

  if (!convenioInfo) return

  if (cliente.convenio && cliente.empresaId) {
    const creditoInfo = await obtenerInfoCreditoCliente(cliente.id)

    if (creditoInfo && creditoInfo.empresa) {
      empresaConvenio.textContent = creditoInfo.empresa.nombre
      sucursalConvenio.textContent = creditoInfo.miembro.sucursal || "No especificada"
      descuentoConvenio.textContent = creditoInfo.empresa.descuento || 0

      // Actualizar información de crédito
      document.getElementById("creditoLimite").textContent = `$${creditoInfo.limiteCredito.toFixed(2)}`
      document.getElementById("creditoUsado").textContent = `$${creditoInfo.creditoUsado.toFixed(2)}`
      document.getElementById("creditoDisponible").textContent = `$${creditoInfo.creditoDisponible.toFixed(2)}`

      // Actualizar barra de progreso
      const porcentajeUso =
        creditoInfo.limiteCredito > 0 ? (creditoInfo.creditoUsado / creditoInfo.limiteCredito) * 100 : 0
      document.getElementById("creditoPercentage").textContent = `${porcentajeUso.toFixed(1)}%`
      document.getElementById("creditoProgressBar").style.width = `${Math.min(porcentajeUso, 100)}%`
      setCreditoProgressBarColor(porcentajeUso)

      // Mostrar alerta si está cerca del límite
      const creditoAlert = document.getElementById("creditoAlert")
      const creditoAlertMessage = document.getElementById("creditoAlertMessage")

      if (porcentajeUso >= 90) {
        creditoAlert.classList.remove("hidden")
        creditoAlertMessage.textContent =
          porcentajeUso >= 100
            ? "El cliente ha excedido su límite de crédito"
            : "El cliente está cerca de su límite de crédito"
      } else {
        creditoAlert.classList.add("hidden")
      }

      convenioInfo.style.display = "block"

      // Aplicar descuento automáticamente a productos existentes
      applyConvenioDiscountToProducts(creditoInfo.empresa.descuento || 0)
    }
  } else {
    hideConvenioInfo()
  }

  // Actualizar visibilidad del abono después de procesar convenio
  updateAbonoVisibility()
}

// Actualizar barra de progreso de credito
function setCreditoProgressBarColor(porcentajeUso) {
  const progressBar = document.getElementById("creditoProgressBar")
  if (!progressBar) return

  if (porcentajeUso < 40) {
    progressBar.style.background = "#10b981" // Verde
  } else if (porcentajeUso < 70) {
    progressBar.style.background = "#f59e0b" // Amarillo
  } else {
    progressBar.style.background = "#dc2626" // Rojo
  }
}

// Ocultar información de convenio
function hideConvenioInfo() {
  const convenioInfo = document.getElementById("convenioInfo")
  if (convenioInfo) {
    convenioInfo.style.display = "none"
  }

  // Remover descuentos automáticos y mensajes SIEMPRE
  const productosItems = document.querySelectorAll(".producto-item")
  productosItems.forEach((item, index) => {
    const descuentoInput = document.getElementById(`descuento_${index}`)
    const descuentoMsg = document.getElementById(`descuentoMsg_${index}`)
    if (descuentoInput) {
      descuentoInput.value = 0
      delete descuentoInput.dataset.manuallySet
      descuentoInput.dispatchEvent(new Event("input"))
    }
    if (descuentoMsg) {
      descuentoMsg.textContent = ""
      descuentoMsg.style.display = "none"
    }
  })
}

// Aplicar descuento de convenio a productos
function applyConvenioDiscountToProducts(descuentoPorcentaje) {
  const productosItems = document.querySelectorAll(".producto-item")

  productosItems.forEach((item, index) => {
    const descuentoInput = document.getElementById(`descuento_${index}`)
    const descuentoMsg = document.getElementById(`descuentoMsg_${index}`)
    if (descuentoInput && !descuentoInput.dataset.manuallySet) {
      descuentoInput.value = descuentoPorcentaje
      descuentoInput.dispatchEvent(new Event("input"))
      if (descuentoPorcentaje > 0 && descuentoMsg) {
        descuentoMsg.textContent = `Descuento de convenio aplicado: ${descuentoPorcentaje}%`
        descuentoMsg.style.display = "block"
      } else if (descuentoMsg) {
        descuentoMsg.textContent = ""
        descuentoMsg.style.display = "none"
      }
    }
  })
}

// Función corregida para actualizar visibilidad del campo abono
function updateAbonoVisibility() {
  const clienteId = document.getElementById("clienteId").value
  const abonoGroup = document.getElementById("abonoGroup")
  const labelAbonoGroup = document.querySelector('label[for="abono"]')
  const abonoInput = document.getElementById("abono")

  if (abonoGroup && abonoInput) {
    if (clienteId) {
      // Cliente seleccionado - verificar si tiene convenio
      const cliente = clientes.find((c) => c.id === clienteId)

      if (cliente && cliente.convenio) {
        // Cliente CON convenio - OCULTAR abono (se paga con crédito)
        abonoGroup.style.display = "none"
        abonoInput.value = "0"
      } else {
        // Cliente SIN convenio - MOSTRAR abono
        labelAbonoGroup.textContent = "Abono inicial"
        abonoGroup.style.display = "block"
        abonoInput.value = "0"
      }
    } else {
      // Venta de mostrador - MOSTRAR abono (debe ser pago completo)
      abonoGroup.style.display = "block"
      labelAbonoGroup.textContent = "Pago total"
      const total = document.getElementById("total").value
      abonoInput.value = total || "0"
    }
  }
}

// Función para agregar un elemento de producto al formulario
function addProductoItem() {
  const productosContainer = document.getElementById("productosContainer")
  if (!productosContainer) return

  const productoIndex = document.querySelectorAll(".producto-item").length

  const productoItem = document.createElement("div")
  productoItem.className = "producto-item"
  productoItem.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <h4 class="font-semibold text-lg">Producto ${productoIndex + 1}</h4>
            ${
              productoIndex > 0
                ? `
                <button type="button" class="remove-producto text-red-500 hover:text-red-700 p-1 rounded transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            `
                : ""
            }
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div class="form-group">
                <label for="tipoProducto_${productoIndex}" class="block mb-1 font-medium">Tipo</label>
                <select id="tipoProducto_${productoIndex}" class="tipo-producto w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" required>
                    <option value="">Seleccione tipo</option>
                    <option value="producto">Producto</option>
                    <option value="armazon">Armazón</option>
                </select>
            </div>
            <div class="form-group">
                <label for="producto_${productoIndex}" class="block mb-1 font-medium">Producto</label>
                <select id="producto_${productoIndex}" class="producto-select w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" required disabled>
                    <option value="">Seleccione producto</option>
                </select>
                <p id="stockInfo_${productoIndex}" class="text-sm text-gray-500 mt-1" style="display: none;"></p>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="form-group">
                <label for="cantidad_${productoIndex}" class="block mb-1 font-medium">Cantidad</label>
                <div class="quantity-controls">
                    <button type="button" class="quantity-btn decrease-btn" data-index="${productoIndex}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                        </svg>
                    </button>
                    <input type="number" id="cantidad_${productoIndex}" class="cantidad quantity-input" min="1" value="1" required>
                    <button type="button" class="quantity-btn increase-btn" data-index="${productoIndex}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="form-group">
                <label for="precio_${productoIndex}" class="block mb-1 font-medium">Precio unitario</label>
                <input type="number" step="0.01" id="precio_${productoIndex}" class="precio w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" required readonly>
                <span id="descuentoMsg_${productoIndex}" class="text-xs text-green-600 font-semibold" style="display:none;"></span>
            </div>
            <div class="form-group">
                <label for="descuento_${productoIndex}" class="block mb-1 font-medium">Descuento (%)</label>
                <input type="number" step="0.01" id="descuento_${productoIndex}" class="descuento w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" min="0" max="100" value="0">
            </div>
            <div class="form-group">
                <label for="subtotal_${productoIndex}" class="block mb-1 font-medium">Subtotal</label>
                <input type="number" step="0.01" id="subtotal_${productoIndex}" class="subtotal w-full p-2 border border-mediumGray rounded-md text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" readonly>
            </div>
        </div>
    `

  productosContainer.appendChild(productoItem)
  setupProductoEvents(productoIndex)
}

// Configurar eventos para un producto
function setupProductoEvents(index) {
  const removeBtn = document.querySelector(`.producto-item:nth-child(${index + 1}) .remove-producto`)
  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      this.closest(".producto-item").remove()
      document.querySelectorAll(".producto-item").forEach((item, i) => {
        item.querySelector("h4").textContent = `Producto ${i + 1}`
      })
      calcularTotal()
    })
  }

  const decreaseBtn = document.querySelector(`.decrease-btn[data-index="${index}"]`)
  const increaseBtn = document.querySelector(`.increase-btn[data-index="${index}"]`)
  const cantidadInput = document.getElementById(`cantidad_${index}`)

  if (decreaseBtn && cantidadInput) {
    decreaseBtn.addEventListener("click", () => {
      const tipoProducto = document.getElementById(`tipoProducto_${index}`)
      const productoSelect = document.getElementById(`producto_${index}`)
      if (!tipoProducto.value || !productoSelect.value) {
        showToast("Primero selecciona el tipo y producto", "warning")
        return
      }
      const currentValue = Number.parseInt(cantidadInput.value) || 1
      if (currentValue > 1) {
        cantidadInput.value = currentValue - 1
        cantidadInput.dispatchEvent(new Event("input"))
      }
    })
  }

  if (increaseBtn && cantidadInput) {
    increaseBtn.addEventListener("click", () => {
      const tipoProducto = document.getElementById(`tipoProducto_${index}`)
      const productoSelect = document.getElementById(`producto_${index}`)
      if (!tipoProducto.value || !productoSelect.value) {
        showToast("Primero selecciona el tipo y producto", "warning")
        return
      }
      const currentValue = Number.parseInt(cantidadInput.value) || 1
      const maxStock = Number.parseInt(cantidadInput.dataset.stock) || 999
      if (currentValue < maxStock) {
        cantidadInput.value = currentValue + 1
        cantidadInput.dispatchEvent(new Event("input"))
      }
    })
  }

  const tipoProducto = document.getElementById(`tipoProducto_${index}`)
  const productoSelect = document.getElementById(`producto_${index}`)

  if (tipoProducto && productoSelect) {
    tipoProducto.addEventListener("change", () => {
      const tipo = tipoProducto.value
      productoSelect.disabled = !tipo
      productoSelect.innerHTML = '<option value="">Seleccione producto</option>'

      if (tipo === "producto") {
        productos.forEach((producto) => {
          if (producto.stock > 0) {
            const option = document.createElement("option")
            option.value = producto.id
            option.textContent = `${producto.nombre} (Stock: ${producto.stock})`
            option.dataset.precio = producto.precioVenta || 0
            option.dataset.stock = producto.stock || 0
            productoSelect.appendChild(option)
          }
        })
      } else if (tipo === "armazon") {
        armazones.forEach((armazon) => {
          if (armazon.stock > 0) {
            const option = document.createElement("option")
            option.value = armazon.id
            option.textContent = `${armazon.marca} - ${armazon.modelo} (Stock: ${armazon.stock})`
            option.dataset.precio = armazon.precioVenta || 0
            option.dataset.stock = armazon.stock || 0
            productoSelect.appendChild(option)
          }
        })
      }
    })

    productoSelect.addEventListener("change", async () => {
      const selectedOption = productoSelect.options[productoSelect.selectedIndex]
      const precio = Number.parseFloat(selectedOption.dataset.precio) || 0
      const stock = Number.parseInt(selectedOption.dataset.stock) || 0

      const precioInput = document.getElementById(`precio_${index}`)
      if (precioInput) {
        precioInput.value = precio.toFixed(2)
        precioInput.dataset.original = precio
      }

      if (cantidadInput) {
        cantidadInput.max = stock
        cantidadInput.dataset.stock = stock
        cantidadInput.value = 1

        if (decreaseBtn) {
          decreaseBtn.disabled = cantidadInput.value <= 1
        }
        if (increaseBtn) {
          increaseBtn.disabled = cantidadInput.value >= stock
        }

        const stockInfo = document.getElementById(`stockInfo_${index}`)
        if (stockInfo) {
          stockInfo.textContent = `Stock disponible: ${stock}`
          stockInfo.style.display = "block"
        }
      }

      // Aplicar descuento de convenio si aplica
      const clienteId = document.getElementById("clienteId").value
      if (clienteId) {
        const cliente = clientes.find((c) => c.id === clienteId)
        if (cliente && cliente.convenio && cliente.empresaId) {
          const creditoInfo = await obtenerInfoCreditoCliente(clienteId)
          if (creditoInfo && creditoInfo.empresa && creditoInfo.empresa.descuento) {
            const descuentoInput = document.getElementById(`descuento_${index}`)
            if (descuentoInput && !descuentoInput.dataset.manuallySet) {
              descuentoInput.value = creditoInfo.empresa.descuento
              descuentoInput.dispatchEvent(new Event("input"))
            }
          }
        }
      }

      calcularSubtotal(index)
    })
  }

  const precioInput = document.getElementById(`precio_${index}`)
  const subtotalInput = document.getElementById(`subtotal_${index}`)
  const descuentoInput = document.getElementById(`descuento_${index}`)

  if (cantidadInput) {
    cantidadInput.addEventListener("input", () => {
      const cantidad = Number.parseInt(cantidadInput.value) || 1
      const stock = Number.parseInt(cantidadInput.dataset.stock) || 999

      if (cantidad < 1) {
        cantidadInput.value = 1
      } else if (cantidad > stock) {
        showToast(`Stock insuficiente. Máximo disponible: ${stock}`, "warning")
        cantidadInput.value = stock
      }

      if (decreaseBtn) {
        decreaseBtn.disabled = Number.parseInt(cantidadInput.value) <= 1
      }
      if (increaseBtn) {
        increaseBtn.disabled = Number.parseInt(cantidadInput.value) >= stock
      }

      calcularSubtotal(index)
    })
  }

  if (descuentoInput) {
    descuentoInput.addEventListener("input", () => {
      const descuento = Number.parseFloat(descuentoInput.value) || 0

      if (descuento !== 0) {
        descuentoInput.dataset.manuallySet = "true"
      } else {
        delete descuentoInput.dataset.manuallySet
      }

      calcularSubtotal(index)
    })
  }

  if (precioInput) {
    precioInput.addEventListener("input", () => {
      calcularSubtotal(index)
    })
  }
}

// Función para calcular subtotal de un producto
function calcularSubtotal(index) {
  const cantidadInput = document.getElementById(`cantidad_${index}`)
  const precioInput = document.getElementById(`precio_${index}`)
  const descuentoInput = document.getElementById(`descuento_${index}`)
  const subtotalInput = document.getElementById(`subtotal_${index}`)

  if (!cantidadInput || !precioInput || !subtotalInput) return

  const cantidad = Number.parseInt(cantidadInput.value) || 0
  const precioOriginal = Number.parseFloat(precioInput.dataset.original) || Number.parseFloat(precioInput.value) || 0
  const descuento = Number.parseFloat(descuentoInput?.value) || 0

  const precioConDescuento = precioOriginal * (1 - descuento / 100)
  precioInput.value = precioConDescuento.toFixed(2)

  const subtotal = cantidad * precioConDescuento
  subtotalInput.value = subtotal.toFixed(2)

  calcularTotal()
}

// Función para calcular el total de la venta
function calcularTotal() {
  const subtotales = document.querySelectorAll(".subtotal")
  let total = 0

  subtotales.forEach((subtotal) => {
    total += Number.parseFloat(subtotal.value) || 0
  })

  const totalInput = document.getElementById("total")
  if (totalInput) {
    totalInput.value = total.toFixed(2)
  }

  // Actualizar visibilidad del abono cuando cambie el total
  updateAbonoVisibility()

  const abonoInput = document.getElementById("abono")
  if (abonoInput) {
    abonoInput.max = total
  }
}

// Configurar eventos para los formularios
function setupFormEvents() {
  const saleForm = document.getElementById("saleForm")
  if (saleForm) {
    saleForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      await handleSaleSubmit()
    })
  }
}


// Función CORREGIDA para manejar envío del formulario de venta
async function handleSaleSubmit() {
  try {
    const saleId = document.getElementById("saleId").value
    const clienteId = document.getElementById("clienteId").value
    const fechaVenta = document.getElementById("fechaVenta").value
    const total = parseFloat(document.getElementById("total").value) || 0
    const observaciones = document.getElementById("observaciones").value

    const productosItems = document.querySelectorAll(".producto-item")
    if (productosItems.length === 0) {
      showToast("Debe agregar al menos un producto", "warning")
      return
    }

    const productos = []
    const productosParaActualizar = []
    let isValid = true
    let tieneArmazones = false

    for (let index = 0; index < productosItems.length; index++) {
      const tipoProducto = document.getElementById(`tipoProducto_${index}`)?.value
      const productoId = document.getElementById(`producto_${index}`)?.value
      const cantidad = parseInt(document.getElementById(`cantidad_${index}`)?.value) || 0
      const precio = parseFloat(document.getElementById(`precio_${index}`)?.value) || 0
      const subtotal = parseFloat(document.getElementById(`subtotal_${index}`)?.value) || 0
      const descuento = parseFloat(document.getElementById(`descuento_${index}`)?.value) || 0

      if (!tipoProducto || !productoId || cantidad <= 0 || precio <= 0) {
        isValid = false
        showToast(`Complete todos los campos del producto ${index + 1}`, "warning")
        break
      }

      if (tipoProducto === "armazon") {
        tieneArmazones = true
      }

      const productoSelect = document.getElementById(`producto_${index}`)
      const nombreProducto = productoSelect?.options[productoSelect.selectedIndex]?.text || "Producto desconocido"

      productos.push({
        tipo: tipoProducto,
        productoId,
        nombreProducto,
        cantidad,
        precio,
        descuento,
        subtotal,
      })

      productosParaActualizar.push({
        tipo: tipoProducto,
        id: productoId,
        cantidad,
      })
    }

    if (!isValid) return

    let abono = 0
    let convenio = false
    let empresaId = null

    if (clienteId) {
      const cliente = clientes.find((c) => c.id === clienteId)
      if (cliente && cliente.convenio) {
        convenio = true
        empresaId = cliente.empresaId

        const creditoInfo = await obtenerInfoCreditoCliente(clienteId)
        if (creditoInfo) {
          if (total > creditoInfo.creditoDisponible) {
            showToast(
              `Crédito insuficiente. Disponible: $${creditoInfo.creditoDisponible.toFixed(2)}, Requerido: $${total.toFixed(2)}`,
              "warning",
            )
            return
          }
          abono = total // Para convenios, el "abono" es el total
        } else {
          showToast("Error al obtener información de crédito", "danger")
          return
        }
      } else {
        // Cliente SIN convenio - obtener abono del formulario
        abono = parseFloat(document.getElementById("abono").value) || 0
        if (abono > total) {
          showToast("El abono no puede ser mayor al total", "warning")
          return
        }
      }
    } else {
      // Venta de mostrador - pago completo
      abono = total
    }

    const confirmMessage = convenio
      ? `¿Confirmar venta por $${total.toFixed(2)} con crédito de convenio?`
      : `¿Confirmar venta por $${total.toFixed(2)}?`

    showCustomAlert("Confirmar Venta", confirmMessage, "info", async () => {
      await processSaleFixed({
        saleId,
        clienteId,
        fechaVenta,
        productos,
        productosParaActualizar,
        total,
        abono,
        observaciones,
        convenio,
        empresaId,
        tieneArmazones,
      })
    })
  } catch (error) {
    console.error("Error al procesar venta:", error)
    showToast("Error al procesar la venta", "danger")
  }
}

// Función CORREGIDA para procesar la venta con estados correctos
async function processSaleFixed(saleData) {
  try {
    const {
      saleId,
      clienteId,
      fechaVenta,
      productos,
      productosParaActualizar,
      total,
      abono,
      observaciones,
      convenio,
      empresaId,
      tieneArmazones,
    } = saleData

    // LÓGICA CORREGIDA para determinar estado inicial
    let estado = "pendiente"
    let estadoArmazon = null

    if (convenio) {
      // Para convenios siempre es 'pagada'
      estado = "pagada"
    } else {
      // Para clientes sin convenio
      if (abono >= total) {
        estado = "pagada"
      } else if (abono > 0) {
        estado = "parcial"
      } else {
        estado = "pendiente"
      }
    }

    // Determinar estado inicial del armazón
    if (tieneArmazones) {
      if (convenio) {
        estadoArmazon = "en-proceso" // Convenios van directo a proceso
      } else {
        if (abono > 0) {
          estadoArmazon = "en-proceso"
        } else {
          estadoArmazon = "apartado"
        }
      }
    }

    const ventaData = {
      clienteId: clienteId || null,
      fecha: fechaVenta ? new Date(fechaVenta) : new Date(),
      productos,
      total,
      abono,
      estado,
      observaciones: observaciones || "",
      convenio,
      empresaId: empresaId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    if (tieneArmazones) {
      ventaData.estadoArmazon = estadoArmazon
    }

    let ventaRef
    if (saleId) {
      ventaRef = doc(db, "ventas", saleId)
      await updateDoc(ventaRef, ventaData)
    } else {
      ventaRef = await addDoc(collection(db, "ventas"), ventaData)
    }

    const ventaId = saleId || ventaRef.id

    // Registrar abono inicial solo si hay abono real
    if (abono > 0) {
      const descripcionAbono = convenio ? "Pago con crédito de convenio" : "Abono inicial"
      await registrarAbono(ventaId, clienteId, abono, descripcionAbono, convenio ? "credito_convenio" : "efectivo")
    }

    // Actualizar stock de productos
    for (const producto of productosParaActualizar) {
      const collectionName = producto.tipo === "armazon" ? "armazones" : "productos"
      const docRef = doc(db, collectionName, producto.id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const currentStock = docSnap.data().stock || 0
        const newStock = Math.max(0, currentStock - producto.cantidad)
        await updateDoc(docRef, {
          stock: newStock,
          updatedAt: serverTimestamp(),
        })
      }
    }

    // Actualizar última visita del cliente
    if (clienteId) {
      await updateDoc(doc(db, "clientes", clienteId), {
        ultimaVisita: serverTimestamp(),
      })
    }

    console.log(`Venta creada con estado: ${estado}, Armazón: ${estadoArmazon}`)
    showToast("Venta registrada correctamente", "success")

    document.getElementById("saleModal").style.display = "none"
    currentClientId = null

    await Promise.all([loadProductos(), loadArmazones()])
    ventasCache.clear()
    saldoCache.clear()
    await loadVentas()
  } catch (error) {
    console.error("Error al procesar venta:", error)
    showToast("Error al procesar la venta", "danger")
  }
}

// Función corregida para procesar la venta - CORREGIDA para manejar estados correctamente
async function processSale(saleData) {
  try {
    const {
      saleId,
      clienteId,
      fechaVenta,
      productos,
      productosParaActualizar,
      total,
      abono,
      observaciones,
      convenio,
      empresaId,
      tieneArmazones, // AGREGADO
    } = saleData

    // CORREGIDO: Lógica de estados mejorada
    let estado = "pendiente"
    if (convenio) {
      // Para convenios siempre es 'pagada' porque se paga con crédito
      estado = "pagada"
    } else if (abono >= total) {
      // Si el abono cubre el total, está pagada
      estado = "pagada"
    } else if (abono > 0) {
      // Si hay abono parcial, está parcial
      estado = "parcial"
    }

    // AGREGADO: Determinar estado inicial del armazón si hay armazones
    let estadoArmazon = null
    if (tieneArmazones) {
      estadoArmazon = determineInitialFrameStatus(abono, total)
    }

    const ventaData = {
      clienteId: clienteId || null,
      fecha: fechaVenta ? new Date(fechaVenta) : new Date(),
      productos,
      total,
      abono,
      estado,
      observaciones: observaciones || "",
      convenio,
      empresaId: empresaId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    // AGREGADO: Incluir estado de armazón si hay armazones
    if (tieneArmazones) {
      ventaData.estadoArmazon = estadoArmazon
    }

    let ventaRef
    if (saleId) {
      ventaRef = doc(db, "ventas", saleId)
      await updateDoc(ventaRef, ventaData)
    } else {
      ventaRef = await addDoc(collection(db, "ventas"), ventaData)
    }

    const ventaId = saleId || ventaRef.id

    // CORREGIDO: Registrar abono inicial solo si hay abono real
    if (abono > 0) {
      const descripcionAbono = convenio ? "Pago con crédito de convenio" : "Abono inicial"
      await registrarAbono(ventaId, clienteId, abono, descripcionAbono, convenio ? "credito_convenio" : "efectivo")
    }

    // CORREGIDO: Actualizar stock de productos SIEMPRE
    for (const producto of productosParaActualizar) {
      const collectionName = producto.tipo === "armazon" ? "armazones" : "productos"
      const docRef = doc(db, collectionName, producto.id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const currentStock = docSnap.data().stock || 0
        const newStock = Math.max(0, currentStock - producto.cantidad)
        await updateDoc(docRef, {
          stock: newStock,
          updatedAt: serverTimestamp(),
        })
        console.log(`Stock actualizado para ${producto.id}: ${currentStock} -> ${newStock}`)
      }
    }

    // Actualizar última visita del cliente si aplica
    if (clienteId) {
      await updateDoc(doc(db, "clientes", clienteId), {
        ultimaVisita: serverTimestamp(),
      })
    }

    showToast("Venta registrada correctamente", "success")

    // Cerrar modal y limpiar
    document.getElementById("saleModal").style.display = "none"
    currentClientId = null

    // CORREGIDO: Recargar productos y armazones para actualizar stock
    await Promise.all([loadProductos(), loadArmazones()])

    // Limpiar cache y recargar
    ventasCache.clear()
    saldoCache.clear()
    await loadVentas()
  } catch (error) {
    console.error("Error al procesar venta:", error)
    showToast("Error al procesar la venta", "danger")
  }
}

// Función para registrar un abono
async function registrarAbono(
  ventaId,
  clienteId,
  monto,
  descripcion = "Abono",
  metodoPago = "efectivo",
  fecha = new Date(),
) {
  try {
    const abonoData = {
      ventaId,
      clienteId: clienteId || null,
      monto,
      descripcion,
      metodoPago,
      fecha: fecha,
      createdAt: serverTimestamp(),
    }

    const abonoRef = await addDoc(collection(db, "abonos"), abonoData)

    if (clienteId) {
      await updateDoc(doc(db, "clientes", clienteId), {
        ultimaVisita: serverTimestamp(),
      })
    }

    return abonoRef.id
  } catch (error) {
    console.error("Error al registrar abono:", error)
    throw error
  }
}

// Configurar eventos de búsqueda
function setupSearchEvents() {
  const searchInput = document.getElementById("searchVenta")
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => {
        filtrosVentas.busqueda = e.target.value.toLowerCase()
        applyFilters()
      }, 300)
    })
  }
}

// Configurar eventos de filtros
function setupFilterEvents() {
  const toggleFiltrosBtn = document.getElementById("toggleFiltrosBtn")
  const filtrosPanel = document.getElementById("filtrosPanel")
  const aplicarFiltrosBtn = document.getElementById("aplicarFiltrosBtn")
  const limpiarFiltrosBtn = document.getElementById("limpiarFiltrosBtn")

  if (toggleFiltrosBtn && filtrosPanel) {
    toggleFiltrosBtn.addEventListener("click", () => {
      const isVisible = filtrosPanel.style.display !== "none"
      filtrosPanel.style.display = isVisible ? "none" : "block"
      toggleFiltrosBtn.classList.toggle("active", !isVisible)
    })
  }

  if (aplicarFiltrosBtn) {
    aplicarFiltrosBtn.addEventListener("click", () => {
      filtrosVentas.estado = document.getElementById("filtroEstado").value
      filtrosVentas.convenio = document.getElementById("filtroConvenio").value
      filtrosVentas.fechaInicio = document.getElementById("filtroFechaInicio").value
      filtrosVentas.fechaFin = document.getElementById("filtroFechaFin").value
      applyFilters()
    })
  }

  if (limpiarFiltrosBtn) {
    limpiarFiltrosBtn.addEventListener("click", () => {
      document.getElementById("filtroEstado").value = ""
      document.getElementById("filtroConvenio").value = ""
      document.getElementById("filtroFechaInicio").value = ""
      document.getElementById("filtroFechaFin").value = ""
      filtrosVentas = {
        cliente: "",
        estado: "",
        fechaInicio: "",
        fechaFin: "",
        convenio: "",
        busqueda: "",
      }
      applyFilters()
    })
  }
}

// Aplicar filtros
function applyFilters() {
  filteredVentas = allVentas.filter((venta) => {
    // Filtro por estado
    if (filtrosVentas.estado && venta.estado !== filtrosVentas.estado) {
      return false
    }

    // Filtro por convenio
    if (filtrosVentas.convenio) {
      const tieneConvenio = venta.convenio === true
      if (filtrosVentas.convenio === "true" && !tieneConvenio) return false
      if (filtrosVentas.convenio === "false" && tieneConvenio) return false
    }

    // Filtro por fecha
    if (filtrosVentas.fechaInicio || filtrosVentas.fechaFin) {
      const fechaVenta = venta.fecha instanceof Timestamp ? venta.fecha.toDate() : new Date(venta.fecha)

      if (filtrosVentas.fechaInicio) {
        const fechaInicio = new Date(filtrosVentas.fechaInicio)
        if (fechaVenta < fechaInicio) return false
      }

      if (filtrosVentas.fechaFin) {
        const fechaFin = new Date(filtrosVentas.fechaFin)
        fechaFin.setHours(23, 59, 59, 999)
        if (fechaVenta > fechaFin) return false
      }
    }

    // Filtro por búsqueda
    if (filtrosVentas.busqueda) {
      const searchTerm = filtrosVentas.busqueda
      const clienteNombre = venta.clienteId
        ? (clientesCache.get(venta.clienteId)?.nombre || "").toLowerCase()
        : "venta de mostrador"

      const matchesId = venta.id.toLowerCase().includes(searchTerm)
      const matchesCliente = clienteNombre.includes(searchTerm)
      const matchesProducto = venta.productos?.some((producto) =>
        producto.nombreProducto.toLowerCase().includes(searchTerm),
      )

      if (!matchesId && !matchesCliente && !matchesProducto) {
        return false
      }
    }

    return true
  })

  currentPage = 1
  displayVentas()
  updatePagination()
}

// Configurar eventos de paginación
function setupPaginationEvents() {
  const prevPageBtn = document.getElementById("prevPageBtn")
  const nextPageBtn = document.getElementById("nextPageBtn")

  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--
        displayVentas()
        updatePagination()
      }
    })
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++
        displayVentas()
        updatePagination()
      }
    })
  }
}

// Actualizar controles de paginación
function updatePagination() {
  totalPages = Math.ceil(filteredVentas.length / SALES_PER_PAGE)

  const currentPageSpan = document.getElementById("currentPage")
  const totalPagesSpan = document.getElementById("totalPages")
  const prevPageBtn = document.getElementById("prevPageBtn")
  const nextPageBtn = document.getElementById("nextPageBtn")

  if (currentPageSpan) currentPageSpan.textContent = currentPage
  if (totalPagesSpan) totalPagesSpan.textContent = totalPages

  if (prevPageBtn) {
    prevPageBtn.disabled = currentPage <= 1
  }

  if (nextPageBtn) {
    nextPageBtn.disabled = currentPage >= totalPages
  }
}

// Función optimizada para cargar ventas
async function loadVentas() {
  try {
    showLoadingSkeleton()

    const ventasSnapshot = await getDocs(query(collection(db, "ventas"), orderBy("createdAt", "desc")))

    allVentas = []
    const ventaIds = []

    ventasSnapshot.forEach((doc) => {
      const ventaData = {
        id: doc.id,
        ...doc.data(),
        saldoInfo: { totalAbonado: 0, totalPagado: 0, saldoPendiente: 0 },
      }
      allVentas.push(ventaData)
      ventaIds.push(doc.id)
    })

    // Calcular saldos en lotes para mejor rendimiento
    await calculateSaldosInBatch(ventaIds)

    filteredVentas = [...allVentas]
    lastCacheUpdate = Date.now()

    displayVentas()
    updatePagination()

    console.log("Ventas cargadas:", allVentas.length)
  } catch (error) {
    console.error("Error al cargar ventas:", error)
    showToast("Error al cargar ventas", "danger")
  }
}

// Mostrar skeleton de carga
function showLoadingSkeleton() {
  const tableBody = document.getElementById("ventasTableBody")
  if (!tableBody) return

  const skeletonRows = Array(5)
    .fill(0)
    .map(
      () => `
      <tr class="animate-pulse">
          <td class="py-3 px-4"><div class="h-4 bg-gray-200 rounded w-20"></div></td>
          <td class="py-3 px-4"><div class="h-4 bg-gray-200 rounded w-20"></div></td>
          <td class="py-3 px-4"><div class="h-4 bg-gray-200 rounded w-20"></div></td>
          <td class="py-3 px-4"><div class="h-4 bg-gray-200 rounded w-16"></div></td>
          <td class="py-3 px-4"><div class="h-4 bg-gray-200 rounded w-12"></div></td>
          <td class="py-3 px-4"><div class="h-4 bg-gray-200 rounded w-16"></div></td>
          <td class="py-3 px-4"><div class="h-4 bg-gray-200 rounded w-16"></div></td>
          <td class="py-3 px-4"><div class="h-4 bg-gray-200 rounded w-24"></div></td>
          <td class="py-3 px-4"><div class="h-4 bg-gray-200 rounded w-24"></div></td>
          <td class="py-3 px-4"><div class="h-4 bg-gray-200 rounded w-24"></div></td>
          <td class="py-3 px-4"><div class="h-4 bg-gray-200 rounded w-24"></div></td>
      </tr>
  `,
    )
    .join("")

  tableBody.innerHTML = skeletonRows
}

// Calcular saldos en lotes para mejor rendimiento
async function calculateSaldosInBatch(ventaIds) {
  const batchSize = 10
  const batches = []

  for (let i = 0; i < ventaIds.length; i += batchSize) {
    batches.push(ventaIds.slice(i, i + batchSize))
  }

  // Procesar lotes en paralelo
  await Promise.all(
    batches.map(async (batch) => {
      await Promise.all(
        batch.map(async (ventaId) => {
          const venta = allVentas.find((v) => v.id === ventaId)
          if (venta) {
            venta.saldoInfo = await calcularSaldoPendiente(ventaId)
          }
        }),
      )
    }),
  )
}

// Mostrar ventas en la tabla con optimizaciones - MODIFICADA para incluir estado de armazón
function displayVentas() {
  const tableBody = document.getElementById("ventasTableBody")
  if (!tableBody) return

  const startIndex = (currentPage - 1) * SALES_PER_PAGE
  const endIndex = startIndex + SALES_PER_PAGE
  const ventasPagina = filteredVentas.slice(startIndex, endIndex)

  // Usar DocumentFragment para mejor rendimiento
  const fragment = document.createDocumentFragment()

  if (ventasPagina.length === 0) {
    const row = document.createElement("tr")
    row.innerHTML = '<td colspan="11" class="py-4 text-center">No se encontraron ventas</td>'
    fragment.appendChild(row)
  } else {
    ventasPagina.forEach((venta) => {
      const row = createVentaRow(venta)
      fragment.appendChild(row)
    })
  }

  // Actualizar DOM una sola vez
  tableBody.innerHTML = ""
  tableBody.appendChild(fragment)

  // Configurar eventos usando delegación
  setupSaleEventsOptimized()
}

// Configurar eventos optimizados usando delegación
function setupSaleEventsOptimized() {
  const tableBody = document.getElementById("ventasTableBody")
  if (!tableBody) return

  // Remover listeners anteriores
  tableBody.removeEventListener("click", handleTableClick)

  // Agregar listener único usando delegación de eventos
  tableBody.addEventListener("click", handleTableClick)
}

// Manejar clicks en la tabla usando delegación - MODIFICADA para incluir estado de armazón
function handleTableClick(event) {
  const button = event.target.closest("button")
  if (!button) return

  const saleId = button.getAttribute("data-id")
  const clienteId = button.getAttribute("data-cliente")

  if (button.classList.contains("view-sale")) {
    viewSale(saleId)
  } else if (button.classList.contains("add-payment")) {
    addPayment(saleId, clienteId)
  } else if (button.classList.contains("cancel-sale")) {
    confirmCancelSale(saleId)
  } else if (button.classList.contains("change-frame-status")) {
    // AGREGADO: Manejar cambio de estado de armazón
    const venta = allVentas.find((v) => v.id === saleId)
    if (venta) {
      showFrameStatusModal(venta)
    }
  }
}

// Crear fila de venta optimizada - MODIFICADA para incluir estado de armazón
function createVentaRow(venta) {
  let fechaText = "No disponible"
  if (venta.fecha) {
    const fecha = venta.fecha instanceof Timestamp ? venta.fecha.toDate() : new Date(venta.fecha)
    fechaText = fecha.toLocaleDateString()
  }

  // Obtener nombre del cliente usando cache
  let clienteText = "Venta de mostrador"
  if (venta.clienteId) {
    const cliente = clientesCache.get(venta.clienteId) || clientes.find((c) => c.id === venta.clienteId)
    clienteText = cliente ? cliente.nombre : "Cliente no encontrado"
  }

  // MODIFICADO: Verificar si tiene armazones
  const tieneArmazones = hasFrames(venta.productos)

  // MODIFICADO: Formatear fecha de entrega
  let fechaEntregaText = "No establecida"
  if (venta.fechaEntrega) {
    const fechaEntrega =
      venta.fechaEntrega instanceof Timestamp ? venta.fechaEntrega.toDate() : new Date(venta.fechaEntrega)
    fechaEntregaText = fechaEntrega.toLocaleDateString()
  }

  const row = document.createElement("tr")
  row.className = "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"

  row.innerHTML = `
    <td class="py-3 px-4 font-mono text-sm">${venta.id.substring(0, 8)}...</td>
    <td class="py-3 px-4">${fechaText}</td>
    <td class="py-3 px-4">${clienteText}</td>
    <td class="py-3 px-4 font-semibold">$${venta.total.toFixed(2)}</td>
    <td class="py-3 px-4 text-green-600">$${venta.saldoInfo.totalAbonado.toFixed(2)}</td>
    <td class="py-3 px-4 ${venta.saldoInfo.saldoPendiente > 0 ? "text-red-600" : "text-green-600"}">
      $${venta.saldoInfo.saldoPendiente.toFixed(2)}
    </td>
    <td class="py-3 px-4">
      <span class="status-${venta.estado}">
        ${getEstadoText(venta.estado)}
      </span>
    </td>
    <td class="py-3 px-4">
      ${
        venta.convenio ? '<span class="badge badge-success">Sí</span>' : '<span class="badge badge-secondary">No</span>'
      }
    </td>
    <td class="py-3 px-4">
      ${
        tieneArmazones
          ? `<span class="estado-${venta.estadoArmazon || "apartado"}">
        ${getFrameStatusText(venta.estadoArmazon || "apartado")}
      </span>
      <button class="change-frame-status ml-1 text-blue-600 hover:text-blue-800" 
        data-id="${venta.id}" title="Cambiar estado">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>`
          : '<span class="text-gray-400 italic">No aplica</span>'
      }
    </td>
    <td class="py-3 px-4">
      ${
        tieneArmazones
          ? venta.fechaEntrega
            ? `<span class="text-green-600">${fechaEntregaText}</span>`
            : '<span class="text-amber-500">Pendiente</span>'
          : '<span class="text-gray-400 italic">No aplica</span>'
      }
    </td>
    <td class="py-3 px-4">
      <div class="flex space-x-1">
        <button class="view-sale inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-full text-sm font-medium transition-colors" 
            data-id="${venta.id}" title="Ver detalles">
          <span class="span-view-details">Ver</span>
        </button>
        ${
          venta.saldoInfo.saldoPendiente > 0 && venta.estado !== "cancelada"
            ? `
          <button class="add-payment inline-flex items-center px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-full text-sm font-medium transition-colors" 
              data-id="${venta.id}" data-cliente="${venta.clienteId || ""}" title="Agregar pago">
            <span class="span-add-payment">Pagar</span>
          </button>
        `
            : ""
        }
        ${
          venta.estado !== "cancelada"
            ? `
          <button class="cancel-sale inline-flex items-center px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-full text-sm font-medium transition-colors" 
              data-id="${venta.id}" title="Cancelar venta">
            <span class="span-cancel">Cancelar</span>
          </button>
        `
            : ""
        }
      </div>
    </td>
  `

  return row
}

// Obtener texto del estado
function getEstadoText(estado) {
  const estados = {
    pendiente: "Pendiente",
    parcial: "Abonado",
    pagada: "Pagado",
    cancelada: "Cancelado",
  }
  return estados[estado] || "Desconocido"
}

// Función para ver una venta
async function viewSale(saleId) {
  try {
    const docRef = doc(db, "ventas", saleId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const venta = docSnap.data()
      currentSale = {
        id: saleId,
        ...venta,
      }

      await showSaleDetailModal(currentSale)
    } else {
      showToast("No se encontró la venta", "danger")
    }
  } catch (error) {
    console.error("Error al obtener venta:", error)
    showToast("Error al obtener la venta", "danger")
  }
}

// Mostrar modal de detalle de venta - MODIFICADA para incluir estado de armazón y receptor
async function showSaleDetailModal(venta) {
  let saleDetailModal = document.getElementById("saleDetailModal")
  if (!saleDetailModal) {
    saleDetailModal = document.createElement("div")
    saleDetailModal.id = "saleDetailModal"
    saleDetailModal.className = "modal"

    saleDetailModal.innerHTML = `
          <div class="modal-content bg-white dark:bg-gray-800 w-11/12 md:w-3/4 max-w-4xl mx-auto mt-10 rounded-lg shadow-modal p-6">
              <div class="flex justify-between items-center mb-4 border-b border-mediumGray dark:border-gray-700 pb-3">
                  <h3 class="text-xl font-semibold">Detalle de Venta</h3>
                  <span class="close text-2xl cursor-pointer hover:text-gray-600 dark:hover:text-gray-300">&times;</span>
              </div>
              
              <div class="sale-details space-y-6">
                  <!-- Información general -->
                  <div class="general-info bg-lightGray dark:bg-gray-700 p-5 rounded-lg">
                      <div class="grid md:grid-cols-2 gap-x-4 gap-y-2">
                          <div class="mb-2">
                              <p><span class="font-semibold">ID Venta:</span> <span id="detailSaleId"></span></p>
                          </div>
                          <div class="mb-2">
                              <p><span class="font-semibold">Fecha:</span> <span id="detailSaleDate"></span></p>
                          </div>
                          <div class="mb-2">
                              <p><span class="font-semibold">Cliente:</span> <span id="detailSaleClient"></span></p>
                          </div>
                          <div class="mb-2">
                              <p><span class="font-semibold">Estado:</span> <span id="detailSaleStatus"></span></p>
                          </div>
                          <div class="mb-2" id="detailConvenioContainer">
                              <p><span class="font-semibold">Convenio:</span> <span id="detailSaleConvenio"></span></p>
                          </div>
                          <div class="mb-2" id="detailEmpresaContainer">
                              <p><span class="font-semibold">Empresa:</span> <span id="detailSaleEmpresa"></span></p>
                          </div>
                          <!-- Información de armazón -->
                          <div class="mb-2" id="detailFrameStatusContainer" style="display: none;">
                              <p>
                                  <span class="font-semibold">Estado de armazón:</span> 
                                  <span id="detailFrameStatus"></span>
                                  <button id="detailChangeFrameStatus" class="ml-2 text-blue-600 hover:text-blue-800 p-1 rounded">
                                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                  </button>
                              </p>
                          </div>
                          <!-- Fecha de entrega -->
                          <div class="mb-2" id="detailDeliveryDateContainer" style="display: none;">
                              <p><span class="font-semibold">Fecha de entrega:</span> <span id="detailDeliveryDate"></span></p>
                          </div>
                          <!-- Receptor de entrega - NUEVO -->
                          <div class="mb-2" id="detailRecipientContainer" style="display: none;">
                              <p><span class="font-semibold">Recibido por:</span> <span id="detailRecipient"></span></p>
                          </div>
                      </div>
                  </div>
                  
                  <!-- Productos -->
                  <div>
                      <h4 class="text-lg font-semibold mb-3">Productos</h4>
                      <div class="overflow-x-auto">
                          <table class="data-table w-full bg-white dark:bg-gray-800 rounded-lg">
                              <thead>
                                  <tr>
                                      <th class="py-2 px-4 text-left bg-primary text-white rounded-tl-lg">Producto</th>
                                      <th class="py-2 px-4 text-left bg-primary text-white">Tipo</th>
                                      <th class="py-2 px-4 text-left bg-primary text-white">Cantidad</th>
                                      <th class="py-2 px-4 text-left bg-primary text-white">Precio</th>
                                      <th class="py-2 px-4 text-left bg-primary text-white">Descuento</th>
                                      <th class="py-2 px-4 text-left bg-primary text-white rounded-tr-lg">Subtotal</th>
                                  </tr>
                              </thead>
                              <tbody id="detailProductsBody" class="divide-y divide-mediumGray dark:divide-gray-700">
                                  <!-- Products will be loaded dynamically -->
                              </tbody>
                              <tfoot>
                                  <tr class="font-bold">
                                      <td class="py-2 px-4" colspan="5">Total</td>
                                      <td class="py-2 px-4" id="detailSaleTotal"></td>
                                  </tr>
                              </tfoot>
                          </table>
                      </div>
                  </div>
                  
                  <!-- Pagos -->
                  <div>
                      <h4 class="text-lg font-semibold mb-3">Pagos y Abonos</h4>
                      <div class="overflow-x-auto">
                          <table class="data-table w-full bg-white dark:bg-gray-800 rounded-lg">
                              <thead>
                                  <tr>
                                      <th class="py-2 px-4 text-left bg-primary text-white rounded-tl-lg">Fecha</th>
                                      <th class="py-2 px-4 text-left bg-primary text-white">Tipo</th>
                                      <th class="py-2 px-4 text-left bg-primary text-white">Descripción</th>
                                      <th class="py-2 px-4 text-left bg-primary text-white rounded-tr-lg">Monto</th>
                                  </tr>
                              </thead>
                              <tbody id="detailPaymentsBody" class="divide-y divide-mediumGray dark:divide-gray-700">
                                  <!-- Payments will be loaded dynamically -->
                              </tbody>
                              <tfoot>
                                  <tr class="font-bold">
                                      <td class="py-2 px-4" colspan="3">Saldo pendiente</td>
                                      <td class="py-2 px-4" id="detailSalePending"></td>
                                  </tr>
                              </tfoot>
                          </table>
                      </div>
                  </div>
                  
                  <!-- Observaciones -->
                  <div id="detailObservacionesContainer">
                      <h4 class="text-lg font-semibold mb-2">Observaciones</h4>
                      <div class="bg-lightGray dark:bg-gray-700 p-3 rounded-lg">
                          <p id="detailSaleObservaciones"></p>
                      </div>
                  </div>
                  
                  <!-- Actions Section -->
                  <div class="flex justify-end space-x-4 pt-4 border-t border-mediumGray dark:border-gray-700 no-print">
                      <button id="detailAddPaymentBtn" class="btn-action bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded transition-colors flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                          </svg>
                          Agregar pago
                      </button>
                      <button id="detailPrintBtn" class="btn-primary py-2 px-4 bg-primary hover:bg-primary/80 text-white rounded transition-colors flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Imprimir
                      </button>
                      <button id="detailCloseBtn" class="py-2 px-4 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Cerrar
                      </button>
                  </div>
              </div>
          </div>
      `

    document.body.appendChild(saleDetailModal)
    setupSaleDetailModalEvents(saleDetailModal)
  }

  saleDetailModal.style.display = "block"
  await populateSaleDetailModal(venta)
}

// Configurar eventos del modal de detalle - MODIFICADA para incluir estado de armazón
function setupSaleDetailModalEvents(modal) {
  const closeBtn = modal.querySelector(".close")
  const detailCloseBtn = document.getElementById("detailCloseBtn")
  const detailPrintBtn = document.getElementById("detailPrintBtn")
  const detailAddPaymentBtn = document.getElementById("detailAddPaymentBtn")
  const detailChangeFrameStatus = document.getElementById("detailChangeFrameStatus")

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none"
    })
  }

  if (detailCloseBtn) {
    detailCloseBtn.addEventListener("click", () => {
      modal.style.display = "none"
    })
  }

  if (detailPrintBtn) {
    detailPrintBtn.addEventListener("click", () => {
      window.print()
    })
  }

  if (detailAddPaymentBtn) {
    detailAddPaymentBtn.addEventListener("click", () => {
      modal.style.display = "none"
      addPayment(currentSale.id, currentSale.clienteId)
    })
  }

  // AGREGADO: Evento para cambiar estado de armazón
  if (detailChangeFrameStatus) {
    detailChangeFrameStatus.addEventListener("click", () => {
      modal.style.display = "none"
      showFrameStatusModal(currentSale)
    })
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none"
    }
  })
}

// Llenar información del modal de detalle - MODIFICADA para incluir estado de armazón y receptor
async function populateSaleDetailModal(venta) {
  document.getElementById("detailSaleId").textContent = venta.id

  let fechaText = "No disponible"
  if (venta.fecha) {
    const fecha = venta.fecha instanceof Timestamp ? venta.fecha.toDate() : new Date(venta.fecha)
    fechaText = fecha.toLocaleDateString()
  }
  document.getElementById("detailSaleDate").textContent = fechaText

  let clienteText = "Venta de mostrador"
  if (venta.clienteId) {
    const cliente = clientesCache.get(venta.clienteId) || clientes.find((c) => c.id === venta.clienteId)
    clienteText = cliente ? cliente.nombre : "Cliente no encontrado"
  }
  document.getElementById("detailSaleClient").textContent = clienteText

  const estadoElement = document.getElementById("detailSaleStatus")
  estadoElement.textContent = getEstadoText(venta.estado)
  estadoElement.className = `status-${venta.estado}`

  const convenioContainer = document.getElementById("detailConvenioContainer")
  const empresaContainer = document.getElementById("detailEmpresaContainer")

  if (venta.convenio) {
    document.getElementById("detailSaleConvenio").textContent = "Sí"
    convenioContainer.style.display = "block"

    if (venta.empresaId) {
      const empresa = empresas.find((e) => e.id === venta.empresaId)
      document.getElementById("detailSaleEmpresa").textContent = empresa ? empresa.nombre : "Empresa no encontrada"
      empresaContainer.style.display = "block"
    } else {
      empresaContainer.style.display = "none"
    }
  } else {
    convenioContainer.style.display = "none"
    empresaContainer.style.display = "none"
  }

  // MODIFICADO: Mostrar estado de armazón y fecha de entrega solo si hay armazones
  const frameStatusContainer = document.getElementById("detailFrameStatusContainer")
  const deliveryDateContainer = document.getElementById("detailDeliveryDateContainer")
  const recipientContainer = document.getElementById("detailRecipientContainer") // NUEVO
  const tieneArmazones = hasFrames(venta.productos)

  if (tieneArmazones) {
    const frameStatusElement = document.getElementById("detailFrameStatus")
    const estadoArmazon = venta.estadoArmazon || "apartado"
    frameStatusElement.textContent = getFrameStatusText(estadoArmazon)
    frameStatusElement.className = `estado-${estadoArmazon}`
    frameStatusContainer.style.display = "block"

    // Mostrar fecha de entrega si existe
    if (venta.fechaEntrega) {
      const fechaEntrega =
        venta.fechaEntrega instanceof Timestamp ? venta.fechaEntrega.toDate() : new Date(venta.fechaEntrega)
      document.getElementById("detailDeliveryDate").textContent = fechaEntrega.toLocaleDateString()
      deliveryDateContainer.style.display = "block"
    } else {
      document.getElementById("detailDeliveryDate").textContent = "Pendiente"
      deliveryDateContainer.style.display = "block"
    }

    // NUEVO: Mostrar receptor de entrega si existe
    if (venta.receptorEntrega) {
      document.getElementById("detailRecipient").textContent = venta.receptorEntrega
      recipientContainer.style.display = "block"
    } else {
      recipientContainer.style.display = "none"
    }
  } else {
    frameStatusContainer.style.display = "none"
    deliveryDateContainer.style.display = "none"
    recipientContainer.style.display = "none" // NUEVO
  }

  const productsBody = document.getElementById("detailProductsBody")
  productsBody.innerHTML = ""

  if (venta.productos && venta.productos.length > 0) {
    venta.productos.forEach((producto) => {
      const row = document.createElement("tr")
      row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

      row.innerHTML = `
              <td class="py-2 px-4">${producto.nombreProducto}</td>
              <td class="py-2 px-4">${producto.tipo === "armazon" ? "Armazón" : "Producto"}</td>
              <td class="py-2 px-4">${producto.cantidad}</td>
              <td class="py-2 px-4">$${producto.precio.toFixed(2)}</td>
              <td class="py-2 px-4">${producto.descuento || 0}%</td>
              <td class="py-2 px-4">$${producto.subtotal.toFixed(2)}</td>
          `

      productsBody.appendChild(row)
    })
  } else {
    productsBody.innerHTML = '<tr><td colspan="6" class="py-2 px-4 text-center">No hay productos registrados</td></tr>'
  }

  document.getElementById("detailSaleTotal").textContent = `$${venta.total.toFixed(2)}`

  await loadSalePayments(venta.id)

  const observacionesContainer = document.getElementById("detailObservacionesContainer")
  const observacionesElement = document.getElementById("detailSaleObservaciones")

  if (venta.observaciones) {
    observacionesElement.textContent = venta.observaciones
    observacionesContainer.style.display = "block"
  } else {
    observacionesContainer.style.display = "none"
  }
}

// Cargar pagos de una venta
async function loadSalePayments(ventaId) {
  const paymentsBody = document.getElementById("detailPaymentsBody")
  paymentsBody.innerHTML =
    '<tr><td colspan="4" class="py-2 px-4 text-center"><div class="spinner mr-2"></div>Cargando pagos...</td></tr>'

  try {
    const [ventaDoc, abonosSnapshot, pagosSnapshot] = await Promise.all([
      getDoc(db, "ventas", ventaId),
      getDocs(query(collection(db, "abonos"), where("ventaId", "==", ventaId), orderBy("fecha", "asc"))),
      getDocs(query(collection(db, "pagos"), where("ventaId", "==", ventaId), orderBy("fecha", "asc"))),
    ])

    const venta = ventaDoc.data()
    const pagos = []
    let totalAbonado = 0
    let totalPagado = 0

    if (venta.abono > 0) {
      pagos.push({
        tipo: "abono",
        fecha: venta.fecha,
        descripcion: "Abono inicial",
        monto: venta.abono,
      })
      totalAbonado += venta.abono
    }

    abonosSnapshot.forEach((doc) => {
      const abono = doc.data()
      if (abono.descripcion !== "Abono inicial") {
        pagos.push({
          tipo: "abono",
          fecha: abono.fecha,
          descripcion: abono.descripcion || "Abono",
          monto: abono.monto,
        })
        totalAbonado += abono.monto
      }
    })

    pagosSnapshot.forEach((doc) => {
      const pago = doc.data()
      pagos.push({
        tipo: "pago",
        fecha: pago.fecha,
        descripcion: pago.descripcion || "Pago",
        monto: pago.monto,
      })
      totalPagado += pago.monto
    })

    pagos.sort((a, b) => {
      const fechaA = a.fecha instanceof Timestamp ? a.fecha.toDate() : new Date(a.fecha)
      const fechaB = b.fecha instanceof Timestamp ? b.fecha.toDate() : new Date(b.fecha)
      return fechaA - fechaB
    })

    paymentsBody.innerHTML = ""

    if (pagos.length > 0) {
      pagos.forEach((pago) => {
        const fechaText =
          pago.fecha instanceof Timestamp
            ? pago.fecha.toDate().toLocaleDateString()
            : new Date(pago.fecha).toLocaleDateString()

        const row = document.createElement("tr")
        row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

        row.innerHTML = `
                  <td class="py-2 px-4">${fechaText}</td>
                  <td class="py-2 px-4">${pago.tipo === "abono" ? "Abono" : "Pago"}</td>
                  <td class="py-2 px-4">${pago.descripcion}</td>
                  <td class="py-2 px-4 ${pago.tipo === "abono" ? "text-green-500" : "text-blue-500"}">$${pago.monto.toFixed(2)}</td>
              `

        paymentsBody.appendChild(row)
      })
    } else {
      paymentsBody.innerHTML = '<tr><td colspan="4" class="py-2 px-4 text-center">No hay pagos registrados</td></tr>'
    }

    const saldoPendiente = venta.total - totalAbonado - totalPagado
    const saldoElement = document.getElementById("detailSalePending")
    saldoElement.textContent = `$${saldoPendiente.toFixed(2)}`
    saldoElement.className = saldoPendiente > 0 ? "text-red-500" : "text-green-500"

    const detailAddPaymentBtn = document.getElementById("detailAddPaymentBtn")
    if (detailAddPaymentBtn) {
      if (saldoPendiente > 0 && venta.estado !== "cancelada") {
        detailAddPaymentBtn.style.display = "flex"
      } else {
        detailAddPaymentBtn.style.display = "none"
      }
    }
  } catch (error) {
    console.error("Error al cargar pagos:", error)
    paymentsBody.innerHTML =
      '<tr><td colspan="4" class="py-2 px-4 text-center text-red-500">Error al cargar pagos</td></tr>'
  }
}

// Función para agregar un pago
async function addPayment(ventaId, clienteId) {
  try {
    const docRef = doc(db, "ventas", ventaId)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      showToast("No se encontró la venta", "danger")
      return
    }

    const venta = docSnap.data()

    if (!venta.clienteId) {
      showToast("No se pueden realizar abonos en ventas de mostrador", "warning")
      return
    }

    const saldoInfo = await calcularSaldoPendiente(ventaId)

    if (saldoInfo.saldoPendiente <= 0) {
      showToast("Esta venta ya está completamente pagada", "info")
      return
    }

    await showPaymentModal(ventaId, clienteId, saldoInfo)
  } catch (error) {
    console.error("Error al preparar formulario de pago:", error)
    showToast("Error al preparar formulario de pago", "danger")
  }
}

// Mostrar modal de pago
async function showPaymentModal(ventaId, clienteId, saldoInfo) {
  let paymentModal = document.getElementById("paymentModal")
  if (!paymentModal) {
    paymentModal = document.createElement("div")
    paymentModal.id = "paymentModal"
    paymentModal.className = "modal"

    paymentModal.innerHTML = `
          <div class="modal-content bg-white dark:bg-gray-800 w-11/12 md:w-2/3 lg:w-1/2 max-w-xl mx-auto mt-16 rounded-lg shadow-modal p-6">
              <div class="flex justify-between items-center mb-4 border-b border-mediumGray dark:border-gray-700 pb-3">
                  <h3 class="text-xl font-semibold">Registrar Pago</h3>
                  <span class="close text-2xl cursor-pointer hover:text-gray-600 dark:hover:text-gray-300">&times;</span>
              </div>
              <form id="paymentForm" class="space-y-4">
                  <input type="hidden" id="paymentVentaId">
                  <input type="hidden" id="paymentClienteId">
                  
                  <div class="form-group">
                      <label for="paymentTipo" class="block mb-1 font-medium">Tipo de pago</label>
                      <select id="paymentTipo" class="w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" required>
                          <option value="abono">Abono</option>
                          <option value="pago">Pago completo</option>
                      </select>
                  </div>
                  
                  <div class="form-group">
                      <label for="paymentMonto" class="block mb-1 font-medium">Monto</label>
                      <input type="number" step="0.01" id="paymentMonto" class="w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" required>
                      <p class="text-sm text-gray-500 mt-1">Saldo pendiente: <span id="paymentSaldoPendiente" class="font-semibold"></span></p>
                  </div>
                  
                  <div class="form-group">
                      <label for="paymentMetodo" class="block mb-1 font-medium">Método de pago</label>
                      <select id="paymentMetodo" class="w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" required>
                          <option value="efectivo">Efectivo</option>
                          <option value="tarjeta_credito">Tarjeta de crédito</option>
                          <option value="tarjeta_debito">Tarjeta de débito</option>
                          <option value="transferencia">Transferencia</option>
                      </select>
                  </div>
                  
                  <div class="form-group">
                      <label for="paymentFecha" class="block mb-1 font-medium">Fecha</label>
                      <input type="date" id="paymentFecha" class="w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" required>
                  </div>
                  
                  <div class="form-group">
                      <label for="paymentDescripcion" class="block mb-1 font-medium">Descripción</label>
                      <textarea id="paymentDescripcion" rows="2" class="w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600"></textarea>
                  </div>
                  
                  <div class="flex justify-end space-x-2 pt-4 border-t border-mediumGray dark:border-gray-700">
                      <button type="button" class="close-modal py-2 px-4 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">Cancelar</button>
                      <button type="submit" class="btn-primary py-2 px-4 bg-primary hover:bg-primary/80 text-white rounded transition-colors">Registrar pago</button>
                  </div>
              </form>
          </div>
      `

    document.body.appendChild(paymentModal)
    setupPaymentModalEvents(paymentModal)
  }

  paymentModal.style.display = "block"

  document.getElementById("paymentVentaId").value = ventaId
  document.getElementById("paymentClienteId").value = clienteId || ""
  document.getElementById("paymentSaldoPendiente").textContent = `$${saldoInfo.saldoPendiente.toFixed(2)}`

  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  document.getElementById("paymentFecha").value = `${year}-${month}-${day}`

  document.getElementById("paymentTipo").value = "abono"
  document.getElementById("paymentMonto").value = ""
  document.getElementById("paymentMetodo").value = "efectivo"
  document.getElementById("paymentDescripcion").value = ""
}

// Configurar eventos del modal de pago
function setupPaymentModalEvents(modal) {
  const closeBtn = modal.querySelector(".close")
  const closeModalBtn = modal.querySelector(".close-modal")
  const paymentForm = document.getElementById("paymentForm")
  const paymentTipo = document.getElementById("paymentTipo")
  const paymentMonto = document.getElementById("paymentMonto")

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none"
    })
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      modal.style.display = "none"
    })
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.style.display = "none"
    }
  })

  if (paymentTipo && paymentMonto) {
    paymentTipo.addEventListener("change", async () => {
      const tipo = paymentTipo.value
      const ventaId = document.getElementById("paymentVentaId").value

      if (tipo === "pago") {
        const saldoInfo = await calcularSaldoPendiente(ventaId)
        paymentMonto.value = saldoInfo.saldoPendiente.toFixed(2)
      } else {
        paymentMonto.value = ""
      }
    })
  }

  if (paymentForm) {
    paymentForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      await handlePaymentSubmit(modal)
    })
  }
}

// Manejar envío del formulario de pago
async function handlePaymentSubmit(modal) {
  try {
    const ventaId = document.getElementById("paymentVentaId").value
    const clienteId = document.getElementById("paymentClienteId").value
    const tipo = document.getElementById("paymentTipo").value
    const monto = Number.parseFloat(document.getElementById("paymentMonto").value) || 0
    const metodo = document.getElementById("paymentMetodo").value
    const fecha = document.getElementById("paymentFecha").value
    const descripcion = document.getElementById("paymentDescripcion").value

    if (monto <= 0) {
      showToast("El monto debe ser mayor a cero", "warning")
      return
    }

    const saldoInfo = await calcularSaldoPendiente(ventaId)
    if (monto > saldoInfo.saldoPendiente) {
      showToast("El monto no puede ser mayor al saldo pendiente", "warning")
      return
    }

    const confirmMessage = `¿Confirmar ${tipo} de $${monto.toFixed(2)}?`

    showCustomAlert("Confirmar Pago", confirmMessage, "info", async () => {
      await processPayment({
        ventaId,
        clienteId,
        tipo,
        monto,
        metodo,
        fecha: fecha ? new Date(fecha) : new Date(),
        descripcion: descripcion || (tipo === "abono" ? "Abono" : "Pago"),
        modal,
      })
    })
  } catch (error) {
    console.error("Error al procesar pago:", error)
    showToast("Error al procesar el pago", "danger")
  }
}

// Función CORREGIDA para procesar pagos con lógica de estados mejorada
async function processPayment(paymentData) {
  try {
    const { ventaId, clienteId, tipo, monto, metodo, fecha, descripcion, modal } = paymentData

    // Registrar el abono o pago
    if (tipo === "abono") {
      await registrarAbono(ventaId, clienteId, monto, descripcion, metodo, fecha)
    } else {
      await registrarPago(ventaId, clienteId, monto, descripcion, metodo, fecha)
    }

    // Obtener datos actualizados de la venta
    const ventaDoc = await getDoc(doc(db, "ventas", ventaId))
    const venta = ventaDoc.data()
    
    // Recalcular saldo DESPUÉS de registrar el pago
    const nuevoSaldoInfo = await calcularSaldoPendienteActualizado(ventaId)
    
    // LÓGICA CORREGIDA para determinar el nuevo estado
    let nuevoEstado = "pendiente"
    let nuevoEstadoArmazon = venta.estadoArmazon

    // Para ventas SIN convenio
    if (!venta.convenio) {
      if (nuevoSaldoInfo.saldoPendiente <= 0.01) {
        // Saldo completamente pagado
        nuevoEstado = "pagada"
      } else if (nuevoSaldoInfo.totalAbonado > 0 || nuevoSaldoInfo.totalPagado > 0) {
        // Hay abonos/pagos pero aún queda saldo pendiente
        nuevoEstado = "parcial"
      } else {
        // No hay abonos ni pagos
        nuevoEstado = "pendiente"
      }

      // Actualizar estado del armazón si tiene armazones
      if (hasFrames(venta.productos)) {
        if (nuevoSaldoInfo.totalAbonado > 0 || nuevoSaldoInfo.totalPagado > 0) {
          // Si hay cualquier pago, cambiar a "en-proceso"
          nuevoEstadoArmazon = "en-proceso"
        } else {
          // Si no hay pagos, mantener "apartado"
          nuevoEstadoArmazon = "apartado"
        }
      }
    } else {
      // Para ventas CON convenio (lógica existente)
      nuevoEstado = "pagada" // Los convenios se consideran pagados con crédito
    }

    // Preparar datos de actualización
    const updateData = {
      estado: nuevoEstado,
      updatedAt: serverTimestamp(),
    }

    // Incluir estado de armazón si aplica
    if (hasFrames(venta.productos)) {
      updateData.estadoArmazon = nuevoEstadoArmazon
    }

    // Actualizar la venta en la base de datos
    await updateDoc(doc(db, "ventas", ventaId), updateData)

    console.log(`Estado actualizado: ${nuevoEstado}, Armazón: ${nuevoEstadoArmazon}`)
    
    showToast(`${tipo === "abono" ? "Abono" : "Pago"} registrado correctamente`, "success")

    modal.style.display = "none"

    // Limpiar cache y recargar
    saldoCache.delete(ventaId)
    ventasCache.clear()
    await loadVentas()
  } catch (error) {
    console.error(`Error al registrar ${tipo}:`, error)
    showToast(`Error al registrar ${tipo}`, "danger")
  }
}

// Función para registrar un pago
async function registrarPago(
  ventaId,
  clienteId,
  monto,
  descripcion = "Pago",
  metodoPago = "efectivo",
  fecha = new Date(),
) {
  try {
    const pagoData = {
      ventaId,
      clienteId: clienteId || null,
      monto,
      descripcion,
      metodoPago,
      fecha: fecha,
      createdAt: serverTimestamp(),
    }

    const pagoRef = await addDoc(collection(db, "pagos"), pagoData)

    if (clienteId) {
      await updateDoc(doc(db, "clientes", clienteId), {
        ultimaVisita: serverTimestamp(),
      })
    }

    return pagoRef.id
  } catch (error) {
    console.error("Error al registrar pago:", error)
    throw error
  }
}

// Función para confirmar cancelación de venta
function confirmCancelSale(saleId) {
  showCustomAlert(
    "Cancelar Venta",
    "¿Estás seguro de que deseas cancelar esta venta? Esta acción no se puede deshacer.",
    "danger",
    () => {
      cancelSale(saleId)
    },
  )
}

// Función para cancelar una venta
async function cancelSale(saleId) {
  try {
    await updateDoc(doc(db, "ventas", saleId), {
      estado: "cancelada",
      updatedAt: serverTimestamp(),
    })

    showToast("Venta cancelada correctamente", "success")

    // Limpiar cache y recargar
    saldoCache.delete(saleId)
    await loadVentas()
  } catch (error) {
    console.error("Error al cancelar venta:", error)
    showToast("Error al cancelar la venta", "danger")
  }
}

// Función CORREGIDA para calcular saldo pendiente de forma más precisa
async function calcularSaldoPendienteActualizado(ventaId) {
  try {
    // Forzar recálculo sin cache
    saldoCache.delete(ventaId)
    
    const [ventaDoc, abonosSnapshot, pagosSnapshot] = await Promise.all([
      getDoc(doc(db, "ventas", ventaId)),
      getDocs(query(collection(db, "abonos"), where("ventaId", "==", ventaId))),
      getDocs(query(collection(db, "pagos"), where("ventaId", "==", ventaId))),
    ])

    if (!ventaDoc.exists()) {
      throw new Error("La venta no existe")
    }

    const venta = ventaDoc.data()
    const total = venta.total

    // Calcular abonos: incluir abono inicial de la venta
    let totalAbonado = venta.abono || 0

    // Sumar todos los abonos adicionales
    abonosSnapshot.forEach((doc) => {
      const abono = doc.data()
      // Solo excluir el abono inicial si ya está incluido en venta.abono
      if (abono.descripcion !== "Abono inicial") {
        totalAbonado += abono.monto
      }
    })

    // Sumar todos los pagos
    let totalPagado = 0
    pagosSnapshot.forEach((doc) => {
      const pago = doc.data()
      totalPagado += pago.monto
    })

    // Calcular saldo pendiente
    const totalPagadoCompleto = totalAbonado + totalPagado
    const saldoPendiente = Math.max(0, total - totalPagadoCompleto)

    const result = {
      total,
      totalAbonado,
      totalPagado,
      saldoPendiente,
    }

    console.log(`Saldo calculado para ${ventaId}:`, result)

    // Actualizar cache
    saldoCache.set(ventaId, {
      data: result,
      timestamp: Date.now(),
    })

    return result
  } catch (error) {
    console.error("Error al calcular saldo pendiente:", error)
    return {
      total: 0,
      totalAbonado: 0,
      totalPagado: 0,
      saldoPendiente: 0,
    }
  }
}

// CORREGIDO: Función para calcular saldo pendiente con lógica mejorada
async function calcularSaldoPendiente(ventaId) {
  // Verificar cache primero
  const cached = saldoCache.get(ventaId)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  try {
    const [ventaDoc, abonosSnapshot, pagosSnapshot] = await Promise.all([
      getDoc(doc(db, "ventas", ventaId)),
      getDocs(query(collection(db, "abonos"), where("ventaId", "==", ventaId))),
      getDocs(query(collection(db, "pagos"), where("ventaId", "==", ventaId))),
    ])

    if (!ventaDoc.exists()) {
      throw new Error("La venta no existe")
    }

    const venta = ventaDoc.data()
    const total = venta.total

    // CORREGIDO: Calcular abonos y pagos correctamente
    let totalAbonado = venta.abono || 0 // Incluir abono inicial
    let totalPagado = 0

    // Sumar abonos adicionales (excluyendo el inicial que ya está en venta.abono)
    abonosSnapshot.forEach((doc) => {
      const abono = doc.data()
      if (abono.descripcion !== "Abono inicial" && abono.descripcion !== "Pago con crédito de convenio") {
        totalAbonado += abono.monto
      }
    })

    // Sumar todos los pagos
    pagosSnapshot.forEach((doc) => {
      const pago = doc.data()
      totalPagado += pago.monto
    })

    // CORREGIDO: Calcular saldo pendiente
    const totalPagadoCompleto = totalAbonado + totalPagado
    const saldoPendiente = Math.max(0, total - totalPagadoCompleto)

    const result = {
      total,
      totalAbonado,
      totalPagado,
      saldoPendiente,
    }

    // Guardar en cache
    saldoCache.set(ventaId, {
      data: result,
      timestamp: Date.now(),
    })

    return result
  } catch (error) {
    console.error("Error al calcular saldo pendiente:", error)
    return {
      total: 0,
      totalAbonado: 0,
      totalPagado: 0,
      saldoPendiente: 0,
    }
  }
}

// Limpiar cache periódicamente
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of saldoCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      saldoCache.delete(key)
    }
  }
}, CACHE_DURATION)

// Exportar funciones globales para uso en otros archivos
window.processPayment = processPayment
window.handleSaleSubmit = handleSaleSubmit
window.loadVentas = loadVentas
window.calcularSaldoPendiente = calcularSaldoPendienteActualizado
window.showToast = showToast
window.showCustomAlert = showCustomAlert
window.addPayment = addPayment
window.showSaleDetailModal = showSaleDetailModal
window.showFrameStatusModal = showFrameStatusModal // AGREGADO
