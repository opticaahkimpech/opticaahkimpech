import { NotificationSystem } from './notification-system.js';
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
  limit,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

import { db } from "./firebase-config.js"
import { checkAndCreateInventoryCollection } from "./auth-check.js"

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
let notificationSystem;

// Configuración de stock
const CONFIG = {
  STOCK_MINIMO_PRODUCTO: 5,
  STOCK_CRITICO_PRODUCTO: 2,
  STOCK_MINIMO_ARMAZON: 3,
  STOCK_CRITICO_ARMAZON: 1,
}

// Filtros activos
const filtrosProductos = {
  tipo: "",
  categoria: "",
  proveedor: "",
  precioMin: "",
  precioMax: "",
  busqueda: "",
}

const filtrosArmazones = {
  marca: "",
  material: "",
  proveedor: "",
  precioMin: "",
  precioMax: "",
  busqueda: "",
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Página de inventario cargada")

  try {
    // Inicializar el sistema de notificaciones
    notificationSystem = new NotificationSystem();
    
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

    // Configurar eventos para los filtros
    setupFilterEvents()

    // Configurar eventos para las búsquedas
    setupSearchEvents()

    // Cargar datos iniciales
    await loadProductos()
    await loadArmazones()

    // Cargar valores únicos para filtros
    await loadUniqueValues()

    // Verificar productos con stock bajo
    checkLowStockItems()

    // Configurar eventos para administrar categorías y proveedores
    setupCategoryAndProviderEvents()
    
    // Configurar eventos para el botón de notificaciones
    setupNotificationEvents();
  } catch (error) {
    console.error("Error al inicializar la página de inventario:", error)
    showToast("Error al cargar la página de inventario", "danger")
  }
})

// Función para configurar eventos de notificaciones
function setupNotificationEvents() {
  const notificationBell = document.getElementById('notificationBell');
  const notificationDropdown = document.getElementById('notificationDropdown');

  if (notificationBell && notificationDropdown) {
    notificationBell.addEventListener('click', () => {
      if (notificationDropdown.style.display === 'block') {
        notificationDropdown.style.display = 'none';
      } else {
        notificationDropdown.style.display = 'block';
        // Si estamos usando el sistema de notificaciones, actualizar la lista
        if (notificationSystem) {
          notificationSystem.updateNotificationList();
        }
      }
    });

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!notificationBell.contains(e.target) && !notificationDropdown.contains(e.target)) {
        notificationDropdown.style.display = 'none';
      }
    });
  }
}

// Función para mostrar notificaciones toast
function showToast(message, type = "info") {
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

  // Agregar evento para cerrar el toast
  const closeBtn = toast.querySelector("button")
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      toast.style.animation = "slideOut 0.3s ease-out forwards"
      setTimeout(() => {
        if (toastContainer.contains(toast)) {
          toastContainer.removeChild(toast)
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
          toastContainer.removeChild(toast)
        }
      }, 300)
    }
  }, 5000)
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

// Función para configurar las pestañas
function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn")
  const tabContents = document.querySelectorAll(".tab-content")

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Remover clase active de todos los botones
      tabButtons.forEach((btn) => {
        btn.classList.remove("active")
        btn.querySelector("span").classList.add("opacity-0")
      })

      // Agregar clase active al botón clickeado
      button.classList.add("active")
      button.querySelector("span").classList.remove("opacity-0")

      // Mostrar el contenido de la pestaña correspondiente
      const tabId = button.getAttribute("data-tab")
      tabContents.forEach((content) => {
        content.style.display = content.id === tabId + "-tab" ? "block" : "none"
      })
    })
  })
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

    // Actualizar los selectores de categorías
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

    console.log("Categorías cargadas:", categorias.length)
  } catch (error) {
    console.error("Error al cargar categorías:", error)
    showToast("Error al cargar categorías", "danger")
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

    // Actualizar los selectores de proveedores
    const productoProveedorSelect = document.getElementById("productoProveedor")
    const armazonProveedorSelect = document.getElementById("armazonProveedor")
    const filterProductoProveedorSelect = document.getElementById("filterProductoProveedorSelect")
    const filterArmazonProveedorSelect = document.getElementById("filterArmazonProveedorSelect")

    if (productoProveedorSelect) {
      productoProveedorSelect.innerHTML = '<option value="">Seleccione un proveedor</option>'
      proveedores.forEach((proveedor) => {
        const option = document.createElement("option")
        option.value = proveedor.id
        option.textContent = proveedor.nombre
        productoProveedorSelect.appendChild(option)
      })
    }

    if (armazonProveedorSelect) {
      armazonProveedorSelect.innerHTML = '<option value="">Seleccione un proveedor</option>'
      proveedores.forEach((proveedor) => {
        const option = document.createElement("option")
        option.value = proveedor.id
        option.textContent = proveedor.nombre
        armazonProveedorSelect.appendChild(option)
      })
    }

    if (filterProductoProveedorSelect) {
      filterProductoProveedorSelect.innerHTML = '<option value="">Todos</option>'
      proveedores.forEach((proveedor) => {
        const option = document.createElement("option")
        option.value = proveedor.id
        option.textContent = proveedor.nombre
        filterProductoProveedorSelect.appendChild(option)
      })
    }

    if (filterArmazonProveedorSelect) {
      filterArmazonProveedorSelect.innerHTML = '<option value="">Todos</option>'
      proveedores.forEach((proveedor) => {
        const option = document.createElement("option")
        option.value = proveedor.id
        option.textContent = proveedor.nombre
        filterArmazonProveedorSelect.appendChild(option)
      })
    }

    console.log("Proveedores cargados:", proveedores.length)
  } catch (error) {
    console.error("Error al cargar proveedores:", error)
    showToast("Error al cargar proveedores", "danger")
  }
}

