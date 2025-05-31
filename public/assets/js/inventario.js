import { NotificationSystem } from "./notification-system.js"
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
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

import { db } from "./firebase-config.js"
import { CONFIG } from "./config.js"
import { checkAndCreateInventoryCollection } from "./auth-check.js"

// Dominios de email válidos
const VALID_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "zoho.com",
  "yandex.com",
  "mail.com",
  "gmx.com",
  "fastmail.com",
  // Dominios mexicanos
  "uady.mx",
  "itmerida.mx",
  "anahuac.mx",
  "tec.mx",
  "unam.mx",
  "ipn.mx",
  "udg.mx",
  "buap.mx",
  "uanl.mx",
  "uas.mx",
  "uacam.mx",
  // Dominios gubernamentales y empresariales mexicanos
  "gob.mx",
  "imss.gob.mx",
  "issste.gob.mx",
  "cfe.mx",
  "pemex.com",
  "banxico.org.mx",
  "sat.gob.mx",
  "sep.gob.mx",
]

// CORREGIDO: Estados de paginación separados para cada pestaña
const paginationState = {
  productos: {
    currentPage: 1,
    totalPages: 1,
    itemsPerPage: 10
  },
  armazones: {
    currentPage: 1,
    totalPages: 1,
    itemsPerPage: 10
  }
}

// Variables globales para almacenar datos
let categorias = []
let proveedores = []
let marcasArmazones = []
let materialesArmazones = []
let coloresArmazones = []

// Variables para manejar colores y materiales en el formulario
let coloresSeleccionados = []
let materialesSeleccionados = []

// Instancia del sistema de notificaciones
let notificationSystem

// Cache para mejorar rendimiento
let productosCache = []
let armazonesCache = []
let lastProductsUpdate = 0
let lastFramesUpdate = 0
const CACHE_DURATION = 30000 // 30 segundos

// Variables para búsqueda optimizada
let searchTimeoutProducts = null
let searchTimeoutFrames = null
const SEARCH_DELAY = 300 // 300ms de debounce

// Sistema de alertas mejorado para evitar duplicados
const activeAlerts = new Set()
const alertTimeout = null

// Filtros activos optimizados
const filtrosProductos = {
  tipo: "",
  categoria: "",
  proveedor: "",
  precioMin: "",
  precioMax: "",
  busqueda: "",
  stockBajo: false,
}

const filtrosArmazones = {
  marca: "",
  material: "",
  proveedor: "",
  precioMin: "",
  precioMax: "",
  busqueda: "",
  stockBajo: false,
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Página de inventario cargada")

  try {
    // Inicializar el sistema de notificaciones
    notificationSystem = new NotificationSystem()

    await initializeAlertFlags()

    // Verificar y crear colecciones necesarias
    await checkAndCreateInventoryCollection()

    // Cargar categorías y proveedores
    await loadCategorias()
    await loadProveedores()

    // Configurar las pestañas
    setupTabs()

    // Configurar eventos para los modales
    setupModalEvents()

    // Configurar eventos para los formularios
    setupFormEvents()

    // Configurar validación en tiempo real
    setupRealTimeValidation()

    // Configurar eventos para los filtros optimizados
    setupOptimizedFilterEvents()

    // Configurar eventos para las búsquedas optimizadas
    setupOptimizedSearchEvents()

    // Configurar eventos de paginación
    setupPaginationEvents()

    // Cargar datos iniciales de forma secuencial
    console.log("Iniciando carga de datos iniciales...")
    
    // Cargar productos primero (pestaña activa por defecto)
    console.log("Cargando productos...")
    await loadProductosOptimized()
    
    // Cargar armazones en segundo plano
    console.log("Cargando armazones...")
    await loadArmazonesOptimized()

    // Cargar valores únicos para filtros
    await loadUniqueValues()

    // Verificar productos con stock bajo
    checkLowStockItems()

    // Configurar eventos para administrar categorías y proveedores
    setupCategoryAndProviderEvents()

    // Configurar eventos para el botón de notificaciones
    setupNotificationEvents()

    // Configurar actualización automática del cache
    setupCacheRefresh()

    // Configurar selectores de tipos de productos
    updateProductTypeSelector()

    // Crear paneles de filtros
    createProductFilters()
    createFrameFilters()

    console.log("Inicialización completada correctamente")
  } catch (error) {
    console.error("Error al inicializar la página de inventario:", error)
    showToast("Error al cargar la página de inventario", "danger")
  }
})

// ===== CONFIGURACIÓN DE EVENTOS DE PAGINACIÓN CORREGIDA =====
function setupPaginationEvents() {
  const prevBtn = document.getElementById("prevPageBtn")
  const nextBtn = document.getElementById("nextPageBtn")

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      const activeTab = getActiveTab()
      const state = paginationState[activeTab]
      
      if (state.currentPage > 1) {
        state.currentPage--
        refreshCurrentTab()
      }
    })
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const activeTab = getActiveTab()
      const state = paginationState[activeTab]
      
      if (state.currentPage < state.totalPages) {
        state.currentPage++
        refreshCurrentTab()
      }
    })
  }
}

// CORREGIDO: Función para obtener la pestaña activa
function getActiveTab() {
  const productosTab = document.getElementById("productos-tab")
  const armazonesTab = document.getElementById("armazones-tab")
  
  if (productosTab && productosTab.style.display !== "none") {
    return "productos"
  } else if (armazonesTab && armazonesTab.style.display !== "none") {
    return "armazones"
  }
  
  // Por defecto, productos está activo
  return "productos"
}

// Función para refrescar la pestaña actual
function refreshCurrentTab() {
  const activeTab = getActiveTab()
  
  if (activeTab === "productos") {
    displayFilteredProductos()
  } else if (activeTab === "armazones") {
    displayFilteredArmazones()
  }
}

// ===== SISTEMA DE ALERTAS MEJORADO =====

function showToast(message, type = "info") {
  // Evitar alertas duplicadas
  const alertKey = `${message}-${type}`
  if (activeAlerts.has(alertKey)) {
    return
  }

  activeAlerts.add(alertKey)

  const toastContainer = document.getElementById("toastContainer")
  if (!toastContainer) return

  const toast = document.createElement("div")
  toast.className = `toast toast-${type}`
  toast.innerHTML = `
    <div class="flex justify-between items-center">
      <span>${message}</span>
      <button type="button" class="ml-2 text-white">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  `

  toastContainer.appendChild(toast)

  const closeBtn = toast.querySelector("button")
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      removeToast(toast, alertKey)
    })
  }

  setTimeout(() => {
    removeToast(toast, alertKey)
  }, 5000)
}

function removeToast(toast, alertKey) {
  if (toast && toast.parentNode) {
    toast.style.animation = "slideOut 0.3s ease-out forwards"
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast)
      }
      activeAlerts.delete(alertKey)
    }, 300)
  }
}

// ===== VALIDACIÓN EN TIEMPO REAL =====

function setupRealTimeValidation() {
  // Validación para emails
  const emailFields = ["nuevoProveedorEmail", "editProveedorEmail"]

  emailFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      field.addEventListener("input", (e) => validateEmailField(e.target))
      field.addEventListener("blur", (e) => validateEmailField(e.target))
    }
  })

  // Validación para teléfonos
  const phoneFields = ["nuevoProveedorTelefono", "editProveedorTelefono"]

  phoneFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      field.addEventListener("input", (e) => validatePhoneField(e.target))
      field.addEventListener("blur", (e) => validatePhoneField(e.target))
    }
  })

  // Validación para nombres de proveedores
  const providerNameFields = ["nuevoProveedorNombre", "editProveedorNombre"]

  providerNameFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      field.addEventListener(
        "input",
        debounce((e) => validateProviderNameField(e.target), 500),
      )
      field.addEventListener("blur", (e) => validateProviderNameField(e.target))
    }
  })

  // Validación para nombres de categorías
  const categoryNameFields = ["nuevaCategoria", "editCategoriaNombre"]

  categoryNameFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId)
    if (field) {
      field.addEventListener(
        "input",
        debounce((e) => validateCategoryNameField(e.target), 500),
      )
      field.addEventListener("blur", (e) => validateCategoryNameField(e.target))
    }
  })
}

function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

function validateEmailField(field) {
  const email = field.value.trim()
  clearFieldValidation(field)

  if (!email) {
    setFieldNeutral(field)
    return true
  }

  if (!validateEmail(email)) {
    setFieldInvalid(field, "Formato de email inválido")
    return false
  }

  if (!validateDomain(email)) {
    setFieldInvalid(field, "Dominio de email no válido o no reconocido")
    return false
  }

  setFieldValid(field)
  return true
}

function validatePhoneField(field) {
  const phone = field.value.trim()
  clearFieldValidation(field)

  if (!phone) {
    setFieldNeutral(field)
    return true
  }

  if (!validatePhone(phone)) {
    setFieldInvalid(field, "Formato de teléfono inválido. Debe tener entre 10-15 dígitos")
    return false
  }

  setFieldValid(field)
  return true
}

async function validateProviderNameField(field) {
  const name = field.value.trim()
  clearFieldValidation(field)

  if (!name) {
    setFieldInvalid(field, "El nombre del proveedor es requerido")
    return false
  }

  if (name.length < 2) {
    setFieldInvalid(field, "El nombre debe tener al menos 2 caracteres")
    return false
  }

  if (name.length > 100) {
    setFieldInvalid(field, "El nombre no puede exceder 100 caracteres")
    return false
  }

  // Verificar duplicados solo si el campo no está en modo edición o es diferente al original
  const isEditing = field.id === "editProveedorNombre"
  const excludeId = isEditing ? document.getElementById("editProveedorId")?.value : null

  try {
    const isDuplicate = await verificarProveedorDuplicado(name, excludeId)
    if (isDuplicate) {
      setFieldInvalid(field, "Ya existe un proveedor con este nombre")
      return false
    }
  } catch (error) {
    console.error("Error al verificar proveedor duplicado:", error)
  }

  setFieldValid(field)
  return true
}

async function validateCategoryNameField(field) {
  const name = field.value.trim()
  clearFieldValidation(field)

  if (!name) {
    setFieldInvalid(field, "El nombre de la categoría es requerido")
    return false
  }

  if (name.length < 2) {
    setFieldInvalid(field, "El nombre debe tener al menos 2 caracteres")
    return false
  }

  if (name.length > 50) {
    setFieldInvalid(field, "El nombre no puede exceder 50 caracteres")
    return false
  }

  // Verificar duplicados solo si el campo no está en modo edición o es diferente al original
  const isEditing = field.id === "editCategoriaNombre"
  const excludeId = isEditing ? document.getElementById("editCategoriaId")?.value : null

  try {
    const isDuplicate = await verificarCategoriaDuplicada(name, excludeId)
    if (isDuplicate) {
      setFieldInvalid(field, "Ya existe una categoría con este nombre")
      return false
    }
  } catch (error) {
    console.error("Error al verificar categoría duplicada:", error)
  }

  setFieldValid(field)
  return true
}

function setFieldValid(field) {
  field.classList.remove("border-red-500", "bg-red-50", "border-gray-300")
  field.classList.add("border-green-500", "bg-green-50")
}

function setFieldInvalid(field, message) {
  field.classList.remove("border-green-500", "bg-green-50", "border-gray-300")
  field.classList.add("border-red-500", "bg-red-50")
  showFieldError(field.id, message)
}

function setFieldNeutral(field) {
  field.classList.remove("border-red-500", "bg-red-50", "border-green-500", "bg-green-50")
  field.classList.add("border-gray-300")
}

function clearFieldValidation(field) {
  field.classList.remove("border-red-500", "bg-red-50", "border-green-500", "bg-green-50")
  field.classList.add("border-gray-300")
  clearFieldError(field.id)
}

function showFieldError(fieldId, message) {
  clearFieldError(fieldId)

  const field = document.getElementById(fieldId)
  if (!field) return

  const errorDiv = document.createElement("div")
  errorDiv.className = "field-error text-red-500 text-xs mt-1"
  errorDiv.textContent = message
  errorDiv.id = `error-${fieldId}`

  field.parentNode.appendChild(errorDiv)
}

function clearFieldError(fieldId) {
  const existingError = document.getElementById(`error-${fieldId}`)
  if (existingError) {
    existingError.remove()
  }
}

function clearFieldErrors() {
  document.querySelectorAll(".field-error").forEach((error) => error.remove())
  document.querySelectorAll(".border-red-500, .border-green-500").forEach((field) => {
    field.classList.remove("border-red-500", "bg-red-50", "border-green-500", "bg-green-50")
    field.classList.add("border-gray-300")
  })
}

// ===== FUNCIONES DE VALIDACIÓN MEJORADAS =====

function validateEmail(email) {
  if (!email) return true // Email es opcional

  // Regex más estricto para validar email
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  return emailRegex.test(email)
}

function validatePhone(phone) {
  if (!phone) return true // Teléfono es opcional

  // Limpiar el teléfono de espacios, guiones y paréntesis
  const cleanPhone = phone.replace(/[\s\-()]/g, "")

  // Validar que tenga entre 10 y 15 dígitos
  const phoneRegex = /^[+]?[\d]{10,15}$/
  return phoneRegex.test(cleanPhone)
}

