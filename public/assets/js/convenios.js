import {
  collection,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
  startAfter,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

import { db } from "./firebase-config.js"

// Variables globales
let empresas = []
let clientes = []
let miembros = []
let ventas = []
let pagosSucursales = []
let currentEmpresaId = null
let currentSucursalData = null

// Constantes y estados para paginación
const ITEMS_PER_PAGE = 5
let empresasPaginationState = {
  currentPage: 1,
  totalPages: 1,
  lastVisible: null,
  allItems: [],
  filteredItems: []
}

let miembrosPaginationState = {
  currentPage: 1,
  totalPages: 1,
  lastVisible: null,
  allItems: [],
  filteredItems: []
}

// Cache para optimización
let empresasCache = new Map()
let miembrosCache = new Map()
let clientesCache = new Map()
let lastCacheUpdate = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

// Filtros activos
const filtrosEmpresas = {
  busqueda: "",
}

let filtrosMiembros = {
  empresa: "",
  sucursal: "",
  estado: "",
  busqueda: "",
}

let activeTab = "empresas"

// Variable para controlar eventos automáticos
let preventAutoEvents = false

const VALID_EMAIL_DOMAINS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "me.com", "mac.com", "aol.com",
  "protonmail.com", "zoho.com", "yandex.com", "mail.com", "gmx.com", "fastmail.com",
  "uady.mx", "itmerida.mx", "anahuac.mx", "tec.mx", "unam.mx", "ipn.mx", "udg.mx", "buap.mx", "uanl.mx", "uas.mx", "uacam.mx",
  "gob.mx", "imss.gob.mx", "issste.gob.mx", "cfe.mx", "pemex.com", "banxico.org.mx", "sat.gob.mx", "sep.gob.mx"
]

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Página de convenios cargada")

  try {
    // Verificar y crear colecciones necesarias
    await checkAndCreateConveniosCollection()

    listenEmpresasRealtime()
    listenMiembrosRealtime()
    listenPagosSucursalesRealtime()

    // Cargar datos necesarios
    await Promise.all([loadClientes(), loadVentas(), loadPagosSucursales()])

    // Configurar eventos para las pestañas
    setupTabEvents()

    // Configurar eventos para los modales
    setupModalEvents()

    // Configurar eventos para los formularios
    setupFormEvents()

    // Configurar eventos para las búsquedas
    setupSearchEvents()

    // Configurar eventos para los filtros
    setupFilterEvents()

    // Configurar eventos para la paginación
    setupPaginationEvents()

    // Cargar validación de formularios
    setupEmpresaFormValidation()

    // Configurar evento para el botón "addClienteFromMiembroBtn"
    const addClienteFromMiembroBtn = document.getElementById("addClienteFromMiembroBtn")
    if (addClienteFromMiembroBtn) {
      addClienteFromMiembroBtn.addEventListener("click", () => {
        // Mostrar modal de cliente (reutilizar el modal existente de clientes.html)
        const modal = document.getElementById("clientModal")
        if (modal) {
          modal.style.display = "block"
          modal.style.zIndex = "2000"
          document.getElementById("modalTitle").textContent = "Nuevo Cliente (Desde Convenio)"
          document.getElementById("clientForm").reset()
          document.getElementById("clientId").value = ""

          // Agregar un campo oculto para indicar que el cliente se crea desde convenios
          let convenioSourceInput = document.getElementById("convenioSource")
          if (!convenioSourceInput) {
            convenioSourceInput = document.createElement("input")
            convenioSourceInput.type = "hidden"
            convenioSourceInput.id = "convenioSource"
            convenioSourceInput.value = "convenios"
            document.getElementById("clientForm").appendChild(convenioSourceInput)
          } else {
            convenioSourceInput.value = "convenios"
          }
        }
      })
    }

    // Recargar clientes después de guardar un cliente desde el modal
    const clientForm = document.getElementById("clientForm")
    if (clientForm) {
      clientForm.addEventListener("submit", async (e) => {
        // Espera un pequeño tiempo para que el cliente se guarde y el modal se cierre
        setTimeout(async () => {
          await loadClientes() // Solo recarga clientes
        }, 500)
      })
    }

    // Escuchar evento global para recargar miembros y empresas cuando se agregue un miembro desde clientes.js
    window.addEventListener("miembroConvenioAgregado", async () => {
      await loadClientes()
      await loadMiembros()
      await loadVentas()
      await loadEmpresas()
    })

    // Agregar esta línea después de cargar todos los datos
    setTimeout(async () => {
      await corregirMiembrosSinCredito()
    }, 2000) // Esperar 2 segundos para que todo esté cargado
  } catch (error) {
    console.error("Error al inicializar la página de convenios:", error)
    showToast("Error al cargar la página de convenios", "danger")
  }
})

// Escuchar cambios en la base de datos de empresas
function listenEmpresasRealtime() {
  const empresasRef = collection(db, "empresas")
  const q = query(empresasRef, orderBy("nombre"))
  onSnapshot(q, (querySnapshot) => {
    empresas = []
    querySnapshot.forEach((doc) => {
      empresas.push({
        id: doc.id,
        ...doc.data(),
      })
    })
    empresasPaginationState.allItems = empresas
    empresasPaginationState.currentPage = 1
    applyEmpresasFilters()
    updateEmpresaSelectors()
    console.log("Empresas actualizadas en tiempo real:", empresas.length)
  })
}

// Escuchar cambios en la base de datos de miembros
function listenMiembrosRealtime() {
  const miembrosRef = collection(db, "miembrosConvenio")
  const q = query(miembrosRef, orderBy("fechaRegistro", "desc"))
  onSnapshot(q, (querySnapshot) => {
    miembros = []
    querySnapshot.forEach((doc) => {
      miembros.push({
        id: doc.id,
        ...doc.data(),
      })
    })
    miembrosPaginationState.allItems = miembros
    miembrosPaginationState.currentPage = 1
    applyMiembrosFilters()
    console.log("Miembros actualizados en tiempo real:", miembros.length)
  })
}

// Escuchar cambios en la base de datos de pagos de sucursales
function listenPagosSucursalesRealtime() {
  const pagosRef = collection(db, "pagosSucursales")
  const q = query(pagosRef, orderBy("fecha", "desc"))
  onSnapshot(q, (querySnapshot) => {
    pagosSucursales = []
    querySnapshot.forEach((doc) => {
      pagosSucursales.push({
        id: doc.id,
        ...doc.data(),
      })
    })
    console.log("Pagos de sucursales actualizados en tiempo real:", pagosSucursales.length)
  })
}

// Función para verificar y crear colecciones necesarias
async function checkAndCreateConveniosCollection() {
  try {
    console.log("Verificando colecciones de convenios...")

    // Verificar si existe la colección de empresas
    const empresasSnapshot = await getDocs(collection(db, "empresas"))
    if (empresasSnapshot.empty) {
      console.log("Creando colección de empresas...")
    }

    // Verificar si existe la colección de miembros
    const miembrosSnapshot = await getDocs(collection(db, "miembrosConvenio"))
    if (miembrosSnapshot.empty) {
      console.log("Creando colección de miembros de convenio...")
    }

    // Verificar si existe la colección de pagos de sucursales
    const pagosSnapshot = await getDocs(collection(db, "pagosSucursales"))
    if (pagosSnapshot.empty) {
      console.log("Creando colección de pagos de sucursales...")
    }

    console.log("Verificación de colecciones de convenios completada")
  } catch (error) {
    console.error("Error al verificar o crear colecciones de convenios:", error)
    throw error
  }
}