// Configurar eventos para los modales
function setupModalEvents() {
  // Configurar botón para agregar producto
  const addProductBtn = document.getElementById("addProductBtn")
  if (addProductBtn) {
    addProductBtn.addEventListener("click", () => {
      // Mostrar modal de producto
      const modal = document.getElementById("productoModal")
      if (modal) {
        modal.style.display = "block"
        document.getElementById("productoModalTitle").textContent = "Agregar Producto"
        document.getElementById("productoForm").reset()
        document.getElementById("productoId").value = ""

        // Establecer valores predeterminados para stock mínimo y crítico
        document.getElementById("productoStockMinimo").value = CONFIG.STOCK_MINIMO_PRODUCTO
        document.getElementById("productoStockCritico").value = CONFIG.STOCK_CRITICO_PRODUCTO

        // Ocultar mensaje de error
        const errorMessage = document.getElementById("error-message")
        if (errorMessage) {
          errorMessage.classList.add("hidden")
          errorMessage.textContent = ""
        }
      }
    })
  }

  // Configurar botón para agregar armazón
  const addArmazonBtn = document.getElementById("addArmazonBtn")
  if (addArmazonBtn) {
    addArmazonBtn.addEventListener("click", () => {
      // Mostrar modal de armazón
      const modal = document.getElementById("armazonModal")
      if (modal) {
        modal.style.display = "block"
        document.getElementById("armazonModalTitle").textContent = "Agregar Armazón"
        document.getElementById("armazonForm").reset()
        document.getElementById("armazonId").value = ""

        // Establecer valores predeterminados para stock mínimo y crítico
        document.getElementById("armazonStockMinimo").value = CONFIG.STOCK_MINIMO_ARMAZON
        document.getElementById("armazonStockCritico").value = CONFIG.STOCK_CRITICO_ARMAZON

        // Limpiar colores y materiales
        coloresSeleccionados = []
        materialesSeleccionados = []
        actualizarColoresUI()
        actualizarMaterialesUI()

        // Ocultar mensaje de error
        const errorMessage = document.getElementById("armazon-error-message")
        if (errorMessage) {
          errorMessage.classList.add("hidden")
          errorMessage.textContent = ""
        }
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

  // Configurar botones para agregar colores y materiales
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

  // Configurar eventos para el modal de confirmación
  const confirmModal = document.getElementById("confirmModal")
  const confirmCancel = document.getElementById("confirmCancel")

  if (confirmCancel) {
    confirmCancel.addEventListener("click", () => {
      if (confirmModal) {
        confirmModal.style.display = "none"
      }
    })
  }

  // Configurar eventos para el modal de producto agotado
  const outOfStockModal = document.getElementById("outOfStockModal")
  const keepProduct = document.getElementById("keepProduct")
  const removeProduct = document.getElementById("removeProduct")

  if (keepProduct) {
    keepProduct.addEventListener("click", () => {
      if (outOfStockModal) {
        outOfStockModal.style.display = "none"
      }
    })
  }
}

// Configurar eventos para los formularios
function setupFormEvents() {
  // Configurar formulario de producto
  const productoForm = document.getElementById("productoForm")
  if (productoForm) {
    productoForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      try {
        const productoId = document.getElementById("productoId").value
        const codigo = document.getElementById("productoCodigo").value
        const nombre = document.getElementById("productoNombre").value
        const descripcion = document.getElementById("productoDescripcion").value
        const tipo = document.getElementById("productoTipo").value
        const categoriaId = document.getElementById("productoCategoria").value
        const proveedorId = document.getElementById("productoProveedor").value
        const precioCompra = Number.parseFloat(document.getElementById("productoPrecioCompra").value)
        const precioVenta = Number.parseFloat(document.getElementById("productoPrecioVenta").value)
        const stock = Number.parseInt(document.getElementById("productoStock").value)
        const stockMinimo = Number.parseInt(document.getElementById("productoStockMinimo").value)
        const stockCritico = Number.parseInt(document.getElementById("productoStockCritico").value)

        // Validar campos requeridos
        if (!codigo || !nombre || !tipo || !categoriaId || isNaN(precioCompra) || isNaN(precioVenta) || isNaN(stock)) {
          const errorMessage = document.getElementById("error-message")
          errorMessage.textContent = "Por favor, complete todos los campos requeridos."
          errorMessage.classList.remove("hidden")
          return
        }

        // Crear objeto de producto
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
          // Agregar fecha de creación para nuevos productos
          productoData.createdAt = serverTimestamp()

          // Verificar si ya existe un producto con el mismo código
          const codigoQuery = query(collection(db, "productos"), where("codigo", "==", codigo))
          const codigoSnapshot = await getDocs(codigoQuery)

          if (!codigoSnapshot.empty) {
            const errorMessage = document.getElementById("error-message")
            errorMessage.textContent = "Ya existe un producto con este código."
            errorMessage.classList.remove("hidden")
            return
          }

          // Agregar nuevo producto
          await addDoc(collection(db, "productos"), productoData)
          showToast("Producto agregado correctamente", "success")
        } else {
          // Actualizar producto existente
          await updateDoc(doc(db, "productos", productoId), productoData)
          showToast("Producto actualizado correctamente", "success")
        }

        // Cerrar modal
        document.getElementById("productoModal").style.display = "none"

        // Recargar productos
        await loadProductos()

        // Verificar stock bajo
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

  // Configurar formulario de armazón
  const armazonForm = document.getElementById("armazonForm")
  if (armazonForm) {
    armazonForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      try {
        const armazonId = document.getElementById("armazonId").value
        const codigo = document.getElementById("armazonCodigo").value
        const nombre = document.getElementById("armazonNombre").value
        const marca = document.getElementById("armazonMarca").value
        const modelo = document.getElementById("armazonModelo").value
        const proveedorId = document.getElementById("armazonProveedor").value
        const precioCompra = Number.parseFloat(document.getElementById("armazonPrecioCompra").value)
        const precioVenta = Number.parseFloat(document.getElementById("armazonPrecioVenta").value)
        const stock = Number.parseInt(document.getElementById("armazonStock").value)
        const stockMinimo = Number.parseInt(document.getElementById("armazonStockMinimo").value)
        const stockCritico = Number.parseInt(document.getElementById("armazonStockCritico").value)

        // Validar campos requeridos
        if (!codigo || !nombre || !marca || !modelo || isNaN(precioCompra) || isNaN(precioVenta) || isNaN(stock)) {
          const errorMessage = document.getElementById("armazon-error-message")
          errorMessage.textContent = "Por favor, complete todos los campos requeridos."
          errorMessage.classList.remove("hidden")
          return
        }

        // Crear objeto de armazón
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
          // Agregar fecha de creación para nuevos armazones
          armazonData.createdAt = serverTimestamp()

          // Verificar si ya existe un armazón con el mismo código
          const codigoQuery = query(collection(db, "armazones"), where("codigo", "==", codigo))
          const codigoSnapshot = await getDocs(codigoQuery)

          if (!codigoSnapshot.empty) {
            const errorMessage = document.getElementById("armazon-error-message")
            errorMessage.textContent = "Ya existe un armazón con este código."
            errorMessage.classList.remove("hidden")
            return
          }

          // Agregar nuevo armazón
          await addDoc(collection(db, "armazones"), armazonData)
          showToast("Armazón agregado correctamente", "success")
        } else {
          // Actualizar armazón existente
          await updateDoc(doc(db, "armazones", armazonId), armazonData)
          showToast("Armazón actualizado correctamente", "success")
        }

        // Cerrar modal
        document.getElementById("armazonModal").style.display = "none"

        // Recargar armazones
        await loadArmazones()

        // Actualizar valores únicos para filtros
        await loadUniqueValues()

        // Verificar stock bajo
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

// Función para generar código automático basado en categoría
async function generarCodigoProducto(categoriaId) {
  // Obtener información de la categoría
  try {
    const categoriaDoc = await getDoc(doc(db, "categorias", categoriaId))
    if (!categoriaDoc.exists()) {
      throw new Error("Categoría no encontrada")
    }

    const categoria = categoriaDoc.data()

    // Obtener prefijo según la categoría
    let prefijo = ""
    switch (categoria.nombre.toLowerCase()) {
      case "armazones":
        prefijo = "ARM"
        break
      case "lentes de contacto":
        prefijo = "CONT"
        break
      case "solares":
        prefijo = "SOL"
        break
      case "accesorios":
        prefijo = "ACC"
        break
      case "limpieza":
        prefijo = "LIMP"
        break
      default:
        // Usar las primeras 4 letras de la categoría
        prefijo = categoria.nombre.substring(0, 4).toUpperCase()
    }

    // Buscar el último código con ese prefijo
    const productosQuery = query(
      collection(db, "productos"),
      where("codigo", ">=", prefijo),
      where("codigo", "<", prefijo + "\uf8ff"),
      orderBy("codigo", "desc"),
      limit(1),
    )

    const productosSnapshot = await getDocs(productosQuery)

    let secuencia = 1
    if (!productosSnapshot.empty) {
      const ultimoProducto = productosSnapshot.docs[0].data()
      // Extraer la secuencia numérica del último código
      const match = ultimoProducto.codigo.match(/\d+$/)
      if (match) {
        secuencia = Number.parseInt(match[0]) + 1
      }
    }

    // Formatear la secuencia con ceros a la izquierda (3 dígitos)
    const secuenciaFormateada = secuencia.toString().padStart(3, "0")

    return `${prefijo}${secuenciaFormateada}`
  } catch (error) {
    console.error("Error al generar código:", error)

    // Generar un código alternativo basado en fecha
    const hoy = new Date()
    const prefijo = "PROD"
    const fechaStr = (hoy.getMonth() + 1).toString().padStart(2, "0") + hoy.getDate().toString().padStart(2, "0")
    const secuencia = Math.floor(Math.random() * 999)
      .toString()
      .padStart(3, "0")

    return `${prefijo}${fechaStr}${secuencia}`
  }
}

// Función para configurar eventos para administrar categorías y proveedores
function setupCategoryAndProviderEvents() {
  // Botón para abrir modal de categorías
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

  // Botón para abrir modal de proveedores
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

  // Botón para generar código automático en producto
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
      } catch (error) {
        console.error("Error al generar código:", error)
        showToast("Error al generar código automático", "danger")
      }
    })
  }

  // Botón para generar código automático en armazón
  const generateFrameCodeBtn = document.getElementById("generateFrameCodeBtn")
  if (generateFrameCodeBtn) {
    generateFrameCodeBtn.addEventListener("click", async () => {
      try {
        // Buscar la categoría de armazones
        const armazonesQuery = query(collection(db, "categorias"), where("nombre", "==", "Armazones"))

        const categoriasSnapshot = await getDocs(armazonesQuery)
        let categoriaId = ""

        if (!categoriasSnapshot.empty) {
          categoriaId = categoriasSnapshot.docs[0].id
        } else {
          // Si no existe la categoría, crear un código genérico
          const hoy = new Date()
          const prefijo = "ARM"
          const fechaStr = (hoy.getMonth() + 1).toString().padStart(2, "0") + hoy.getDate().toString().padStart(2, "0")
          const secuencia = Math.floor(Math.random() * 999)
            .toString()
            .padStart(3, "0")

          document.getElementById("armazonCodigo").value = `${prefijo}${fechaStr}${secuencia}`
          return
        }

        const codigo = await generarCodigoProducto(categoriaId)
        document.getElementById("armazonCodigo").value = codigo
      } catch (error) {
        console.error("Error al generar código:", error)
        showToast("Error al generar código automático", "danger")
      }
    })
  }

  // Formulario para agregar categoría
  const addCategoriaForm = document.getElementById("addCategoriaForm")
  if (addCategoriaForm) {
    addCategoriaForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      const nombreCategoria = document.getElementById("nuevaCategoria").value.trim()
      if (!nombreCategoria) {
        showToast("Ingrese un nombre para la categoría", "warning")
        return
      }

      try {
        // Verificar si ya existe una categoría con ese nombre
        const categoriaQuery = query(collection(db, "categorias"), where("nombre", "==", nombreCategoria))

        const categoriaSnapshot = await getDocs(categoriaQuery)

        if (!categoriaSnapshot.empty) {
          showToast("Ya existe una categoría con ese nombre", "warning")
          return
        }

        // Agregar nueva categoría
        await addDoc(collection(db, "categorias"), {
          nombre: nombreCategoria,
          createdAt: serverTimestamp(),
        })

        showToast("Categoría agregada correctamente", "success")
        document.getElementById("nuevaCategoria").value = ""

        // Recargar categorías
        await loadCategorias()
        loadCategoriasToModal()
      } catch (error) {
        console.error("Error al agregar categoría:", error)
        showToast("Error al agregar categoría", "danger")
      }
    })
  }

  // Formulario para agregar proveedor
  const addProveedorForm = document.getElementById("addProveedorForm")
  if (addProveedorForm) {
    addProveedorForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      const nombreProveedor = document.getElementById("nuevoProveedorNombre").value.trim()
      const contactoProveedor = document.getElementById("nuevoProveedorContacto").value.trim()
      const telefonoProveedor = document.getElementById("nuevoProveedorTelefono").value.trim()
      const emailProveedor = document.getElementById("nuevoProveedorEmail").value.trim()

      if (!nombreProveedor) {
        showToast("Ingrese un nombre para el proveedor", "warning")
        return
      }

      try {
        // Verificar si ya existe un proveedor con ese nombre
        const proveedorQuery = query(collection(db, "proveedores"), where("nombre", "==", nombreProveedor))

        const proveedorSnapshot = await getDocs(proveedorQuery)

        if (!proveedorSnapshot.empty) {
          showToast("Ya existe un proveedor con ese nombre", "warning")
          return
        }

        // Agregar nuevo proveedor
        await addDoc(collection(db, "proveedores"), {
          nombre: nombreProveedor,
          contacto: contactoProveedor,
          telefono: telefonoProveedor,
          email: emailProveedor,
          createdAt: serverTimestamp(),
        })

        showToast("Proveedor agregado correctamente", "success")
        document.getElementById("nuevoProveedorNombre").value = ""
        document.getElementById("nuevoProveedorContacto").value = ""
        document.getElementById("nuevoProveedorTelefono").value = ""
        document.getElementById("nuevoProveedorEmail").value = ""

        // Recargar proveedores
        await loadProveedores()
        loadProveedoresToModal()
      } catch (error) {
        console.error("Error al agregar proveedor:", error)
        showToast("Error al agregar proveedor", "danger")
      }
    })
  }
}