// CORREGIDO: Validación estricta de dominios usando la lista proporcionada
function validateDomain(email) {
  if (!email) return true // Email es opcional

  const domain = email.split("@")[1]
  if (!domain) return false

  // Verificar solo contra la lista de dominios válidos
  const domainLower = domain.toLowerCase()
  return VALID_EMAIL_DOMAINS.includes(domainLower)
}

// ===== FUNCIONES PARA CÓDIGOS ÚNICOS =====

// Función mejorada para generar código de armazón
async function generarCodigoArmazon() {
  try {
    console.log("Generando código para armazón...")

    // Buscar todos los códigos existentes de armazones
    const armazonesSnapshot = await getDocs(collection(db, "armazones"))
    const codigosExistentes = new Set()

    armazonesSnapshot.forEach((doc) => {
      const codigo = doc.data().codigo
      if (codigo) {
        codigosExistentes.add(codigo)
      }
    })

    // También verificar en productos por si hay conflictos
    const productosSnapshot = await getDocs(collection(db, "productos"))
    productosSnapshot.forEach((doc) => {
      const codigo = doc.data().codigo
      if (codigo) {
        codigosExistentes.add(codigo)
      }
    })

    const prefijo = "ARM"
    let secuencia = 1
    let codigoGenerado = ""

    // Buscar la siguiente secuencia disponible
    do {
      codigoGenerado = `${prefijo}${secuencia.toString().padStart(3, "0")}`
      secuencia++
    } while (codigosExistentes.has(codigoGenerado))

    console.log("Código generado para armazón:", codigoGenerado)
    return codigoGenerado
  } catch (error) {
    console.error("Error al generar código para armazón:", error)

    // Fallback: generar código con timestamp
    const timestamp = Date.now().toString().slice(-6)
    const codigoFallback = `ARM${timestamp}`

    console.log("Usando código fallback:", codigoFallback)
    return codigoFallback
  }
}

// Función mejorada para generar código automático basado en categoría
async function generarCodigoProducto(categoriaId) {
  try {
    const categoriaDoc = await getDoc(doc(db, "categorias", categoriaId))
    if (!categoriaDoc.exists()) {
      throw new Error("Categoría no encontrada")
    }

    const categoria = categoriaDoc.data()
    let prefijo = ""

    // Mapeo mejorado de categorías a prefijos
    const categoriaPrefijos = {
      armazones: "ARM",
      "lentes de contacto": "CONT",
      "lentes solares": "SOL",
      "lentes oftálmicos": "OFT",
      "lentes fotocromáticos": "FOTO",
      accesorios: "ACC",
      limpieza: "LIMP",
      general: "GEN",
    }

    const nombreCategoria = categoria.nombre.toLowerCase()
    prefijo = categoriaPrefijos[nombreCategoria] || categoria.nombre.substring(0, 4).toUpperCase()

    // Buscar todos los códigos existentes
    const productosSnapshot = await getDocs(collection(db, "productos"))
    const armazonesSnapshot = await getDocs(collection(db, "armazones"))
    const codigosExistentes = new Set()

    productosSnapshot.forEach((doc) => {
      const codigo = doc.data().codigo
      if (codigo) {
        codigosExistentes.add(codigo)
      }
    })

    armazonesSnapshot.forEach((doc) => {
      const codigo = doc.data().codigo
      if (codigo) {
        codigosExistentes.add(codigo)
      }
    })

    let secuencia = 1
    let codigoGenerado = ""

    // Buscar la siguiente secuencia disponible
    do {
      codigoGenerado = `${prefijo}${secuencia.toString().padStart(3, "0")}`
      secuencia++
    } while (codigosExistentes.has(codigoGenerado))

    return codigoGenerado
  } catch (error) {
    console.error("Error al generar código:", error)

    // Fallback con timestamp
    const timestamp = Date.now().toString().slice(-6)
    return `PROD${timestamp}`
  }
}

// Función mejorada para verificar categorías duplicadas
async function verificarCategoriaDuplicada(nombre, categoriaIdExcluir = null) {
  try {
    const nombreNormalizado = nombre.trim().toLowerCase()

    // Buscar categorías con nombre similar
    const categoriasSnapshot = await getDocs(collection(db, "categorias"))

    for (const docSnapshot of categoriasSnapshot.docs) {
      const categoria = docSnapshot.data()
      const nombreExistente = categoria.nombre.trim().toLowerCase()

      // Si es la misma categoría que estamos editando, saltarla
      if (categoriaIdExcluir && docSnapshot.id === categoriaIdExcluir) {
        continue
      }

      if (nombreExistente === nombreNormalizado) {
        return true // Duplicada
      }
    }

    return false // No duplicada
  } catch (error) {
    console.error("Error al verificar categoría duplicada:", error)
    return false
  }
}

// Función mejorada para verificar proveedores duplicados
async function verificarProveedorDuplicado(nombre, proveedorIdExcluir = null) {
  try {
    const nombreNormalizado = nombre.trim().toLowerCase()

    const proveedoresSnapshot = await getDocs(collection(db, "proveedores"))

    for (const docSnapshot of proveedoresSnapshot.docs) {
      const proveedor = docSnapshot.data()
      const nombreExistente = proveedor.nombre.trim().toLowerCase()

      // Si es el mismo proveedor que estamos editando, saltarla
      if (proveedorIdExcluir && docSnapshot.id === proveedorIdExcluir) {
        continue
      }

      if (nombreExistente === nombreNormalizado) {
        return true // Duplicado
      }
    }

    return false // No duplicado
  } catch (error) {
    console.error("Error al verificar proveedor duplicado:", error)
    return false
  }
}

// ===== FUNCIONES DE CONFIGURACIÓN =====

// Función para configurar actualización automática del cache
function setupCacheRefresh() {
  setInterval(async () => {
    const now = Date.now()

    // Actualizar cache de productos si es necesario
    if (now - lastProductsUpdate > CACHE_DURATION) {
      await refreshProductsCache()
    }

    // Actualizar cache de armazones si es necesario
    if (now - lastFramesUpdate > CACHE_DURATION) {
      await refreshFramesCache()
    }
  }, CACHE_DURATION)
}

// Función para refrescar cache de productos
async function refreshProductsCache() {
  try {
    console.log("Actualizando cache de productos...")
    const productosSnapshot = await getDocs(collection(db, "productos"))
    const tempProductos = []

    productosSnapshot.forEach((doc) => {
      if (doc.id !== "placeholder" && !doc.data().isPlaceholder) {
        tempProductos.push({
          id: doc.id,
          ...doc.data(),
        })
      }
    })

    // CORREGIDO: Actualizar cache de forma síncrona
    productosCache = tempProductos
    lastProductsUpdate = Date.now()
    
    console.log("Cache de productos actualizado:", productosCache.length, "productos cargados")
    return productosCache.length // Retornar el número de productos cargados
  } catch (error) {
    console.error("Error al actualizar cache de productos:", error)
    throw error
  }
}

// Función para refrescar cache de armazones
async function refreshFramesCache() {
  try {
    console.log("Actualizando cache de armazones...")
    const armazonesSnapshot = await getDocs(collection(db, "armazones"))
    const tempArmazones = []

    armazonesSnapshot.forEach((doc) => {
      if (doc.id !== "placeholder" && !doc.data().isPlaceholder) {
        tempArmazones.push({
          id: doc.id,
          ...doc.data(),
        })
      }
    })

    // CORREGIDO: Actualizar cache de forma síncrona
    armazonesCache = tempArmazones
    lastFramesUpdate = Date.now()
    
    console.log("Cache de armazones actualizado:", armazonesCache.length, "armazones cargados")
    return armazonesCache.length // Retornar el número de armazones cargados
  } catch (error) {
    console.error("Error al actualizar cache de armazones:", error)
    throw error
  }
}

// Función para configurar eventos de notificaciones
function setupNotificationEvents() {
  const notificationBell = document.getElementById("notificationBell")
  const notificationDropdown = document.getElementById("notificationDropdown")

  if (notificationBell && notificationDropdown) {
    notificationBell.addEventListener("click", () => {
      if (notificationDropdown.style.display === "block") {
        notificationDropdown.style.display = "none"
      } else {
        notificationDropdown.style.display = "block"
        if (notificationSystem) {
          notificationSystem.updateNotificationList()
        }
      }
    })

    document.addEventListener("click", (e) => {
      if (!notificationBell.contains(e.target) && !notificationDropdown.contains(e.target)) {
        notificationDropdown.style.display = "none"
      }
    })
  }
}

// Función para cargar valores únicos para los filtros
function updateProductTypeSelector() {
  const productoTipoSelect = document.getElementById("productoTipo")
  const filterProductoTipoSelect = document.getElementById("filterProductoTipo")

  const tiposProductos = [
    { value: "producto", label: "Producto General" },
    { value: "lentes_contacto", label: "Lentes de Contacto" },
    { value: "lentes_solares", label: "Lentes Solares" },
    { value: "lentes_fotocromaticos", label: "Lentes Fotocromáticos" },
    { value: "lentes_oftalmicos", label: "Lentes Oftálmicos" },
    { value: "armazon", label: "Armazón" },
    { value: "accesorio", label: "Accesorio" },
  ]

  if (productoTipoSelect) {
    productoTipoSelect.innerHTML = '<option value="">Seleccione un tipo</option>'
    tiposProductos.forEach((tipo) => {
      const option = document.createElement("option")
      option.value = tipo.value
      option.textContent = tipo.label
      productoTipoSelect.appendChild(option)
    })
  }

  if (filterProductoTipoSelect) {
    filterProductoTipoSelect.innerHTML = '<option value="">Todos</option>'
    tiposProductos.forEach((tipo) => {
      const option = document.createElement("option")
      option.value = tipo.value
      option.textContent = tipo.label
      filterProductoTipoSelect.appendChild(option)
    })
  }
}

// CORREGIDO: Función para configurar las pestañas con estado de paginación separado
function setupTabs() {
  const tabProductos = document.getElementById("tabProductos")
  const tabArmazones = document.getElementById("tabArmazones")
  const spanProductos = document.getElementById("spanProductos")
  const spanArmazones = document.getElementById("spanArmazones")
  const productosTab = document.getElementById("productos-tab")
  const armazonesTab = document.getElementById("armazones-tab")

  tabProductos.addEventListener("click", () => {
    tabProductos.classList.add("active")
    tabArmazones.classList.remove("active")
    spanProductos.classList.remove("opacity-0")
    spanProductos.classList.add("opacity-100")
    spanArmazones.classList.remove("opacity-100")
    spanArmazones.classList.add("opacity-0")
    productosTab.style.display = "block"
    armazonesTab.style.display = "none"
    refreshCurrentTab()
    updatePaginationControls()
  })

  tabArmazones.addEventListener("click", () => {
    tabArmazones.classList.add("active")
    tabProductos.classList.remove("active")
    spanArmazones.classList.remove("opacity-0")
    spanArmazones.classList.add("opacity-100")
    spanProductos.classList.remove("opacity-100")
    spanProductos.classList.add("opacity-0")
    productosTab.style.display = "none"
    armazonesTab.style.display = "block"
    refreshCurrentTab()
    updatePaginationControls()
  })

  // Estado inicial
  tabProductos.classList.add("active")
  tabArmazones.classList.remove("active")
  spanProductos.classList.remove("opacity-0")
  spanProductos.classList.add("opacity-100")
  spanArmazones.classList.remove("opacity-100")
  spanArmazones.classList.add("opacity-0")
  productosTab.style.display = "block"
  armazonesTab.style.display = "none"
}