// Función para cargar empresas con paginación y búsqueda en tiempo real
async function loadEmpresas(searchTerm = "") {
  try {
    // Verificar cache primero
    const cacheKey = `empresas_${searchTerm}`
    const cached = empresasCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      empresas = cached.data
      empresasPaginationState.allItems = empresas
      applyEmpresasFilters()
      return empresas
    }

    const empresasRef = collection(db, "empresas")
    const q = query(empresasRef, orderBy("nombre"))
    const querySnapshot = await getDocs(q)

    empresas = []
    querySnapshot.forEach((doc) => {
      empresas.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    // Guardar en cache
    empresasCache.set(cacheKey, {
      data: empresas,
      timestamp: Date.now()
    })

    // Actualizar estado de paginación
    empresasPaginationState.allItems = empresas
    empresasPaginationState.currentPage = 1

    // Aplicar filtros y actualizar tabla
    applyEmpresasFilters()

    // Actualizar selectores de empresas
    updateEmpresaSelectors()

    console.log("Empresas cargadas:", empresas.length)
    return empresas
  } catch (error) {
    console.error("Error al cargar empresas:", error)
    showToast("Error al cargar empresas", "danger")
    return []
  }
}

// Función para cargar clientes
async function loadClientes() {
  try {
    // Verificar cache primero
    const cached = clientesCache.get('all_clientes')
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      clientes = cached.data
      return clientes
    }

    const clientesRef = collection(db, "clientes")
    const q = query(clientesRef, orderBy("nombre"))
    const querySnapshot = await getDocs(q)

    clientes = []
    querySnapshot.forEach((doc) => {
      clientes.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    // Guardar en cache
    clientesCache.set('all_clientes', {
      data: clientes,
      timestamp: Date.now()
    })

    // Actualizar selectores de clientes
    updateClienteSelectors()

    console.log("Clientes cargados:", clientes.length)
    return clientes
  } catch (error) {
    console.error("Error al cargar clientes:", error)
    showToast("Error al cargar clientes", "danger")
    return []
  }
}

// Función para cargar miembros de convenios con paginación y filtros
async function loadMiembros(filters = {}) {
  try {
    // Crear clave de cache basada en los filtros
    const filterKey = JSON.stringify(filters)
    const cacheKey = `miembros_${filterKey}`

    // Verificar cache primero
    const cached = miembrosCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      miembros = cached.data
      miembrosPaginationState.allItems = miembros
      applyMiembrosFilters()
      return miembros
    }

    const miembrosRef = collection(db, "miembrosConvenio")
    let q = query(miembrosRef, orderBy("fechaRegistro", "desc"))

    // Aplicar filtros si existen
    if (filters.empresa) {
      q = query(q, where("empresaId", "==", filters.empresa))
    }

    if (filters.sucursal) {
      q = query(q, where("sucursal", "==", filters.sucursal))
    }

    if (filters.estado) {
      q = query(q, where("estado", "==", filters.estado))
    }

    const querySnapshot = await getDocs(q)

    miembros = []
    querySnapshot.forEach((doc) => {
      miembros.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    // Guardar en cache
    miembrosCache.set(cacheKey, {
      data: miembros,
      timestamp: Date.now()
    })

    // Actualizar estado de paginación
    miembrosPaginationState.allItems = miembros
    miembrosPaginationState.currentPage = 1

    // Aplicar filtros y actualizar tabla
    applyMiembrosFilters()

    console.log("Miembros cargados:", miembros.length)
    return miembros
  } catch (error) {
    console.error("Error al cargar miembros:", error)
    showToast("Error al cargar miembros", "danger")
    return []
  }
}

// Función para cargar ventas (necesaria para calcular crédito usado)
async function loadVentas() {
  try {
    const ventasRef = collection(db, "ventas")
    const q = query(ventasRef, orderBy("fecha", "desc"))
    const querySnapshot = await getDocs(q)

    ventas = []
    querySnapshot.forEach((doc) => {
      ventas.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    console.log("Ventas cargadas:", ventas.length)
    return ventas
  } catch (error) {
    console.error("Error al cargar ventas:", error)
    showToast("Error al cargar ventas", "danger")
    return []
  }
}

// Función para cargar pagos de sucursales
async function loadPagosSucursales() {
  try {
    const pagosRef = collection(db, "pagosSucursales")
    const q = query(pagosRef, orderBy("fecha", "desc"))
    const querySnapshot = await getDocs(q)

    pagosSucursales = []
    querySnapshot.forEach((doc) => {
      pagosSucursales.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    console.log("Pagos de sucursales cargados:", pagosSucursales.length)
    return pagosSucursales
  } catch (error) {
    console.error("Error al cargar pagos de sucursales:", error)
    showToast("Error al cargar pagos de sucursales", "danger")
    return []
  }
}

// Función para calcular la deuda de una empresa por sucursal
function calcularDeudaEmpresaPorSucursal(empresaId) {
  const miembrosEmpresa = miembros.filter((m) => m.empresaId === empresaId)
  const deudaPorSucursal = {}

  miembrosEmpresa.forEach((miembro) => {
    const creditoUsado = calcularCreditoUsadoMiembro(miembro.clienteId)

    if (!deudaPorSucursal[miembro.sucursal]) {
      deudaPorSucursal[miembro.sucursal] = {
        miembros: 0,
        deudaTotal: 0,
      }
    }

    deudaPorSucursal[miembro.sucursal].miembros++
    deudaPorSucursal[miembro.sucursal].deudaTotal += creditoUsado
  })

  return deudaPorSucursal
}

// Función para calcular pagos realizados por una sucursal
function calcularPagosSucursal(empresaId, sucursal) {
  const pagosSucursal = pagosSucursales.filter(
    (pago) => pago.empresaId === empresaId && pago.sucursal === sucursal
  )

  return pagosSucursal.reduce((total, pago) => total + (pago.monto || 0), 0)
}

// Función para calcular la deuda neta de una sucursal (deuda - pagos)
function calcularDeudaNetaSucursal(empresaId, sucursal) {
  const deudaPorSucursal = calcularDeudaEmpresaPorSucursal(empresaId)
  const deudaTotal = deudaPorSucursal[sucursal]?.deudaTotal || 0
  const pagosRealizados = calcularPagosSucursal(empresaId, sucursal)

  return Math.max(0, deudaTotal - pagosRealizados)
}

// Función para calcular el crédito usado por un miembro
function calcularCreditoUsadoMiembro(clienteId) {
  const ventasCliente = ventas.filter(
    (venta) => venta.clienteId === clienteId && venta.convenio === true && venta.estado !== "cancelada",
  )

  return ventasCliente.reduce((total, venta) => {
    const saldoPendiente = (venta.total || 0) - (venta.pagado || 0)
    return total + Math.max(0, saldoPendiente)
  }, 0)
}

// Función para calcular el crédito disponible de un miembro
function calcularCreditoDisponibleMiembro(miembroId) {
  const miembro = miembros.find((m) => m.id === miembroId)
  if (!miembro) return 0

  const creditoUsado = calcularCreditoUsadoMiembro(miembro.clienteId)
  const limiteCredito = miembro.limiteCredito || 0

  return Math.max(0, limiteCredito - creditoUsado)
}

// Función para validar si un miembro tiene crédito suficiente para una venta
function validateConvenioCredit(clienteId, montoVenta) {
  const miembro = miembros.find((m) => m.clienteId === clienteId)
  if (!miembro) return { valid: false, message: "Cliente no es miembro de ningún convenio" }

  const creditoDisponible = calcularCreditoDisponibleMiembro(miembro.id)

  if (montoVenta > creditoDisponible) {
    return {
      valid: false,
      message: `Crédito insuficiente. Disponible: $${creditoDisponible.toFixed(2)}, Requerido: $${montoVenta.toFixed(2)}`,
    }
  }

  return { valid: true, message: "Crédito suficiente" }
}

// Función para aplicar filtros a empresas y actualizar la tabla
function applyEmpresasFilters() {
  const searchTerm = filtrosEmpresas.busqueda.toLowerCase()

  if (searchTerm) {
    empresasPaginationState.filteredItems = empresasPaginationState.allItems.filter(empresa =>
      (empresa.nombre && empresa.nombre.toLowerCase().includes(searchTerm)) ||
      (empresa.contacto && empresa.contacto.toLowerCase().includes(searchTerm)) ||
      (empresa.telefono && empresa.telefono.includes(searchTerm)) ||
      (empresa.email && empresa.email.toLowerCase().includes(searchTerm))
    )
  } else {
    empresasPaginationState.filteredItems = [...empresasPaginationState.allItems]
  }

  // Calcular total de páginas
  empresasPaginationState.totalPages = Math.ceil(empresasPaginationState.filteredItems.length / ITEMS_PER_PAGE)
  if (empresasPaginationState.totalPages === 0) empresasPaginationState.totalPages = 1

  // Asegurar que la página actual es válida
  if (empresasPaginationState.currentPage > empresasPaginationState.totalPages) {
    empresasPaginationState.currentPage = empresasPaginationState.totalPages
  }

  // Actualizar tabla y controles de paginación
  updateEmpresasTable()
  updatePaginationControls()
}

// Función para aplicar filtros a miembros y actualizar la tabla
function applyMiembrosFilters() {
  let filteredMiembros = [...miembrosPaginationState.allItems]

  // Aplicar filtro de búsqueda
  if (filtrosMiembros.busqueda) {
    const term = filtrosMiembros.busqueda.toLowerCase()
    filteredMiembros = filteredMiembros.filter((miembro) => {
      // Buscar por referencia
      if (miembro.referencia && miembro.referencia.toLowerCase().includes(term)) return true

      // Buscar por cliente
      const cliente = clientes.find((c) => c.id === miembro.clienteId)
      if (cliente && cliente.nombre.toLowerCase().includes(term)) return true

      // Buscar por empresa
      const empresa = empresas.find((e) => e.id === miembro.empresaId)
      if (empresa && empresa.nombre.toLowerCase().includes(term)) return true

      return false
    })
  }

  // Aplicar filtro de empresa
  if (filtrosMiembros.empresa) {
    filteredMiembros = filteredMiembros.filter(miembro => miembro.empresaId === filtrosMiembros.empresa)
  }

  // Aplicar filtro de sucursal
  if (filtrosMiembros.sucursal) {
    filteredMiembros = filteredMiembros.filter(miembro => miembro.sucursal === filtrosMiembros.sucursal)
  }

  // Aplicar filtro de estado
  if (filtrosMiembros.estado) {
    filteredMiembros = filteredMiembros.filter(miembro => obtenerEstadoMiembro(miembro.id) === filtrosMiembros.estado)
  }

  miembrosPaginationState.filteredItems = filteredMiembros

  // Calcular total de páginas
  miembrosPaginationState.totalPages = Math.ceil(miembrosPaginationState.filteredItems.length / ITEMS_PER_PAGE)
  if (miembrosPaginationState.totalPages === 0) miembrosPaginationState.totalPages = 1

  // Asegurar que la página actual es válida
  if (miembrosPaginationState.currentPage > miembrosPaginationState.totalPages) {
    miembrosPaginationState.currentPage = miembrosPaginationState.totalPages
  }

  // Actualizar tabla y controles de paginación
  updateMiembrosTable()
  updatePaginationControls()
}

// Función para obtener el estado de un miembro basado en su crédito
function obtenerEstadoMiembro(miembroId) {
  const miembro = miembros.find((m) => m.id === miembroId)
  if (!miembro) return "inactivo"

  const creditoUsado = calcularCreditoUsadoMiembro(miembro.clienteId)
  const limiteCredito = miembro.limiteCredito || 0

  if (creditoUsado >= limiteCredito) {
    return "limite-excedido"
  }

  return "activo"
}

// Función para alternar la vista expandida de sucursales
function toggleSucursalesView(empresaId) {
  const expandableContent = document.getElementById(`sucursales-${empresaId}`)
  const expandIcon = document.getElementById(`expand-icon-${empresaId}`)

  if (expandableContent && expandIcon) {
    if (expandableContent.style.display === 'none' || expandableContent.style.display === '') {
      expandableContent.style.display = 'table-row'
      expandIcon.classList.add('expanded')
      loadSucursalesDetails(empresaId)
    } else {
      expandableContent.style.display = 'none'
      expandIcon.classList.remove('expanded')
    }
  }
}

// Función para cargar detalles de sucursales
function loadSucursalesDetails(empresaId) {
  const empresa = empresas.find(e => e.id === empresaId)
  if (!empresa) return

  const deudaPorSucursal = calcularDeudaEmpresaPorSucursal(empresaId)
  const sucursalesContainer = document.getElementById(`sucursales-content-${empresaId}`)

  if (!sucursalesContainer) return

  let sucursalesHTML = ''

  if (empresa.sucursales && empresa.sucursales.length > 0) {
    empresa.sucursales.forEach(sucursal => {
      const datos = deudaPorSucursal[sucursal] || { miembros: 0, deudaTotal: 0 }
      const pagosRealizados = calcularPagosSucursal(empresaId, sucursal)
      const deudaNeta = Math.max(0, datos.deudaTotal - pagosRealizados)
      const promedio = datos.miembros > 0 ? datos.deudaTotal / datos.miembros : 0
      const estadoCuenta = deudaNeta > 0 ? 'Con Deuda' : 'Sin Deuda'
      const badgeClass = deudaNeta > 0 ? 'badge-warning' : 'badge-success'

      sucursalesHTML += `
        <div class="sucursal-card">
          <div class="flex justify-between items-start mb-2">
            <h5 class="font-semibold text-primary">${sucursal}</h5>
            <span class="badge ${badgeClass}">Cuenta independiente</span>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
            <div>
              <span class="text-gray-600 dark:text-gray-400">Miembros:</span>
              <span class="font-medium">${datos.miembros}</span>
            </div>
            <div>
              <span class="text-gray-600 dark:text-gray-400">Deuda Total:</span>
              <span class="font-medium">$${datos.deudaTotal.toFixed(2)}</span>
            </div>
            <div>
              <span class="text-gray-600 dark:text-gray-400">Pagos:</span>
              <span class="font-medium text-green-600">$${pagosRealizados.toFixed(2)}</span>
            </div>
            <div>
              <span class="text-gray-600 dark:text-gray-400">Deuda Neta:</span>
              <span class="font-medium ${deudaNeta > 0 ? 'text-red-600' : 'text-green-600'}">$${deudaNeta.toFixed(2)}</span>
            </div>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-xs text-gray-500">Estado: ${estadoCuenta}</span>
            <button onclick="verDetallesSucursal('${empresaId}', '${sucursal}')" class="text-primary hover:text-primary/80 text-sm font-medium">
              Ver detalles completos
            </button>
          </div>
        </div>
      `
    })
  } else {
    sucursalesHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No hay sucursales registradas</p>'
  }

  sucursalesContainer.innerHTML = sucursalesHTML
}

// Función para ver detalles completos de una sucursal
function verDetallesSucursal(empresaId, sucursal) {
  const empresa = empresas.find(e => e.id === empresaId)
  if (!empresa) return

  // Guardar datos actuales de la sucursal
  currentSucursalData = {
    empresaId,
    sucursal,
    empresaNombre: empresa.nombre
  }

  // Calcular datos de la sucursal
  const deudaPorSucursal = calcularDeudaEmpresaPorSucursal(empresaId)
  const datos = deudaPorSucursal[sucursal] || { miembros: 0, deudaTotal: 0 }
  const pagosRealizados = calcularPagosSucursal(empresaId, sucursal)
  const deudaNeta = Math.max(0, datos.deudaTotal - pagosRealizados)

  // Mostrar modal de detalle de sucursal
  const modal = document.getElementById("detalleSucursalModal")
  if (modal) {
    modal.style.display = "block"

    // Llenar información de la sucursal
    document.getElementById("detalleSucursalNombre").textContent = sucursal
    document.getElementById("detalleSucursalEmpresa").textContent = empresa.nombre
    document.getElementById("detalleSucursalMiembros").textContent = datos.miembros
    document.getElementById("detalleSucursalDeudaTotal").textContent = `$${datos.deudaTotal.toFixed(2)}`
    document.getElementById("detalleSucursalPagosRealizados").textContent = `$${pagosRealizados.toFixed(2)}`
    document.getElementById("detalleSucursalDeudaNeta").textContent = `$${deudaNeta.toFixed(2)}`

    // Cargar miembros de la sucursal
    loadMiembrosSucursal(empresaId, sucursal)

    // Cargar historial de pagos
    loadHistorialPagosSucursal(empresaId, sucursal)
  }
}

// Función para cargar miembros de una sucursal específica
function loadMiembrosSucursal(empresaId, sucursal) {
  const miembrosSucursal = miembros.filter(m => m.empresaId === empresaId && m.sucursal === sucursal)
  const tbody = document.getElementById("detalleSucursalMiembrosBody")

  if (!tbody) return

  tbody.innerHTML = ""

  if (miembrosSucursal.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center">No hay miembros en esta sucursal</td></tr>'
    return
  }

  miembrosSucursal.forEach(miembro => {
    const cliente = clientes.find(c => c.id === miembro.clienteId)
    const clienteNombre = cliente ? cliente.nombre : "Cliente no encontrado"
    const creditoUsado = calcularCreditoUsadoMiembro(miembro.clienteId)
    const creditoDisponible = Math.max(0, (miembro.limiteCredito || 0) - creditoUsado)

    const row = document.createElement("tr")
    row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"
    row.innerHTML = `
      <td class="py-2 px-4">${clienteNombre}</td>
      <td class="py-2 px-4">$${(miembro.limiteCredito || 0).toFixed(2)}</td>
      <td class="py-2 px-4">$${creditoUsado.toFixed(2)}</td>
      <td class="py-2 px-4">$${creditoDisponible.toFixed(2)}</td>
      <td class="py-2 px-4">
        <span class="status-${obtenerEstadoMiembro(miembro.id)}">
          ${obtenerEstadoMiembro(miembro.id) === "activo" ? "Activo" : "Límite Excedido"}
        </span>
      </td>
    `
    tbody.appendChild(row)
  })
}

// Función para cargar historial de pagos de una sucursal
function loadHistorialPagosSucursal(empresaId, sucursal) {
  const pagosSucursal = pagosSucursales.filter(p => p.empresaId === empresaId && p.sucursal === sucursal)
  const tbody = document.getElementById("detalleSucursalPagosBody")

  if (!tbody) return

  tbody.innerHTML = ""

  if (pagosSucursal.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center">No hay pagos registrados</td></tr>'
    return
  }

  pagosSucursal.forEach(pago => {
    const fecha = pago.fecha instanceof Timestamp ? pago.fecha.toDate() : new Date(pago.fecha)

    const row = document.createElement("tr")
    row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"
    row.innerHTML = `
      <td class="py-2 px-4">${fecha.toLocaleDateString()}</td>
      <td class="py-2 px-4">$${(pago.monto || 0).toFixed(2)}</td>
      <td class="py-2 px-4">${pago.metodoPago || "No especificado"}</td>
      <td class="py-2 px-4">${pago.notas || "-"}</td>
    `
    tbody.appendChild(row)
  })
}

// Función para registrar un pago de sucursal
async function registrarPagoSucursal() {
  try {
    const monto = parseFloat(document.getElementById("pagoSucursalMonto").value)
    const metodoPago = document.getElementById("pagoSucursalMetodo").value
    const notas = document.getElementById("pagoSucursalNotas").value

    if (!monto || monto <= 0) {
      showToast("Por favor, ingrese un monto válido", "warning")
      return
    }

    if (!metodoPago) {
      showToast("Por favor, seleccione un método de pago", "warning")
      return
    }

    const pagoData = {
      empresaId: currentSucursalData.empresaId,
      sucursal: currentSucursalData.sucursal,
      empresaNombre: currentSucursalData.empresaNombre,
      monto: monto,
      metodoPago: metodoPago,
      notas: notas || "",
      fecha: new Date(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    await addDoc(collection(db, "pagosSucursales"), pagoData)

    showToast("Pago registrado correctamente", "success")

    // Cerrar modal de pago
    document.getElementById("pagoSucursalModal").style.display = "none"

    // Recargar datos
    await loadPagosSucursales()

    // Actualizar vista de detalle de sucursal si está abierta
    if (currentSucursalData) {
      verDetallesSucursal(currentSucursalData.empresaId, currentSucursalData.sucursal)
    }

  } catch (error) {
    console.error("Error al registrar pago:", error)
    showToast("Error al registrar el pago", "danger")
  }
}

// Función para actualizar la tabla de empresas (MEJORADA)
function updateEmpresasTable() {
  const tableBody = document.getElementById("empresasTableBody")
  if (!tableBody) return

  // Limpiar tabla
  tableBody.innerHTML = ""

  if (empresasPaginationState.filteredItems.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="10" class="py-4 text-center">No se encontraron empresas</td></tr>'
    return
  }

  // Calcular índices para paginación
  const startIndex = (empresasPaginationState.currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, empresasPaginationState.filteredItems.length)
  const empresasPagina = empresasPaginationState.filteredItems.slice(startIndex, endIndex)

  // Agregar empresas a la tabla
  empresasPagina.forEach((empresa) => {
    // Contar sucursales
    const sucursales = empresa.sucursales || []

    // Contar miembros
    const miembrosCount = miembros.filter((m) => m.empresaId === empresa.id).length

    // Crear fila principal de la empresa
    const row = document.createElement("tr")
    row.className = "hover:bg-gray-50 dark:hover:bg-gray-700 expandable-row"

    row.innerHTML = `
      <td class="py-3 px-4">${empresa.nombre || "-"}</td>
      <td class="py-3 px-4">${empresa.contacto || "-"}</td>
      <td class="py-3 px-4">${empresa.telefono || "-"}</td>
      <td class="py-3 px-4">${empresa.email || "-"}</td>
      <td class="py-3 px-4">${empresa.descuento || 40}%</td>
      <td class="py-3 px-4">$${(empresa.limiteCreditoPorMiembro || 3500).toFixed(2)}</td>
      <td class="py-3 px-4">${sucursales.length}</td>
      <td class="py-3 px-4">${miembrosCount}</td>
      <td class="py-3 px-4">
        <button onclick="toggleSucursalesView('${empresa.id}')" class="flex items-center text-primary hover:text-primary/80 font-medium">
          <svg id="expand-icon-${empresa.id}" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1 expand-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          Ver detalles
        </button>
      </td>
      <td class="py-3 px-4">
        <div class="flex space-x-2">
          <button class="view-empresa text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${empresa.id}" title="Ver detalles completos">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button class="edit-empresa text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" data-id="${empresa.id}" title="Editar">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button class="delete-empresa text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${empresa.id}" title="Eliminar">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    `

    tableBody.appendChild(row)

    // Crear fila expandible para sucursales
    const expandableRow = document.createElement("tr")
    expandableRow.id = `sucursales-${empresa.id}`
    expandableRow.className = "expandable-content"
    expandableRow.style.display = "none"

    expandableRow.innerHTML = `
      <td colspan="10" class="py-4 px-6">
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 class="font-semibold mb-3 text-gray-800 dark:text-gray-200 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Sucursales - Cuentas Independientes
          </h4>
          <div id="sucursales-content-${empresa.id}" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <!-- Se cargará dinámicamente -->
          </div>
        </div>
      </td>
    `

    tableBody.appendChild(expandableRow)
  })

  // Configurar eventos para los botones
  setupEmpresaEvents()
}

// Función para actualizar la tabla de miembros
function updateMiembrosTable() {
  const tableBody = document.getElementById("miembrosTableBody")
  if (!tableBody) return

  // Limpiar tabla
  tableBody.innerHTML = ""

  if (miembrosPaginationState.filteredItems.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center">No se encontraron miembros</td></tr>'
    return
  }

  // Calcular índices para paginación
  const startIndex = (miembrosPaginationState.currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, miembrosPaginationState.filteredItems.length)
  const miembrosPagina = miembrosPaginationState.filteredItems.slice(startIndex, endIndex)

  // Agregar miembros a la tabla
  miembrosPagina.forEach((miembro) => {
    // Obtener nombre de la empresa
    const empresa = empresas.find((e) => e.id === miembro.empresaId)
    const empresaNombre = empresa ? empresa.nombre : "Empresa no encontrada"

    // Obtener nombre del cliente
    const cliente = clientes.find((c) => c.id === miembro.clienteId)
    const clienteNombre = cliente ? cliente.nombre : "Cliente no encontrado"

    // Calcular créditos
    const limiteCredito = miembro.limiteCredito || 0
    const creditoUsado = calcularCreditoUsadoMiembro(miembro.clienteId)
    const creditoDisponible = Math.max(0, limiteCredito - creditoUsado)
    const estado = obtenerEstadoMiembro(miembro.id)

    // Formatear fecha de registro
    let fechaRegistroText = "No disponible"
    if (miembro.fechaRegistro) {
      const fecha =
        miembro.fechaRegistro instanceof Timestamp ? miembro.fechaRegistro.toDate() : new Date(miembro.fechaRegistro)
      fechaRegistroText = fecha.toLocaleDateString()
    }

    const row = document.createElement("tr")
    row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

    row.innerHTML = `
      <td class="py-3 px-4">${empresaNombre}</td>
      <td class="py-3 px-4">
        <span class="badge badge-success">${miembro.sucursal || "-"}</span>
      </td>
      <td class="py-3 px-4">${clienteNombre}</td>
      <td class="py-3 px-4">$${limiteCredito.toFixed(2)}</td>
      <td class="py-3 px-4">$${creditoUsado.toFixed(2)}</td>
      <td class="py-3 px-4">$${creditoDisponible.toFixed(2)}</td>
      <td class="py-3 px-4">
        <span class="status-${estado}">${estado === "activo" ? "Activo" : estado === "limite-excedido" ? "Límite Excedido" : "Inactivo"}</span>
      </td>
      <td class="py-3 px-4">${fechaRegistroText}</td>
      <td class="py-3 px-4">
        <div class="flex space-x-2">
          <button class="edit-miembro text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" data-id="${miembro.id}" title="Editar">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button class="adjust-credit text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${miembro.id}" title="Ajustar crédito">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </button>
          <button class="delete-miembro text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${miembro.id}" title="Eliminar">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    `

    tableBody.appendChild(row)
  })

  // Configurar eventos para los botones
  setupMiembroEvents()
}

// Función para actualizar los controles de paginación según el tab activo
function updatePaginationControls() {
  const prevPageBtn = document.getElementById("prevPageBtn")
  const nextPageBtn = document.getElementById("nextPageBtn")
  const currentPageSpan = document.getElementById("currentPage")
  const totalPagesSpan = document.getElementById("totalPages")

  if (!prevPageBtn || !nextPageBtn || !currentPageSpan || !totalPagesSpan) return

  // Determinar qué estado de paginación usar según el tab activo
  const paginationState = activeTab === "empresas" ? empresasPaginationState : miembrosPaginationState

  // Actualizar texto de paginación
  currentPageSpan.textContent = paginationState.currentPage
  totalPagesSpan.textContent = paginationState.totalPages

  // Habilitar/deshabilitar botones de paginación
  prevPageBtn.disabled = paginationState.currentPage <= 1
  nextPageBtn.disabled = paginationState.currentPage >= paginationState.totalPages
}

// Función para actualizar los selectores de empresas
function updateEmpresaSelectors() {
  // Actualizar selector de empresas en el formulario de miembro
  const miembroEmpresa = document.getElementById("miembroEmpresa")
  if (miembroEmpresa) {
    miembroEmpresa.innerHTML = '<option value="">Seleccione una empresa</option>'
    empresas.forEach((empresa) => {
      const option = document.createElement("option")
      option.value = empresa.id
      option.textContent = empresa.nombre
      miembroEmpresa.appendChild(option)
    })
  }

  // Actualizar selector de empresas en los filtros
  const filterEmpresa = document.getElementById("filterEmpresa")
  if (filterEmpresa) {
    filterEmpresa.innerHTML = '<option value="">Todas</option>'
    empresas.forEach((empresa) => {
      const option = document.createElement("option")
      option.value = empresa.id
      option.textContent = empresa.nombre
      filterEmpresa.appendChild(option)
    })
  }
}

// Función para actualizar los selectores de clientes
function updateClienteSelectors() {
  // Actualizar selector de clientes en el formulario de miembro
  const miembroCliente = document.getElementById("miembroCliente")
  if (miembroCliente) {
    miembroCliente.innerHTML = '<option value="">Seleccione un cliente</option>'
    clientes.forEach((cliente) => {
      const option = document.createElement("option")
      option.value = cliente.id
      option.textContent = cliente.nombre
      miembroCliente.appendChild(option)
    })
  }
}

// Función para mostrar notificaciones toast
function showToast(message, type = "info") {
  // Crear contenedor de toast si no existe
  let toastContainer = document.getElementById("toastContainer")
  if (!toastContainer) {
    toastContainer = document.createElement("div")
    toastContainer.id = "toastContainer"
    toastContainer.className = "toast-container"
    document.body.appendChild(toastContainer)
  }

  const toast = document.createElement("div")
  toast.className = `toast toast-${type}`
  toast.innerHTML = `
    <div class="toast-content">
      <span>${message}</span>
    </div>
    <button type="button" class="toast-close">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  `

  toastContainer.appendChild(toast)

  // Agregar evento para cerrar el toast
  const closeBtn = toast.querySelector(".toast-close")
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      toast.style.animation = "slideOut 0.3s ease-out forwards"
      setTimeout(() => {
        if (toastContainer.contains(toast)) {
          toast.remove()
        }
      }, 300)
    })
  }

  // Cerrar automáticamente después de 5 segundos
  setTimeout(() => {
    if (toastContainer.contains(toast)) {
      toast.style.animation = "slideOut 0.3s ease-out forwards"
      setTimeout(() => {
        if (toastContainer.contains(toast)) {
          toast.remove()
        }
      }, 300)
    }
  }, 5000)
}

// Configurar eventos para las pestañas
function setupTabEvents() {
  const tabEmpresas = document.getElementById("tabEmpresas")
  const tabMiembros = document.getElementById("tabMiembros")
  const spanEmpresas = document.getElementById("spanEmpresas")
  const spanMiembros = document.getElementById("spanMiembros")
  const empresasTab = document.getElementById("empresas-tab")
  const miembrosTab = document.getElementById("miembros-tab")

  tabEmpresas.addEventListener("click", () => {
    activeTab = "empresas"
    tabEmpresas.classList.add("active")
    tabMiembros.classList.remove("active")
    spanEmpresas.classList.remove("opacity-0")
    spanEmpresas.classList.add("opacity-100")
    spanMiembros.classList.remove("opacity-100")
    spanMiembros.classList.add("opacity-0")
    empresasTab.style.display = "block"
    miembrosTab.style.display = "none"
    updatePaginationControls()
  })

  tabMiembros.addEventListener("click", () => {
    activeTab = "miembros"
    tabMiembros.classList.add("active")
    tabEmpresas.classList.remove("active")
    spanMiembros.classList.remove("opacity-0")
    spanMiembros.classList.add("opacity-100")
    spanEmpresas.classList.remove("opacity-100")
    spanEmpresas.classList.add("opacity-0")
    empresasTab.style.display = "none"
    miembrosTab.style.display = "block"
    updatePaginationControls()
  })

  // Estado inicial
  if (activeTab === "empresas") {
    tabEmpresas.classList.add("active")
    tabMiembros.classList.remove("active")
    spanEmpresas.classList.remove("opacity-0")
    spanEmpresas.classList.add("opacity-100")
    spanMiembros.classList.remove("opacity-100")
    spanMiembros.classList.add("opacity-0")
    empresasTab.style.display = "block"
    miembrosTab.style.display = "none"
  } else {
    tabMiembros.classList.add("active")
    tabEmpresas.classList.remove("active")
    spanMiembros.classList.remove("opacity-0")
    spanMiembros.classList.add("opacity-100")
    spanEmpresas.classList.remove("opacity-100")
    spanEmpresas.classList.add("opacity-0")
    empresasTab.style.display = "none"
    miembrosTab.style.display = "block"
  }
}

// Validación en tiempo real para empresaModal
function setupEmpresaFormValidation() {
  const nombreInput = document.getElementById("empresaNombre")
  const telefonoInput = document.getElementById("empresaTelefono")
  const emailInput = document.getElementById("empresaEmail")

  // Mensajes de error
  function setError(input, message) {
    input.classList.add("border-red-500")
    input.classList.remove("border-mediumGray")
    let msg = input.parentElement.querySelector(".input-error-msg")
    if (!msg) {
      msg = document.createElement("div")
      msg.className = "input-error-msg text-xs text-red-600 mt-1"
      input.parentElement.appendChild(msg)
    }
    msg.textContent = message
  }
  function clearError(input) {
    input.classList.remove("border-red-500")
    input.classList.add("border-mediumGray")
    const msg = input.parentElement.querySelector(".input-error-msg")
    if (msg) msg.remove()
  }

  // Validar nombre único
  nombreInput.addEventListener("input", () => {
    const value = nombreInput.value.trim().toLowerCase()
    const existe = empresas.some(e => e.nombre && e.nombre.trim().toLowerCase() === value)
    if (existe) {
      setError(nombreInput, "Ya existe una empresa con este nombre.")
    } else if (value.length < 3) {
      setError(nombreInput, "El nombre debe tener al menos 3 caracteres.")
    } else {
      clearError(nombreInput)
    }
  })

  // Validar teléfono
  telefonoInput.addEventListener("input", () => {
    const value = telefonoInput.value.replace(/\D/g, "")
    if (!/^[2-9]\d{9,}$/.test(value)) {
      setError(telefonoInput, "El teléfono debe tener al menos 10 dígitos y empezar con 2-9.")
    } else {
      clearError(telefonoInput)
    }
  })

  // Validar email
  emailInput.addEventListener("input", () => {
    const value = emailInput.value.trim()
    if (value.length === 0) {
      clearError(emailInput)
      return
    }
    const emailParts = value.split("@")
    if (emailParts.length !== 2) {
      setError(emailInput, "Correo no válido.")
      return
    }
    const domain = emailParts[1].toLowerCase()
    const validDomain = VALID_EMAIL_DOMAINS.some(d => domain.endsWith(d))
    if (!validDomain) {
      setError(emailInput, "Dominio de correo no permitido.")
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError(emailInput, "Formato de correo no válido.")
    } else {
      clearError(emailInput)
    }
  })

  // Validación final al enviar
  const form = document.getElementById("empresaForm")
  form.addEventListener("submit", (e) => {
    let valid = true
    // Nombre
    const nombreVal = nombreInput.value.trim().toLowerCase()
    if (empresas.some(e => e.nombre && e.nombre.trim().toLowerCase() === nombreVal)) {
      setError(nombreInput, "Ya existe una empresa con este nombre.")
      valid = false
    }
    if (nombreVal.length < 3) {
      setError(nombreInput, "El nombre debe tener al menos 3 caracteres.")
      valid = false
    }
    // Teléfono
    const telVal = telefonoInput.value.replace(/\D/g, "")
    if (!/^[2-9]\d{9,}$/.test(telVal)) {
      setError(telefonoInput, "El teléfono debe tener al menos 10 dígitos y empezar con 2-9.")
      valid = false
    }
    // Email
    const emailVal = emailInput.value.trim()
    if (emailVal.length > 0) {
      const emailParts = emailVal.split("@")
      const domain = emailParts.length === 2 ? emailParts[1].toLowerCase() : ""
      const validDomain = VALID_EMAIL_DOMAINS.some(d => domain.endsWith(d))
      if (!validDomain) {
        setError(emailInput, "Dominio de correo no permitido.")
        valid = false
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        setError(emailInput, "Formato de correo no válido.")
        valid = false
      }
    }
    if (!valid) {
      e.preventDefault()
      showToast("Corrige los errores antes de guardar.", "danger")
    }
  })
}

// Configurar eventos para los modales
function setupModalEvents() {
  // Configurar botón para agregar empresa
  const addEmpresaBtn = document.getElementById("addEmpresaBtn")
  if (addEmpresaBtn) {
    addEmpresaBtn.addEventListener("click", () => {
      // Mostrar modal de empresa
      const modal = document.getElementById("empresaModal")
      if (modal) {
        modal.style.display = "block"
        document.getElementById("empresaModalTitle").textContent = "Nueva Empresa"
        document.getElementById("empresaForm").reset()
        document.getElementById("empresaId").value = ""

        // Limpiar contenedor de sucursales
        const sucursalesContainer = document.getElementById("sucursalesContainer")
        if (sucursalesContainer) {
          sucursalesContainer.innerHTML = `
            <div class="sucursal-item flex items-center space-x-2">
              <input type="text" placeholder="Nombre de la sucursal" class="sucursal-nombre flex-grow p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600">
            </div>
          `
        }
      }
    })
  }

  // Configurar botón para agregar miembro
  const addMiembroBtn = document.getElementById("addMiembroBtn")
  if (addMiembroBtn) {
    addMiembroBtn.addEventListener("click", () => {
      // Mostrar modal de miembro
      const modal = document.getElementById("miembroModal")
      if (modal) {
        modal.style.display = "block"
        modal.style.zIndex = "2000"
        document.getElementById("miembroModalTitle").textContent = "Nuevo Miembro"
        document.getElementById("miembroForm").reset()
        document.getElementById("miembroId").value = ""

        // Establecer fecha actual
        const today = new Date()
        const year = today.getFullYear()
        const month = String(today.getMonth() + 1).padStart(2, "0")
        const day = String(today.getDate()).padStart(2, "0")
        document.getElementById("miembroFechaRegistro").value = `${year}-${month}-${day}`

        // Deshabilitar selector de sucursal
        const miembroSucursal = document.getElementById("miembroSucursal")
        if (miembroSucursal) {
          miembroSucursal.disabled = true
          miembroSucursal.innerHTML = '<option value="">Seleccione una sucursal</option>'
        }
      }
    })
  }

  // Configurar botones para cerrar modales
  const closeButtons = document.querySelectorAll(".close, .close-modal")
  closeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      // Solo cierra el modal más cercano al botón
      const modal = this.closest(".modal")
      if (modal) modal.style.display = "none"
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

  // Configurar botón para agregar sucursal
  const addSucursalBtn = document.getElementById("addSucursalBtn")
  if (addSucursalBtn) {
    addSucursalBtn.addEventListener("click", () => {
      const sucursalesContainer = document.getElementById("sucursalesContainer")
      if (sucursalesContainer) {
        const sucursalItem = document.createElement("div")
        sucursalItem.className = "sucursal-item flex items-center space-x-2"
        sucursalItem.innerHTML = `
          <input type="text" placeholder="Nombre de la sucursal" class="sucursal-nombre flex-grow p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600">
          <button type="button" class="remove-sucursal text-red-500 hover:text-red-700">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        `
        sucursalesContainer.appendChild(sucursalItem)

        // Configurar evento para eliminar sucursal
        const removeBtn = sucursalItem.querySelector(".remove-sucursal")
        if (removeBtn) {
          removeBtn.addEventListener("click", function () {
            this.closest(".sucursal-item").remove()
          })
        }
      }
    })
  }

  // Configurar evento para cambiar empresa en el formulario de miembro (CORREGIDO)
  const miembroEmpresa = document.getElementById("miembroEmpresa")
  const miembroSucursal = document.getElementById("miembroSucursal")
  const miembroLimiteCredito = document.getElementById("miembroLimiteCredito")

  if (miembroEmpresa && miembroSucursal) {
    miembroEmpresa.addEventListener("change", () => {
      const empresaId = miembroEmpresa.value

      // Habilitar/deshabilitar selector de sucursal
      miembroSucursal.disabled = !empresaId
      miembroSucursal.innerHTML = '<option value="">Seleccione una sucursal</option>'

      if (empresaId) {
        // Buscar empresa
        const empresa = empresas.find((e) => e.id === empresaId)
        if (empresa) {
          // Solo mostrar alerta si NO estamos evitando eventos automáticos
          if (miembroLimiteCredito && !preventAutoEvents) {
            const limiteEmpresa = empresa.limiteCreditoPorMiembro || 3500
            miembroLimiteCredito.value = limiteEmpresa

            // Mostrar mensaje informativo solo cuando es una acción del usuario
            showToast(`Límite de crédito establecido automáticamente: $${limiteEmpresa.toFixed(2)}`, "info")
          } else if (miembroLimiteCredito && preventAutoEvents) {
            // Si estamos evitando eventos automáticos, solo establecer el valor sin mostrar alerta
            const limiteEmpresa = empresa.limiteCreditoPorMiembro || 3500
            miembroLimiteCredito.value = limiteEmpresa
          }

          // Agregar sucursales al selector
          if (empresa.sucursales) {
            empresa.sucursales.forEach((sucursal) => {
              const option = document.createElement("option")
              option.value = sucursal
              option.textContent = sucursal
              miembroSucursal.appendChild(option)
            })
          }
        }
      }
    })
  }

  // Configurar botones para el modal de detalle de empresa
  const detallePrintBtn = document.getElementById("detallePrintBtn")
  const detalleCloseBtn = document.getElementById("detalleCloseBtn")
  const detalleEditEmpresaBtn = document.getElementById("detalleEditEmpresaBtn")
  const detalleAddMiembroBtn = document.getElementById("detalleAddMiembroBtn")

  if (detallePrintBtn) {
    detallePrintBtn.addEventListener("click", () => {
      window.print()
    })
  }

  if (detalleCloseBtn) {
    detalleCloseBtn.addEventListener("click", () => {
      document.getElementById("detalleEmpresaModal").style.display = "none"
    })
  }

  if (detalleEditEmpresaBtn) {
    detalleEditEmpresaBtn.addEventListener("click", () => {
      if (currentEmpresaId) {
        // Cerrar modal de detalle
        //document.getElementById("detalleEmpresaModal").style.display = "none"
        // Abrir modal de edición
        editEmpresa(currentEmpresaId)
      }
    })
  }

  if (detalleAddMiembroBtn) {
    detalleAddMiembroBtn.addEventListener("click", () => {
      if (currentEmpresaId) {
        // Cerrar modal de detalle
        //document.getElementById("detalleEmpresaModal").style.display = "none"
        // Abrir modal de nuevo miembro con la empresa preseleccionada
        const modal = document.getElementById("miembroModal")
        if (modal) {
          modal.style.display = "block"
          modal.style.zIndex = "2000"
          document.getElementById("miembroModalTitle").textContent = "Nuevo Miembro"
          document.getElementById("miembroForm").reset()
          document.getElementById("miembroId").value = ""

          // Establecer fecha actual
          const today = new Date()
          const year = today.getFullYear()
          const month = String(today.getMonth() + 1).padStart(2, "0")
          const day = String(today.getDate()).padStart(2, "0")
          document.getElementById("miembroFechaRegistro").value = `${year}-${month}-${day}`

          // Preseleccionar empresa sin disparar eventos automáticos
          preventAutoEvents = true
          document.getElementById("miembroEmpresa").value = currentEmpresaId

          // Disparar evento change para cargar sucursales
          const event = new Event("change")
          document.getElementById("miembroEmpresa").dispatchEvent(event)

          // Restaurar eventos automáticos después de un breve delay
          setTimeout(() => {
            preventAutoEvents = false
          }, 100)
        }
      }
    })
  }

  // Configurar eventos para el modal de detalle de sucursal
  const detalleSucursalCloseBtn = document.getElementById("detalleSucursalCloseBtn")
  const registrarPagoBtn = document.getElementById("registrarPagoBtn")

  if (detalleSucursalCloseBtn) {
    detalleSucursalCloseBtn.addEventListener("click", () => {
      document.getElementById("detalleSucursalModal").style.display = "none"
    })
  }

  if (registrarPagoBtn) {
    registrarPagoBtn.addEventListener("click", () => {
      // Mostrar modal de pago
      const modal = document.getElementById("pagoSucursalModal")
      if (modal) {
        modal.style.display = "block"
        document.getElementById("pagoSucursalForm").reset()

        // Llenar información de la sucursal
        if (currentSucursalData) {
          document.getElementById("pagoSucursalEmpresa").textContent = currentSucursalData.empresaNombre
          document.getElementById("pagoSucursalNombreSucursal").textContent = currentSucursalData.sucursal

          // Calcular y mostrar la deuda actual de la sucursal
          const deudaNeta = calcularDeudaNetaSucursal(currentSucursalData.empresaId, currentSucursalData.sucursal)
          document.getElementById("pagoSucursalDeudaActual").textContent = `$${deudaNeta.toFixed(2)}`
        }
      }
    })
  }

  // Configurar eventos para el modal de pago
  const pagoSucursalCloseBtn = document.getElementById("pagoSucursalCloseBtn")
  const pagoSucursalCancelBtn = document.getElementById("pagoSucursalCancelBtn")
  const pagoSucursalForm = document.getElementById("pagoSucursalForm")

  if (pagoSucursalCloseBtn) {
    pagoSucursalCloseBtn.addEventListener("click", () => {
      document.getElementById("pagoSucursalModal").style.display = "none"
    })
  }

  if (pagoSucursalCancelBtn) {
    pagoSucursalCancelBtn.addEventListener("click", () => {
      document.getElementById("pagoSucursalModal").style.display = "none"
    })
  }

  if (pagoSucursalForm) {
    pagoSucursalForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      await registrarPagoSucursal()
    })
  }
}

// Configurar eventos para los formularios
function setupFormEvents() {
  // Configurar formulario de empresa
  const empresaForm = document.getElementById("empresaForm")
  if (empresaForm) {
    empresaForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      try {
        const empresaId = document.getElementById("empresaId").value
        const nombre = document.getElementById("empresaNombre").value
        const contacto = document.getElementById("empresaContacto").value
        const telefono = document.getElementById("empresaTelefono").value
        const email = document.getElementById("empresaEmail").value
        const descuento = Number.parseInt(document.getElementById("empresaDescuento").value) || 40
        const limiteCreditoPorMiembro = Number.parseFloat(document.getElementById("empresaLimiteCredito").value) || 3500
        const direccion = document.getElementById("empresaDireccion").value
        const notas = document.getElementById("empresaNotas").value

        // Obtener sucursales
        const sucursales = []
        document.querySelectorAll(".sucursal-nombre").forEach((input) => {
          const nombre = input.value.trim()
          if (nombre) {
            sucursales.push(nombre)
          }
        })

        // Validar campos requeridos
        if (!nombre || !contacto || !telefono) {
          showToast("Por favor, complete los campos requeridos", "warning")
          return
        }

        // Crear objeto de empresa
        const empresaData = {
          nombre,
          contacto,
          telefono,
          email: email || "",
          descuento,
          direccion: direccion || "",
          sucursales,
          notas: notas || "",
          limiteCreditoPorMiembro,
          updatedAt: serverTimestamp(),
        }

        if (!empresaId) {
          // Agregar nueva empresa
          empresaData.createdAt = serverTimestamp()
          await addDoc(collection(db, "empresas"), empresaData)
          showToast("Empresa agregada correctamente", "success")
        } else {
          // Actualizar empresa existente
          await updateDoc(doc(db, "empresas", empresaId), empresaData)
          showToast("Empresa actualizada correctamente", "success")
        }

        // Cerrar modal
        document.getElementById("empresaModal").style.display = "none"

        // Recargar empresas
        await loadEmpresas()
      } catch (error) {
        console.error("Error al guardar empresa:", error)
        showToast("Error al guardar la empresa", "danger")
      }
    })
  }

  // Configurar formulario de miembro
  const miembroForm = document.getElementById("miembroForm")
  if (miembroForm) {
    miembroForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      try {
        const miembroId = document.getElementById("miembroId").value
        const empresaId = document.getElementById("miembroEmpresa").value
        const sucursal = document.getElementById("miembroSucursal").value
        const clienteId = document.getElementById("miembroCliente").value
        const limiteCredito = Number.parseFloat(document.getElementById("miembroLimiteCredito").value) || 3500

        // Asegurar que siempre se asigne un límite de crédito válido
        let finalLimiteCredito = limiteCredito || 0

        // Si el límite es 0 o no se especificó, usar el límite de la empresa
        if (finalLimiteCredito === 0 && empresaId) {
          const empresa = empresas.find((e) => e.id === empresaId)
          if (empresa && empresa.limiteCreditoPorMiembro) {
            finalLimiteCredito = empresa.limiteCreditoPorMiembro
            console.log(`Asignando límite automático de $${finalLimiteCredito} de la empresa ${empresa.nombre}`)
          }
        }

        // Si aún es 0, usar valor por defecto
        if (finalLimiteCredito === 0) {
          finalLimiteCredito = 3500
          console.log("Usando límite por defecto de $3500")
        }

        const referencia = document.getElementById("miembroReferencia").value
        const fechaRegistro = document.getElementById("miembroFechaRegistro").value
        const notas = document.getElementById("miembroNotas").value

        // Validar campos requeridos
        if (!empresaId || !sucursal || !clienteId || !fechaRegistro) {
          showToast("Por favor, complete los campos requeridos", "warning")
          return
        }

        // Verificar si el cliente ya es miembro de esta empresa
        const miembroExistente = miembros.find(
          (m) => m.clienteId === clienteId && m.empresaId === empresaId && m.id !== miembroId,
        )

        if (miembroExistente) {
          showToast("Este cliente ya es miembro de esta empresa", "warning")
          return
        }

        // Crear objeto de miembro
        const miembroData = {
          empresaId,
          sucursal,
          clienteId,
          limiteCredito: finalLimiteCredito,
          referencia: referencia || "",
          fechaRegistro: fechaRegistro ? new Date(fechaRegistro) : new Date(),
          notas: notas || "",
          updatedAt: serverTimestamp(),
        }

        if (!miembroId) {
          // Agregar nuevo miembro
          miembroData.createdAt = serverTimestamp()
          await addDoc(collection(db, "miembrosConvenio"), miembroData)

          // Actualizar cliente para marcarlo como miembro de convenio
          await updateDoc(doc(db, "clientes", clienteId), {
            convenio: true,
            empresaId: empresaId,
            updatedAt: serverTimestamp(),
          })

          showToast("Miembro agregado correctamente", "success")
        } else {
          // Actualizar miembro existente
          await updateDoc(doc(db, "miembrosConvenio", miembroId), miembroData)
          showToast("Miembro actualizado correctamente", "success")
        }

        // Cerrar modal
        document.getElementById("miembroModal").style.display = "none"

        // Recargar datos
        await Promise.all([loadMiembros(), loadClientes(), loadEmpresas()])
      } catch (error) {
        console.error("Error al guardar miembro:", error)
        showToast("Error al guardar el miembro", "danger")
      }
    })
  }

  // Configurar formulario de ajustar crédito
  const ajustarCreditoForm = document.getElementById("ajustarCreditoForm")
  if (ajustarCreditoForm) {
    ajustarCreditoForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      try {
        const miembroId = document.getElementById("ajustarCreditoMiembroId").value
        const nuevoLimite = Number.parseFloat(document.getElementById("ajustarCreditoNuevoLimite").value)
        const motivo = document.getElementById("ajustarCreditoMotivo").value

        // Validar campos requeridos
        if (!miembroId || !nuevoLimite || !motivo) {
          showToast("Por favor, complete todos los campos", "warning")
          return
        }

        if (nuevoLimite < 0) {
          showToast("El límite de crédito no puede ser negativo", "warning")
          return
        }

        // Actualizar miembro
        await updateDoc(doc(db, "miembrosConvenio", miembroId), {
          limiteCredito: nuevoLimite,
          ultimoAjuste: {
            fecha: new Date(),
            limiteAnterior: document.getElementById("ajustarCreditoLimiteActual").textContent.replace("$", ""),
            limiteNuevo: nuevoLimite,
            motivo: motivo,
          },
          updatedAt: serverTimestamp(),
        })

        showToast("Límite de crédito ajustado correctamente", "success")

        // Cerrar modal
        document.getElementById("ajustarCreditoModal").style.display = "none"

        // Recargar datos
        await Promise.all([loadMiembros(), loadEmpresas()])

        // Si estamos en el detalle de empresa, recargar miembros de la empresa
        if (currentEmpresaId) {
          await loadEmpresaMiembros(currentEmpresaId)
        }
      } catch (error) {
        console.error("Error al ajustar límite de crédito:", error)
        showToast("Error al ajustar el límite de crédito", "danger")
      }
    })
  }
}