// Función para cargar categorías en el modal
async function loadCategoriasToModal() {
  const categoriasTableBody = document.getElementById("categoriasTableBody")
  if (!categoriasTableBody) return

  try {
    categoriasTableBody.innerHTML = '<tr><td colspan="3" class="py-4 text-center">Cargando categorías...</td></tr>'

    const categoriasSnapshot = await getDocs(collection(db, "categorias"))

    if (categoriasSnapshot.empty) {
      categoriasTableBody.innerHTML =
        '<tr><td colspan="3" class="py-4 text-center">No hay categorías registradas</td></tr>'
      return
    }

    categoriasTableBody.innerHTML = ""

    categoriasSnapshot.forEach((doc) => {
      const categoria = doc.data()
      const row = document.createElement("tr")
      row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

      row.innerHTML = `
                <td class="py-3 px-4">${doc.id}</td>
                <td class="py-3 px-4">${categoria.nombre || ""}</td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        <button class="edit-categoria text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${doc.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button class="delete-categoria text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${doc.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            `

      categoriasTableBody.appendChild(row)
    })

    // Configurar eventos para los botones de editar y eliminar
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
    proveedoresTableBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center">Cargando proveedores...</td></tr>'

    const proveedoresSnapshot = await getDocs(collection(db, "proveedores"))

    if (proveedoresSnapshot.empty) {
      proveedoresTableBody.innerHTML =
        '<tr><td colspan="5" class="py-4 text-center">No hay proveedores registrados</td></tr>'
      return
    }

    proveedoresTableBody.innerHTML = ""

    proveedoresSnapshot.forEach((doc) => {
      const proveedor = doc.data()
      const row = document.createElement("tr")
      row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

      row.innerHTML = `
                <td class="py-3 px-4">${doc.id}</td>
                <td class="py-3 px-4">${proveedor.nombre || ""}</td>
                <td class="py-3 px-4">${proveedor.contacto || ""}</td>
                <td class="py-3 px-4">${proveedor.telefono || ""}</td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        <button class="edit-proveedor text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${doc.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button class="delete-proveedor text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${doc.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            `

      proveedoresTableBody.appendChild(row)
    })

    // Configurar eventos para los botones de editar y eliminar
    setupProveedorEvents()
  } catch (error) {
    console.error("Error al cargar proveedores en el modal:", error)
    proveedoresTableBody.innerHTML =
      '<tr><td colspan="5" class="py-4 text-center text-red-500">Error al cargar proveedores</td></tr>'
  }
}