// Función para cargar categorías
async function loadCategorias() {
  try {
    const categoriasSnapshot = await getDocs(collection(db, "categorias"))
    categorias = []

    categoriasSnapshot.forEach((doc) => {
      categorias.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    updateCategoriaSelectors()
    console.log("Categorías cargadas:", categorias.length)
  } catch (error) {
    console.error("Error al cargar categorías:", error)
    showToast("Error al cargar categorías", "danger")
  }
}

// Función para actualizar selectores de categorías
function updateCategoriaSelectors() {
  const productoCategoriaSelect = document.getElementById("productoCategoria")
  const filterProductoCategoriaSelect = document.getElementById("filterProductoCategoria")

  if (productoCategoriaSelect) {
    productoCategoriaSelect.innerHTML = '<option value="">Seleccione una categoría</option>'
    categorias.forEach((categoria) => {
      const option = document.createElement("option")
      option.value = categoria.id
      option.textContent = categoria.nombre
      productoCategoriaSelect.appendChild(option)
    })
  }

  if (filterProductoCategoriaSelect) {
    filterProductoCategoriaSelect.innerHTML = '<option value="">Todas</option>'
    categorias.forEach((categoria) => {
      const option = document.createElement("option")
      option.value = categoria.id
      option.textContent = categoria.nombre
      filterProductoCategoriaSelect.appendChild(option)
    })
  }
}

// Función para cargar proveedores
async function loadProveedores() {
  try {
    const proveedoresSnapshot = await getDocs(collection(db, "proveedores"))
    proveedores = []

    proveedoresSnapshot.forEach((doc) => {
      proveedores.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    updateProveedorSelectors()
    console.log("Proveedores cargados:", proveedores.length)
  } catch (error) {
    console.error("Error al cargar proveedores:", error)
    showToast("Error al cargar proveedores", "danger")
  }
}

// Función para actualizar selectores de proveedores
function updateProveedorSelectors() {
  const productoProveedorSelect = document.getElementById("productoProveedor")
  const armazonProveedorSelect = document.getElementById("armazonProveedor")
  const filterProductoProveedorSelect = document.getElementById("filterProductoProveedor")
  const filterArmazonProveedorSelect = document.getElementById("filterArmazonProveedor")

  const selectors = [
    { element: productoProveedorSelect, placeholder: "Seleccione un proveedor" },
    { element: armazonProveedorSelect, placeholder: "Seleccione un proveedor" },
    { element: filterProductoProveedorSelect, placeholder: "Todos" },
    { element: filterArmazonProveedorSelect, placeholder: "Todos" },
  ]

  selectors.forEach(({ element, placeholder }) => {
    if (element) {
      element.innerHTML = `<option value="">${placeholder}</option>`
      proveedores.forEach((proveedor) => {
        const option = document.createElement("option")
        option.value = proveedor.id
        option.textContent = proveedor.nombre
        element.appendChild(option)
      })
    }
  })
}

// ===== CONFIGURACIÓN DE EVENTOS PARA MODALES =====

// Configurar eventos para los modales
function setupModalEvents() {
  const addProductBtn = document.getElementById("addProductBtn")
  if (addProductBtn) {
    addProductBtn.addEventListener("click", () => {
      const modal = document.getElementById("productoModal")
      if (modal) {
        modal.style.display = "block"
        document.getElementById("productoModalTitle").textContent = "Agregar Producto"
        document.getElementById("productoForm").reset()
        document.getElementById("productoId").value = ""

        document.getElementById("productoStockMinimo").value = CONFIG.STOCK_MINIMO_PRODUCTO
        document.getElementById("productoStockCritico").value = CONFIG.STOCK_CRITICO_PRODUCTO

        const errorMessage = document.getElementById("error-message")
        if (errorMessage) {
          errorMessage.classList.add("hidden")
          errorMessage.textContent = ""
        }
      }
    })
  }

  const addArmazonBtn = document.getElementById("addArmazonBtn")
  if (addArmazonBtn) {
    addArmazonBtn.addEventListener("click", async () => {
      const modal = document.getElementById("armazonModal")
      if (modal) {
        modal.style.display = "block"
        document.getElementById("armazonModalTitle").textContent = "Agregar Armazón"
        document.getElementById("armazonForm").reset()
        document.getElementById("armazonId").value = ""

        document.getElementById("armazonStockMinimo").value = CONFIG.STOCK_MINIMO_ARMAZON
        document.getElementById("armazonStockCritico").value = CONFIG.STOCK_CRITICO_ARMAZON

        // Generar código automáticamente al abrir el modal
        try {
          const codigo = await generarCodigoArmazon()
          document.getElementById("armazonCodigo").value = codigo
        } catch (error) {
          console.error("Error al generar código automático:", error)
        }

        coloresSeleccionados = []
        materialesSeleccionados = []
        actualizarColoresUI()
        actualizarMaterialesUI()

        const errorMessage = document.getElementById("armazon-error-message")
        if (errorMessage) {
          errorMessage.classList.add("hidden")
          errorMessage.textContent = ""
        }
      }
    })
  }

  const closeButtons = document.querySelectorAll(".close, .close-modal")
  closeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".modal").forEach((modal) => {
        modal.style.display = "none"
      })
      clearFieldErrors()
    })
  })

  window.addEventListener("click", (event) => {
    document.querySelectorAll(".modal").forEach((modal) => {
      if (event.target === modal) {
        modal.style.display = "none"
        clearFieldErrors()
      }
    })
  })

  const addColorBtn = document.getElementById("addColorBtn")
  if (addColorBtn) {
    addColorBtn.addEventListener("click", () => {
      const nuevoColor = document.getElementById("nuevoColor").value.trim()
      if (nuevoColor) {
        if (!coloresSeleccionados.includes(nuevoColor)) {
          coloresSeleccionados.push(nuevoColor)
          actualizarColoresUI()
        }
        document.getElementById("nuevoColor").value = ""
      }
    })
  }

  const addMaterialBtn = document.getElementById("addMaterialBtn")
  if (addMaterialBtn) {
    addMaterialBtn.addEventListener("click", () => {
      const nuevoMaterial = document.getElementById("nuevoMaterial").value.trim()
      if (nuevoMaterial) {
        if (!materialesSeleccionados.includes(nuevoMaterial)) {
          materialesSeleccionados.push(nuevoMaterial)
          actualizarMaterialesUI()
        }
        document.getElementById("nuevoMaterial").value = ""
      }
    })
  }

  const confirmModal = document.getElementById("confirmModal")
  const confirmCancel = document.getElementById("confirmCancel")

  if (confirmCancel) {
    confirmCancel.addEventListener("click", () => {
      if (confirmModal) {
        confirmModal.style.display = "none"
      }
    })
  }

  const outOfStockModal = document.getElementById("outOfStockModal")
  const keepProduct = document.getElementById("keepProduct")

  if (keepProduct) {
    keepProduct.addEventListener("click", () => {
      if (outOfStockModal) {
        outOfStockModal.style.display = "none"
      }
    })
  }
}

// ===== CONFIGURACIÓN DE EVENTOS PARA FORMULARIOS =====

// Configurar eventos para los formularios
function setupFormEvents() {
  const productoForm = document.getElementById("productoForm")
  if (productoForm) {
    productoForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      try {
        const productoId = document.getElementById("productoId").value
        const codigo = document.getElementById("productoCodigo").value.trim()
        const nombre = document.getElementById("productoNombre").value.trim()
        const descripcion = document.getElementById("productoDescripcion").value.trim()
        const tipo = document.getElementById("productoTipo").value
        const categoriaId = document.getElementById("productoCategoria").value
        const proveedorId = document.getElementById("productoProveedor").value
        const precioCompra = Number.parseFloat(document.getElementById("productoPrecioCompra").value)
        const precioVenta = Number.parseFloat(document.getElementById("productoPrecioVenta").value)
        const stock = Number.parseInt(document.getElementById("productoStock").value)
        const stockMinimo = Number.parseInt(document.getElementById("productoStockMinimo").value)
        const stockCritico = Number.parseInt(document.getElementById("productoStockCritico").value)

        // Validaciones
        if (!codigo || !nombre || !tipo || !categoriaId || isNaN(precioCompra) || isNaN(precioVenta) || isNaN(stock)) {
          const errorMessage = document.getElementById("error-message")
          errorMessage.textContent = "Por favor, complete todos los campos requeridos."
          errorMessage.classList.remove("hidden")
          return
        }

        // Verificar código único
        if (!productoId) {
          const codigoQuery = query(collection(db, "productos"), where("codigo", "==", codigo))
          const codigoSnapshot = await getDocs(codigoQuery)

          const codigoArmazonQuery = query(collection(db, "armazones"), where("codigo", "==", codigo))
          const codigoArmazonSnapshot = await getDocs(codigoArmazonQuery)

          if (!codigoSnapshot.empty || !codigoArmazonSnapshot.empty) {
            const errorMessage = document.getElementById("error-message")
            errorMessage.textContent = "Ya existe un producto o armazón con este código."
            errorMessage.classList.remove("hidden")
            return
          }
        }

        const productoData = {
          codigo,
          nombre,
          descripcion,
          tipo,
          categoriaId,
          proveedorId: proveedorId || null,
          precioCompra,
          precioVenta,
          stock,
          stockMinimo: stockMinimo || CONFIG.STOCK_MINIMO_PRODUCTO,
          stockCritico: stockCritico || CONFIG.STOCK_CRITICO_PRODUCTO,
          updatedAt: serverTimestamp(),
        }

        if (!productoId) {
          productoData.createdAt = serverTimestamp()
          await addDoc(collection(db, "productos"), productoData)
          showToast("Producto agregado correctamente", "success")
        } else {
          await updateDoc(doc(db, "productos", productoId), productoData)
          showToast("Producto actualizado correctamente", "success")
        }

        document.getElementById("productoModal").style.display = "none"
        clearFieldErrors()
        await refreshProductsCache()
        await loadProductosOptimized()
        checkLowStockItems()
      } catch (error) {
        console.error("Error al guardar producto:", error)
        const errorMessage = document.getElementById("error-message")
        errorMessage.textContent = "Error al guardar el producto. Inténtelo de nuevo."
        errorMessage.classList.remove("hidden")
        showToast("Error al guardar el producto", "danger")
      }
    })
  }

  const armazonForm = document.getElementById("armazonForm")
  if (armazonForm) {
    armazonForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      try {
        const armazonId = document.getElementById("armazonId").value
        const codigo = document.getElementById("armazonCodigo").value.trim()
        const nombre = document.getElementById("armazonNombre").value.trim()
        const marca = document.getElementById("armazonMarca").value.trim()
        const modelo = document.getElementById("armazonModelo").value.trim()
        const proveedorId = document.getElementById("armazonProveedor").value
        const precioCompra = Number.parseFloat(document.getElementById("armazonPrecioCompra").value)
        const precioVenta = Number.parseFloat(document.getElementById("armazonPrecioVenta").value)
        const stock = Number.parseInt(document.getElementById("armazonStock").value)
        const stockMinimo = Number.parseInt(document.getElementById("armazonStockMinimo").value)
        const stockCritico = Number.parseInt(document.getElementById("armazonStockCritico").value)

        // Validaciones
        if (!codigo || !nombre || !marca || !modelo || isNaN(precioCompra) || isNaN(precioVenta) || isNaN(stock)) {
          const errorMessage = document.getElementById("armazon-error-message")
          errorMessage.textContent = "Por favor, complete todos los campos requeridos."
          errorMessage.classList.remove("hidden")
          return
        }

        // Verificar código único
        if (!armazonId) {
          const codigoQuery = query(collection(db, "armazones"), where("codigo", "==", codigo))
          const codigoSnapshot = await getDocs(codigoQuery)

          const codigoProductoQuery = query(collection(db, "productos"), where("codigo", "==", codigo))
          const codigoProductoSnapshot = await getDocs(codigoProductoQuery)

          if (!codigoSnapshot.empty || !codigoProductoSnapshot.empty) {
            const errorMessage = document.getElementById("armazon-error-message")
            errorMessage.textContent = "Ya existe un armazón o producto con este código."
            errorMessage.classList.remove("hidden")
            return
          }
        }

        const armazonData = {
          codigo,
          nombre,
          marca,
          modelo,
          colores: coloresSeleccionados,
          materiales: materialesSeleccionados,
          proveedorId: proveedorId || null,
          precioCompra,
          precioVenta,
          stock,
          stockMinimo: stockMinimo || CONFIG.STOCK_MINIMO_ARMAZON,
          stockCritico: stockCritico || CONFIG.STOCK_CRITICO_ARMAZON,
          updatedAt: serverTimestamp(),
        }

        if (!armazonId) {
          armazonData.createdAt = serverTimestamp()
          await addDoc(collection(db, "armazones"), armazonData)
          showToast("Armazón agregado correctamente", "success")
        } else {
          await updateDoc(doc(db, "armazones", armazonId), armazonData)
          showToast("Armazón actualizado correctamente", "success")
        }

        document.getElementById("armazonModal").style.display = "none"
        clearFieldErrors()
        await refreshFramesCache()
        await loadArmazonesOptimized()
        await loadUniqueValues()
        checkLowStockItems()
      } catch (error) {
        console.error("Error al guardar armazón:", error)
        const errorMessage = document.getElementById("armazon-error-message")
        errorMessage.textContent = "Error al guardar el armazón. Inténtelo de nuevo."
        errorMessage.classList.remove("hidden")
        showToast("Error al guardar el armazón", "danger")
      }
    })
  }
}

// ===== CONFIGURACIÓN DE EVENTOS PARA CATEGORÍAS Y PROVEEDORES =====