// Configurar eventos para las búsquedas en tiempo real
function setupSearchEvents() {
  // Búsqueda de empresas en tiempo real
  const searchEmpresa = document.getElementById("searchEmpresa")
  if (searchEmpresa) {
    let searchTimeout = null

    searchEmpresa.addEventListener("input", (e) => {
      // Limpiar timeout anterior
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }

      // Establecer nuevo timeout para evitar muchas búsquedas seguidas
      searchTimeout = setTimeout(() => {
        filtrosEmpresas.busqueda = e.target.value.trim()
        applyEmpresasFilters()
      }, 300) // Esperar 300ms después de que el usuario deje de escribir
    })
  }

  // Búsqueda de miembros en tiempo real
  const searchMiembro = document.getElementById("searchMiembro")
  if (searchMiembro) {
    let searchTimeout = null

    searchMiembro.addEventListener("input", (e) => {
      // Limpiar timeout anterior
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }

      // Establecer nuevo timeout para evitar muchas búsquedas seguidas
      searchTimeout = setTimeout(() => {
        filtrosMiembros.busqueda = e.target.value.trim()
        applyMiembrosFilters()
      }, 300) // Esperar 300ms después de que el usuario deje de escribir
    })
  }
}

// Configurar eventos para los filtros
function setupFilterEvents() {
  // Mostrar/ocultar filtros de miembros
  const toggleMiembroFilters = document.getElementById("toggleMiembroFilters")
  const miembroFiltersContainer = document.getElementById("miembroFiltersContainer")

  if (toggleMiembroFilters && miembroFiltersContainer) {
    toggleMiembroFilters.addEventListener("click", () => {
      miembroFiltersContainer.style.display = miembroFiltersContainer.style.display === "none" ? "block" : "none"
    })
  }

  // Aplicar filtros de miembros
  const applyMiembroFilters = document.getElementById("applyMiembroFilters")
  if (applyMiembroFilters) {
    applyMiembroFilters.addEventListener("click", () => {
      filtrosMiembros.empresa = document.getElementById("filterEmpresa").value
      filtrosMiembros.sucursal = document.getElementById("filterSucursal").value
      filtrosMiembros.estado = document.getElementById("filterEstado").value
      applyMiembrosFilters()
    })
  }

  // Limpiar filtros de miembros
  const resetMiembroFilters = document.getElementById("resetMiembroFilters")
  if (resetMiembroFilters) {
    resetMiembroFilters.addEventListener("click", () => {
      document.getElementById("filterEmpresa").value = ""
      document.getElementById("filterSucursal").value = ""
      document.getElementById("filterEstado").value = ""
      filtrosMiembros = {
        empresa: "",
        sucursal: "",
        estado: "",
        busqueda: "",
      }
      document.getElementById("searchMiembro").value = ""
      applyMiembrosFilters()
    })
  }

  // Actualizar sucursales al cambiar empresa en filtros
  const filterEmpresa = document.getElementById("filterEmpresa")
  const filterSucursal = document.getElementById("filterSucursal")

  if (filterEmpresa && filterSucursal) {
    filterEmpresa.addEventListener("change", () => {
      const empresaId = filterEmpresa.value

      // Limpiar selector de sucursal
      filterSucursal.innerHTML = '<option value="">Todas</option>'

      if (empresaId) {
        // Buscar empresa
        const empresa = empresas.find((e) => e.id === empresaId)
        if (empresa && empresa.sucursales) {
          // Agregar sucursales al selector
          empresa.sucursales.forEach((sucursal) => {
            const option = document.createElement("option")
            option.value = sucursal
            option.textContent = sucursal
            filterSucursal.appendChild(option)
          })
        }
      }
    })
  }
}