// Configurar eventos para las categorías
function setupCategoriaEvents() {
  // Configurar botones para editar categorías
  const editButtons = document.querySelectorAll(".edit-categoria")
  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const categoriaId = button.getAttribute("data-id")
      editCategoria(categoriaId)
    })
  })

  // Configurar botones para eliminar categorías
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
  // Configurar botones para editar proveedores
  const editButtons = document.querySelectorAll(".edit-proveedor")
  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const proveedorId = button.getAttribute("data-id")
      editProveedor(proveedorId)
    })
  })

  // Configurar botones para eliminar proveedores
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

      // Mostrar modal de edición
      const modal = document.getElementById("editCategoriaModal")
      if (modal) {
        modal.style.display = "block"

        // Llenar formulario con datos de la categoría
        document.getElementById("editCategoriaId").value = categoriaId
        document.getElementById("editCategoriaNombre").value = categoria.nombre || ""
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

      // Mostrar modal de edición
      const modal = document.getElementById("editProveedorModal")
      if (modal) {
        modal.style.display = "block"

        // Llenar formulario con datos del proveedor
        document.getElementById("editProveedorId").value = proveedorId
        document.getElementById("editProveedorNombre").value = proveedor.nombre || ""
        document.getElementById("editProveedorContacto").value = proveedor.contacto || ""
        document.getElementById("editProveedorTelefono").value = proveedor.telefono || ""
        document.getElementById("editProveedorEmail").value = proveedor.email || ""
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

// Función para confirmar eliminación de una categoría
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

    // Configurar evento para el botón de confirmar
    const handleConfirm = async () => {
      try {
        await deleteCategoria(categoriaId)
        confirmModal.style.display = "none"

        // Remover el evento para evitar duplicados
        confirmOk.removeEventListener("click", handleConfirm)
      } catch (error) {
        console.error("Error al eliminar categoría:", error)
        showToast("Error al eliminar la categoría", "danger")
        confirmModal.style.display = "none"

        // Remover el evento para evitar duplicados
        confirmOk.removeEventListener("click", handleConfirm)
      }
    }

    // Remover eventos anteriores y agregar el nuevo
    confirmOk.removeEventListener("click", handleConfirm)
    confirmOk.addEventListener("click", handleConfirm)
  }
}