// Configurar eventos mejorados para categorías y proveedores
function setupCategoryAndProviderEvents() {
  const manageCategoriesBtn = document.getElementById("manageCategoriesBtn")
  if (manageCategoriesBtn) {
    manageCategoriesBtn.addEventListener("click", () => {
      const modal = document.getElementById("categoriasModal")
      if (modal) {
        modal.style.display = "block"
        loadCategoriasToModal()
      }
    })
  }

  const manageProvidersBtn = document.getElementById("manageProvidersBtn")
  if (manageProvidersBtn) {
    manageProvidersBtn.addEventListener("click", () => {
      const modal = document.getElementById("proveedoresModal")
      if (modal) {
        modal.style.display = "block"
        loadProveedoresToModal()
      }
    })
  }

  // CORREGIR: Configurar botón para agregar proveedor desde armazones
  const addProviderBtn2 = document.getElementById("addProviderBtn2")
  if (addProviderBtn2) {
    addProviderBtn2.addEventListener("click", () => {
      const modal = document.getElementById("proveedoresModal")
      if (modal) {
        modal.style.display = "block"
        loadProveedoresToModal()
      }
    })
  }

  // CORREGIDO: Configurar formulario de agregar categoría con validación mejorada
  const addCategoriaForm = document.getElementById("addCategoriaForm")
  if (addCategoriaForm) {
    addCategoriaForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      const nombre = document.getElementById("nuevaCategoria").value.trim()
      clearFieldErrors()

      // Validaciones básicas
      if (!nombre) {
        showFieldError("nuevaCategoria", "El nombre de la categoría es requerido")
        return
      }

      if (nombre.length < 2) {
        showFieldError("nuevaCategoria", "El nombre debe tener al menos 2 caracteres")
        return
      }

      if (nombre.length > 50) {
        showFieldError("nuevaCategoria", "El nombre no puede exceder 50 caracteres")
        return
      }

      try {
        // Verificar si ya existe
        const esDuplicada = await verificarCategoriaDuplicada(nombre)

        if (esDuplicada) {
          showFieldError("nuevaCategoria", "Ya existe una categoría con este nombre")
          return
        }

        const categoriaData = {
          nombre: nombre,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }

        await addDoc(collection(db, "categorias"), categoriaData)
        showToast("Categoría agregada correctamente", "success")

        // Limpiar formulario
        document.getElementById("nuevaCategoria").value = ""
        clearFieldErrors()

        // CORREGIDO: Recargar datos y actualizar modal inmediatamente
        await loadCategorias()
        await loadCategoriasToModal() // Recargar el modal para mostrar la nueva categoría
      } catch (error) {
        console.error("Error al agregar categoría:", error)
        showToast("Error al agregar la categoría", "danger")
      }
    })
  }

  // Configurar formulario de agregar proveedor con validación mejorada
  const addProveedorForm = document.getElementById("addProveedorForm")
  if (addProveedorForm) {
    addProveedorForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      const nombre = document.getElementById("nuevoProveedorNombre").value.trim()
      const contacto = document.getElementById("nuevoProveedorContacto").value.trim()
      const telefono = document.getElementById("nuevoProveedorTelefono").value.trim()
      const email = document.getElementById("nuevoProveedorEmail").value.trim()

      clearFieldErrors()
      let hasErrors = false

      // Validar nombre (requerido)
      if (!nombre) {
        showFieldError("nuevoProveedorNombre", "El nombre del proveedor es requerido")
        hasErrors = true
      } else if (nombre.length < 2) {
        showFieldError("nuevoProveedorNombre", "El nombre debe tener al menos 2 caracteres")
        hasErrors = true
      } else if (nombre.length > 100) {
        showFieldError("nuevoProveedorNombre", "El nombre no puede exceder 100 caracteres")
        hasErrors = true
      }

      // Validar teléfono (opcional pero si se proporciona debe ser válido)
      if (telefono && !validatePhone(telefono)) {
        showFieldError("nuevoProveedorTelefono", "Formato de teléfono inválido. Debe tener entre 10-15 dígitos")
        hasErrors = true
      }

      // Validar email (opcional pero si se proporciona debe ser válido)
      if (email && !validateEmail(email)) {
        showFieldError("nuevoProveedorEmail", "Formato de email inválido")
        hasErrors = true
      }

      // Validar dominio del email
      if (email && !validateDomain(email)) {
        showFieldError("nuevoProveedorEmail", "Dominio de email no válido o no reconocido")
        hasErrors = true
      }

      if (hasErrors) {
        return
      }

      try {
        // Verificar si ya existe un proveedor con el mismo nombre
        const esDuplicado = await verificarProveedorDuplicado(nombre)

        if (esDuplicado) {
          showFieldError("nuevoProveedorNombre", "Ya existe un proveedor con este nombre")
          return
        }

        const proveedorData = {
          nombre: nombre,
          contacto: contacto || "",
          telefono: telefono || "",
          email: email || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }

        await addDoc(collection(db, "proveedores"), proveedorData)
        showToast("Proveedor agregado correctamente", "success")

        // Limpiar formulario
        document.getElementById("nuevoProveedorNombre").value = ""
        document.getElementById("nuevoProveedorContacto").value = ""
        document.getElementById("nuevoProveedorTelefono").value = ""
        document.getElementById("nuevoProveedorEmail").value = ""
        clearFieldErrors()

        // Recargar datos
        await loadProveedores()
        await loadProveedoresToModal()
      } catch (error) {
        console.error("Error al agregar proveedor:", error)
        showToast("Error al agregar el proveedor", "danger")
      }
    })
  }

  // Configurar generación automática de código de producto
  const productoCategoriaSelect = document.getElementById("productoCategoria")
  if (productoCategoriaSelect) {
    productoCategoriaSelect.addEventListener("change", async (e) => {
      const categoriaId = e.target.value
      const codigoInput = document.getElementById("productoCodigo")

      if (categoriaId && codigoInput && !codigoInput.value.trim()) {
        try {
          const codigo = await generarCodigoProducto(categoriaId)
          codigoInput.value = codigo
          showToast("Código generado automáticamente", "info")
        } catch (error) {
          console.error("Error al generar código automático:", error)
        }
      }
    })
  }

  const generateProductCodeBtn = document.getElementById("generateProductCodeBtn")
  if (generateProductCodeBtn) {
    generateProductCodeBtn.addEventListener("click", async () => {
      const categoriaId = document.getElementById("productoCategoria").value
      if (!categoriaId) {
        showToast("Seleccione una categoría para generar el código", "warning")
        return
      }

      try {
        const codigo = await generarCodigoProducto(categoriaId)
        document.getElementById("productoCodigo").value = codigo
        showToast("Código generado correctamente", "success")
      } catch (error) {
        console.error("Error al generar código:", error)
        showToast("Error al generar código automático", "danger")
      }
    })
  }

  // CORREGIR: Configurar generación de código de armazón
  const generateFrameCodeBtn = document.getElementById("generateFrameCodeBtn")
  if (generateFrameCodeBtn) {
    generateFrameCodeBtn.addEventListener("click", async () => {
      try {
        console.log("Botón de generar código de armazón presionado")

        const codigo = await generarCodigoArmazon()
        document.getElementById("armazonCodigo").value = codigo
        showToast("Código de armazón generado correctamente", "success")
      } catch (error) {
        console.error("Error al generar código para armazón:", error)
        showToast("Error al generar código de armazón", "danger")
      }
    })
  }

  // Configurar formulario de editar categoría
  const editCategoriaForm = document.getElementById("editCategoriaForm")
  if (editCategoriaForm) {
    editCategoriaForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      const categoriaId = document.getElementById("editCategoriaId").value
      const nombre = document.getElementById("editCategoriaNombre").value.trim()

      clearFieldErrors()

      if (!nombre) {
        showFieldError("editCategoriaNombre", "El nombre de la categoría es requerido")
        return
      }

      if (nombre.length < 2) {
        showFieldError("editCategoriaNombre", "El nombre debe tener al menos 2 caracteres")
        return
      }

      try {
        // Verificar duplicados excluyendo la categoría actual
        const esDuplicada = await verificarCategoriaDuplicada(nombre, categoriaId)

        if (esDuplicada) {
          showFieldError("editCategoriaNombre", "Ya existe una categoría con este nombre")
          return
        }

        await updateDoc(doc(db, "categorias", categoriaId), {
          nombre: nombre,
          updatedAt: serverTimestamp(),
        })

        showToast("Categoría actualizada correctamente", "success")
        document.getElementById("editCategoriaModal").style.display = "none"
        clearFieldErrors()

        await loadCategorias()
        await loadCategoriasToModal()
      } catch (error) {
        console.error("Error al actualizar categoría:", error)
        showToast("Error al actualizar la categoría", "danger")
      }
    })
  }

  // Configurar formulario de editar proveedor
  const editProveedorForm = document.getElementById("editProveedorForm")
  if (editProveedorForm) {
    editProveedorForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      const proveedorId = document.getElementById("editProveedorId").value
      const nombre = document.getElementById("editProveedorNombre").value.trim()
      const contacto = document.getElementById("editProveedorContacto").value.trim()
      const telefono = document.getElementById("editProveedorTelefono").value.trim()
      const email = document.getElementById("editProveedorEmail").value.trim()

      clearFieldErrors()
      let hasErrors = false

      if (!nombre) {
        showFieldError("editProveedorNombre", "El nombre del proveedor es requerido")
        hasErrors = true
      } else if (nombre.length < 2) {
        showFieldError("editProveedorNombre", "El nombre debe tener al menos 2 caracteres")
        hasErrors = true
      }

      if (telefono && !validatePhone(telefono)) {
        showFieldError("editProveedorTelefono", "Formato de teléfono inválido")
        hasErrors = true
      }

      if (email && !validateEmail(email)) {
        showFieldError("editProveedorEmail", "Formato de email inválido")
        hasErrors = true
      }

      if (email && !validateDomain(email)) {
        showFieldError("editProveedorEmail", "Dominio de email no válido")
        hasErrors = true
      }

      if (hasErrors) return

      try {
        // Verificar duplicados excluyendo el proveedor actual
        const esDuplicado = await verificarProveedorDuplicado(nombre, proveedorId)

        if (esDuplicado) {
          showFieldError("editProveedorNombre", "Ya existe un proveedor con este nombre")
          return
        }

        await updateDoc(doc(db, "proveedores", proveedorId), {
          nombre: nombre,
          contacto: contacto,
          telefono: telefono,
          email: email,
          updatedAt: serverTimestamp(),
        })

        showToast("Proveedor actualizado correctamente", "success")
        document.getElementById("editProveedorModal").style.display = "none"
        clearFieldErrors()

        await loadProveedores()
        await loadProveedoresToModal()
      } catch (error) {
        console.error("Error al actualizar proveedor:", error)
        showToast("Error al actualizar el proveedor", "danger")
      }
    })
  }
}

// ===== FUNCIONES DE BÚSQUEDA Y FILTROS =====

// Función para configurar eventos de búsqueda optimizados
function setupOptimizedSearchEvents() {
  const searchProductoInput = document.getElementById("searchProducto")
  const searchArmazonInput = document.getElementById("searchArmazon")

  if (searchProductoInput) {
    searchProductoInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeoutProducts)

      searchTimeoutProducts = setTimeout(() => {
        filtrosProductos.busqueda = e.target.value.trim().toLowerCase()
        paginationState.productos.currentPage = 1 // CORREGIDO: Usar estado específico
        displayFilteredProductos()
      }, SEARCH_DELAY)
    })

    // Búsqueda instantánea al presionar Enter
    searchProductoInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        clearTimeout(searchTimeoutProducts)
        filtrosProductos.busqueda = e.target.value.trim().toLowerCase()
        paginationState.productos.currentPage = 1 // CORREGIDO: Usar estado específico
        displayFilteredProductos()
      }
    })
  }

  if (searchArmazonInput) {
    searchArmazonInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeoutFrames)

      searchTimeoutFrames = setTimeout(() => {
        filtrosArmazones.busqueda = e.target.value.trim().toLowerCase()
        paginationState.armazones.currentPage = 1 // CORREGIDO: Usar estado específico
        displayFilteredArmazones()
      }, SEARCH_DELAY)
    })

    // Búsqueda instantánea al presionar Enter
    searchArmazonInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        clearTimeout(searchTimeoutFrames)
        filtrosArmazones.busqueda = e.target.value.trim().toLowerCase()
        paginationState.armazones.currentPage = 1 // CORREGIDO: Usar estado específico
        displayFilteredArmazones()
      }
    })
  }
}