// Configurar eventos para la paginación
function setupPaginationEvents() {
  const prevPageBtn = document.getElementById("prevPageBtn")
  const nextPageBtn = document.getElementById("nextPageBtn")

  if (prevPageBtn) {
    prevPageBtn.addEventListener("click", () => {
      // Determinar qué estado de paginación usar según el tab activo
      const paginationState = activeTab === "empresas" ? empresasPaginationState : miembrosPaginationState

      if (paginationState.currentPage > 1) {
        paginationState.currentPage--;

        // Actualizar tabla según el tab activo
        if (activeTab === "empresas") {
          updateEmpresasTable();
        } else {
          updateMiembrosTable();
        }

        updatePaginationControls();
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", () => {
      // Determinar qué estado de paginación usar según el tab activo
      const paginationState = activeTab === "empresas" ? empresasPaginationState : miembrosPaginationState

      if (paginationState.currentPage < paginationState.totalPages) {
        paginationState.currentPage++;

        // Actualizar tabla según el tab activo
        if (activeTab === "empresas") {
          updateEmpresasTable();
        } else {
          updateMiembrosTable();
        }

        updatePaginationControls();
      }
    });
  }
}

// Configurar eventos para las empresas
function setupEmpresaEvents() {
  // Configurar botones para ver empresas
  const viewButtons = document.querySelectorAll(".view-empresa")
  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const empresaId = button.getAttribute("data-id")
      viewEmpresa(empresaId)
    })
  })

  // Configurar botones para editar empresas
  const editButtons = document.querySelectorAll(".edit-empresa")
  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const empresaId = button.getAttribute("data-id")
      editEmpresa(empresaId)
    })
  })

  // Configurar botones para eliminar empresas
  const deleteButtons = document.querySelectorAll(".delete-empresa")
  deleteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const empresaId = button.getAttribute("data-id")
      confirmDeleteEmpresa(empresaId)
    })
  })
}