// Función para confirmar eliminación de un proveedor
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

    // Configurar evento para el botón de confirmar
    const handleConfirm = async () => {
      try {
        await deleteProveedor(proveedorId)
        confirmModal.style.display = "none"

        // Remover el evento para evitar duplicados
        confirmOk.removeEventListener("click", handleConfirm)
      } catch (error) {
        console.error("Error al eliminar proveedor:", error)
        showToast("Error al eliminar el proveedor", "danger")
        confirmModal.style.display = "none"

        // Remover el evento para evitar duplicados
        confirmOk.removeEventListener("click", handleConfirm)
      }
    }

    // Remover eventos anteriores y agregar el nuevo
    confirmOk.removeEventListener("click", handleConfirm)
    confirmOk.addEventListener("click", handleConfirm)
  }
}

// Función para eliminar una categoría
async function deleteCategoria(categoriaId) {
  try {
    // Verificar si hay productos asociados a esta categoría
    const productosQuery = query(collection(db, "productos"), where("categoriaId", "==", categoriaId))

    const productosSnapshot = await getDocs(productosQuery)

    if (!productosSnapshot.empty) {
      showToast("No se puede eliminar la categoría porque hay productos asociados", "warning")
      return
    }

    await deleteDoc(doc(db, "categorias", categoriaId))
    showToast("Categoría eliminada correctamente", "success")

    // Recargar categorías
    await loadCategorias()
    loadCategoriasToModal()
  } catch (error) {
    console.error("Error al eliminar categoría:", error)
    throw error
  }
}

// Función para eliminar un proveedor
async function deleteProveedor(proveedorId) {
  try {
    // Verificar si hay productos asociados a este proveedor
    const productosQuery = query(collection(db, "productos"), where("proveedorId", "==", proveedorId))

    const productosSnapshot = await getDocs(productosQuery)

    if (!productosSnapshot.empty) {
      showToast("No se puede eliminar el proveedor porque hay productos asociados", "warning")
      return
    }

    // Verificar si hay armazones asociados a este proveedor
    const armazonesQuery = query(collection(db, "armazones"), where("proveedorId", "==", proveedorId))

    const armazonesSnapshot = await getDocs(armazonesQuery)

    if (!armazonesSnapshot.empty) {
      showToast("No se puede eliminar el proveedor porque hay armazones asociados", "warning")
      return
    }

    await deleteDoc(doc(db, "proveedores", proveedorId))
    showToast("Proveedor eliminado correctamente", "success")

    // Recargar proveedores
    await loadProveedores()
    loadProveedoresToModal()
  } catch (error) {
    console.error("Error al eliminar proveedor:", error)
    throw error
  }
}

// Función para configurar los eventos de filtro
function setupFilterEvents() {
  const filterProductoTipoSelect = document.getElementById("filterProductoTipo")
  const filterProductoCategoriaSelect = document.getElementById("filterProductoCategoria")
  const filterProductoProveedorSelect = document.getElementById("filterProductoProveedor")
  const filterProductoPrecioMinInput = document.getElementById("filterProductoPrecioMin")
  const filterProductoPrecioMaxInput = document.getElementById("filterProductoPrecioMax")

  const filterArmazonMarcaSelect = document.getElementById("filterArmazonMarca")
  const filterArmazonMaterialSelect = document.getElementById("filterArmazonMaterial")
  const filterArmazonProveedorSelect = document.getElementById("filterArmazonProveedor")
  const filterArmazonPrecioMinInput = document.getElementById("filterArmazonPrecioMin")
  const filterArmazonPrecioMaxInput = document.getElementById("filterArmazonPrecioMax")

  if (filterProductoTipoSelect) {
    filterProductoTipoSelect.addEventListener("change", () => {
      filtrosProductos.tipo = filterProductoTipoSelect.value
      loadProductos()
    })
  }

  if (filterProductoCategoriaSelect) {
    filterProductoCategoriaSelect.addEventListener("change", () => {
      filtrosProductos.categoria = filterProductoCategoriaSelect.value
      loadProductos()
    })
  }

  if (filterProductoProveedorSelect) {
    filterProductoProveedorSelect.addEventListener("change", () => {
      filtrosProductos.proveedor = filterProductoProveedorSelect.value
      loadProductos()
    })
  }

  if (filterProductoPrecioMinInput) {
    filterProductoPrecioMinInput.addEventListener("input", () => {
      filtrosProductos.precioMin = filterProductoPrecioMinInput.value
      loadProductos()
    })
  }

  if (filterProductoPrecioMaxInput) {
    filterProductoPrecioMaxInput.addEventListener("input", () => {
      filtrosProductos.precioMax = filterProductoPrecioMaxInput.value
      loadProductos()
    })
  }

  if (filterArmazonMarcaSelect) {
    filterArmazonMarcaSelect.addEventListener("change", () => {
      filtrosArmazones.marca = filterArmazonMarcaSelect.value
      loadArmazones()
    })
  }

  if (filterArmazonMaterialSelect) {
    filterArmazonMaterialSelect.addEventListener("change", () => {
      filtrosArmazones.material = filterArmazonMaterialSelect.value
      loadArmazones()
    })
  }

  if (filterArmazonProveedorSelect) {
    filterArmazonProveedorSelect.addEventListener("change", () => {
      filtrosArmazones.proveedor = filterArmazonProveedorSelect.value
      loadArmazones()
    })
  }

  if (filterArmazonPrecioMinInput) {
    filterArmazonPrecioMinInput.addEventListener("input", () => {
      filtrosArmazones.precioMin = filterArmazonPrecioMinInput.value
      loadArmazones()
    })
  }

  if (filterArmazonPrecioMaxInput) {
    filterArmazonPrecioMaxInput.addEventListener("input", () => {
      filtrosArmazones.precioMax = filterArmazonPrecioMaxInput.value
      loadArmazones()
    })
  }
}