// Función para configurar eventos de filtros optimizados
function setupOptimizedFilterEvents() {
  // Configurar botones de toggle para filtros de productos
  const toggleFiltrosProductosBtn = document.getElementById("toggleFiltrosProductosBtn")
  const filtrosProductosPanel = document.getElementById("filtrosProductosPanel")

  if (toggleFiltrosProductosBtn && filtrosProductosPanel) {
    toggleFiltrosProductosBtn.addEventListener("click", () => {
      const isVisible = filtrosProductosPanel.style.display !== "none"
      filtrosProductosPanel.style.display = isVisible ? "none" : "block"
      toggleFiltrosProductosBtn.classList.toggle("active", !isVisible)
    })
  }

  // Configurar botones de toggle para filtros de armazones
  const toggleFiltrosArmazonesBtn = document.getElementById("toggleFiltrosArmazonesBtn")
  const filtrosArmazonesPanel = document.getElementById("filtrosArmazonesPanel")

  if (toggleFiltrosArmazonesBtn && filtrosArmazonesPanel) {
    toggleFiltrosArmazonesBtn.addEventListener("click", () => {
      const isVisible = filtrosArmazonesPanel.style.display !== "none"
      filtrosArmazonesPanel.style.display = isVisible ? "none" : "block"
      toggleFiltrosArmazonesBtn.classList.toggle("active", !isVisible)
    })
  }

  // Configurar eventos para filtros de productos
  const productFilters = [
    { id: "filterProductoTipo", property: "tipo" },
    { id: "filterProductoCategoria", property: "categoria" },
    { id: "filterProductoProveedor", property: "proveedor" },
    { id: "filterProductoPrecioMin", property: "precioMin" },
    { id: "filterProductoPrecioMax", property: "precioMax" },
    { id: "filterProductoStockBajo", property: "stockBajo" },
  ]

  productFilters.forEach(({ id, property }) => {
    const element = document.getElementById(id)
    if (element) {
      element.addEventListener("change", () => {
        if (property === "stockBajo") {
          filtrosProductos[property] =
            element.value === "bajo" || element.value === "critico" || element.value === "agotado"
        } else {
          filtrosProductos[property] = element.value
        }
        paginationState.productos.currentPage = 1 // CORREGIDO: Usar estado específico
        displayFilteredProductos()
      })
    }
  })

  // Configurar eventos para filtros de armazones
  const frameFilters = [
    { id: "filterArmazonMarca", property: "marca" },
    { id: "filterArmazonMaterial", property: "material" },
    { id: "filterArmazonProveedor", property: "proveedor" },
    { id: "filterArmazonPrecioMin", property: "precioMin" },
    { id: "filterArmazonPrecioMax", property: "precioMax" },
    { id: "filterArmazonStockBajo", property: "stockBajo" },
  ]

  frameFilters.forEach(({ id, property }) => {
    const element = document.getElementById(id)
    if (element) {
      element.addEventListener("change", () => {
        if (property === "stockBajo") {
          filtrosArmazones[property] =
            element.value === "bajo" || element.value === "critico" || element.value === "agotado"
        } else {
          filtrosArmazones[property] = element.value
        }
        paginationState.armazones.currentPage = 1 // CORREGIDO: Usar estado específico
        displayFilteredArmazones()
      })
    }
  })

  // Configurar botones de limpiar filtros
  const limpiarFiltrosProductosBtn = document.getElementById("limpiarFiltrosProductosBtn")
  if (limpiarFiltrosProductosBtn) {
    limpiarFiltrosProductosBtn.addEventListener("click", () => {
      clearProductFilters()
    })
  }

  const limpiarFiltrosArmazonesBtn = document.getElementById("limpiarFiltrosArmazonesBtn")
  if (limpiarFiltrosArmazonesBtn) {
    limpiarFiltrosArmazonesBtn.addEventListener("click", () => {
      clearFrameFilters()
    })
  }

  // Configurar botones de aplicar filtros
  const aplicarFiltrosProductosBtn = document.getElementById("aplicarFiltrosProductosBtn")
  if (aplicarFiltrosProductosBtn) {
    aplicarFiltrosProductosBtn.addEventListener("click", () => {
      displayFilteredProductos()
    })
  }

  const aplicarFiltrosArmazonesBtn = document.getElementById("aplicarFiltrosArmazonesBtn")
  if (aplicarFiltrosArmazonesBtn) {
    aplicarFiltrosArmazonesBtn.addEventListener("click", () => {
      displayFilteredArmazones()
    })
  }
}

// ===== FUNCIONES DE CREACIÓN DE FILTROS =====

// Función para crear filtros de productos
function createProductFilters() {
  const productosTab = document.getElementById("productos-tab")
  if (!productosTab) return

  let filtrosPanel = productosTab.querySelector("#filtrosProductosPanel")
  if (filtrosPanel) return // Ya existe

  // Buscar el panel de filtros existente o crear uno nuevo
  const existingPanel = productosTab.querySelector(".filter-container")
  if (existingPanel) {
    filtrosPanel = existingPanel
    filtrosPanel.id = "filtrosProductosPanel"
  } else {
    filtrosPanel = document.createElement("div")
    filtrosPanel.id = "filtrosProductosPanel"
    filtrosPanel.className = "filter-container bg-white dark:bg-gray-800 rounded-lg shadow-card p-4 mb-6"
    filtrosPanel.style.display = "none"

    const actionsBar = productosTab.querySelector(".actions")
    if (actionsBar) {
      actionsBar.insertAdjacentElement("afterend", filtrosPanel)
    }
  }

  // Actualizar selectores
  updateProductTypeSelector()
  updateCategoriaSelectors()
  updateProveedorSelectors()
}

// Función para crear filtros de armazones
function createFrameFilters() {
  const armazonesTab = document.getElementById("armazones-tab")
  if (!armazonesTab) return

  let filtrosPanel = armazonesTab.querySelector("#filtrosArmazonesPanel")
  if (filtrosPanel) return // Ya existe

  // Buscar el panel de filtros existente o crear uno nuevo
  const existingPanel = armazonesTab.querySelector(".filter-container")
  if (existingPanel) {
    filtrosPanel = existingPanel
    filtrosPanel.id = "filtrosArmazonesPanel"
  } else {
    filtrosPanel = document.createElement("div")
    filtrosPanel.id = "filtrosArmazonesPanel"
    filtrosPanel.className = "filter-container bg-white dark:bg-gray-800 rounded-lg shadow-card p-4 mb-6"
    filtrosPanel.style.display = "none"

    const actionsBar = armazonesTab.querySelector(".actions")
    if (actionsBar) {
      actionsBar.insertAdjacentElement("afterend", filtrosPanel)
    }
  }
}

// CORREGIDO: Función para limpiar filtros de productos con estado específico
function clearProductFilters() {
  // Resetear objeto de filtros
  Object.keys(filtrosProductos).forEach((key) => {
    if (key === "stockBajo") {
      filtrosProductos[key] = false
    } else {
      filtrosProductos[key] = ""
    }
  })

  // Resetear elementos del DOM
  const filterElements = [
    "filterProductoTipo",
    "filterProductoCategoria",
    "filterProductoProveedor",
    "filterProductoPrecioMin",
    "filterProductoPrecioMax",
  ]

  filterElements.forEach((id) => {
    const element = document.getElementById(id)
    if (element) {
      element.value = ""
    }
  })

  const stockBajoCheckbox = document.getElementById("filterProductoStockBajo")
  if (stockBajoCheckbox) {
    stockBajoCheckbox.value = ""
  }

  const searchInput = document.getElementById("searchProducto")
  if (searchInput) {
    searchInput.value = ""
  }

  // CORREGIDO: Resetear página usando estado específico
  paginationState.productos.currentPage = 1
  displayFilteredProductos()
}

// CORREGIDO: Función para limpiar filtros de armazones con estado específico
function clearFrameFilters() {
  // Resetear objeto de filtros
  Object.keys(filtrosArmazones).forEach((key) => {
    if (key === "stockBajo") {
      filtrosArmazones[key] = false
    } else {
      filtrosArmazones[key] = ""
    }
  })

  // Resetear elementos del DOM
  const filterElements = [
    "filterArmazonMarca",
    "filterArmazonMaterial",
    "filterArmazonProveedor",
    "filterArmazonPrecioMin",
    "filterArmazonPrecioMax",
  ]

  filterElements.forEach((id) => {
    const element = document.getElementById(id)
    if (element) {
      element.value = ""
    }
  })

  const stockBajoCheckbox = document.getElementById("filterArmazonStockBajo")
  if (stockBajoCheckbox) {
    stockBajoCheckbox.value = ""
  }

  const searchInput = document.getElementById("searchArmazon")
  if (searchInput) {
    searchInput.value = ""
  }

  // CORREGIDO: Resetear página usando estado específico
  paginationState.armazones.currentPage = 1
  displayFilteredArmazones()
}

// ===== FUNCIONES DE CARGA DE DATOS =====

// Función optimizada para cargar productos
async function loadProductosOptimized() {
  const tableBody = document.getElementById("productosTableBody")
  if (!tableBody) return

  try {
    // Mostrar indicador de carga
    tableBody.innerHTML =
      '<tr><td colspan="8" class="py-8 text-center"><div class="flex flex-col items-center space-y-3"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div><p class="text-gray-600 dark:text-gray-400">Cargando productos...</p></div></td></tr>'

    // Limpiar cache y forzar carga completa
    productosCache = []
    lastProductsUpdate = 0
    
    console.log("Iniciando carga de productos desde Firestore...")
    
    // Cargar directamente desde Firestore sin usar cache
    const productosSnapshot = await getDocs(collection(db, "productos"))
    const tempProductos = []

    productosSnapshot.forEach((doc) => {
      if (doc.id !== "placeholder" && !doc.data().isPlaceholder) {
        tempProductos.push({
          id: doc.id,
          ...doc.data(),
        })
      }
    })

    // Asegurar que el cache esté completamente poblado antes de continuar
    productosCache = tempProductos
    lastProductsUpdate = Date.now()
    
    console.log("Productos cargados en cache:", productosCache.length)
    
    // Solo mostrar después de que el cache esté 100% listo
    if (productosCache.length > 0) {
      // Pequeña pausa para asegurar que todo esté sincronizado
      await new Promise(resolve => setTimeout(resolve, 50))
      displayFilteredProductos()
    } else {
      // Si no hay productos, mostrar mensaje apropiado
      tableBody.innerHTML =
        '<tr><td colspan="8" class="py-8 text-center text-gray-500 dark:text-gray-400">No hay productos registrados</td></tr>'
      
      paginationState.productos.totalPages = 1
      paginationState.productos.currentPage = 1
      updatePaginationControls()
      updateResultsCounter("productos", 0, 0)
    }
    
    console.log("Carga de productos completada exitosamente")
  } catch (error) {
    console.error("Error al cargar productos:", error)
    tableBody.innerHTML =
      '<tr><td colspan="8" class="py-4 text-center text-red-500">Error al cargar productos</td></tr>'
    showToast("Error al cargar productos", "danger")
  }
}

// Función optimizada para cargar armazones
async function loadArmazonesOptimized() {
  const tableBody = document.getElementById("armazonesTableBody")
  if (!tableBody) return

  try {
    // Mostrar indicador de carga
    tableBody.innerHTML =
      '<tr><td colspan="10" class="py-8 text-center"><div class="flex flex-col items-center space-y-3"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div><p class="text-gray-600 dark:text-gray-400">Cargando armazones...</p></div></td></tr>'

    // Limpiar cache y forzar carga completa
    armazonesCache = []
    lastFramesUpdate = 0
    
    console.log("Iniciando carga de armazones desde Firestore...")
    
    // Cargar directamente desde Firestore sin usar cache
    const armazonesSnapshot = await getDocs(collection(db, "armazones"))
    const tempArmazones = []

    armazonesSnapshot.forEach((doc) => {
      if (doc.id !== "placeholder" && !doc.data().isPlaceholder) {
        tempArmazones.push({
          id: doc.id,
          ...doc.data(),
        })
      }
    })

    // Asegurar que el cache esté completamente poblado antes de continuar
    armazonesCache = tempArmazones
    lastFramesUpdate = Date.now()
    
    console.log("Armazones cargados en cache:", armazonesCache.length)
    
    // Solo mostrar después de que el cache esté 100% listo
    if (armazonesCache.length > 0) {
      // Pequeña pausa para asegurar que todo esté sincronizado
      await new Promise(resolve => setTimeout(resolve, 50))
      displayFilteredArmazones()
    } else {
      // Si no hay armazones, mostrar mensaje apropiado
      tableBody.innerHTML =
        '<tr><td colspan="10" class="py-8 text-center text-gray-500 dark:text-gray-400">No hay armazones registrados</td></tr>'
      
      paginationState.armazones.totalPages = 1
      paginationState.armazones.currentPage = 1
      updatePaginationControls()
      updateResultsCounter("armazones", 0, 0)
    }
    
    console.log("Carga de armazones completada exitosamente")
  } catch (error) {
    console.error("Error al cargar armazones:", error)
    tableBody.innerHTML =
      '<tr><td colspan="10" class="py-4 text-center text-red-500">Error al cargar armazones</td></tr>'
    showToast("Error al cargar armazones", "danger")
  }
}

// ===== FUNCIONES DE VISUALIZACIÓN DE DATOS CON FILTROS CORREGIDOS =====