// Configurar eventos para los miembros
function setupMiembroEvents() {
  // Configurar botones para editar miembros
  const editButtons = document.querySelectorAll(".edit-miembro")
  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const miembroId = button.getAttribute("data-id")
      editMiembro(miembroId)
    })
  })

  // Configurar botones para ajustar crédito
  const adjustButtons = document.querySelectorAll(".adjust-credit")
  adjustButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const miembroId = button.getAttribute("data-id")
      adjustCredit(miembroId)
    })
  })

  // Configurar botones para eliminar miembros
  const deleteButtons = document.querySelectorAll(".delete-miembro")
  deleteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const miembroId = button.getAttribute("data-id")
      confirmDeleteMiembro(miembroId)
    })
  })
}

// Función para ver una empresa
async function viewEmpresa(empresaId) {
  try {
    // Obtener datos de la empresa
    const docRef = doc(db, "empresas", empresaId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const empresa = docSnap.data()
      currentEmpresaId = empresaId

      // Mostrar modal de detalle de empresa
      const modal = document.getElementById("detalleEmpresaModal")
      if (modal) {
        modal.style.display = "block"

        // Llenar información de la empresa
        document.getElementById("detalleEmpresaNombre").textContent = empresa.nombre || "Sin nombre"
        document.getElementById("detalleEmpresaContacto").textContent = empresa.contacto || "No disponible"
        document.getElementById("detalleEmpresaTelefono").textContent = empresa.telefono || "No disponible"
        document.getElementById("detalleEmpresaEmail").textContent = empresa.email || "No disponible"
        document.getElementById("detalleEmpresaDescuento").textContent = `${empresa.descuento || 40}%`
        document.getElementById("detalleEmpresaLimiteCredito").textContent =
          `$${(empresa.limiteCreditoPorMiembro || 3500).toFixed(2)}`
        document.getElementById("detalleEmpresaDireccion").textContent = empresa.direccion || "No disponible"
        document.getElementById("detalleEmpresaNotas").textContent = empresa.notas || "No hay notas disponibles"

        // Mostrar resumen por sucursal mejorado
        await loadResumenSucursalesMejorado(empresaId)

        // Cargar miembros de la empresa
        await loadEmpresaMiembros(empresaId)
      }
    } else {
      console.error("No se encontró la empresa")
      showToast("No se encontró la empresa", "danger")
    }
  } catch (error) {
    console.error("Error al obtener empresa:", error)
    showToast("Error al obtener la empresa", "danger")
  }
}

