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
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

import { db } from "./firebase-config.js"

// Variables globales
let empresas = []
let clientes = []
let miembros = []
let currentEmpresaId = null
const currentMiembroId = null

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

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Página de convenios cargada")

  try {
    // Verificar y crear colecciones necesarias
    await checkAndCreateConveniosCollection()

    // Cargar datos necesarios
    await Promise.all([loadEmpresas(), loadClientes(), loadMiembros()])

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
  } catch (error) {
    console.error("Error al inicializar la página de convenios:", error)
    showToast("Error al cargar la página de convenios", "danger")
  }

  // Configurar evento para el botón "addClienteFromMiembroBtn"
  const addClienteFromMiembroBtn = document.getElementById("addClienteFromMiembroBtn")
  if (addClienteFromMiembroBtn) {
    addClienteFromMiembroBtn.addEventListener("click", () => {
      // Mostrar modal de cliente (reutilizar el modal existente de clientes.html)
      const modal = document.getElementById("clientModal")
      if (modal) {
        modal.style.display = "block"
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
        await loadClientes()
      }, 500)
    })
  }
})

// Función para verificar y crear colecciones necesarias
async function checkAndCreateConveniosCollection() {
  try {
    console.log("Verificando colecciones de convenios...")

    // Verificar si existe la colección de empresas
    const empresasSnapshot = await getDocs(collection(db, "empresas"))
    if (empresasSnapshot.empty) {
      console.log("Creando colección de empresas...")
      // No es necesario crear un documento placeholder
    }

    // Verificar si existe la colección de miembros
    const miembrosSnapshot = await getDocs(collection(db, "miembrosConvenio"))
    if (miembrosSnapshot.empty) {
      console.log("Creando colección de miembros de convenio...")
      // No es necesario crear un documento placeholder
    }

    // Verificar si existe la colección de pagos de convenio
    const pagosSnapshot = await getDocs(collection(db, "pagosConvenio"))
    if (pagosSnapshot.empty) {
      console.log("Creando colección de pagos de convenio...")
      // No es necesario crear un documento placeholder
    }

    console.log("Verificación de colecciones de convenios completada")
  } catch (error) {
    console.error("Error al verificar o crear colecciones de convenios:", error)
    throw error
  }
}