// Función para aplicar filtros a productos
function applyProductFilters(productos) {
  return productos.filter((producto) => {
    // Filtro por tipo
    if (filtrosProductos.tipo && producto.tipo !== filtrosProductos.tipo) {
      return false
    }

    // Filtro por categoría
    if (filtrosProductos.categoria && producto.categoriaId !== filtrosProductos.categoria) {
      return false
    }

    // Filtro por proveedor
    if (filtrosProductos.proveedor && producto.proveedorId !== filtrosProductos.proveedor) {
      return false
    }

    // Filtro por precio mínimo
    if (filtrosProductos.precioMin && producto.precioVenta < parseFloat(filtrosProductos.precioMin)) {
      return false
    }

    // Filtro por precio máximo
    if (filtrosProductos.precioMax && producto.precioVenta > parseFloat(filtrosProductos.precioMax)) {
      return false
    }

    // Filtro por búsqueda
    if (filtrosProductos.busqueda) {
      const searchTerm = filtrosProductos.busqueda.toLowerCase()
      const searchableText = [
        producto.codigo,
        producto.nombre,
        producto.descripcion,
        producto.tipo,
      ].join(" ").toLowerCase()
      
      if (!searchableText.includes(searchTerm)) {
        return false
      }
    }

    // Filtro por stock bajo
    if (filtrosProductos.stockBajo) {
      const stockMinimo = producto.stockMinimo || CONFIG.STOCK_MINIMO_PRODUCTO
      const stockCritico = producto.stockCritico || CONFIG.STOCK_CRITICO_PRODUCTO
      
      const filterValue = document.getElementById("filterProductoStockBajo")?.value
      
      if (filterValue === "bajo" && producto.stock > stockMinimo) {
        return false
      }
      if (filterValue === "critico" && (producto.stock > stockCritico || producto.stock === 0)) {
        return false
      }
      if (filterValue === "agotado" && producto.stock > 0) {
        return false
      }
      if (filterValue === "normal" && producto.stock <= stockMinimo) {
        return false
      }
    }

    return true
  })
}

// Función para aplicar filtros a armazones
function applyFrameFilters(armazones) {
  return armazones.filter((armazon) => {
    // Filtro por marca
    if (filtrosArmazones.marca && armazon.marca !== filtrosArmazones.marca) {
      return false
    }

    // Filtro por material
    if (filtrosArmazones.material) {
      if (!armazon.materiales || !armazon.materiales.includes(filtrosArmazones.material)) {
        return false
      }
    }

    // Filtro por proveedor
    if (filtrosArmazones.proveedor && armazon.proveedorId !== filtrosArmazones.proveedor) {
      return false
    }

    // Filtro por precio mínimo
    if (filtrosArmazones.precioMin && armazon.precioVenta < parseFloat(filtrosArmazones.precioMin)) {
      return false
    }

    // Filtro por precio máximo
    if (filtrosArmazones.precioMax && armazon.precioVenta > parseFloat(filtrosArmazones.precioMax)) {
      return false
    }

    // Filtro por búsqueda
    if (filtrosArmazones.busqueda) {
      const searchTerm = filtrosArmazones.busqueda.toLowerCase()
      const searchableText = [
        armazon.codigo,
        armazon.nombre,
        armazon.marca,
        armazon.modelo,
        ...(armazon.colores || []),
        ...(armazon.materiales || []),
      ].join(" ").toLowerCase()
      
      if (!searchableText.includes(searchTerm)) {
        return false
      }
    }

    // Filtro por stock bajo
    if (filtrosArmazones.stockBajo) {
      const stockMinimo = armazon.stockMinimo || CONFIG.STOCK_MINIMO_ARMAZON
      const stockCritico = armazon.stockCritico || CONFIG.STOCK_CRITICO_ARMAZON
      
      const filterValue = document.getElementById("filterArmazonStockBajo")?.value
      
      if (filterValue === "bajo" && armazon.stock > stockMinimo) {
        return false
      }
      if (filterValue === "critico" && (armazon.stock > stockCritico || armazon.stock === 0)) {
        return false
      }
      if (filterValue === "agotado" && armazon.stock > 0) {
        return false
      }
      if (filterValue === "normal" && armazon.stock <= stockMinimo) {
        return false
      }
    }

    return true
  })
}

// CORREGIDO: Función para mostrar productos filtrados con estado de paginación específico
function displayFilteredProductos() {
  const tableBody = document.getElementById("productosTableBody")
  if (!tableBody) return

  console.log("Iniciando displayFilteredProductos con", productosCache.length, "productos en cache")

  // Verificar que el cache tenga datos antes de proceder
  if (productosCache.length === 0) {
    console.log("Cache de productos vacío, mostrando mensaje")
    tableBody.innerHTML =
      '<tr><td colspan="8" class="py-8 text-center text-gray-500 dark:text-gray-400">No hay productos registrados</td></tr>'
    
    paginationState.productos.totalPages = 1
    paginationState.productos.currentPage = 1
    updatePaginationControls()
    updateResultsCounter("productos", 0, 0)
    return
  }

  // Aplicar filtros
  const filteredProducts = applyProductFilters(productosCache)
  console.log("Productos después de filtros:", filteredProducts.length)

  // CORREGIDO: Calcular paginación usando estado específico
  const state = paginationState.productos
  state.totalPages = Math.max(1, Math.ceil(filteredProducts.length / state.itemsPerPage))
  console.log("Total de páginas calculadas:", state.totalPages)
  
  // Asegurar que currentPage esté en rango válido
  if (state.currentPage > state.totalPages) {
    state.currentPage = state.totalPages
  }
  if (state.currentPage < 1) {
    state.currentPage = 1
  }

  const startIdx = (state.currentPage - 1) * state.itemsPerPage
  const endIdx = startIdx + state.itemsPerPage
  const pageProducts = filteredProducts.slice(startIdx, endIdx)

  console.log(`Mostrando productos ${startIdx + 1} a ${Math.min(endIdx, filteredProducts.length)} de ${filteredProducts.length}`)

  // Mostrar resultados
  if (filteredProducts.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="8" class="py-8 text-center text-gray-500 dark:text-gray-400">No se encontraron productos que coincidan con los filtros</td></tr>'
  } else {
    // Crear filas de la tabla
    const fragment = document.createDocumentFragment()
    pageProducts.forEach((producto) => {
      const row = createProductRow(producto)
      fragment.appendChild(row)
    })

    tableBody.innerHTML = ""
    tableBody.appendChild(fragment)
    setupProductoEvents()
  }

  // Actualizar controles DESPUÉS de procesar los datos
  updateResultsCounter("productos", filteredProducts.length, productosCache.length)
  updatePaginationControls()
  
  console.log("displayFilteredProductos completado exitosamente")
}

// CORREGIDO: Función para mostrar armazones filtrados con estado de paginación específico
function displayFilteredArmazones() {
  const tableBody = document.getElementById("armazonesTableBody")
  if (!tableBody) return

  console.log("Iniciando displayFilteredArmazones con", armazonesCache.length, "armazones en cache")

  // Verificar que el cache tenga datos antes de proceder
  if (armazonesCache.length === 0) {
    console.log("Cache de armazones vacío, mostrando mensaje")
    tableBody.innerHTML =
      '<tr><td colspan="10" class="py-8 text-center text-gray-500 dark:text-gray-400">No hay armazones registrados</td></tr>'
    
    paginationState.armazones.totalPages = 1
    paginationState.armazones.currentPage = 1
    updatePaginationControls()
    updateResultsCounter("armazones", 0, 0)
    return
  }

  // Aplicar filtros
  const filteredFrames = applyFrameFilters(armazonesCache)
  console.log("Armazones después de filtros:", filteredFrames.length)

  // CORREGIDO: Calcular paginación usando estado específico
  const state = paginationState.armazones
  state.totalPages = Math.max(1, Math.ceil(filteredFrames.length / state.itemsPerPage))
  console.log("Total de páginas calculadas:", state.totalPages)
  
  // Asegurar que currentPage esté en rango válido
  if (state.currentPage > state.totalPages) {
    state.currentPage = state.totalPages
  }
  if (state.currentPage < 1) {
    state.currentPage = 1
  }

  const startIdx = (state.currentPage - 1) * state.itemsPerPage
  const endIdx = startIdx + state.itemsPerPage
  const pageFrames = filteredFrames.slice(startIdx, endIdx)

  console.log(`Mostrando armazones ${startIdx + 1} a ${Math.min(endIdx, filteredFrames.length)} de ${filteredFrames.length}`)

  // Mostrar resultados
  if (filteredFrames.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="10" class="py-8 text-center text-gray-500 dark:text-gray-400">No se encontraron armazones que coincidan con los filtros</td></tr>'
  } else {
    // Crear filas de la tabla
    const fragment = document.createDocumentFragment()
    pageFrames.forEach((armazon) => {
      const row = createFrameRow(armazon)
      fragment.appendChild(row)
    })

    tableBody.innerHTML = ""
    tableBody.appendChild(fragment)
    setupArmazonEvents()
  }

  // Actualizar controles DESPUÉS de procesar los datos
  updateResultsCounter("armazones", filteredFrames.length, armazonesCache.length)
  updatePaginationControls()
  
  console.log("displayFilteredArmazones completado exitosamente")
}

// CORREGIDO: Función para la paginación con estado específico
function updatePaginationControls() {
  const prevBtn = document.getElementById("prevPageBtn")
  const nextBtn = document.getElementById("nextPageBtn")
  const currentPageSpan = document.getElementById("currentPage")
  const totalPagesSpan = document.getElementById("totalPages")

  // CORREGIDO: Obtener estado de la pestaña activa
  const activeTab = getActiveTab()
  const state = paginationState[activeTab]

  // Verificar que los elementos existan antes de actualizarlos
  if (prevBtn) {
    prevBtn.disabled = state.currentPage <= 1
    prevBtn.style.opacity = state.currentPage <= 1 ? "0.5" : "1"
    prevBtn.style.cursor = state.currentPage <= 1 ? "not-allowed" : "pointer"
  }
  
  if (nextBtn) {
    nextBtn.disabled = state.currentPage >= state.totalPages
    nextBtn.style.opacity = state.currentPage >= state.totalPages ? "0.5" : "1"
    nextBtn.style.cursor = state.currentPage >= state.totalPages ? "not-allowed" : "pointer"
  }
  
  if (currentPageSpan) {
    currentPageSpan.textContent = state.currentPage
  }
  
  if (totalPagesSpan) {
    totalPagesSpan.textContent = state.totalPages
  }

  // Log detallado para debugging
  console.log(`Paginación actualizada (${activeTab}): Página ${state.currentPage} de ${state.totalPages} (${state.itemsPerPage} items por página)`)
}

// ===== FUNCIONES DE CREACIÓN DE FILAS =====

// Función para crear fila de producto
function createProductRow(producto) {
  const row = document.createElement("tr")
  row.className = "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"

  // Determinar clase de stock
  const stockClass = getStockClass(
    producto.stock,
    producto.stockMinimo || CONFIG.STOCK_MINIMO_PRODUCTO,
    producto.stockCritico || CONFIG.STOCK_CRITICO_PRODUCTO,
  )

  row.innerHTML = `
    <td class="py-3 px-4 font-mono text-sm">${producto.codigo || ""}</td>
    <td class="py-3 px-4 font-medium">${producto.nombre || ""}</td>
    <td class="py-3 px-4">
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        ${producto.tipo || ""}
      </span>
    </td>
    <td class="py-3 px-4">${categorias.find((cat) => cat.id === producto.categoriaId)?.nombre || ""}</td>
    <td class="py-3 px-4">${proveedores.find((prov) => prov.id === producto.proveedorId)?.nombre || ""}</td>
    <td class="py-3 px-4 font-semibold">$${(producto.precioVenta || 0).toFixed(2)}</td>
    <td class="py-3 px-4">
      <span class="${stockClass} font-medium">${producto.stock || 0}</span>
    </td>
    <td class="py-3 px-4">
      <div class="flex space-x-2">
        <button class="edit-producto p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors" data-id="${producto.id}" title="Editar">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button class="delete-producto p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors" data-id="${producto.id}" title="Eliminar">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </td>
  `

  return row
}