// Función mejorada para cargar resumen por sucursales
async function loadResumenSucursalesMejorado(empresaId) {
  try {
    const deudaPorSucursal = calcularDeudaEmpresaPorSucursal(empresaId)
    const resumenBody = document.getElementById("detalleResumenSucursalesBody")

    if (!resumenBody) return

    // Limpiar tabla
    resumenBody.innerHTML = ""

    if (Object.keys(deudaPorSucursal).length === 0) {
      resumenBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center">No hay datos de sucursales</td></tr>'
      return
    }

    // Agregar resumen por sucursal con mejoras
    Object.entries(deudaPorSucursal).forEach(([sucursal, datos]) => {
      const pagosRealizados = calcularPagosSucursal(empresaId, sucursal)
      const deudaNeta = Math.max(0, datos.deudaTotal - pagosRealizados)
      const promedio = datos.miembros > 0 ? datos.deudaTotal / datos.miembros : 0
      const estadoCuenta = deudaNeta > 0 ? 'Con Deuda' : 'Sin Deuda'
      const badgeClass = deudaNeta > 0 ? 'badge-warning' : 'badge-success'

      const row = document.createElement("tr")
      row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

      row.innerHTML = `
        <td class="py-3 px-4">
          <div class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <strong>${sucursal}</strong>
          </div>
        </td>
        <td class="py-3 px-4">${datos.miembros}</td>
        <td class="py-3 px-4">$${deudaNeta.toFixed(2)}</td>
        <td class="py-3 px-4">$${promedio.toFixed(2)}</td>
        <td class="py-3 px-4">
          <span class="badge ${badgeClass}">${estadoCuenta}</span>
        </td>
        <td class="py-3 px-4">
          <button onclick="verDetallesSucursal('${empresaId}', '${sucursal}')" class="text-primary hover:text-primary/80 text-sm font-medium">
            Ver detalles
          </button>
        </td>
      `

      resumenBody.appendChild(row)
    })
  } catch (error) {
    console.error("Error al cargar resumen de sucursales:", error)
    const resumenBody = document.getElementById("detalleResumenSucursalesBody")
    if (resumenBody) {
      resumenBody.innerHTML =
        '<tr><td colspan="6" class="py-4 text-center text-red-500">Error al cargar resumen</td></tr>'
    }
  }
}