// Función para configurar los eventos de búsqueda
function setupSearchEvents() {
  const searchProductoInput = document.getElementById("searchProducto")
  const searchArmazonInput = document.getElementById("searchArmazon")

  if (searchProductoInput) {
    searchProductoInput.addEventListener("input", () => {
      filtrosProductos.busqueda = searchProductoInput.value
      loadProductos()
    })
  }

  if (searchArmazonInput) {
    searchArmazonInput.addEventListener("input", () => {
      filtrosArmazones.busqueda = searchArmazonInput.value
      loadArmazones()
    })
  }
}

// Función para cargar productos
async function loadProductos() {
  const productosTableBody = document.getElementById("productosTableBody")
  if (!productosTableBody) return

  try {
    productosTableBody.innerHTML = '<tr><td colspan="11" class="py-4 text-center">Cargando productos...</td></tr>'

    let productosQuery = collection(db, "productos")
    const queryConstraints = []

    if (filtrosProductos.tipo) {
      queryConstraints.push(where("tipo", "==", filtrosProductos.tipo))
    }

    if (filtrosProductos.categoria) {
      queryConstraints.push(where("categoriaId", "==", filtrosProductos.categoria))
    }

    if (filtrosProductos.proveedor) {
      queryConstraints.push(where("proveedorId", "==", filtrosProductos.proveedor))
    }

    if (filtrosProductos.precioMin) {
      queryConstraints.push(where("precioVenta", ">=", Number.parseFloat(filtrosProductos.precioMin)))
    }

    if (filtrosProductos.precioMax) {
      queryConstraints.push(where("precioVenta", "<=", Number.parseFloat(filtrosProductos.precioMax)))
    }

    if (filtrosProductos.busqueda) {
      const searchTerm = filtrosProductos.busqueda.toLowerCase()
      queryConstraints.push(where("nombre", ">=", searchTerm))
      queryConstraints.push(where("nombre", "<=", searchTerm + "\uf8ff"))
    }

    productosQuery = query(productosQuery, ...queryConstraints)

    const productosSnapshot = await getDocs(productosQuery)

    if (productosSnapshot.empty) {
      productosTableBody.innerHTML =
        '<tr><td colspan="11" class="py-4 text-center">No hay productos registrados</td></tr>'
      return
    }

    productosTableBody.innerHTML = ""

    productosSnapshot.forEach((doc) => {
      const producto = doc.data()
      const row = document.createElement("tr")
      row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

      row.innerHTML = `
                <td class="py-3 px-4">${producto.codigo || ""}</td>
                <td class="py-3 px-4">${producto.nombre || ""}</td>
                <td class="py-3 px-4">${producto.descripcion || ""}</td>
                <td class="py-3 px-4">${producto.tipo || ""}</td>
                <td class="py-3 px-4">${categorias.find((cat) => cat.id === producto.categoriaId)?.nombre || ""}</td>
                <td class="py-3 px-4">${proveedores.find((prov) => prov.id === producto.proveedorId)?.nombre || ""}</td>
                <td class="py-3 px-4">${producto.precioVenta || ""}</td>
                <td class="py-3 px-4">${producto.stock || ""}</td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        <button class="edit-producto text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${doc.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button class="delete-producto text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${doc.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            `

      productosTableBody.appendChild(row)
    })

    // Configurar eventos para los botones de editar y eliminar
    setupProductoEvents()
  } catch (error) {
    console.error("Error al cargar productos:", error)
    productosTableBody.innerHTML =
      '<tr><td colspan="11" class="py-4 text-center text-red-500">Error al cargar productos</td></tr>'
  }
}

// Función para cargar armazones
async function loadArmazones() {
  const armazonesTableBody = document.getElementById("armazonesTableBody")
  if (!armazonesTableBody) return

  try {
    armazonesTableBody.innerHTML = '<tr><td colspan="12" class="py-4 text-center">Cargando armazones...</td></tr>'

    let armazonesQuery = collection(db, "armazones")
    const queryConstraints = []

    if (filtrosArmazones.marca) {
      queryConstraints.push(where("marca", "==", filtrosArmazones.marca))
    }

    if (filtrosArmazones.material) {
      queryConstraints.push(where("materiales", "array-contains", filtrosArmazones.material))
    }

    if (filtrosArmazones.proveedor) {
      queryConstraints.push(where("proveedorId", "==", filtrosArmazones.proveedor))
    }

    if (filtrosArmazones.precioMin) {
      queryConstraints.push(where("precioVenta", ">=", Number.parseFloat(filtrosArmazones.precioMin)))
    }

    if (filtrosArmazones.precioMax) {
      queryConstraints.push(where("precioVenta", "<=", Number.parseFloat(filtrosArmazones.precioMax)))
    }

    if (filtrosArmazones.busqueda) {
      const searchTerm = filtrosArmazones.busqueda.toLowerCase()
      queryConstraints.push(where("nombre", ">=", searchTerm))
      queryConstraints.push(where("nombre", "<=", searchTerm + "\uf8ff"))
    }

    armazonesQuery = query(armazonesQuery, ...queryConstraints)

    const armazonesSnapshot = await getDocs(armazonesQuery)

    if (armazonesSnapshot.empty) {
      armazonesTableBody.innerHTML =
        '<tr><td colspan="12" class="py-4 text-center">No hay armazones registrados</td></tr>'
      return
    }

    armazonesTableBody.innerHTML = ""

    armazonesSnapshot.forEach((doc) => {
      const armazon = doc.data()
      const row = document.createElement("tr")
      row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

      row.innerHTML = `
                <td class="py-3 px-4">${armazon.codigo || ""}</td>
                <td class="py-3 px-4">${armazon.nombre || ""}</td>
                <td class="py-3 px-4">${armazon.marca || ""}</td>
                <td class="py-3 px-4">${armazon.modelo || ""}</td>
                <td class="py-3 px-4">${armazon.colores?.join(", ") || ""}</td>
                <td class="py-3 px-4">${armazon.materiales?.join(", ") || ""}</td>
                <td class="py-3 px-4">${proveedores.find((prov) => prov.id === armazon.proveedorId)?.nombre || ""}</td>
                <td class="py-3 px-4">${armazon.precioVenta || ""}</td>
                <td class="py-3 px-4">${armazon.stock || ""}</td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        <button class="edit-armazon text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${doc.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button class="delete-armazon text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${doc.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            `

      armazonesTableBody.appendChild(row)
    })

    // Configurar eventos para los botones de editar y eliminar
    setupArmazonEvents()
  } catch (error) {
    console.error("Error al cargar armazones:", error)
    armazonesTableBody.innerHTML =
      '<tr><td colspan="12" class="py-4 text-center text-red-500">Error al cargar armazones</td></tr>'
  }
}