// Función para cargar empresas
async function loadEmpresas(searchTerm = "") {
  try {
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

    // Filtrar por término de búsqueda si existe
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      empresas = empresas.filter(
        (empresa) =>
          (empresa.nombre && empresa.nombre.toLowerCase().includes(term)) ||
          (empresa.contacto && empresa.contacto.toLowerCase().includes(term)),
      )
    }

    // Actualizar tabla de empresas
    updateEmpresasTable()

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

// Función para cargar miembros de convenios
async function loadMiembros(filters = {}) {
  try {
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

    // Filtrar por término de búsqueda si existe (en memoria)
    if (filters.busqueda) {
      const term = filters.busqueda.toLowerCase()
      miembros = miembros.filter((miembro) => {
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

    // Actualizar tabla de miembros
    updateMiembrosTable()

    console.log("Miembros cargados:", miembros.length)
    return miembros
  } catch (error) {
    console.error("Error al cargar miembros:", error)
    showToast("Error al cargar miembros", "danger")
    return []
  }
}

// Escuchar el evento personalizado para recargar empresas y miembros
// Escuchar el evento personalizado para recargar empresas y miembros
window.addEventListener("miembroConvenioAgregado", async () => {
  await loadMiembros();   // Primero actualiza la lista global de miembros
  await loadEmpresas();   // Luego actualiza la tabla de empresas (que usa la variable miembros)
});

// Función para actualizar la tabla de empresas
function updateEmpresasTable() {
  const tableBody = document.getElementById("empresasTableBody")
  if (!tableBody) return

  // Limpiar tabla
  tableBody.innerHTML = ""

  if (empresas.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" class="py-4 text-center">No se encontraron empresas</td></tr>'
    return
  }

  // Agregar empresas a la tabla
  empresas.forEach((empresa) => {
    // Contar sucursales
    const sucursales = empresa.sucursales || []

    // Contar miembros
    const miembrosCount = miembros.filter((m) => m.empresaId === empresa.id).length

    const row = document.createElement("tr")
    row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

    row.innerHTML = `
      <td class="py-3 px-4">${empresa.nombre || "-"}</td>
      <td class="py-3 px-4">${empresa.contacto || "-"}</td>
      <td class="py-3 px-4">${empresa.telefono || "-"}</td>
      <td class="py-3 px-4">${empresa.email || "-"}</td>
      <td class="py-3 px-4">${empresa.descuento || 40}%</td>
      <td class="py-3 px-4">$${empresa.saldo || 0}</td>
      <td class="py-3 px-4">${sucursales.length}</td>
      <td class="py-3 px-4">${miembrosCount}</td>
      <td class="py-3 px-4">
        <div class="flex space-x-2">
          <button class="view-empresa text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${empresa.id}" title="Ver detalles">
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

  if (miembros.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="11" class="py-4 text-center">No se encontraron miembros</td></tr>'
    return
  }

  // Agregar miembros a la tabla
  miembros.forEach((miembro) => {
    // Obtener nombre de la empresa
    const empresa = empresas.find((e) => e.id === miembro.empresaId)
    const empresaNombre = empresa ? empresa.nombre : "Empresa no encontrada"

    // Obtener nombre del cliente
    const cliente = clientes.find((c) => c.id === miembro.clienteId)
    const clienteNombre = cliente ? cliente.nombre : "Cliente no encontrado"

    // Formatear fecha de registro
    let fechaRegistroText = "No disponible"
    if (miembro.fechaRegistro) {
      const fecha =
        miembro.fechaRegistro instanceof Timestamp ? miembro.fechaRegistro.toDate() : new Date(miembro.fechaRegistro)
      fechaRegistroText = fecha.toLocaleDateString()
    }

    // Formatear fecha de pago
    let fechaPagoText = "No disponible"
    if (miembro.fechaPago) {
      const fecha = miembro.fechaPago instanceof Timestamp ? miembro.fechaPago.toDate() : new Date(miembro.fechaPago)
      fechaPagoText = fecha.toLocaleDateString()
    }

    const row = document.createElement("tr")
    row.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

    row.innerHTML = `
      <td class="py-3 px-4">${empresaNombre}</td>
      <td class="py-3 px-4">${miembro.sucursal || "-"}</td>
      <td class="py-3 px-4">${fechaRegistroText}</td>
      <td class="py-3 px-4">${miembro.referencia || "-"}</td>
      <td class="py-3 px-4">${clienteNombre}</td>
      <td class="py-3 px-4">${miembro.metodoPago || "-"}</td>
      <td class="py-3 px-4">${miembro.factura || "-"}</td>
      <td class="py-3 px-4">${fechaPagoText}</td>
      <td class="py-3 px-4">
        <span class="status-${miembro.estado || "pendiente"}">${miembro.estado === "pagado" ? "Pagado" : "Pendiente"}</span>
      </td>
      <td class="py-3 px-4">$${(miembro.saldo || 0).toFixed(2)}</td>
      <td class="py-3 px-4">
        <div class="flex space-x-2">
          <button class="edit-miembro text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" data-id="${miembro.id}" title="Editar">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button class="register-payment text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${miembro.id}" title="Registrar pago">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
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

    // Agregar un input de búsqueda
    const searchInput = document.createElement("input")
    searchInput.type = "text"
    searchInput.placeholder = "Buscar cliente..."
    searchInput.className =
      "w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600"

    // Agregar evento para filtrar clientes
    searchInput.addEventListener("input", () => {
      const searchTerm = searchInput.value.toLowerCase()
      miembroCliente.innerHTML = '<option value="">Seleccione un cliente</option>'
      clientes.forEach((cliente) => {
        if (cliente.nombre.toLowerCase().includes(searchTerm)) {
          const option = document.createElement("option")
          option.value = cliente.id
          option.textContent = cliente.nombre
          miembroCliente.appendChild(option)
        }
      })
    })

    // Agregar input de búsqueda al formulario
    miembroCliente.parentNode.insertBefore(searchInput, miembroCliente)

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
  const tabButtons = document.querySelectorAll(".tab-btn")
  const tabContents = document.querySelectorAll(".tab-content")

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Remover clase active de todos los botones
      tabButtons.forEach((btn) => {
        btn.classList.remove("active")
        const span = btn.querySelector("span")
        if (span) span.classList.add("opacity-0")
      })

      // Agregar clase active al botón clickeado
      button.classList.add("active")
      const span = button.querySelector("span")
      if (span) span.classList.remove("opacity-0")

      // Mostrar el contenido de la pestaña correspondiente
      const tabId = button.getAttribute("data-tab")
      tabContents.forEach((content) => {
        content.style.display = content.id === `${tabId}-tab` ? "block" : "none"
      })
    })
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

  // Configurar evento para cambiar empresa en el formulario de miembro
  const miembroEmpresa = document.getElementById("miembroEmpresa")
  const miembroSucursal = document.getElementById("miembroSucursal")
  if (miembroEmpresa && miembroSucursal) {
    miembroEmpresa.addEventListener("change", () => {
      const empresaId = miembroEmpresa.value

      // Habilitar/deshabilitar selector de sucursal
      miembroSucursal.disabled = !empresaId
      miembroSucursal.innerHTML = '<option value="">Seleccione una sucursal</option>'

      if (empresaId) {
        // Buscar empresa
        const empresa = empresas.find((e) => e.id === empresaId)
        if (empresa && empresa.sucursales) {
          // Agregar sucursales al selector
          empresa.sucursales.forEach((sucursal) => {
            const option = document.createElement("option")
            option.value = sucursal
            option.textContent = sucursal
            miembroSucursal.appendChild(option)
          })
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
        document.getElementById("detalleEmpresaModal").style.display = "none"
        // Abrir modal de edición
        editEmpresa(currentEmpresaId)
      }
    })
  }

  if (detalleAddMiembroBtn) {
    detalleAddMiembroBtn.addEventListener("click", () => {
      if (currentEmpresaId) {
        // Cerrar modal de detalle
        document.getElementById("detalleEmpresaModal").style.display = "none"
        // Abrir modal de nuevo miembro con la empresa preseleccionada
        const modal = document.getElementById("miembroModal")
        if (modal) {
          modal.style.display = "block"
          document.getElementById("miembroModalTitle").textContent = "Nuevo Miembro"
          document.getElementById("miembroForm").reset()
          document.getElementById("miembroId").value = ""

          // Establecer fecha actual
          const today = new Date()
          const year = today.getFullYear()
          const month = String(today.getMonth() + 1).padStart(2, "0")
          const day = String(today.getDate()).padStart(2, "0")
          document.getElementById("miembroFechaRegistro").value = `${year}-${month}-${day}`

          // Preseleccionar empresa
          document.getElementById("miembroEmpresa").value = currentEmpresaId

          // Disparar evento change para cargar sucursales
          const event = new Event("change")
          document.getElementById("miembroEmpresa").dispatchEvent(event)
        }
      }
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
        const saldo = Number.parseFloat(document.getElementById("empresaSaldo").value) || 0
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
          saldo,
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
        let clienteId = document.getElementById("miembroCliente").value
        const referencia = document.getElementById("miembroReferencia").value
        const fechaRegistro = document.getElementById("miembroFechaRegistro").value
        const notas = document.getElementById("miembroNotas").value

        // Si no se selecciona un cliente, crear uno nuevo
        if (!clienteId) {
          // Mostrar modal de cliente (reutilizar el modal existente de clientes.html)
          const modal = document.getElementById("clientModal")
          if (modal) {
            modal.style.display = "block"
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

            // Agregar un evento al formulario de cliente para capturar el ID del nuevo cliente
            const clientForm = document.getElementById("clientForm")
            clientForm.addEventListener("submit", async (e) => {
              // Espera un pequeño tiempo para que el cliente se guarde y el modal se cierre
              setTimeout(async () => {
                await loadClientes()
                const newCliente = clientes.find((c) => c.nombre === document.getElementById("clientName").value)
                if (newCliente) {
                  clienteId = newCliente.id
                  // Crear objeto de miembro
                  const miembroData = {
                    empresaId,
                    sucursal,
                    clienteId,
                    referencia: referencia || "",
                    fechaRegistro: fechaRegistro ? new Date(fechaRegistro) : new Date(),
                    notas: notas || "",
                    estado: "pendiente",
                    saldo: 0,
                    updatedAt: serverTimestamp(),
                  }

                  if (!miembroId) {
                    // Agregar nuevo miembro
                    miembroData.createdAt = serverTimestamp()

                    // Agregar miembro
                    const miembroRef = await addDoc(collection(db, "miembrosConvenio"), miembroData)

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

                  // Recargar miembros
                  await loadMiembros()

                  // Recargar clientes para actualizar información de convenios
                  await loadClientes()

                  // Recargar empresas
                  await loadEmpresas()
                }
              }, 500)
            })
          }
          return
        }

        // Actualizar el estado del convenio del cliente
        await updateClientConvenioStatus(clienteId)

        // Validar campos requeridos
        if (!empresaId || !sucursal || !clienteId || !fechaRegistro) {
          showToast("Por favor, complete los campos requeridos", "warning")
          return
        }

        // Crear objeto de miembro
        const miembroData = {
          empresaId,
          sucursal,
          clienteId,
          referencia: referencia || "",
          fechaRegistro: fechaRegistro ? new Date(fechaRegistro) : new Date(),
          notas: notas || "",
          estado: "pendiente",
          saldo: 0,
          updatedAt: serverTimestamp(),
        }

        if (!miembroId) {
          // Agregar nuevo miembro
          miembroData.createdAt = serverTimestamp()

          // Agregar miembro
          const miembroRef = await addDoc(collection(db, "miembrosConvenio"), miembroData)

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

        // Recargar miembros
        await loadMiembros()

        // Recargar clientes para actualizar información de convenios
        await loadClientes()

        // Recargar empresas
        await loadEmpresas()
      } catch (error) {
        console.error("Error al guardar miembro:", error)
        showToast("Error al guardar el miembro", "danger")
      }
    })
  }

  // Configurar formulario de pago
  const pagoForm = document.getElementById("pagoForm")
  if (pagoForm) {
    pagoForm.addEventListener("submit", async (e) => {
      e.preventDefault()

      try {
        const miembroId = document.getElementById("pagoMiembroId").value
        const monto = Number.parseFloat(document.getElementById("pagoMonto").value) || 0
        const fecha = document.getElementById("pagoFecha").value
        const metodo = document.getElementById("pagoMetodo").value
        const factura = document.getElementById("pagoFactura").value
        const notas = document.getElementById("pagoNotas").value

        // Validar campos requeridos
        if (!miembroId || !monto || !fecha || !metodo) {
          showToast("Por favor, complete los campos requeridos", "warning")
          return
        }

        // Obtener miembro
        const miembroRef = doc(db, "miembrosConvenio", miembroId)
        const miembroDoc = await getDoc(miembroRef)

        if (!miembroDoc.exists()) {
          showToast("Miembro no encontrado", "danger")
          return
        }

        const miembro = miembroDoc.data()
        const saldoActual = miembro.saldo || 0

        // Validar que el monto no sea mayor al saldo
        if (monto > saldoActual) {
          showToast("El monto no puede ser mayor al saldo pendiente", "warning")
          return
        }

        // Crear objeto de pago
        const pagoData = {
          miembroId,
          empresaId: miembro.empresaId,
          clienteId: miembro.clienteId,
          monto,
          fecha: fecha ? new Date(fecha) : new Date(),
          metodoPago: metodo,
          factura: factura || "",
          notas: notas || "",
          createdAt: serverTimestamp(),
        }

        // Registrar pago
        await addDoc(collection(db, "pagosConvenio"), pagoData)

        // Actualizar saldo del miembro
        const nuevoSaldo = saldoActual - monto
        const nuevoEstado = nuevoSaldo <= 0 ? "pagado" : "pendiente"

        await updateDoc(miembroRef, {
          saldo: nuevoSaldo,
          estado: nuevoEstado,
          fechaPago: fecha ? new Date(fecha) : new Date(),
          metodoPago: metodo,
          factura: factura || "",
          updatedAt: serverTimestamp(),
        })

        showToast("Pago registrado correctamente", "success")

        // Cerrar modal
        document.getElementById("pagoModal").style.display = "none"

        // Recargar miembros
        await loadMiembros()
      } catch (error) {
        console.error("Error al registrar pago:", error)
        showToast("Error al registrar el pago", "danger")
      }
    })
  }
}

// Configurar eventos para las búsquedas
function setupSearchEvents() {
  // Búsqueda de empresas
  const searchEmpresaBtn = document.getElementById("searchEmpresaBtn")
  const searchEmpresa = document.getElementById("searchEmpresa")

  if (searchEmpresaBtn && searchEmpresa) {
    searchEmpresaBtn.addEventListener("click", () => {
      loadEmpresas(searchEmpresa.value.trim())
    })

    searchEmpresa.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        loadEmpresas(searchEmpresa.value.trim())
      }
    })
  }

  // Búsqueda de miembros
  const searchMiembroBtn = document.getElementById("searchMiembroBtn")
  const searchMiembro = document.getElementById("searchMiembro")

  if (searchMiembroBtn && searchMiembro) {
    searchMiembroBtn.addEventListener("click", () => {
      filtrosMiembros.busqueda = searchMiembro.value.trim()
      loadMiembros(filtrosMiembros)
    })

    searchMiembro.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        filtrosMiembros.busqueda = searchMiembro.value.trim()
        loadMiembros(filtrosMiembros)
      }
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
      loadMiembros(filtrosMiembros)
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
      loadMiembros(filtrosMiembros)
    })
  }

  // Actualizar sucursales al cambiarambiar empresa en filtros
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

  // Configurar botones para registrar pagos
  const paymentButtons = document.querySelectorAll(".register-payment")
  paymentButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const miembroId = button.getAttribute("data-id")
      registerPayment(miembroId)
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
        document.getElementById("detalleEmpresaSaldo").textContent = `$${(empresa.saldo || 0).toFixed(2)}`
        document.getElementById("detalleEmpresaDireccion").textContent = empresa.direccion || "No disponible"
        document.getElementById("detalleEmpresaNotas").textContent = empresa.notas || "No hay notas disponibles"

        // Mostrar sucursales
        const sucursalesContainer = document.getElementById("detalleSucursalesContainer")
        if (sucursalesContainer) {
          sucursalesContainer.innerHTML = ""

          if (empresa.sucursales && empresa.sucursales.length > 0) {
            empresa.sucursales.forEach((sucursal) => {
              const sucursalCard = document.createElement("div")
              sucursalCard.className = "bg-lightGray dark:bg-gray-700 p-3 rounded-lg"
              sucursalCard.innerHTML = `
                <p class="font-medium">${sucursal}</p>
              `
              sucursalesContainer.appendChild(sucursalCard)
            })
          } else {
            sucursalesContainer.innerHTML =
              '<p class="text-gray-500 dark:text-gray-400">No hay sucursales registradas</p>'
          }
        }

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

// Función para cargar miembros de una empresa
async function loadEmpresaMiembros(empresaId) {
  try {
    const miembrosRef = collection(db, "miembrosConvenio")
    const q = query(miembrosRef, where("empresaId", "==", empresaId), orderBy("fechaRegistro", "desc"))
    const querySnapshot = await getDocs(q)

    const miembrosBody = document.getElementById("detalleMiembrosBody")
    if (!miembrosBody) return

    // Limpiar tabla
    miembrosBody.innerHTML = ""

    if (querySnapshot.empty) {
      miembrosBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center">No hay miembros registrados</td></tr>'
      return
    }

    // Agregar miembros a la tabla
    querySnapshot.forEach((doc) => {
      const miembro = doc.data()
      miembro.id = doc.id

      // Obtener nombre del cliente
      const cliente = clientes.find((c) => c.id === miembro.clienteId)
      const clienteNombre = cliente ? cliente.nombre : "Cliente no encontrado"

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
        <td class="py-2 px-4">${miembro.sucursal || "-"}</td>
        <td class="py-2 px-4">${clienteNombre}</td>
        <td class="py-2 px-4">${miembro.referencia || "-"}</td>
        <td class="py-2 px-4">${fechaRegistroText}</td>
        <td class="py-2 px-4">$${(miembro.saldo || 0).toFixed(2)}</td>
        <td class="py-2 px-4">
          <div class="flex space-x-2">
            <button class="edit-detalle-miembro text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" data-id="${miembro.id}" title="Editar">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="register-detalle-payment text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${miembro.id}" title="Registrar pago">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
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
        '<tr><td colspan="6" class="py-4 text-center text-red-500">Error al cargar miembros</td></tr>'
    }
  }
}

// Configurar eventos para los miembros en el detalle de empresa
function setupDetalleMiembroEvents() {
  // Configurar botones para editar miembros
  const editButtons = document.querySelectorAll(".edit-detalle-miembro")
  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const miembroId = button.getAttribute("data-id")
      // Cerrar modal de detalle
      document.getElementById("detalleEmpresaModal").style.display = "none"
      // Abrir modal de edición
      editMiembro(miembroId)
    })
  })

  // Configurar botones para registrar pagos
  const paymentButtons = document.querySelectorAll(".register-detalle-payment")
  paymentButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const miembroId = button.getAttribute("data-id")
      // Cerrar modal de detalle
      document.getElementById("detalleEmpresaModal").style.display = "none"
      // Abrir modal de pago
      registerPayment(miembroId)
    })
  })

  // Configurar botones para eliminar miembros
  const deleteButtons = document.querySelectorAll(".delete-detalle-miembro")
  deleteButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const miembroId = button.getAttribute("data-id")
      // Cerrar modal de detalle
      document.getElementById("detalleEmpresaModal").style.display = "none"
      // Confirmar eliminación
      confirmDeleteMiembro(miembroId)
    })
  })
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
        document.getElementById("empresaModalTitle").textContent = "Editar Empresa"

        // Llenar formulario con datos de la empresa
        document.getElementById("empresaId").value = empresaId
        document.getElementById("empresaNombre").value = empresa.nombre || ""
        document.getElementById("empresaContacto").value = empresa.contacto || ""
        document.getElementById("empresaTelefono").value = empresa.telefono || ""
        document.getElementById("empresaEmail").value = empresa.email || ""
        document.getElementById("empresaDescuento").value = empresa.descuento || 40
        document.getElementById("empresaSaldo").value = empresa.saldo || 0
        document.getElementById("empresaDireccion").value = empresa.direccion || ""
        document.getElementById("empresaNotas").value = empresa.notas || ""

        // Llenar sucursales
        const sucursalesContainer = document.getElementById("sucursalesContainer")
        if (sucursalesContainer) {
          sucursalesContainer.innerHTML = ""

          if (empresa.sucursales && empresa.sucursales.length > 0) {
            empresa.sucursales.forEach((sucursal, index) => {
              const sucursalItem = document.createElement("div")
              sucursalItem.className = "sucursal-item flex items-center space-x-2"

              if (index === 0) {
                // Primera sucursal sin botón de eliminar
                sucursalItem.innerHTML = `
                  <input type="text" value="${sucursal}" placeholder="Nombre de la sucursal" class="sucursal-nombre flex-grow p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600">
                `
              } else {
                // Resto de sucursales con botón de eliminar
                sucursalItem.innerHTML = `
                  <input type="text" value="${sucursal}" placeholder="Nombre de la sucursal" class="sucursal-nombre flex-grow p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600">
                  <button type="button" class="remove-sucursal text-red-500 hover:text-red-700">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                `
              }

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
            // Si no hay sucursales, agregar una vacía
            const sucursalItem = document.createElement("div")
            sucursalItem.innerHTML = `
              <input type="text" placeholder="Nombre de la sucursal" class="sucursal-nombre flex-grow p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600">
              </div>
            `
            sucursalesContainer.appendChild(sucursalItem)
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
        document.getElementById("miembroModalTitle").textContent = "Editar Miembro"

        // Llenar formulario con datos del miembro
        document.getElementById("miembroId").value = miembroId
        document.getElementById("miembroEmpresa").value = miembro.empresaId || ""
        document.getElementById("miembroReferencia").value = miembro.referencia || ""
        document.getElementById("miembroNotas").value = miembro.notas || ""

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

        // Cargar sucursales de la empresa
        const miembroSucursal = document.getElementById("miembroSucursal")
        miembroSucursal.innerHTML = '<option value="">Seleccione una sucursal</option>'
        miembroSucursal.disabled = false

        const empresa = empresas.find((e) => e.id === miembro.empresaId)
        if (empresa && empresa.sucursales) {
          empresa.sucursales.forEach((sucursal) => {
            const option = document.createElement("option")
            option.value = sucursal
            option.textContent = sucursal
            if (sucursal === miembro.sucursal) {
              option.selected = true
            }
            miembroSucursal.appendChild(option)
          })
        }

        // Seleccionar cliente
        document.getElementById("miembroCliente").value = miembro.clienteId || ""

        // Disparar evento change para cargar sucursales
        const event = new Event("change")
        document.getElementById("miembroEmpresa").dispatchEvent(event)
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

// Función para registrar un pago
async function registerPayment(miembroId) {
  try {
    // Obtener datos del miembro
    const docRef = doc(db, "miembrosConvenio", miembroId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const miembro = docSnap.data()

      // Obtener nombre del cliente
      const cliente = clientes.find((c) => c.id === miembro.clienteId)
      const clienteNombre = cliente ? cliente.nombre : "Cliente no encontrado"

      // Obtener nombre de la empresa
      const empresa = empresas.find((e) => e.id === miembro.empresaId)
      const empresaNombre = empresa ? empresa.nombre : "Empresa no encontrada"

      // Mostrar modal de pago
      const modal = document.getElementById("pagoModal")
      if (modal) {
        modal.style.display = "block"

        // Llenar información del miembro
        document.getElementById("pagoMiembroId").value = miembroId
        document.getElementById("pagoClienteNombre").textContent = clienteNombre
        document.getElementById("pagoEmpresaNombre").textContent = empresaNombre
        document.getElementById("pagoSucursalNombre").textContent = miembro.sucursal || "No especificada"
        document.getElementById("pagoSaldoActual").textContent = `$${(miembro.saldo || 0).toFixed(2)}`

        // Establecer fecha actual
        const today = new Date()
        const year = today.getFullYear()
        const month = String(today.getMonth() + 1).padStart(2, "0")
        const day = String(today.getDate()).padStart(2, "0")
        document.getElementById("pagoFecha").value = `${year}-${month}-${day}`

        // Establecer monto máximo
        document.getElementById("pagoMonto").max = miembro.saldo || 0
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

// Función para confirmar eliminación de una empresa
function confirmDeleteEmpresa(empresaId) {
  // Mostrar modal de confirmación
  const modal = document.getElementById("confirmModal")
  if (modal) {
    modal.style.display = "block"
    document.getElementById("confirmTitle").textContent = "Confirmar eliminación"
    document.getElementById("confirmMessage").textContent =
      "¿Estás seguro de que deseas eliminar esta empresa? Esta acción no se puede deshacer y eliminará todos los miembros asociados."

    // Configurar botones
    const cancelBtn = document.getElementById("confirmCancel")
    const okBtn = document.getElementById("confirmOk")

    // Eliminar eventos anteriores
    const newCancelBtn = cancelBtn.cloneNode(true)
    const newOkBtn = okBtn.cloneNode(true)
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn)
    okBtn.parentNode.replaceChild(newOkBtn, okBtn)

    // Configurar nuevos eventos
    newCancelBtn.addEventListener("click", () => {
      modal.style.display = "none"
    })

    newOkBtn.addEventListener("click", async () => {
      modal.style.display = "none"
      await deleteEmpresa(empresaId)
    })
  } else {
    // Si no hay modal, usar confirm nativo
    if (
      confirm(
        "¿Estás seguro de que deseas eliminar esta empresa? Esta acción no se puede deshacer y eliminará todos los miembros asociados.",
      )
    ) {
      deleteEmpresa(empresaId)
    }
  }
}

// Función para confirmar eliminación de un miembro
function confirmDeleteMiembro(miembroId) {
  // Mostrar modal de confirmación
  const modal = document.getElementById("confirmModal")
  if (modal) {
    modal.style.display = "block"
    document.getElementById("confirmTitle").textContent = "Confirmar eliminación"
    document.getElementById("confirmMessage").textContent =
      "¿Estás seguro de que deseas eliminar este miembro? Esta acción no se puede deshacer."

    // Configurar botones
    const cancelBtn = document.getElementById("confirmCancel")
    const okBtn = document.getElementById("confirmOk")

    // Eliminar eventos anteriores
    const newCancelBtn = cancelBtn.cloneNode(true)
    const newOkBtn = okBtn.cloneNode(true)
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn)
    okBtn.parentNode.replaceChild(newOkBtn, okBtn)

    // Configurar nuevos eventos
    newCancelBtn.addEventListener("click", () => {
      modal.style.display = "none"
    })

    newOkBtn.addEventListener("click", async () => {
      modal.style.display = "none"
      await deleteMiembro(miembroId)
    })
  } else {
    // Si no hay modal, usar confirm nativo
    if (confirm("¿Estás seguro de que deseas eliminar este miembro? Esta acción no se puede deshacer.")) {
      deleteMiembro(miembroId)
    }
  }
}

// Función para eliminar una empresa
async function deleteEmpresa(empresaId) {
  try {
    // Buscar miembros asociados a la empresa
    const miembrosRef = collection(db, "miembrosConvenio")
    const q = query(miembrosRef, where("empresaId", "==", empresaId))
    const querySnapshot = await getDocs(q)

    // Eliminar miembros
    const batch = db.batch()
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref)
    })

    // Eliminar empresa
    batch.delete(doc(db, "empresas", empresaId))

    // Ejecutar batch
    await batch.commit()

    showToast("Empresa eliminada correctamente", "success")

    // Recargar empresas
    await loadEmpresas()

    // Recargar miembros
    await loadMiembros()
  } catch (error) {
    console.error("Error al eliminar empresa:", error)
    showToast("Error al eliminar la empresa", "danger")
  }
}

// Función para eliminar un miembro
async function deleteMiembro(miembroId) {
  try {
    // Obtener datos del miembro
    const miembroRef = doc(db, "miembrosConvenio", miembroId)
    const miembroDoc = await getDoc(miembroRef)

    if (!miembroDoc.exists()) {
      showToast("Miembro no encontrado", "danger")
      return
    }

    const miembro = miembroDoc.data()
    const clienteId = miembro.clienteId

    // Eliminar miembro
    await deleteDoc(miembroRef)

    // Verificar si el cliente tiene otros miembros
    const otrosMiembrosRef = collection(db, "miembrosConvenio")
    const q = query(otrosMiembrosRef, where("clienteId", "==", clienteId))
    const querySnapshot = await getDocs(q)

    // Si no tiene otros miembros, actualizar cliente para quitar convenio
    if (querySnapshot.empty) {
      await updateDoc(doc(db, "clientes", clienteId), {
        convenio: false,
        empresaId: null,
        updatedAt: serverTimestamp(),
      })
    }

    showToast("Miembro eliminado correctamente", "success")

    // Recargar miembros
    await loadMiembros()

    // Recargar clientes
    await loadClientes()

    // Recargar empresas
    await loadEmpresas()

    // Si estamos en el detalle de empresa, recargar miembros de la empresa
    if (currentEmpresaId) {
      await loadEmpresaMiembros(currentEmpresaId)
    }
  } catch (error) {
    console.error("Error al eliminar miembro:", error)
    showToast("Error al eliminar el miembro", "danger")
  }
}

// Función para actualizar el estado del convenio del cliente
async function updateClientConvenioStatus(clienteId) {
  try {
    // Verificar si el cliente tiene otros miembros activos
    const otrosMiembrosRef = collection(db, "miembrosConvenio")
    const q = query(otrosMiembrosRef, where("clienteId", "==", clienteId))
    const querySnapshot = await getDocs(q)

    // Si no tiene otros miembros, actualizar cliente para quitar convenio
    if (querySnapshot.empty) {
      await updateDoc(doc(db, "clientes", clienteId), {
        convenio: false,
        empresaId: null,
        updatedAt: serverTimestamp(),
      })
    } else {
      // Si tiene otros miembros, verificar si todos pertenecen a la misma empresa
      let mismaEmpresa = true
      let empresaId = null
      querySnapshot.forEach((doc) => {
        const miembro = doc.data()
        if (!empresaId) {
          empresaId = miembro.empresaId
        } else if (empresaId !== miembro.empresaId) {
          mismaEmpresa = false
        }
      })

      // Si todos los miembros pertenecen a la misma empresa, actualizar el cliente
      if (mismaEmpresa) {
        await updateDoc(doc(db, "clientes", clienteId), {
          convenio: true,
          empresaId: empresaId,
          updatedAt: serverTimestamp(),
        })
      } else {
        // Si los miembros pertenecen a diferentes empresas, quitar el convenio del cliente
        await updateDoc(doc(db, "clientes", clienteId), {
          convenio: false,
          empresaId: null,
          updatedAt: serverTimestamp(),
        })
      }
    }

    // Recargar clientes
    await loadClientes()
  } catch (error) {
    console.error("Error al actualizar el estado del convenio del cliente:", error)
    showToast("Error al actualizar el estado del convenio del cliente", "danger")
  }
}