// Función para cargar miembros de una empresa
async function loadEmpresaMiembros(empresaId) {
  try {
    const miembrosEmpresa = miembros.filter((m) => m.empresaId === empresaId)
    const miembrosBody = document.getElementById("detalleMiembrosBody")

    if (!miembrosBody) return

    // Limpiar tabla
    miembrosBody.innerHTML = ""

    if (miembrosEmpresa.length === 0) {
      miembrosBody.innerHTML = '<tr><td colspan="7" class="py-4 text-center">No hay miembros registrados</td></tr>'
      return
    }

    // Agregar miembros a la tabla
    miembrosEmpresa.forEach((miembro) => {
      // Obtener nombre del cliente
      const cliente = clientes.find((c) => c.id === miembro.clienteId)
      const clienteNombre = cliente ? cliente.nombre : "Cliente no encontrado"

      // Calcular créditos
      const limiteCredito = miembro.limiteCredito || 0
      const creditoUsado = calcularCreditoUsadoMiembro(miembro.clienteId)
      const creditoDisponible = Math.max(0, limiteCredito - creditoUsado)
      const estado = obtenerEstadoMiembro(miembro.id)

      const row = document.createElement("tr")
      row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

      row.innerHTML = `
        <td class="py-2 px-4">
          <span class="badge badge-success">${miembro.sucursal || "-"}</span>
        </td>
        <td class="py-2 px-4">${clienteNombre}</td>
        <td class="py-2 px-4">$${limiteCredito.toFixed(2)}</td>
        <td class="py-2 px-4">$${creditoUsado.toFixed(2)}</td>
        <td class="py-2 px-4">$${creditoDisponible.toFixed(2)}</td>
        <td class="py-2 px-4">
          <span class="status-${estado}">${estado === "activo" ? "Activo" : estado === "limite-excedido" ? "Límite Excedido" : "Inactivo"}</span>
        </td>
        <td class="py-2 px-4">
          <div class="flex space-x-2">
            <button class="edit-detalle-miembro text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" data-id="${miembro.id}" title="Editar">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="adjust-detalle-credit text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${miembro.id}" title="Ajustar crédito">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </button>
            <button class="delete-detalle-miembro text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${miembro.id}" title="Eliminar">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      `

      miembrosBody.appendChild(row)
    })

    // Configurar eventos para los botones
    setupDetalleMiembroEvents()
  } catch (error) {
    console.error("Error al cargar miembros de la empresa:", error)
    const miembrosBody = document.getElementById("detalleMiembrosBody")
    if (miembrosBody) {
      miembrosBody.innerHTML =
        '<tr><td colspan="7" class="py-4 text-center text-red-500">Error al cargar miembros</td></tr>'
    }
  }
}