// Función para cargar valores únicos para los filtros
async function loadUniqueValues() {
  try {
    // Marcas de armazones
    const marcasSet = new Set()
    const armazonesSnapshot = await getDocs(collection(db, "armazones"))
    armazonesSnapshot.forEach((doc) => {
      const armazon = doc.data()
      if (armazon.marca) {
        marcasSet.add(armazon.marca)
      }
    })
    marcasArmazones = Array.from(marcasSet)

    // Materiales de armazones
    const materialesSet = new Set()
    armazonesSnapshot.forEach((doc) => {
      const armazon = doc.data()
      if (armazon.materiales) {
        armazon.materiales.forEach((material) => materialesSet.add(material))
      }
    })
    materialesArmazones = Array.from(materialesSet)

    // Colores de armazones
    const coloresSet = new Set()
    armazonesSnapshot.forEach((doc) => {
      const armazon = doc.data()
      if (armazon.colores) {
        armazon.colores.forEach((color) => coloresSet.add(color))
      }
    })
    coloresArmazones = Array.from(coloresSet)

    // Actualizar los selectores de filtros
    const filterArmazonMarcaSelect = document.getElementById("filterArmazonMarca")
    const filterArmazonMaterialSelect = document.getElementById("filterArmazonMaterial")

    if (filterArmazonMarcaSelect) {
      filterArmazonMarcaSelect.innerHTML = '<option value="">Todas</option>'
      marcasArmazones.forEach((marca) => {
        const option = document.createElement("option")
        option.value = marca
        option.textContent = marca
        filterArmazonMarcaSelect.appendChild(option)
      })
    }

    if (filterArmazonMaterialSelect) {
      filterArmazonMaterialSelect.innerHTML = '<option value="">Todos</option>'
      materialesArmazones.forEach((material) => {
        const option = document.createElement("option")
        option.value = material
        option.textContent = material
        filterArmazonMaterialSelect.appendChild(option)
      })
    }

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

// Función para verificar productos con stock bajo
function checkLowStockItems() {
  // Verificar productos
  const productosQuery = query(collection(db, "productos"), where("stock", "<=", CONFIG.STOCK_MINIMO_PRODUCTO))

  getDocs(productosQuery)
    .then((productosSnapshot) => {
      productosSnapshot.forEach((doc) => {
        const producto = doc.data()
        // Solo crear notificaciones, no mostrar modales
        if (producto.stock === 0) {
          // Verificar si ya existe una notificación para este producto
          notificationSystem.checkProductStock(producto)
        } else if (producto.stock <= CONFIG.STOCK_CRITICO_PRODUCTO) {
          notificationSystem.checkProductStock(producto)
        } else if (producto.stock <= CONFIG.STOCK_MINIMO_PRODUCTO) {
          notificationSystem.checkProductStock(producto)
        }
      })
    })
    .catch((error) => {
      console.error("Error al verificar productos con stock bajo:", error)
    })

  // Verificar armazones
  const armazonesQuery = query(collection(db, "armazones"), where("stock", "<=", CONFIG.STOCK_MINIMO_ARMAZON))

  getDocs(armazonesQuery)
    .then((armazonesSnapshot) => {
      armazonesSnapshot.forEach((doc) => {
        const armazon = doc.data()
        // Solo crear notificaciones, no mostrar modales
        if (armazon.stock === 0) {
          notificationSystem.checkArmazonStock(armazon)
        } else if (armazon.stock <= CONFIG.STOCK_CRITICO_ARMAZON) {
          notificationSystem.checkArmazonStock(armazon)
        } else if (armazon.stock <= CONFIG.STOCK_MINIMO_ARMAZON) {
          notificationSystem.checkArmazonStock(armazon)
        }
      })
    })
    .catch((error) => {
      console.error("Error al verificar armazones con stock bajo:", error)
    })
}

// Función para mostrar el modal de producto agotado
function showOutOfStockModal(nombreProducto, stock, tipo, id) {
  const outOfStockModal = document.getElementById("outOfStockModal")
  const outOfStockTitle = document.getElementById("outOfStockTitle")
  const outOfStockMessage = document.getElementById("outOfStockMessage")
  const keepProduct = document.getElementById("keepProduct")
  const removeProduct = document.getElementById("removeProduct")

  if (outOfStockModal && outOfStockTitle && outOfStockMessage && keepProduct && removeProduct) {
    outOfStockTitle.textContent = `¡Stock Crítico!`
    outOfStockMessage.textContent = `El ${tipo} ${nombreProducto} tiene un stock de ${stock}. ¿Qué desea hacer?`

    outOfStockModal.style.display = "block"

    // Configurar evento para el botón de mantener
    keepProduct.addEventListener("click", () => {
      outOfStockModal.style.display = "none"
    })

    // Configurar evento para el botón de eliminar
    removeProduct.addEventListener("click", async () => {
      try {
        if (tipo === "producto") {
          await deleteDoc(doc(db, "productos", id))
          showToast("Producto eliminado correctamente", "success")
          await loadProductos()
        } else if (tipo === "armazon") {
          await deleteDoc(doc(db, "armazones", id))
          showToast("Armazón eliminado correctamente", "success")
          await loadArmazones()
        }

        outOfStockModal.style.display = "none"
      } catch (error) {
        console.error("Error al eliminar producto:", error)
        showToast("Error al eliminar el producto", "danger")
      }
    })
  }
}

// Función para configurar eventos para los productos
function setupProductoEvents() {
  // Configurar botones para editar productos
  const editButtons = document.querySelectorAll(".edit-producto")
  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const productoId = button.getAttribute("data-id")
      editProducto(productoId)
    })
  })

  // Configurar botones para eliminar productos
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
  // Configurar botones para editar armazones
  const editButtons = document.querySelectorAll(".edit-armazon")
  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const armazonId = button.getAttribute("data-id")
      editArmazon(armazonId)
    })
  })

  // Configurar botones para eliminar armazones
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
    const docRef = doc(db, "productos", productoId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const producto = docSnap.data()

      // Mostrar modal de producto
      const modal = document.getElementById("productoModal")
      if (modal) {
        modal.style.display = "block"
        document.getElementById("productoModalTitle").textContent = "Editar Producto"

        // Llenar formulario con datos del producto
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

        // Ocultar mensaje de error
        const errorMessage = document.getElementById("error-message")
        if (errorMessage) {
          errorMessage.classList.add("hidden")
          errorMessage.textContent = ""
        }
      }
    } else {
      console.error("No se encontró el producto")
      showToast("No se encontró el producto", "danger")
    }
  } catch (error) {
    console.error("Error al obtener producto:", error)
    showToast("Error al obtener el producto", "danger")
  }
}