// Función para crear fila de armazón
function createFrameRow(armazon) {
  const row = document.createElement("tr")
  row.className = "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"

  // Determinar clase de stock
  const stockClass = getStockClass(
    armazon.stock,
    armazon.stockMinimo || CONFIG.STOCK_MINIMO_ARMAZON,
    armazon.stockCritico || CONFIG.STOCK_CRITICO_ARMAZON,
  )

  row.innerHTML = `
    <td class="py-3 px-4 font-mono text-sm">${armazon.codigo || ""}</td>
    <td class="py-3 px-4 font-medium">${armazon.nombre || ""}</td>
    <td class="py-3 px-4">${armazon.marca || ""}</td>
    <td class="py-3 px-4">${armazon.modelo || ""}</td>
    <td class="py-3 px-4">
      <div class="flex flex-wrap gap-1">
        ${(armazon.colores || [])
      .map(
        (color) =>
          `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">${color}</span>`,
      )
      .join("")}
      </div>
    </td>
    <td class="py-3 px-4">
      <div class="flex flex-wrap gap-1">
        ${(armazon.materiales || [])
      .map(
        (material) =>
          `<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-200">${material}</span>`,
      )
      .join("")}
      </div>
    </td>
    <td class="py-3 px-4">${proveedores.find((prov) => prov.id === armazon.proveedorId)?.nombre || ""}</td>
    <td class="py-3 px-4 font-semibold">$${(armazon.precioVenta || 0).toFixed(2)}</td>
    <td class="py-3 px-4">
      <span class="${stockClass} font-medium">${armazon.stock || 0}</span>
    </td>
    <td class="py-3 px-4">
      <div class="flex space-x-2">
        <button class="edit-armazon p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors" data-id="${armazon.id}" title="Editar">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button class="delete-armazon p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors" data-id="${armazon.id}" title="Eliminar">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </td>
  `

  return row
}

// ===== FUNCIONES AUXILIARES =====

// Función para obtener clase CSS según el nivel de stock
function getStockClass(stock, stockMinimo, stockCritico) {
  if (stock <= 0) {
    return "text-red-600 dark:text-red-400"
  } else if (stock <= stockCritico) {
    return "text-red-600 dark:text-red-400"
  } else if (stock <= stockMinimo) {
    return "text-yellow-600 dark:text-yellow-400"
  } else {
    return "text-green-600 dark:text-green-400"
  }
}

// Función para actualizar contador de resultados
function updateResultsCounter(type, filtered, total) {
  const counterId = type === "productos" ? "productosCounter" : "armazonesCounter"
  let counter = document.getElementById(counterId)

  if (!counter) {
    // Crear contador si no existe
    const tab = document.getElementById(`${type}-tab`)
    if (tab) {
      counter = document.createElement("div")
      counter.id = counterId
      counter.className = "text-sm text-gray-600 dark:text-gray-400 mb-4 px-4"

      const table = tab.querySelector(".data-table")
      if (table) {
        table.parentNode.insertBefore(counter, table)
      }
    }
  }

  if (counter) {
    if (filtered === total) {
      counter.textContent = `Mostrando ${total} ${type}`
    } else {
      counter.textContent = `Mostrando ${filtered} de ${total} ${type}`
    }
  }
}

// ===== FUNCIONES DE CARGA DE VALORES ÚNICOS =====

// Función para cargar valores únicos para los filtros
async function loadUniqueValues() {
  try {
    // Marcas de armazones
    const marcasSet = new Set()
    armazonesCache.forEach((armazon) => {
      if (armazon.marca) {
        marcasSet.add(armazon.marca)
      }
    })
    marcasArmazones = Array.from(marcasSet).sort()

    // Materiales de armazones
    const materialesSet = new Set()
    armazonesCache.forEach((armazon) => {
      if (armazon.materiales) {
        armazon.materiales.forEach((material) => materialesSet.add(material))
      }
    })
    materialesArmazones = Array.from(materialesSet).sort()

    // Colores de armazones
    const coloresSet = new Set()
    armazonesCache.forEach((armazon) => {
      if (armazon.colores) {
        armazon.colores.forEach((color) => coloresSet.add(color))
      }
    })
    coloresArmazones = Array.from(coloresSet).sort()

    // Actualizar selectores de filtros
    updateFilterSelectors()

    console.log(
      "Valores únicos cargados: Marcas =",
      marcasArmazones.length,
      ", Materiales =",
      materialesArmazones.length,
      ", Colores =",
      coloresArmazones.length,
    )
  } catch (error) {
    console.error("Error al cargar valores únicos:", error)
    showToast("Error al cargar valores únicos", "danger")
  }
}

// Función para actualizar selectores de filtros
function updateFilterSelectors() {
  const filterArmazonMarcaSelect = document.getElementById("filterArmazonMarca")
  const filterArmazonMaterialSelect = document.getElementById("filterArmazonMaterial")

  if (filterArmazonMarcaSelect) {
    const currentValue = filterArmazonMarcaSelect.value
    filterArmazonMarcaSelect.innerHTML = '<option value="">Todas las marcas</option>'
    marcasArmazones.forEach((marca) => {
      const option = document.createElement("option")
      option.value = marca
      option.textContent = marca
      filterArmazonMarcaSelect.appendChild(option)
    })
    filterArmazonMarcaSelect.value = currentValue
  }

  if (filterArmazonMaterialSelect) {
    const currentValue = filterArmazonMaterialSelect.value
    filterArmazonMaterialSelect.innerHTML = '<option value="">Todos los materiales</option>'
    materialesArmazones.forEach((material) => {
      const option = document.createElement("option")
      option.value = material
      option.textContent = material
      filterArmazonMaterialSelect.appendChild(option)
    })
    filterArmazonMaterialSelect.value = currentValue
  }
}

// ===== FUNCIONES DE VERIFICACIÓN DE STOCK =====

// Función para verificar productos con stock bajo
async function checkLowStockItems() {
  try {
    // Verificar productos
    const productosStockBajo = productosCache.filter((producto) => {
      const stockMinimo = producto.stockMinimo || CONFIG.STOCK_MINIMO_PRODUCTO
      return producto.stock <= stockMinimo
    })

    productosStockBajo.forEach((producto) => {
      if (notificationSystem) {
        notificationSystem.checkProductStock(producto)
      }
    })

    // Verificar armazones
    const armazonesStockBajo = armazonesCache.filter((armazon) => {
      const stockMinimo = armazon.stockMinimo || CONFIG.STOCK_MINIMO_ARMAZON
      return armazon.stock <= stockMinimo
    })

    armazonesStockBajo.forEach((armazon) => {
      if (notificationSystem) {
        notificationSystem.checkArmazonStock(armazon)
      }
    })

    console.log("Verificación de stock bajo completada")
  } catch (error) {
    console.error("Error al verificar productos con stock bajo:", error)
  }
}

// ===== FUNCIONES DE INICIALIZACIÓN =====

// Función para inicializar flags de alerta
async function initializeAlertFlags() {
  try {
    // Inicializar flags en productos
    const productosQuery = query(collection(db, "productos"))
    const productosSnapshot = await getDocs(productosQuery)

    const productBatch = writeBatch(db)

    productosSnapshot.forEach((docSnapshot) => {
      const producto = docSnapshot.data()
      const docRef = doc(db, "productos", docSnapshot.id)

      if (
        producto.alerta_stock_bajo === undefined ||
        producto.alerta_stock_critico === undefined ||
        producto.alerta_stock_agotado === undefined
      ) {
        const updateData = {
          alerta_stock_bajo: false,
          alerta_stock_critico: false,
          alerta_stock_agotado: false,
        }

        productBatch.update(docRef, updateData)
      }
    })

    await productBatch.commit()

    // Inicializar flags en armazones
    const armazonesQuery = query(collection(db, "armazones"))
    const armazonesSnapshot = await getDocs(armazonesQuery)

    const armazonBatch = writeBatch(db)

    armazonesSnapshot.forEach((docSnapshot) => {
      const armazon = docSnapshot.data()
      const docRef = doc(db, "armazones", docSnapshot.id)

      if (
        armazon.alerta_stock_bajo === undefined ||
        armazon.alerta_stock_critico === undefined ||
        armazon.alerta_stock_agotado === undefined
      ) {
        const updateData = {
          alerta_stock_bajo: false,
          alerta_stock_critico: false,
          alerta_stock_agotado: false,
        }

        armazonBatch.update(docRef, updateData)
      }
    })

    await armazonBatch.commit()

    console.log("Inicialización de flags de alerta completada")
  } catch (error) {
    console.error("Error al inicializar flags de alerta:", error)
  }
}

// ===== FUNCIONES DE GESTIÓN DE MODALES =====

// CORREGIDO: Función para cargar categorías en el modal sin duplicados
async function loadCategoriasToModal() {
  const categoriasTableBody = document.getElementById("categoriasTableBody")
  if (!categoriasTableBody) return

  try {
    categoriasTableBody.innerHTML = '<tr><td colspan="3" class="py-4 text-center">Cargando categorías...</td></tr>'

    // Recargar categorías desde la base de datos para asegurar datos actualizados
    await loadCategorias()

    if (categorias.length === 0) {
      categoriasTableBody.innerHTML =
        '<tr><td colspan="3" class="py-4 text-center">No hay categorías registradas</td></tr>'
      return
    }

    categoriasTableBody.innerHTML = ""

    // Usar el array global de categorías que ya está actualizado
    categorias.forEach((categoria) => {
      const row = document.createElement("tr")
      row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

      row.innerHTML = `
        <td class="py-3 px-4">${categoria.id}</td>
        <td class="py-3 px-4">${categoria.nombre || ""}</td>
        <td class="py-3 px-4">
          <div class="flex space-x-2">
            <button class="edit-categoria text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${categoria.id}">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="delete-categoria text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${categoria.id}">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      `

      categoriasTableBody.appendChild(row)
    })

    setupCategoriaEvents()
  } catch (error) {
    console.error("Error al cargar categorías en el modal:", error)
    categoriasTableBody.innerHTML =
      '<tr><td colspan="3" class="py-4 text-center text-red-500">Error al cargar categorías</td></tr>'
  }
}

// Función para cargar proveedores en el modal
async function loadProveedoresToModal() {
  const proveedoresTableBody = document.getElementById("proveedoresTableBody")
  if (!proveedoresTableBody) return

  try {
    proveedoresTableBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center">Cargando proveedores...</td></tr>'

    // Recargar proveedores desde la base de datos para asegurar datos actualizados
    await loadProveedores()

    if (proveedores.length === 0) {
      proveedoresTableBody.innerHTML =
        '<tr><td colspan="4" class="py-4 text-center">No hay proveedores registrados</td></tr>'
      return
    }

    proveedoresTableBody.innerHTML = ""

    // Usar el array global de proveedores que ya está actualizado
    proveedores.forEach((proveedor) => {
      const row = document.createElement("tr")
      row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

      row.innerHTML = `
        <td class="py-3 px-4">${proveedor.id}</td>
        <td class="py-3 px-4">${proveedor.nombre || ""}</td>
        <td class="py-3 px-4">${proveedor.contacto || ""}</td>
        <td class="py-3 px-4">
          <div class="flex space-x-2">
            <button class="edit-proveedor text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${proveedor.id}">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="delete-proveedor text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${proveedor.id}">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      `

      proveedoresTableBody.appendChild(row)
    })

    setupProveedorEvents()
  } catch (error) {
    console.error("Error al cargar proveedores en el modal:", error)
    proveedoresTableBody.innerHTML =
      '<tr><td colspan="4" class="py-4 text-center text-red-500">Error al cargar proveedores</td></tr>'
  }
}

// ===== FUNCIONES DE EVENTOS PARA EDICIÓN Y ELIMINACIÓN =====

// Configurar eventos para las categorías
function setupCategoriaEvents() {
  const editButtons = document.querySelectorAll(".edit-categoria")
  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const categoriaId = button.getAttribute("data-id")
      editCategoria(categoriaId)
    })
  })

  const deleteButtons = document.querySelectorAll(".delete-categoria")
  deleteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const categoriaId = button.getAttribute("data-id")
      confirmDeleteCategoria(categoriaId)
    })
  })
}

// Configurar eventos para los proveedores
function setupProveedorEvents() {
  const editButtons = document.querySelectorAll(".edit-proveedor")
  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const proveedorId = button.getAttribute("data-id")
      editProveedor(proveedorId)
    })
  })

  const deleteButtons = document.querySelectorAll(".delete-proveedor")
  deleteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const proveedorId = button.getAttribute("data-id")
      confirmDeleteProveedor(proveedorId)
    })
  })
}

// Función para editar una categoría
async function editCategoria(categoriaId) {
  try {
    const docRef = doc(db, "categorias", categoriaId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const categoria = docSnap.data()

      const modal = document.getElementById("editCategoriaModal")
      if (modal) {
        modal.style.display = "block"

        document.getElementById("editCategoriaId").value = categoriaId
        document.getElementById("editCategoriaNombre").value = categoria.nombre || ""
        clearFieldErrors()
      }
    } else {
      console.error("No se encontró la categoría")
      showToast("No se encontró la categoría", "danger")
    }
  } catch (error) {
    console.error("Error al obtener categoría:", error)
    showToast("Error al obtener la categoría", "danger")
  }
}

// Función para editar un proveedor
async function editProveedor(proveedorId) {
  try {
    const docRef = doc(db, "proveedores", proveedorId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const proveedor = docSnap.data()

      const modal = document.getElementById("editProveedorModal")
      if (modal) {
        modal.style.display = "block"

        document.getElementById("editProveedorId").value = proveedorId
        document.getElementById("editProveedorNombre").value = proveedor.nombre || ""
        document.getElementById("editProveedorContacto").value = proveedor.contacto || ""
        document.getElementById("editProveedorTelefono").value = proveedor.telefono || ""
        document.getElementById("editProveedorEmail").value = proveedor.email || ""
        clearFieldErrors()
      }
    } else {
      console.error("No se encontró el proveedor")
      showToast("No se encontró el proveedor", "danger")
    }
  } catch (error) {
    console.error("Error al obtener proveedor:", error)
    showToast("Error al obtener el proveedor", "danger")
  }
}

// Función mejorada para confirmar eliminación de una categoría
function confirmDeleteCategoria(categoriaId) {
  const confirmModal = document.getElementById("confirmModal")
  const confirmTitle = document.getElementById("confirmTitle")
  const confirmMessage = document.getElementById("confirmMessage")
  const confirmOk = document.getElementById("confirmOk")

  if (confirmModal && confirmTitle && confirmMessage && confirmOk) {
    confirmTitle.textContent = "Eliminar Categoría"
    confirmMessage.textContent =
      "¿Estás seguro de que deseas eliminar esta categoría? Esta acción no se puede deshacer y podría afectar a los productos asociados."

    confirmModal.style.display = "block"

    // Limpiar eventos anteriores
    const newConfirmOk = confirmOk.cloneNode(true)
    confirmOk.parentNode.replaceChild(newConfirmOk, confirmOk)

    newConfirmOk.addEventListener("click", async () => {
      try {
        await deleteCategoria(categoriaId)
        confirmModal.style.display = "none"
      } catch (error) {
        console.error("Error al eliminar categoría:", error)
        showToast("Error al eliminar la categoría", "danger")
        confirmModal.style.display = "none"
      }
    })
  }
}

// Función mejorada para confirmar eliminación de un proveedor
function confirmDeleteProveedor(proveedorId) {
  const confirmModal = document.getElementById("confirmModal")
  const confirmTitle = document.getElementById("confirmTitle")
  const confirmMessage = document.getElementById("confirmMessage")
  const confirmOk = document.getElementById("confirmOk")

  if (confirmModal && confirmTitle && confirmMessage && confirmOk) {
    confirmTitle.textContent = "Eliminar Proveedor"
    confirmMessage.textContent =
      "¿Estás seguro de que deseas eliminar este proveedor? Esta acción no se puede deshacer y podría afectar a los productos asociados."

    confirmModal.style.display = "block"

    // Limpiar eventos anteriores
    const newConfirmOk = confirmOk.cloneNode(true)
    confirmOk.parentNode.replaceChild(newConfirmOk, confirmOk)

    newConfirmOk.addEventListener("click", async () => {
      try {
        await deleteProveedor(proveedorId)
        confirmModal.style.display = "none"
      } catch (error) {
        console.error("Error al eliminar proveedor:", error)
        showToast("Error al eliminar el proveedor", "danger")
        confirmModal.style.display = "none"
      }
    })
  }
}

// Función mejorada para eliminar una categoría
async function deleteCategoria(categoriaId) {
  try {
    // Verificar si hay productos asociados
    const productosQuery = query(collection(db, "productos"), where("categoriaId", "==", categoriaId))
    const productosSnapshot = await getDocs(productosQuery)

    if (!productosSnapshot.empty) {
      showToast("No se puede eliminar la categoría porque hay productos asociados", "warning")
      return
    }

    await deleteDoc(doc(db, "categorias", categoriaId))
    showToast("Categoría eliminada correctamente", "success")

    await loadCategorias()
    await loadCategoriasToModal()
  } catch (error) {
    console.error("Error al eliminar categoría:", error)
    throw error
  }
}

// Función mejorada para eliminar un proveedor
async function deleteProveedor(proveedorId) {
  try {
    // Verificar si hay productos asociados
    const productosQuery = query(collection(db, "productos"), where("proveedorId", "==", proveedorId))
    const productosSnapshot = await getDocs(productosQuery)

    if (!productosSnapshot.empty) {
      showToast("No se puede eliminar el proveedor porque hay productos asociados", "warning")
      return
    }

    // Verificar si hay armazones asociados
    const armazonesQuery = query(collection(db, "armazones"), where("proveedorId", "==", proveedorId))
    const armazonesSnapshot = await getDocs(armazonesQuery)

    if (!armazonesSnapshot.empty) {
      showToast("No se puede eliminar el proveedor porque hay armazones asociados", "warning")
      return
    }

    await deleteDoc(doc(db, "proveedores", proveedorId))
    showToast("Proveedor eliminado correctamente", "success")

    await loadProveedores()
    await loadProveedoresToModal()
  } catch (error) {
    console.error("Error al eliminar proveedor:", error)
    throw error
  }
}

// ===== FUNCIONES DE EVENTOS PARA PRODUCTOS Y ARMAZONES =====

// Función para configurar eventos para los productos
function setupProductoEvents() {
  const editButtons = document.querySelectorAll(".edit-producto")
  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const productoId = button.getAttribute("data-id")
      editProducto(productoId)
    })
  })

  const deleteButtons = document.querySelectorAll(".delete-producto")
  deleteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const productoId = button.getAttribute("data-id")
      confirmDeleteProducto(productoId)
    })
  })
}

// Función para configurar eventos para los armazones
function setupArmazonEvents() {
  const editButtons = document.querySelectorAll(".edit-armazon")
  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const armazonId = button.getAttribute("data-id")
      editArmazon(armazonId)
    })
  })

  const deleteButtons = document.querySelectorAll(".delete-armazon")
  deleteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const armazonId = button.getAttribute("data-id")
      confirmDeleteArmazon(armazonId)
    })
  })
}

// Función para editar un producto
async function editProducto(productoId) {
  try {
    const producto = productosCache.find((p) => p.id === productoId)
    if (!producto) {
      showToast("No se encontró el producto", "danger")
      return
    }

    const modal = document.getElementById("productoModal")
    if (modal) {
      modal.style.display = "block"
      document.getElementById("productoModalTitle").textContent = "Editar Producto"

      document.getElementById("productoId").value = productoId
      document.getElementById("productoCodigo").value = producto.codigo || ""
      document.getElementById("productoNombre").value = producto.nombre || ""
      document.getElementById("productoDescripcion").value = producto.descripcion || ""
      document.getElementById("productoTipo").value = producto.tipo || ""
      document.getElementById("productoCategoria").value = producto.categoriaId || ""
      document.getElementById("productoProveedor").value = producto.proveedorId || ""
      document.getElementById("productoPrecioCompra").value = producto.precioCompra || ""
      document.getElementById("productoPrecioVenta").value = producto.precioVenta || ""
      document.getElementById("productoStock").value = producto.stock || ""
      document.getElementById("productoStockMinimo").value = producto.stockMinimo || CONFIG.STOCK_MINIMO_PRODUCTO
      document.getElementById("productoStockCritico").value = producto.stockCritico || CONFIG.STOCK_CRITICO_PRODUCTO

      const errorMessage = document.getElementById("error-message")
      if (errorMessage) {
        errorMessage.classList.add("hidden")
        errorMessage.textContent = ""
      }
      clearFieldErrors()
    }
  } catch (error) {
    console.error("Error al obtener producto:", error)
    showToast("Error al obtener el producto", "danger")
  }
}

// Función para editar un armazón
async function editArmazon(armazonId) {
  try {
    const armazon = armazonesCache.find((a) => a.id === armazonId)
    if (!armazon) {
      showToast("No se encontró el armazón", "danger")
      return
    }

    const modal = document.getElementById("armazonModal")
    if (modal) {
      modal.style.display = "block"
      document.getElementById("armazonModalTitle").textContent = "Editar Armazón"

      document.getElementById("armazonId").value = armazonId
      document.getElementById("armazonCodigo").value = armazon.codigo || ""
      document.getElementById("armazonNombre").value = armazon.nombre || ""
      document.getElementById("armazonMarca").value = armazon.marca || ""
      document.getElementById("armazonModelo").value = armazon.modelo || ""
      document.getElementById("armazonProveedor").value = armazon.proveedorId || ""
      document.getElementById("armazonPrecioCompra").value = armazon.precioCompra || ""
      document.getElementById("armazonPrecioVenta").value = armazon.precioVenta || ""
      document.getElementById("armazonStock").value = armazon.stock || ""
      document.getElementById("armazonStockMinimo").value = armazon.stockMinimo || CONFIG.STOCK_MINIMO_ARMAZON
      document.getElementById("armazonStockCritico").value = armazon.stockCritico || CONFIG.STOCK_CRITICO_ARMAZON

      coloresSeleccionados = armazon.colores || []
      materialesSeleccionados = armazon.materiales || []
      actualizarColoresUI()
      actualizarMaterialesUI()

      const errorMessage = document.getElementById("armazon-error-message")
      if (errorMessage) {
        errorMessage.classList.add("hidden")
        errorMessage.textContent = ""
      }
      clearFieldErrors()
    }
  } catch (error) {
    console.error("Error al obtener armazón:", error)
    showToast("Error al obtener el armazón", "danger")
  }
}

// Función para confirmar eliminación de un producto
function confirmDeleteProducto(productoId) {
  const confirmModal = document.getElementById("confirmModal")
  const confirmTitle = document.getElementById("confirmTitle")
  const confirmMessage = document.getElementById("confirmMessage")
  const confirmOk = document.getElementById("confirmOk")

  if (confirmModal && confirmTitle && confirmMessage && confirmOk) {
    confirmTitle.textContent = "Eliminar Producto"
    confirmMessage.textContent = "¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer."

    confirmModal.style.display = "block"

    // Limpiar eventos anteriores
    const newConfirmOk = confirmOk.cloneNode(true)
    confirmOk.parentNode.replaceChild(newConfirmOk, confirmOk)

    newConfirmOk.addEventListener("click", async () => {
      try {
        await deleteProducto(productoId)
        confirmModal.style.display = "none"
      } catch (error) {
        console.error("Error al eliminar producto:", error)
        showToast("Error al eliminar el producto", "danger")
        confirmModal.style.display = "none"
      }
    })
  }
}

// Función para confirmar eliminación de un armazón
function confirmDeleteArmazon(armazonId) {
  const confirmModal = document.getElementById("confirmModal")
  const confirmTitle = document.getElementById("confirmTitle")
  const confirmMessage = document.getElementById("confirmMessage")
  const confirmOk = document.getElementById("confirmOk")

  if (confirmModal && confirmTitle && confirmMessage && confirmOk) {
    confirmTitle.textContent = "Eliminar Armazón"
    confirmMessage.textContent = "¿Estás seguro de que deseas eliminar este armazón? Esta acción no se puede deshacer."

    confirmModal.style.display = "block"

    // Limpiar eventos anteriores
    const newConfirmOk = confirmOk.cloneNode(true)
    confirmOk.parentNode.replaceChild(newConfirmOk, confirmOk)

    newConfirmOk.addEventListener("click", async () => {
      try {
        await deleteArmazon(armazonId)
        confirmModal.style.display = "none"
      } catch (error) {
        console.error("Error al eliminar armazón:", error)
        showToast("Error al eliminar el armazón", "danger")
        confirmModal.style.display = "none"
      }
    })
  }
}

// Función para eliminar un producto
async function deleteProducto(productoId) {
  try {
    await deleteDoc(doc(db, "productos", productoId))
    showToast("Producto eliminado correctamente", "success")

    await refreshProductsCache()
    await loadProductosOptimized()
  } catch (error) {
    console.error("Error al eliminar producto:", error)
    throw error
  }
}

// Función para eliminar un armazón
async function deleteArmazon(armazonId) {
  try {
    await deleteDoc(doc(db, "armazones", armazonId))
    showToast("Armazón eliminado correctamente", "success")

    await refreshFramesCache()
    await loadArmazonesOptimized()
    await loadUniqueValues()
  } catch (error) {
    console.error("Error al eliminar armazón:", error)
    throw error
  }
}

// ===== FUNCIONES DE INTERFAZ DE USUARIO =====

// Función para actualizar la interfaz de usuario de colores
function actualizarColoresUI() {
  const coloresContainer = document.getElementById("coloresSeleccionados")
  if (!coloresContainer) return

  coloresContainer.innerHTML = ""

  coloresSeleccionados.forEach((color) => {
    const colorElement = document.createElement("span")
    colorElement.className = "inline-block bg-blue-500 text-white py-1 px-2 rounded mr-2 mb-2"
    colorElement.textContent = color

    const deleteButton = document.createElement("button")
    deleteButton.textContent = "×"
    deleteButton.className = "ml-1 text-red-500 hover:text-red-700 focus:outline-none"
    deleteButton.addEventListener("click", () => {
      coloresSeleccionados = coloresSeleccionados.filter((c) => c !== color)
      actualizarColoresUI()
    })

    colorElement.appendChild(deleteButton)
    coloresContainer.appendChild(colorElement)
  })
}

// Función para actualizar la interfaz de usuario de materiales
function actualizarMaterialesUI() {
  const materialesContainer = document.getElementById("materialesSeleccionados")
  if (!materialesContainer) return

  materialesContainer.innerHTML = ""

  materialesSeleccionados.forEach((material) => {
    const materialElement = document.createElement("span")
    materialElement.className = "inline-block bg-green-500 text-white py-1 px-2 rounded mr-2 mb-2"
    materialElement.textContent = material

    const deleteButton = document.createElement("button")
    deleteButton.textContent = "×"
    deleteButton.className = "ml-1 text-red-500 hover:text-red-700 focus:outline-none"
    deleteButton.addEventListener("click", () => {
      materialesSeleccionados = materialesSeleccionados.filter((m) => m !== material)
      actualizarMaterialesUI()
    })

    materialElement.appendChild(deleteButton)
    materialesContainer.appendChild(materialElement)
  })
}

// ===== EXPORTAR FUNCIONES PRINCIPALES =====

export {
  checkLowStockItems,
  initializeAlertFlags,
  loadProductosOptimized as loadProductos,
  loadArmazonesOptimized as loadArmazones,
  generarCodigoArmazon,
  verificarCategoriaDuplicada,
  verificarProveedorDuplicado,
  validateEmail,
  validatePhone,
  validateDomain,
  showFieldError,
  clearFieldErrors,
  validateEmailField,
  validatePhoneField,
  validateProviderNameField,
  validateCategoryNameField,
}