// Función para editar una empresa
async function editEmpresa(empresaId) {
  try {
    // Obtener datos de la empresa
    const docRef = doc(db, "empresas", empresaId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const empresa = docSnap.data()

      // Mostrar modal de empresa
      const modal = document.getElementById("empresaModal")
      if (modal) {
        modal.style.display = "block"
        modal.style.zIndex = "2000"
        document.getElementById("empresaModalTitle").textContent = "Editar Empresa"
        document.getElementById("empresaForm").reset()
        document.getElementById("empresaId").value = empresaId

        // Llenar información de la empresa
        document.getElementById("empresaNombre").value = empresa.nombre || ""
        document.getElementById("empresaContacto").value = empresa.contacto || ""
        document.getElementById("empresaTelefono").value = empresa.telefono || ""
        document.getElementById("empresaEmail").value = empresa.email || ""
        document.getElementById("empresaDescuento").value = empresa.descuento || 40
        document.getElementById("empresaLimiteCredito").value = empresa.limiteCreditoPorMiembro || 3500
        document.getElementById("empresaDireccion").value = empresa.direccion || ""
        document.getElementById("empresaNotas").value = empresa.notas || ""

        // Mostrar sucursales
        const sucursalesContainer = document.getElementById("sucursalesContainer")
        if (sucursalesContainer) {
          sucursalesContainer.innerHTML = ""

          if (empresa.sucursales && empresa.sucursales.length > 0) {
            empresa.sucursales.forEach((sucursal) => {
              const sucursalItem = document.createElement("div")
              sucursalItem.className = "sucursal-item flex items-center space-x-2"
              sucursalItem.innerHTML = `
                <input type="text" placeholder="Nombre de la sucursal" class="sucursal-nombre flex-grow p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" value="${sucursal}">
                <button type="button" class="remove-sucursal text-red-500 hover:text-red-700">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            `
              sucursalesContainer.appendChild(sucursalItem)

              // Configurar evento para eliminar sucursal
              const removeBtn = sucursalItem.querySelector(".remove-sucursal")
              if (removeBtn) {
                removeBtn.addEventListener("click", function () {
                  this.closest(".sucursal-item").remove()
                })
              }
            })
          } else {
            sucursalesContainer.innerHTML = `
              <div class="sucursal-item flex items-center space-x-2">
                <input type="text" placeholder="Nombre de la sucursal" class="sucursal-nombre flex-grow p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600">
              </div>
            `
          }
        }
      }
    } else {
      console.error("No se encontró la empresa")
      showToast("No se encontró la empresa", "danger")
    }
  } catch (error) {
    console.error("Error al obtener empresa:", error)
    showToast("Error al obtener la empresa", "danger")
  }
}

// Función para eliminar una empresa
async function confirmDeleteEmpresa(empresaId) {
  if (confirm("¿Está seguro de que desea eliminar esta empresa?")) {
    try {
      await deleteDoc(doc(db, "empresas", empresaId))
      showToast("Empresa eliminada correctamente", "success")

      // Recargar empresas
      await loadEmpresas()
    } catch (error) {
      console.error("Error al eliminar empresa:", error)
      showToast("Error al eliminar la empresa", "danger")
    }
  }
}

// Función para editar un miembro
async function editMiembro(miembroId) {
  try {
    // Obtener datos del miembro
    const docRef = doc(db, "miembrosConvenio", miembroId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const miembro = docSnap.data()

      // Mostrar modal de miembro
      const modal = document.getElementById("miembroModal")
      if (modal) {
        modal.style.display = "block"
        modal.style.zIndex = "2000"
        document.getElementById("miembroModalTitle").textContent = "Editar Miembro"
        document.getElementById("miembroForm").reset()
        document.getElementById("miembroId").value = miembroId

        // Evitar eventos automáticos durante la carga
        preventAutoEvents = true

        // Llenar información del miembro
        document.getElementById("miembroEmpresa").value = miembro.empresaId || ""

        // Disparar evento change para cargar sucursales
        const event = new Event("change")
        document.getElementById("miembroEmpresa").dispatchEvent(event)

        // Preseleccionar sucursal
        setTimeout(() => {
          document.getElementById("miembroSucursal").value = miembro.sucursal || ""
          // Restaurar eventos automáticos
          preventAutoEvents = false
        }, 100)

        document.getElementById("miembroCliente").value = miembro.clienteId || ""
        document.getElementById("miembroLimiteCredito").value = miembro.limiteCredito || 3500
        document.getElementById("miembroReferencia").value = miembro.referencia || ""

        // Formatear fecha de registro
        if (miembro.fechaRegistro) {
          const fecha =
            miembro.fechaRegistro instanceof Timestamp
              ? miembro.fechaRegistro.toDate()
              : new Date(miembro.fechaRegistro)
          const year = fecha.getFullYear()
          const month = String(fecha.getMonth() + 1).padStart(2, "0")
          const day = String(fecha.getDate()).padStart(2, "0")
          document.getElementById("miembroFechaRegistro").value = `${year}-${month}-${day}`
        }

        document.getElementById("miembroNotas").value = miembro.notas || ""
      }
    } else {
      console.error("No se encontró el miembro")
      showToast("No se encontró el miembro", "danger")
    }
  } catch (error) {
    console.error("Error al obtener miembro:", error)
    showToast("Error al obtener el miembro", "danger")
  }
}

// Función para ajustar el crédito de un miembro
async function adjustCredit(miembroId) {
  try {
    // Obtener datos del miembro
    const miembro = miembros.find((m) => m.id === miembroId)

    if (!miembro) {
      showToast("No se encontró el miembro", "danger")
      return
    }

    // Obtener información adicional
    const cliente = clientes.find((c) => c.id === miembro.clienteId)
    const empresa = empresas.find((e) => e.id === miembro.empresaId)

    const clienteNombre = cliente ? cliente.nombre : "Cliente no encontrado"
    const empresaNombre = empresa ? empresa.nombre : "Empresa no encontrada"

    const limiteCredito = miembro.limiteCredito || 0
    const creditoUsado = calcularCreditoUsadoMiembro(miembro.clienteId)
    const creditoDisponible = Math.max(0, limiteCredito - creditoUsado)

    // Mostrar modal de ajustar crédito
    const modal = document.getElementById("ajustarCreditoModal")
    if (modal) {
      modal.style.display = "block"
      modal.style.zIndex = "2000"

      // Llenar información del miembro
      document.getElementById("ajustarCreditoMiembroId").value = miembroId
      document.getElementById("ajustarCreditoClienteNombre").textContent = clienteNombre
      document.getElementById("ajustarCreditoEmpresaNombre").textContent = empresaNombre
      document.getElementById("ajustarCreditoSucursalNombre").textContent = miembro.sucursal || "No especificada"
      document.getElementById("ajustarCreditoLimiteActual").textContent = `$${limiteCredito.toFixed(2)}`
      document.getElementById("ajustarCreditoCreditoUsado").textContent = `$${creditoUsado.toFixed(2)}`
      document.getElementById("ajustarCreditoCreditoDisponible").textContent = `$${creditoDisponible.toFixed(2)}`

      // Establecer valor inicial del nuevo límite
      document.getElementById("ajustarCreditoNuevoLimite").value = limiteCredito
      document.getElementById("ajustarCreditoNuevoLimite").min = creditoUsado
      document.getElementById("ajustarCreditoMotivo").value = ""
    }
  } catch (error) {
    console.error("Error al obtener miembro:", error)
    showToast("Error al obtener el miembro", "danger")
  }
}

// Función para eliminar un miembro
async function confirmDeleteMiembro(miembroId) {
  if (confirm("¿Está seguro de que desea eliminar este miembro?")) {
    try {
      // Obtener datos del miembro
      const docRef = doc(db, "miembrosConvenio", miembroId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const miembro = docSnap.data()

        // Eliminar miembro
        await deleteDoc(doc(db, "miembrosConvenio", miembroId))

        // Actualizar cliente para quitarlo como miembro de convenio
        await updateDoc(doc(db, "clientes", miembro.clienteId), {
          convenio: false,
          empresaId: "",
          updatedAt: serverTimestamp(),
        })

        showToast("Miembro eliminado correctamente", "success")

        // Recargar datos
        await Promise.all([loadMiembros(), loadClientes(), loadEmpresas()])

        // Si estamos en el detalle de empresa, recargar miembros de la empresa
        if (currentEmpresaId) {
          await loadEmpresaMiembros(currentEmpresaId)
        }
      } else {
        console.error("No se encontró el miembro")
        showToast("No se encontró el miembro", "danger")
      }
    } catch (error) {
      console.error("Error al eliminar miembro:", error)
      showToast("Error al eliminar el miembro", "danger")
    }
  }
}

// Configurar eventos para los botones del modal de detalle de miembro (CORREGIDO)
function setupDetalleMiembroEvents() {
  // Configurar botones para editar miembros
  const editButtons = document.querySelectorAll(".edit-detalle-miembro")
  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const miembroId = button.getAttribute("data-id")
      editMiembro(miembroId)

      // Cerrar modal de detalle
      //document.getElementById("detalleEmpresaModal").style.display = "none"
    })
  })

  // Configurar botones para ajustar crédito (CORREGIDO)
  const adjustButtons = document.querySelectorAll(".adjust-detalle-credit")
  adjustButtons.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      const miembroId = button.getAttribute("data-id")
      adjustCredit(miembroId)
    })
  })

  // Configurar botones para eliminar miembros
  const deleteButtons = document.querySelectorAll(".delete-detalle-miembro")
  deleteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const miembroId = button.getAttribute("data-id")
      confirmDeleteMiembro(miembroId)
    })
  })
}

// Función para corregir miembros existentes sin límite de crédito
async function corregirMiembrosSinCredito() {
  try {
    console.log("Iniciando corrección de miembros sin límite de crédito...")

    const miembrosRef = collection(db, "miembrosConvenio")
    const q = query(miembrosRef)
    const querySnapshot = await getDocs(q)

    let miembrosCorregidos = 0

    for (const miembroDoc of querySnapshot.docs) {
      const miembro = miembroDoc.data()

      // Si el miembro no tiene límite de crédito o es 0
      if (!miembro.limiteCredito || miembro.limiteCredito === 0) {
        // Obtener la empresa para asignar el límite correcto
        const empresaDoc = await getDoc(doc(db, "empresas", miembro.empresaId))

        if (empresaDoc.exists()) {
          const empresa = empresaDoc.data()
          const limiteCredito = empresa.limiteCreditoPorMiembro || 3500

          // Actualizar el miembro con el límite de crédito correcto
          await updateDoc(doc(db, "miembrosConvenio", miembroDoc.id), {
            limiteCredito: limiteCredito,
            updatedAt: serverTimestamp(),
            corregidoAutomaticamente: true,
            fechaCorreccion: new Date(),
          })

          miembrosCorregidos++
          console.log(`Miembro ${miembroDoc.id} corregido con límite $${limiteCredito}`)
        }
      }
    }

    if (miembrosCorregidos > 0) {
      showToast(`${miembrosCorregidos} miembros corregidos automáticamente`, "success")
      // Recargar datos
      await Promise.all([loadMiembros(), loadEmpresas()])
    } else {
      console.log("No se encontraron miembros que necesiten corrección")
    }
  } catch (error) {
    console.error("Error al corregir miembros:", error)
    showToast("Error al corregir miembros existentes", "danger")
  }
}

// Hacer las funciones disponibles globalmente
window.toggleSucursalesView = toggleSucursalesView
window.verDetallesSucursal = verDetallesSucursal

// Exportar funciones para uso global si es necesario
window.validateConvenioCredit = validateConvenioCredit
window.calcularCreditoUsadoMiembro = calcularCreditoUsadoMiembro
window.calcularCreditoDisponibleMiembro = calcularCreditoDisponibleMiembro