// Función para editar un armazón
async function editArmazon(armazonId) {
  try {
    const docRef = doc(db, "armazones", armazonId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const armazon = docSnap.data()

      // Mostrar modal de armazón
      const modal = document.getElementById("armazonModal")
      if (modal) {
        modal.style.display = "block"
        document.getElementById("armazonModalTitle").textContent = "Editar Armazón"

        // Llenar formulario con datos del armazón
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

        // Cargar colores y materiales
        coloresSeleccionados = armazon.colores || []
        materialesSeleccionados = armazon.materiales || []
        actualizarColoresUI()
        actualizarMaterialesUI()

        // Ocultar mensaje de error
        const errorMessage = document.getElementById("armazon-error-message")
        if (errorMessage) {
          errorMessage.classList.add("hidden")
          errorMessage.textContent = ""
        }
      }
    } else {
      console.error("No se encontró el armazón")
      showToast("No se encontró el armazón", "danger")
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

    // Configurar evento para el botón de confirmar
    const handleConfirm = async () => {
      try {
        await deleteProducto(productoId)
        confirmModal.style.display = "none"

        // Remover el evento para evitar duplicados
        confirmOk.removeEventListener("click", handleConfirm)
      } catch (error) {
        console.error("Error al eliminar producto:", error)
        showToast("Error al eliminar el producto", "danger")
        confirmModal.style.display = "none"

        // Remover el evento para evitar duplicados
        confirmOk.removeEventListener("click", handleConfirm)
      }
    }

    // Remover eventos anteriores y agregar el nuevo
    confirmOk.removeEventListener("click", handleConfirm)
    confirmOk.addEventListener("click", handleConfirm)
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

    // Configurar evento para el botón de confirmar
    const handleConfirm = async () => {
      try {
        await deleteArmazon(armazonId)
        confirmModal.style.display = "none"

        // Remover el evento para evitar duplicados
        confirmOk.removeEventListener("click", handleConfirm)
      } catch (error) {
        console.error("Error al eliminar armazón:", error)
        showToast("Error al eliminar el armazón", "danger")
        confirmModal.style.display = "none"

        // Remover el evento para evitar duplicados
        confirmOk.removeEventListener("click", handleConfirm)
      }
    }

    // Remover eventos anteriores y agregar el nuevo
    confirmOk.removeEventListener("click", handleConfirm)
    confirmOk.addEventListener("click", handleConfirm)
  }
}

// Función para eliminar un producto
async function deleteProducto(productoId) {
  try {
    await deleteDoc(doc(db, "productos", productoId))
    showToast("Producto eliminado correctamente", "success")

    // Recargar productos
    await loadProductos()
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

    // Recargar armazones
    await loadArmazones()

    // Actualizar valores únicos para filtros
    await loadUniqueValues()
  } catch (error) {
    console.error("Error al eliminar armazón:", error)
    throw error
  }
}

// Función para actualizar la interfaz de usuario de colores
function actualizarColoresUI() {
  const coloresContainer = document.getElementById("coloresSeleccionados")
  if (!coloresContainer) return

  coloresContainer.innerHTML = ""

  coloresSeleccionados.forEach((color) => {
    const colorElement = document.createElement("span")
    colorElement.className = "inline-block bg-blue-500 text-white py-1 px-2 rounded mr-2 mb-2"
    colorElement.textContent = color

    // Agregar botón para eliminar el color
    const deleteButton = document.createElement("button")
    deleteButton.textContent = "x"
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

    // Agregar botón para eliminar el material
    const deleteButton = document.createElement("button")
    deleteButton.textContent = "x"
    deleteButton.className = "ml-1 text-red-500 hover:text-red-700 focus:outline-none"
    deleteButton.addEventListener("click", () => {
      materialesSeleccionados = materialesSeleccionados.filter((m) => m !== material)
      actualizarMaterialesUI()
    })

    materialElement.appendChild(deleteButton)
    materialesContainer.appendChild(materialElement)
  })
}