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
    startAfter,
    Timestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"

import { db } from "./firebase-config.js"
import { checkAndCreateInventoryCollection } from "./auth-check.js"

// Variables globales
let currentClient = null
let lastVisible = null
const CLIENTS_PER_PAGE = 10
let empresas = []
let isValidating = false

// Configuración de paginación
let currentPage = 1
let totalPages = 1

// Filtros activos
const filtrosClientes = {
    convenio: "",
    empresa: "",
    busqueda: "",
    fechaRegistro: "",
    ultimaVisita: "",
}

// Dominios de email válidos
const VALID_EMAIL_DOMAINS = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
    'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com',
    'zoho.com', 'yandex.com', 'mail.com', 'gmx.com', 'fastmail.com',
    // Dominios mexicanos
    'uady.mx', 'itmerida.mx', 'anahuac.mx', 'tec.mx', 'unam.mx',
    'ipn.mx', 'udg.mx', 'buap.mx', 'uanl.mx', 'uas.mx', 'uacam.mx',
    // Dominios gubernamentales y empresariales mexicanos
    'gob.mx', 'imss.gob.mx', 'issste.gob.mx', 'cfe.mx', 'pemex.com',
    'banxico.org.mx', 'sat.gob.mx', 'sep.gob.mx'
]

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Página de clientes cargada")

    try {
        await checkAndCreateInventoryCollection()
        await checkAndCreateClientesCollection()
        await loadEmpresas()

        setupModalEvents()
        setupFormEvents()
        setupFilterEvents()
        setupSearchEvents()
        setupHistoryTabs()
        setupPaginationEvents()
        setupRealTimeValidation()

        await loadClientes()
    } catch (error) {
        console.error("Error al inicializar la página de clientes:", error)
        showToast("Error al cargar la página de clientes", "danger")
    }
})

// Función para verificar y crear colecciones necesarias para clientes
async function checkAndCreateClientesCollection() {
    try {
        console.log("Verificando colecciones de clientes...")

        const empresasSnapshot = await getDocs(collection(db, "empresas"))
        if (empresasSnapshot.empty) {
            console.log("Creando colección de empresas...")
            const empresasIniciales = [
                { nombre: "IMSS", descripcion: "Instituto Mexicano del Seguro Social", descuento: 10 },
                { nombre: "ISSSTE", descripcion: "Instituto de Seguridad y Servicios Sociales de los Trabajadores del Estado", descuento: 15 },
                { nombre: "CFE", descripcion: "Comisión Federal de Electricidad", descuento: 8 },
                { nombre: "PEMEX", descripcion: "Petróleos Mexicanos", descuento: 12 },
            ]

            for (const empresa of empresasIniciales) {
                await addDoc(collection(db, "empresas"), {
                    ...empresa,
                    createdAt: serverTimestamp(),
                })
            }
        }

        console.log("Verificación de colecciones de clientes completada")
    } catch (error) {
        console.error("Error al verificar o crear colecciones de clientes:", error)
        throw error
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

        // Actualizar los selectores de empresas
        const clientEmpresaSelect = document.getElementById("clientEmpresa")
        const filtroEmpresaSelect = document.getElementById("filtroEmpresa")

        if (clientEmpresaSelect) {
            clientEmpresaSelect.innerHTML = '<option value="">Sin convenio</option>'
            empresas.forEach((empresa) => {
                const option = document.createElement("option")
                option.value = empresa.id
                option.textContent = empresa.nombre
                clientEmpresaSelect.appendChild(option)
            })
        }

        if (filtroEmpresaSelect) {
            filtroEmpresaSelect.innerHTML = '<option value="">Todas las empresas</option>'
            empresas.forEach((empresa) => {
                const option = document.createElement("option")
                option.value = empresa.id
                option.textContent = empresa.nombre
                filtroEmpresaSelect.appendChild(option)
            })
        }

        console.log("Empresas cargadas:", empresas.length)
    } catch (error) {
        console.error("Error al cargar empresas:", error)
        showToast("Error al cargar empresas", "danger")
    }
}

// Función para mostrar notificaciones toast mejoradas
function showToast(message, type = "info", duration = 5000) {
    let toastContainer = document.getElementById("toastContainer")
    if (!toastContainer) {
        toastContainer = document.createElement("div")
        toastContainer.id = "toastContainer"
        toastContainer.className = "fixed top-4 right-4 z-50 max-w-xs"
        document.body.appendChild(toastContainer)
    }

    const toast = document.createElement("div")

    toast.className = `bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 mb-3 flex items-center justify-between border-l-4 transform translate-x-full transition-transform duration-300 ${type === "success"
        ? "border-green-500"
        : type === "danger"
            ? "border-red-500"
            : type === "warning"
                ? "border-yellow-500"
                : "border-blue-500"
        }`

    const icons = {
        success: '✓',
        danger: '✕',
        warning: '⚠',
        info: 'ℹ'
    }

    toast.innerHTML = `
        <div class="flex items-center">
            <span class="mr-3 text-lg ${type === "success"
            ? "text-green-500"
            : type === "danger"
                ? "text-red-500"
                : type === "warning"
                    ? "text-yellow-500"
                    : "text-blue-500"
        }">${icons[type] || icons.info}</span>
            <span class="text-gray-800 dark:text-gray-200">${message}</span>
        </div>
        <button type="button" class="ml-4 text-gray-400 hover:text-gray-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    `

    toastContainer.appendChild(toast)

    // Animar entrada
    setTimeout(() => {
        toast.classList.remove('translate-x-full')
    }, 10)

    // Agregar evento para cerrar el toast
    const closeBtn = toast.querySelector("button")
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            removeToast(toast)
        })
    }

    // Cerrar automáticamente
    if (duration > 0) {
        setTimeout(() => {
            removeToast(toast)
        }, duration)
    }

    function removeToast(toastElement) {
        toastElement.classList.add('translate-x-full')
        setTimeout(() => {
            if (toastContainer.contains(toastElement)) {
                toastContainer.removeChild(toastElement)
            }
        }, 300)
    }
}

// Función para mostrar alertas de confirmación personalizadas
function showConfirmDialog(title, message, confirmText = "Confirmar", cancelText = "Cancelar", type = "warning") {
    return new Promise((resolve) => {
        // Crear modal de confirmación
        const confirmModal = document.createElement('div')
        confirmModal.className = 'modal'
        confirmModal.style.display = 'block'
        confirmModal.style.zIndex = '9999'

        confirmModal.innerHTML = `
            <div class="modal-content bg-white dark:bg-gray-800 w-11/12 md:w-1/3 max-w-md mx-auto mt-32 rounded-lg shadow-modal p-6">
                <div class="flex items-center mb-4">
                    <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${type === 'danger' ? 'bg-red-100 dark:bg-red-900' :
                type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900' :
                    'bg-blue-100 dark:bg-blue-900'
            }">
                        <svg class="w-6 h-6 ${type === 'danger' ? 'text-red-600 dark:text-red-400' :
                type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-blue-600 dark:text-blue-400'
            }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            ${type === 'danger' ?
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />' :
                type === 'warning' ?
                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />' :
                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />'
            }
                        </svg>
                    </div>
                    <div class="ml-4">
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${title}</h3>
                    </div>
                </div>
                
                <div class="mb-6">
                    <p class="text-gray-600 dark:text-gray-300">${message}</p>
                </div>
                
                <div class="flex justify-end space-x-3">
                    <button id="cancelBtn" class="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors">
                        ${cancelText}
                    </button>
                    <button id="confirmBtn" class="px-4 py-2 text-white rounded-md transition-colors ${type === 'danger' ? 'bg-red-600 hover:bg-red-700' :
                type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                    'bg-blue-600 hover:bg-blue-700'
            }">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `

        document.body.appendChild(confirmModal)

        // Configurar eventos
        const cancelBtn = confirmModal.querySelector('#cancelBtn')
        const confirmBtn = confirmModal.querySelector('#confirmBtn')

        const cleanup = () => {
            document.body.removeChild(confirmModal)
        }

        cancelBtn.addEventListener('click', () => {
            cleanup()
            resolve(false)
        })

        confirmBtn.addEventListener('click', () => {
            cleanup()
            resolve(true)
        })

        // Cerrar con ESC
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                cleanup()
                resolve(false)
                document.removeEventListener('keydown', handleKeyDown)
            }
        }

        document.addEventListener('keydown', handleKeyDown)

        // Cerrar al hacer clic fuera
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                cleanup()
                resolve(false)
            }
        })
    })
}

// Función para mostrar modal de doble verificación para pagos
async function showPaymentConfirmation(amount, description = "este pago") {
    const confirmed = await showConfirmDialog(
        "Confirmar Pago",
        `¿Está seguro de que desea registrar ${description} por $${amount.toFixed(2)}?`,
        "Sí, registrar pago",
        "Cancelar",
        "warning"
    )

    if (confirmed) {
        // Segunda confirmación
        return await showConfirmDialog(
            "Confirmación Final",
            `Esta acción no se puede deshacer. ¿Proceder con el pago de $${amount.toFixed(2)}?`,
            "Confirmar definitivamente",
            "Cancelar",
            "danger"
        )
    }

    return false
}

// Configurar validaciones en tiempo real
function setupRealTimeValidation() {
    const clientName = document.getElementById("clientName")
    const clientPhone = document.getElementById("clientPhone")
    const clientEmail = document.getElementById("clientEmail")
    const clientBirthdate = document.getElementById("clientBirthdate")

    // Establecer fecha máxima para el campo de fecha de nacimiento (ayer)
    if (clientBirthdate) {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const maxDate = yesterday.toISOString().split('T')[0]
        clientBirthdate.setAttribute('max', maxDate)
    }

    // Validación de nombre
    if (clientName) {
        clientName.addEventListener("input", debounce(async () => {
            await validateClientName(clientName.value.trim())
        }, 500))

        clientName.addEventListener("blur", async () => {
            await validateClientName(clientName.value.trim())
        })
    }

    // Validación de teléfono
    if (clientPhone) {
        clientPhone.addEventListener("input", () => {
            // Permitir solo números
            clientPhone.value = clientPhone.value.replace(/\D/g, '')
            validatePhoneNumber(clientPhone.value)
        })

        clientPhone.addEventListener("blur", () => {
            validatePhoneNumber(clientPhone.value)
        })
    }

    // Validación de email
    if (clientEmail) {
        clientEmail.addEventListener("input", debounce(() => {
            validateEmail(clientEmail.value.trim())
        }, 300))

        clientEmail.addEventListener("blur", () => {
            validateEmail(clientEmail.value.trim())
        })
    }

    // Validación de fecha de nacimiento
    if (clientBirthdate) {
        clientBirthdate.addEventListener("change", () => {
            validateBirthdate(clientBirthdate.value)
        })
    }
}

// Función debounce para optimizar validaciones
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

// Validar nombre del cliente (verificar duplicados)
async function validateClientName(name) {
    const nameInput = document.getElementById("clientName")
    const errorDiv = document.getElementById("clientNameError")
    const clientId = document.getElementById("clientId").value

    if (!name) {
        setValidationState(nameInput, errorDiv, false, "El nombre es requerido")
        return false
    }

    if (name.length < 2) {
        setValidationState(nameInput, errorDiv, false, "El nombre debe tener al menos 2 caracteres")
        return false
    }

    if (name.length > 100) {
        setValidationState(nameInput, errorDiv, false, "El nombre no puede exceder 100 caracteres")
        return false
    }

    // Validar que contenga solo letras, espacios y algunos caracteres especiales
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-\.\']+$/
    if (!nameRegex.test(name)) {
        setValidationState(nameInput, errorDiv, false, "El nombre solo puede contener letras, espacios, guiones y apostrofes")
        return false
    }

    try {
        // Verificar duplicados en la base de datos
        const clientesQuery = query(
            collection(db, "clientes"),
            where("nombre", "==", name)
        )
        const querySnapshot = await getDocs(clientesQuery)

        // Si estamos editando, excluir el cliente actual
        const duplicates = querySnapshot.docs.filter(doc => doc.id !== clientId)

        if (duplicates.length > 0) {
            setValidationState(nameInput, errorDiv, false, "Ya existe un cliente con este nombre")
            return false
        }

        setValidationState(nameInput, errorDiv, true, "")
        return true
    } catch (error) {
        console.error("Error al validar nombre:", error)
        setValidationState(nameInput, errorDiv, false, "Error al validar el nombre")
        return false
    }
}

// Validar número de teléfono
function validatePhoneNumber(phone) {
    const phoneInput = document.getElementById("clientPhone")
    const errorDiv = document.getElementById("clientPhoneError")

    if (!phone) {
        setValidationState(phoneInput, errorDiv, false, "El teléfono es requerido")
        return false
    }

    // Validar formato de teléfono mexicano (10 dígitos)
    const phoneRegex = /^[0-9]{10}$/
    if (!phoneRegex.test(phone)) {
        setValidationState(phoneInput, errorDiv, false, "El teléfono debe tener exactamente 10 dígitos")
        return false
    }

    // Validar que no sean todos números iguales
    if (/^(\d)\1{9}$/.test(phone)) {
        setValidationState(phoneInput, errorDiv, false, "El teléfono no puede tener todos los dígitos iguales")
        return false
    }

    // Validar que comience con un dígito válido para México
    const firstDigit = phone.charAt(0)
    if (!['2', '3', '4', '5', '6', '7', '8', '9'].includes(firstDigit)) {
        setValidationState(phoneInput, errorDiv, false, "El teléfono debe comenzar con un dígito válido (2-9)")
        return false
    }

    setValidationState(phoneInput, errorDiv, true, "")
    return true
}

// Validar email
function validateEmail(email) {
    const emailInput = document.getElementById("clientEmail")
    const errorDiv = document.getElementById("clientEmailError")

    // El email es opcional, pero si se proporciona debe ser válido
    if (!email) {
        setValidationState(emailInput, errorDiv, null, "")
        return true
    }

    // Validar formato básico de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
        setValidationState(emailInput, errorDiv, false, "Formato de email inválido")
        return false
    }

    // Validar longitud
    if (email.length > 254) {
        setValidationState(emailInput, errorDiv, false, "El email es demasiado largo")
        return false
    }

    // Extraer dominio
    const domain = email.split('@')[1].toLowerCase()

    // Validar dominio
    if (!VALID_EMAIL_DOMAINS.includes(domain)) {
        setValidationState(emailInput, errorDiv, false, `Dominio no válido. Use dominios como: ${VALID_EMAIL_DOMAINS.slice(0, 5).join(', ')}, etc.`)
        return false
    }

    setValidationState(emailInput, errorDiv, true, "")
    return true
}

// Validar fecha de nacimiento
function validateBirthdate(birthdate) {
    const birthdateInput = document.getElementById("clientBirthdate")
    const errorDiv = document.getElementById("clientBirthdateError")

    // La fecha de nacimiento es opcional
    if (!birthdate) {
        setValidationState(birthdateInput, errorDiv, null, "")
        return true
    }

    const selectedDate = new Date(birthdate)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    const eighteenYearsAgo = new Date()
    eighteenYearsAgo.setFullYear(today.getFullYear() - 18)

    // Validar que no sea una fecha futura o de hoy
    if (selectedDate >= yesterday) {
        setValidationState(birthdateInput, errorDiv, false, "La fecha de nacimiento debe ser anterior a hoy")
        return false
    }

    // Validar que la persona sea mayor de edad
    if (selectedDate > eighteenYearsAgo) {
        setValidationState(birthdateInput, errorDiv, false, "El cliente debe ser mayor de 18 años")
        return false
    }

    // Validar que la fecha no sea demasiado antigua (más de 120 años)
    const maxAge = new Date()
    maxAge.setFullYear(today.getFullYear() - 120)
    if (selectedDate < maxAge) {
        setValidationState(birthdateInput, errorDiv, false, "La fecha de nacimiento no puede ser anterior a 120 años")
        return false
    }

    setValidationState(birthdateInput, errorDiv, true, "")
    return true
}

// Función para establecer el estado de validación visual
function setValidationState(input, errorDiv, isValid, message) {
    if (!input || !errorDiv) return

    // Remover clases previas
    input.classList.remove('input-error', 'input-success')
    errorDiv.classList.remove('show')

    if (isValid === true) {
        input.classList.add('input-success')
    } else if (isValid === false) {
        input.classList.add('input-error')
        errorDiv.textContent = message
        errorDiv.classList.add('show')
    }
    // Si isValid es null, no se aplica ningún estilo (estado neutral)
}

// Configurar eventos para los modales
function setupModalEvents() {
    // Configurar botón para agregar cliente
    const addClientBtn = document.getElementById("addClientBtn")
    if (addClientBtn) {
        addClientBtn.addEventListener("click", () => {
            openClientModal()
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

    // Configurar checkbox de convenio
    const clientConvenio = document.getElementById("clientConvenio")
    const clientEmpresaGroup = document.getElementById("clientEmpresaGroup")
    const clientEmpresa = document.getElementById("clientEmpresa")

    if (clientConvenio && clientEmpresaGroup && clientEmpresa) {
        clientConvenio.addEventListener("change", () => {
            if (clientConvenio.checked) {
                clientEmpresaGroup.classList.remove("opacity-50")
                clientEmpresa.disabled = false
            } else {
                clientEmpresaGroup.classList.add("opacity-50")
                clientEmpresa.disabled = true
                clientEmpresa.value = ""

                // También ocultar sucursal
                const clientSucursalGroup = document.getElementById("clientSucursalGroup")
                const clientSucursal = document.getElementById("clientSucursal")
                if (clientSucursalGroup && clientSucursal) {
                    clientSucursalGroup.style.display = "none"
                    clientSucursalGroup.classList.add("opacity-50")
                    clientSucursal.disabled = true
                    clientSucursal.value = ""
                }
            }
        })
    }

    // Configurar cambio de empresa para mostrar sucursales
    if (clientEmpresa) {
        clientEmpresa.addEventListener("change", async () => {
            const empresaId = clientEmpresa.value
            const clientSucursalGroup = document.getElementById("clientSucursalGroup")
            const clientSucursal = document.getElementById("clientSucursal")

            if (empresaId && clientSucursalGroup && clientSucursal) {
                // Mostrar el campo de selección de sucursal
                clientSucursalGroup.style.display = "block"
                clientSucursalGroup.classList.remove("opacity-50")
                clientSucursal.disabled = false

                // Cargar las sucursales de la empresa
                clientSucursal.innerHTML = '<option value="">Seleccione una sucursal</option>'
                try {
                    const empresaDoc = await getDoc(doc(db, "empresas", empresaId))
                    if (empresaDoc.exists()) {
                        const empresa = empresaDoc.data()
                        if (empresa.sucursales && empresa.sucursales.length > 0) {
                            empresa.sucursales.forEach((sucursal) => {
                                const option = document.createElement("option")
                                option.value = sucursal
                                option.textContent = sucursal
                                clientSucursal.appendChild(option)
                            })
                        }
                    }
                } catch (error) {
                    console.error("Error al cargar sucursales:", error)
                }
            } else if (clientSucursalGroup && clientSucursal) {
                // Ocultar el campo de selección de sucursal
                clientSucursalGroup.style.display = "none"
                clientSucursalGroup.classList.add("opacity-50")
                clientSucursal.disabled = true
                clientSucursal.value = ""
            }
        })
    }

    // Configurar botones del modal de tarjeta de cliente
    setupClientCardModalEvents()
}

// Función para abrir el modal de cliente
function openClientModal(clientData = null) {
    const modal = document.getElementById("clientModal")
    const form = document.getElementById("clientForm")

    if (!modal || !form) return

    // Limpiar formulario y validaciones
    form.reset()
    clearAllValidations()

    // Configurar título y campos
    const modalTitle = document.getElementById("modalTitle")
    const clientId = document.getElementById("clientId")

    if (clientData) {
        modalTitle.textContent = "Editar Cliente"
        clientId.value = clientData.id
        fillClientForm(clientData)
    } else {
        modalTitle.textContent = "Nuevo Cliente"
        clientId.value = ""
        resetClientForm()
    }

    modal.style.display = "block"
}

// Función para llenar el formulario con datos del cliente
function fillClientForm(clientData) {
    document.getElementById("clientName").value = clientData.nombre || ""
    document.getElementById("clientPhone").value = clientData.telefono || ""
    document.getElementById("clientEmail").value = clientData.email || ""
    document.getElementById("clientAddress").value = clientData.direccion || ""

    // Formatear fecha de nacimiento para el input date
    if (clientData.fechaNacimiento) {
        const fecha = clientData.fechaNacimiento instanceof Timestamp
            ? clientData.fechaNacimiento.toDate()
            : new Date(clientData.fechaNacimiento)

        const year = fecha.getFullYear()
        const month = String(fecha.getMonth() + 1).padStart(2, "0")
        const day = String(fecha.getDate()).padStart(2, "0")
        document.getElementById("clientBirthdate").value = `${year}-${month}-${day}`
    }

    // Configurar convenio y empresa
    const clientConvenio = document.getElementById("clientConvenio")
    const clientEmpresaGroup = document.getElementById("clientEmpresaGroup")
    const clientEmpresa = document.getElementById("clientEmpresa")

    if (clientConvenio && clientEmpresaGroup && clientEmpresa) {
        clientConvenio.checked = clientData.convenio || false

        if (clientData.convenio) {
            clientEmpresaGroup.classList.remove("opacity-50")
            clientEmpresa.disabled = false
            clientEmpresa.value = clientData.empresaId || ""

            // Cargar sucursales si hay empresa seleccionada
            if (clientData.empresaId) {
                loadSucursalesForEmpresa(clientData.empresaId, clientData.sucursal)
            }
        } else {
            clientEmpresaGroup.classList.add("opacity-50")
            clientEmpresa.disabled = true
            clientEmpresa.value = ""
        }
    }
}

// Función para resetear el formulario de cliente
function resetClientForm() {
    const clientConvenio = document.getElementById("clientConvenio")
    const clientEmpresaGroup = document.getElementById("clientEmpresaGroup")
    const clientEmpresa = document.getElementById("clientEmpresa")
    const clientSucursalGroup = document.getElementById("clientSucursalGroup")
    const clientSucursal = document.getElementById("clientSucursal")

    if (clientConvenio && clientEmpresaGroup && clientEmpresa) {
        clientConvenio.checked = false
        clientEmpresaGroup.classList.add("opacity-50")
        clientEmpresa.disabled = true
        clientEmpresa.value = ""
    }

    if (clientSucursalGroup && clientSucursal) {
        clientSucursalGroup.style.display = "none"
        clientSucursalGroup.classList.add("opacity-50")
        clientSucursal.disabled = true
        clientSucursal.value = ""
    }
}

// Función para cargar sucursales de una empresa específica
async function loadSucursalesForEmpresa(empresaId, selectedSucursal = "") {
    const clientSucursalGroup = document.getElementById("clientSucursalGroup")
    const clientSucursal = document.getElementById("clientSucursal")

    if (!clientSucursalGroup || !clientSucursal) return

    try {
        clientSucursalGroup.style.display = "block"
        clientSucursalGroup.classList.remove("opacity-50")
        clientSucursal.disabled = false

        clientSucursal.innerHTML = '<option value="">Seleccione una sucursal</option>'

        const empresaDoc = await getDoc(doc(db, "empresas", empresaId))
        if (empresaDoc.exists()) {
            const empresa = empresaDoc.data()
            if (empresa.sucursales && empresa.sucursales.length > 0) {
                empresa.sucursales.forEach((sucursal) => {
                    const option = document.createElement("option")
                    option.value = sucursal
                    option.textContent = sucursal
                    if (sucursal === selectedSucursal) {
                        option.selected = true
                    }
                    clientSucursal.appendChild(option)
                })
            }
        }
    } catch (error) {
        console.error("Error al cargar sucursales:", error)
    }
}

// Función para limpiar todas las validaciones
function clearAllValidations() {
    const inputs = document.querySelectorAll('#clientModal input, #clientModal select')
    const errorDivs = document.querySelectorAll('#clientModal .error-message')

    inputs.forEach(input => {
        input.classList.remove('input-error', 'input-success')
    })

    errorDivs.forEach(errorDiv => {
        errorDiv.classList.remove('show')
        errorDiv.textContent = ""
    })
}

// Configurar eventos para el modal de tarjeta de cliente
function setupClientCardModalEvents() {
    const closeCardBtn = document.getElementById("closeCardBtn")
    if (closeCardBtn) {
        closeCardBtn.addEventListener("click", () => {
            const clientCardModal = document.getElementById("clientCardModal")
            if (clientCardModal) {
                clientCardModal.style.display = "none"
            }
        })
    }

    const printCardBtn = document.getElementById("printCardBtn")
    if (printCardBtn) {
        printCardBtn.addEventListener("click", () => {
            printClientHistory()
        })
    }

    const newSaleBtn = document.getElementById("newSaleBtn")
    if (newSaleBtn) {
        newSaleBtn.addEventListener("click", () => {
            if (currentClient) {
                window.location.href = `ventas.html?clientId=${currentClient.id}`
            }
        })
    }
}

// Función para imprimir historial del cliente optimizada
async function printClientHistory() {
    showPrintLoadingOverlay("Preparando impresión...");

    const clientName = document.getElementById("cardClientName").textContent
    const clientPhone = document.getElementById("cardClientPhone").textContent
    const clientEmail = document.getElementById("cardClientEmail").textContent

    // Obtener ventas del cliente
    let ventas = []
    try {
        const ventasQuery = query(
            collection(db, "ventas"),
            where("clienteId", "==", currentClient.id),
            orderBy("fecha", "desc")
        )
        const ventasSnapshot = await getDocs(ventasQuery)
        ventas = ventasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (e) {
        ventas = []
    }

    // Construir historial de ventas y abonos
    let historyTable = ""
    let saldoTotalPendiente = 0
    for (const venta of ventas) {
        const fechaVenta = venta.fecha instanceof Timestamp ? venta.fecha.toDate() : new Date(venta.fecha)
        let productosInfo = "Venta"
        if (venta.productos && venta.productos.length > 0) {
            productosInfo = venta.productos.map((p) => p.nombreProducto).join(", ")
        }
        // Estado y saldo
        const saldoInfo = await calcularSaldoPendiente(venta.id)
        let estado = "Pendiente"
        let estadoClass = "text-yellow-500"
        if (saldoInfo.saldoPendiente <= 0) {
            estado = "Pagado"
            estadoClass = "text-green-500"
        } else if (saldoInfo.totalAbonado > 0 || saldoInfo.totalPagado > 0) {
            estado = "Abonado"
            estadoClass = "text-blue-500"
        }
        saldoTotalPendiente += saldoInfo.saldoPendiente > 0 ? saldoInfo.saldoPendiente : 0

        // Fila principal de la venta
        historyTable += `
            <tr>
                <td>${fechaVenta.toLocaleDateString()}</td>
                <td>${productosInfo}</td>
                <td><span class="${estadoClass}">${estado}</span></td>
                <td>$${venta.total.toFixed(2)}</td>
            </tr>
            <tr>
                <td colspan="4">
                    <table style="width:100%; margin:8px 0 8px 0; font-size:11px; border:1px solid #eee;">
                        <thead>
                            <tr>
                                <th style="background:#f3f3f3;">Fecha</th>
                                <th style="background:#f3f3f3;">Tipo</th>
                                <th style="background:#f3f3f3;">Descripción</th>
                                <th style="background:#f3f3f3;">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${await buildAbonosPagosRows(venta)}
                        </tbody>
                    </table>
                </td>
            </tr>
        `
    }

    // Agregar fila de saldo total pendiente si existe
    let saldoPendienteRow = ""
    if (saldoTotalPendiente > 0) {
        saldoPendienteRow = `
            <tr>
                <td colspan="2"></td>
                <td style="font-weight:bold; color:#dc2626;">Saldo pendiente</td>
                <td style="font-weight:bold; color:#dc2626;">$${saldoTotalPendiente.toFixed(2)}</td>
            </tr>
        `
    }

    // Abrir ventana de impresión
    const printWindow = window.open('', '_blank')
    const LOGO_URL = "https://res.cloudinary.com/dmyejrbs7/image/upload/v1748059351/logoAKP-2_wdapz7.png"
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Historial de Cliente - ${clientName}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #f09d1f; padding-bottom: 10px; }
                .client-info { margin-bottom: 20px; background: #f9f9f9; padding: 10px; border-radius: 5px; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; }
                th { background-color: #f09d1f; color: white; font-weight: bold; }
                .text-green-500 { color: #10b981; }
                .text-red-500 { color: #dc2626; }
                .text-blue-500 { color: #3b82f6; }
                .text-yellow-500 { color: #f59e0b; }
                .font-bold { font-weight: bold; }
                .bg-red-50 { background-color: #fef2f2; }
                @media print { body { margin: 0; } .no-print { display: none; } }
                .logo { width: 80px; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <img src="${LOGO_URL}" class="logo" alt="Logo empresa">
                <h1>Servicios Ópticos Ah Kim Pech</h1>
                <h2>Tarjeta e Historial de Cliente</h2>
            </div>
            <div class="client-info">
                <h3>${clientName}</h3>
                <p><strong>Teléfono:</strong> ${clientPhone}</p>
                <p><strong>Email:</strong> ${clientEmail}</p>
                <p><strong>Fecha de impresión:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Producto</th>
                        <th>Estado</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${historyTable}
                    ${saldoPendienteRow}
                </tbody>
            </table>
        </body>
        </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    printWindow.close()

    // Ocultar overlay de carga
    hidePrintLoadingOverlay();
}

window.printClientHistory = printClientHistory

async function buildAbonosPagosRows(venta) {
    let rows = ""
    // Abono inicial
    if (venta.abono && venta.abono > 0) {
        rows += `
            <tr>
                <td>${(venta.fecha instanceof Timestamp ? venta.fecha.toDate() : new Date(venta.fecha)).toLocaleDateString()}</td>
                <td>Abono</td>
                <td>Abono inicial</td>
                <td>+$${venta.abono.toFixed(2)}</td>
            </tr>
        `
    }
    // Abonos adicionales
    const abonosQuery = query(
        collection(db, "abonos"),
        where("ventaId", "==", venta.id),
        orderBy("fecha", "asc")
    )
    const abonosSnapshot = await getDocs(abonosQuery)
    abonosSnapshot.forEach((doc) => {
        const abono = doc.data()
        if (abono.descripcion !== 'Abono inicial') {
            const fechaAbono = abono.fecha instanceof Timestamp ? abono.fecha.toDate() : new Date(abono.fecha)
            rows += `
                <tr>
                    <td>${fechaAbono.toLocaleDateString()}</td>
                    <td>Abono</td>
                    <td>${abono.descripcion || 'Abono'}</td>
                    <td>+$${abono.monto.toFixed(2)}</td>
                </tr>
            `
        }
    })
    // Pagos
    const pagosQuery = query(
        collection(db, "pagos"),
        where("ventaId", "==", venta.id),
        orderBy("fecha", "asc")
    )
    const pagosSnapshot = await getDocs(pagosQuery)
    pagosSnapshot.forEach((doc) => {
        const pago = doc.data()
        const fechaPago = pago.fecha instanceof Timestamp ? pago.fecha.toDate() : new Date(pago.fecha)
        rows += `
            <tr>
                <td>${fechaPago.toLocaleDateString()}</td>
                <td>Pago</td>
                <td>${pago.descripcion || 'Pago'} (${pago.metodoPago || 'Efectivo'})</td>
                <td>+$${pago.monto.toFixed(2)}</td>
            </tr>
        `
    })
    return rows
}

function showPrintLoadingOverlay(text = "Preparando impresión...") {
    let overlay = document.getElementById("printLoadingOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "printLoadingOverlay";
        overlay.style.position = "fixed";
        overlay.style.top = 0;
        overlay.style.left = 0;
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.background = "rgba(255,255,255,0.85)";
        overlay.style.zIndex = 99999;
        overlay.style.display = "flex";
        overlay.style.flexDirection = "column";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.innerHTML = `
            <div style="margin-bottom:16px;">
                <div class="spinner" style="border:4px solid #f3f3f3;border-top:4px solid #f09d1f;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;"></div>
            </div>
            <div style="font-size:1.1rem;color:#444;">${text}</div>
            <style>
                @keyframes spin { 100% { transform: rotate(360deg); } }
            </style>
        `;
        document.body.appendChild(overlay);
    } else {
        overlay.style.display = "flex";
    }
}
function hidePrintLoadingOverlay() {
    const overlay = document.getElementById("printLoadingOverlay");
    if (overlay) overlay.style.display = "none";
}

// Función para cargar historial completo del cliente
async function loadFullClientHistory(clientId) {
    try {
        const contentDiv = document.getElementById("fullHistoryContent")
        if (!contentDiv) return

        // Obtener ventas del cliente
        const ventasQuery = query(
            collection(db, "ventas"),
            where("clienteId", "==", clientId),
            orderBy("fecha", "desc")
        )

        const ventasSnapshot = await getDocs(ventasQuery)

        if (ventasSnapshot.empty) {
            contentDiv.innerHTML = '<div class="text-center py-8 text-gray-500">No hay compras registradas</div>'
            return
        }

        let historyHTML = `
            <table class="data-table w-full bg-white dark:bg-gray-800 rounded-lg">
                <thead>
                    <tr>
                        <th class="py-2 px-4 text-left bg-primary text-white sticky top-0">Fecha</th>
                        <th class="py-2 px-4 text-left bg-primary text-white sticky top-0">Producto</th>
                        <th class="py-2 px-4 text-left bg-primary text-white sticky top-0">Estado</th>
                        <th class="py-2 px-4 text-left bg-primary text-white sticky top-0">Total</th>
                        <th class="py-2 px-4 text-left bg-primary text-white sticky top-0">Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `

        let saldoTotalPendiente = 0

        // Procesar cada venta
        for (const ventaDoc of ventasSnapshot.docs) {
            const venta = {
                id: ventaDoc.id,
                ...ventaDoc.data(),
            }

            // Calcular saldo pendiente de la venta
            const saldoInfo = await calcularSaldoPendiente(venta.id)
            saldoTotalPendiente += saldoInfo.saldoPendiente

            // Formatear fecha de la venta
            const fechaVenta = venta.fecha instanceof Timestamp ? venta.fecha.toDate() : new Date(venta.fecha)

            // Obtener información de productos
            let productosInfo = "Venta"
            if (venta.productos && venta.productos.length > 0) {
                productosInfo = venta.productos.map((p) => p.nombreProducto).join(", ")
            }

            // Determinar estado
            let estado = "Pendiente"
            let estadoClass = "text-yellow-500"

            if (saldoInfo.saldoPendiente <= 0) {
                estado = "Pagado"
                estadoClass = "text-green-500"
            } else if (saldoInfo.totalAbonado > 0 || saldoInfo.totalPagado > 0) {
                estado = "Abonado"
                estadoClass = "text-blue-500"
            }

            // Agregar fila de venta
            historyHTML += `
                <tr class="bg-gray-50 dark:bg-gray-700">
                    <td class="py-2 px-4 font-semibold">${fechaVenta.toLocaleDateString()}</td>
                    <td class="py-2 px-4">${productosInfo}</td>
                    <td class="py-2 px-4">
                        <span class="${estadoClass} font-semibold">${estado}</span>
                    </td>
                    <td class="py-2 px-4 font-bold">$${venta.total.toFixed(2)}</td>
                    <td class="py-2 px-4">
                        <button class="text-blue-500 hover:text-blue-700 text-sm" onclick="toggleFullVentaDetails('${venta.id}')">
                            Ver detalles
                        </button>
                    </td>
                </tr>
                <tr id="full-detalles-${venta.id}" style="display: none;">
                    <td colspan="5" class="py-0 px-4">
                        <div class="bg-white dark:bg-gray-800 border-l-4 border-blue-500 pl-4 py-2">
                            <div id="full-detalles-content-${venta.id}">
                                <div class="text-center text-gray-500">Cargando detalles...</div>
                            </div>
                        </div>
                    </td>
                </tr>
            `

            // Cargar detalles de la venta
            await loadVentaDetailsForFullHistory(venta.id, venta.total, venta.abono || 0)
        }

        // Agregar saldo total pendiente
        if (saldoTotalPendiente > 0) {
            historyHTML += `
                <tr class="bg-red-50 dark:bg-red-900/20 border-t-2 border-red-500">
                    <td class="py-3 px-4 font-bold text-lg" colspan="3">SALDO TOTAL PENDIENTE</td>
                    <td class="py-3 px-4 text-red-600 font-bold text-lg">$${saldoTotalPendiente.toFixed(2)}</td>
                    <td class="py-3 px-4">
                        <button class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm" 
                                onclick="payAllPendingFromModal('${clientId}', ${saldoTotalPendiente})">
                            Pagar Todo
                        </button>
                    </td>
                </tr>
            `
        }

        historyHTML += `
                </tbody>
            </table>
        `

        contentDiv.innerHTML = historyHTML

    } catch (error) {
        console.error("Error al cargar historial completo:", error)
        const contentDiv = document.getElementById("fullHistoryContent")
        if (contentDiv) {
            contentDiv.innerHTML = '<div class="text-center py-8 text-red-500">Error al cargar historial</div>'
        }
    }
}

// Función para cargar detalles de venta en el historial completo
async function loadVentaDetailsForFullHistory(ventaId, totalVenta, abonoInicial) {
    try {
        const contentDiv = document.getElementById(`full-detalles-content-${ventaId}`)
        if (!contentDiv) return

        let detallesHTML = ""
        let totalAbonado = 0
        let totalPagado = 0

        // Agregar abono inicial si existe
        if (abonoInicial > 0) {
            const fechaVenta = new Date()
            detallesHTML += `
                <div class="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-600">
                    <div class="flex items-center">
                        <span class="text-sm text-gray-600 dark:text-gray-400 mr-2">${fechaVenta.toLocaleDateString()}</span>
                        <span class="text-sm">Abono inicial</span>
                    </div>
                    <span class="text-green-500 font-semibold">+$${abonoInicial.toFixed(2)}</span>
                </div>
            `
            totalAbonado += abonoInicial
        }

        // Obtener abonos adicionales
        const abonosQuery = query(
            collection(db, "abonos"),
            where("ventaId", "==", ventaId),
            orderBy("fecha", "asc")
        )

        const abonosSnapshot = await getDocs(abonosQuery)
        abonosSnapshot.forEach((doc) => {
            const abono = doc.data()
            if (abono.descripcion !== 'Abono inicial') {
                const fechaAbono = abono.fecha instanceof Timestamp ? abono.fecha.toDate() : new Date(abono.fecha)
                detallesHTML += `
                    <div class="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-600">
                        <div class="flex items-center">
                            <span class="text-sm text-gray-600 dark:text-gray-400 mr-2">${fechaAbono.toLocaleDateString()}</span>
                            <span class="text-sm">${abono.descripcion || 'Abono'}</span>
                        </div>
                        <span class="text-green-500 font-semibold">+$${abono.monto.toFixed(2)}</span>
                    </div>
                `
                totalAbonado += abono.monto
            }
        })

        // Obtener pagos
        const pagosQuery = query(
            collection(db, "pagos"),
            where("ventaId", "==", ventaId),
            orderBy("fecha", "asc")
        )

        const pagosSnapshot = await getDocs(pagosQuery)
        pagosSnapshot.forEach((doc) => {
            const pago = doc.data()
            const fechaPago = pago.fecha instanceof Timestamp ? pago.fecha.toDate() : new Date(pago.fecha)
            detallesHTML += `
                <div class="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-600">
                    <div class="flex items-center">
                        <span class="text-sm text-gray-600 dark:text-gray-400 mr-2">${fechaPago.toLocaleDateString()}</span>
                        <span class="text-sm">${pago.descripcion || 'Pago'} (${pago.metodoPago || 'Efectivo'})</span>
                    </div>
                    <span class="text-blue-500 font-semibold">+$${pago.monto.toFixed(2)}</span>
                </div>
            `
            totalPagado += pago.monto
        })

        // Calcular saldo pendiente
        const saldoPendiente = totalVenta - totalAbonado - totalPagado

        // Agregar fila de saldo pendiente
        detallesHTML += `
            <div class="flex justify-between items-center py-2 mt-2 bg-gray-100 dark:bg-gray-700 rounded px-2">
                <span class="font-semibold">Saldo pendiente</span>
                <div class="flex items-center gap-2">
                    <span class="font-bold ${saldoPendiente > 0 ? 'text-red-500' : 'text-green-500'}">
                        $${saldoPendiente.toFixed(2)}
                    </span>
                    ${saldoPendiente > 0 ? `
                        <button class="add-payment-btn bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs" 
                                data-venta-id="${ventaId}" data-saldo="${saldoPendiente.toFixed(2)}">
                            Pagar
                        </button>
                    ` : `
                        <span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                            ✓ Pagado
                        </span>
                    `}
                </div>
            </div>
        `

        contentDiv.innerHTML = detallesHTML

    } catch (error) {
        console.error("Error al cargar detalles de venta:", error)
        const contentDiv = document.getElementById(`full-detalles-content-${ventaId}`)
        if (contentDiv) {
            contentDiv.innerHTML = '<div class="text-red-500 text-sm">Error al cargar detalles</div>'
        }
    }
}

// Funciones globales para el historial completo
window.toggleFullVentaDetails = function (ventaId) {
    const detallesRow = document.getElementById(`full-detalles-${ventaId}`)
    if (detallesRow) {
        if (detallesRow.style.display === "none") {
            detallesRow.style.display = "table-row"
        } else {
            detallesRow.style.display = "none"
        }
    }
}

window.payAllPendingFromModal = async function (clienteId, saldoTotal) {
    const confirmed = await showPaymentConfirmation(saldoTotal, "el pago total de todas las deudas pendientes")

    if (confirmed) {
        try {
            // Obtener todas las ventas con saldo pendiente
            const ventasQuery = query(
                collection(db, "ventas"),
                where("clienteId", "==", clienteId)
            )

            const ventasSnapshot = await getDocs(ventasQuery)

            for (const ventaDoc of ventasSnapshot.docs) {
                const saldoInfo = await calcularSaldoPendiente(ventaDoc.id)

                if (saldoInfo.saldoPendiente > 0) {
                    // Registrar pago completo para esta venta
                    await registrarPago(
                        ventaDoc.id,
                        clienteId,
                        saldoInfo.saldoPendiente,
                        'Pago total pendiente',
                        'efectivo'
                    )

                    // Actualizar estado de la venta
                    await updateDoc(doc(db, 'ventas', ventaDoc.id), {
                        estado: 'pagada',
                        updatedAt: serverTimestamp()
                    })
                }
            }

            showToast('Todos los pagos pendientes han sido registrados', 'success')

            // Recargar historial
            await loadClientHistory(clienteId)
            await loadFullClientHistory(clienteId)

        } catch (error) {
            console.error("Error al pagar todo:", error)
            showToast('Error al procesar los pagos', 'danger')
        }
    }
}

// Configurar eventos para los formularios
function setupFormEvents() {
    const clientForm = document.getElementById("clientForm")
    if (!clientForm) return

    clientForm.addEventListener("submit", async (e) => {
        e.preventDefault()

        if (isValidating) return
        isValidating = true

        const saveBtn = document.getElementById("saveClientBtn")
        const saveText = document.getElementById("saveClientText")

        // Mostrar estado de carga
        if (saveBtn) saveBtn.disabled = true
        if (saveText) saveText.innerHTML = '<span class="spinner"></span>Guardando...'

        try {
            // Validar todos los campos
            const isValid = await validateAllFields()

            if (!isValid) {
                showToast("Por favor, corrija los errores en el formulario", "warning")
                return
            }

            // Obtener datos del formulario
            const clientData = getFormData()

            // Guardar cliente
            await saveClient(clientData)

        } catch (error) {
            console.error("Error al guardar cliente:", error)
            showToast("Error al guardar el cliente", "danger")
        } finally {
            isValidating = false
            if (saveBtn) saveBtn.disabled = false
            if (saveText) saveText.textContent = "Guardar cliente"
        }
    })
}

// Función para validar todos los campos del formulario
async function validateAllFields() {
    const name = document.getElementById("clientName").value.trim()
    const phone = document.getElementById("clientPhone").value.trim()
    const email = document.getElementById("clientEmail").value.trim()
    const birthdate = document.getElementById("clientBirthdate").value

    const validations = await Promise.all([
        validateClientName(name),
        validatePhoneNumber(phone),
        validateEmail(email),
        validateBirthdate(birthdate)
    ])

    return validations.every(isValid => isValid)
}

// Función para obtener datos del formulario
function getFormData() {
    const clientId = document.getElementById("clientId").value
    const nombre = document.getElementById("clientName").value.trim()
    const telefono = document.getElementById("clientPhone").value.trim()
    const email = document.getElementById("clientEmail").value.trim()
    const direccion = document.getElementById("clientAddress").value.trim()
    const fechaNacimiento = document.getElementById("clientBirthdate").value
    const convenio = document.getElementById("clientConvenio").checked
    const empresaId = convenio ? document.getElementById("clientEmpresa").value : ""
    const sucursal = document.getElementById("clientSucursal")?.value || ""

    return {
        clientId,
        nombre,
        telefono,
        email: email || null,
        direccion: direccion || null,
        fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
        convenio,
        empresaId: empresaId || null,
        sucursal: sucursal || null
    }
}

// Función para guardar cliente
async function saveClient(clientData) {
    try {
        const clienteData = {
            nombre: clientData.nombre,
            telefono: clientData.telefono,
            email: clientData.email,
            direccion: clientData.direccion,
            fechaNacimiento: clientData.fechaNacimiento,
            convenio: clientData.convenio,
            empresaId: clientData.empresaId,
            sucursal: clientData.sucursal,
            updatedAt: serverTimestamp(),
        }

        if (!clientData.clientId) {
            // Agregar nuevo cliente
            clienteData.fechaRegistro = serverTimestamp()
            clienteData.ultimaVisita = null

            const clienteRef = await addDoc(collection(db, "clientes"), clienteData)
            showToast("Cliente agregado correctamente", "success")

            // Si el cliente tiene convenio, crear miembro de convenio
            if (clientData.convenio && clientData.empresaId) {
                await createConvenioMember(clienteRef.id, clientData.empresaId, clientData.sucursal)
            }
        } else {
            // Actualizar cliente existente
            await updateDoc(doc(db, "clientes", clientData.clientId), clienteData)
            showToast("Cliente actualizado correctamente", "success")
        }

        // Cerrar modal
        document.getElementById("clientModal").style.display = "none"

        // SOLUCIÓN: Resetear variables de paginación antes de recargar
        resetPagination()
        await loadClientes()

    } catch (error) {
        console.error("Error al guardar cliente:", error)
        throw error
    }
}

function resetPagination() {
    currentPage = 1
    lastVisible = null
    totalPages = 1
}

// Función para crear miembro de convenio
async function createConvenioMember(clienteId, empresaId, sucursal) {
    try {
        const miembroData = {
            empresaId: empresaId,
            sucursal: sucursal || "",
            clienteId: clienteId,
            referencia: "",
            fechaRegistro: new Date(),
            notas: "",
            estado: "pendiente",
            saldo: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }

        await addDoc(collection(db, "miembrosConvenio"), miembroData)
        showToast("Cliente asociado al convenio correctamente", "success")

        // Lanzar evento para que convenios.js recargue los datos
        window.dispatchEvent(new CustomEvent("miembroConvenioAgregado"))
    } catch (error) {
        console.error("Error al crear miembro de convenio:", error)
        showToast("Error al asociar cliente al convenio", "warning")
    }
}

// Configurar eventos para los filtros
function setupFilterEvents() {
    const toggleFiltrosBtn = document.getElementById("toggleFiltrosBtn")
    const filtrosPanel = document.getElementById("filtrosPanel")
    const aplicarFiltrosBtn = document.getElementById("aplicarFiltrosBtn")
    const limpiarFiltrosBtn = document.getElementById("limpiarFiltrosBtn")

    if (toggleFiltrosBtn && filtrosPanel) {
        toggleFiltrosBtn.addEventListener("click", () => {
            const isVisible = filtrosPanel.style.display !== "none"

            if (isVisible) {
                filtrosPanel.classList.add('filter-slide-exit')
                setTimeout(() => {
                    filtrosPanel.style.display = "none"
                    filtrosPanel.classList.remove('filter-slide-exit')
                    toggleFiltrosBtn.classList.remove('active')
                }, 300)
            } else {
                filtrosPanel.style.display = "block"
                filtrosPanel.classList.add('filter-slide-enter')
                toggleFiltrosBtn.classList.add('active')
                setTimeout(() => {
                    filtrosPanel.classList.remove('filter-slide-enter')
                }, 300)
            }
        })
    }

    if (aplicarFiltrosBtn) {
        aplicarFiltrosBtn.addEventListener("click", () => {
            applyFilters()
        })
    }

    if (limpiarFiltrosBtn) {
        limpiarFiltrosBtn.addEventListener("click", () => {
            clearFilters()
        })
    }
}

// Función para aplicar filtros
function applyFilters() {
    filtrosClientes.convenio = document.getElementById("filtroConvenio").value
    filtrosClientes.empresa = document.getElementById("filtroEmpresa").value
    filtrosClientes.fechaRegistro = document.getElementById("filtroFechaRegistro").value
    filtrosClientes.ultimaVisita = document.getElementById("filtroUltimaVisita").value

    // CORREGIDO: Resetear paginación al aplicar filtros
    resetPagination()
    loadClientes()
    showToast("Filtros aplicados", "info", 2000)
}

// Función para limpiar filtros
function clearFilters() {
    document.getElementById("filtroConvenio").value = ""
    document.getElementById("filtroEmpresa").value = ""
    document.getElementById("filtroFechaRegistro").value = ""
    document.getElementById("filtroUltimaVisita").value = ""

    // Limpiar filtros activos
    Object.keys(filtrosClientes).forEach(key => {
        filtrosClientes[key] = ""
    })

    // CORREGIDO: Resetear paginación al limpiar filtros
    resetPagination()
    loadClientes()
    showToast("Filtros limpiados", "info", 2000)
}

// Configurar eventos para las búsquedas (sin botón, solo tiempo real)
function setupSearchEvents() {
    const searchCliente = document.getElementById("searchCliente")

    if (searchCliente) {
        // Búsqueda en tiempo real con debounce
        searchCliente.addEventListener("input", debounce(() => {
            performSearch()
        }, 500))

        searchCliente.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                performSearch()
            }
        })
    }
}

// Función para realizar búsqueda
function performSearch() {
    const searchCliente = document.getElementById("searchCliente")
    filtrosClientes.busqueda = searchCliente.value.trim()

    // CORREGIDO: Resetear paginación al buscar
    resetPagination()
    loadClientes()
}

// Configurar eventos para las pestañas de historial
function setupHistoryTabs() {
    const tabButtons = document.querySelectorAll(".history-tab-btn")
    const tabContents = document.querySelectorAll(".history-tab-content")

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
                content.style.display = content.id === tabId + "-tab" ? "block" : "none"
            })
        })
    })
}

// Configurar eventos para la paginación
function setupPaginationEvents() {
    const prevPageBtn = document.getElementById("prevPageBtn")
    const nextPageBtn = document.getElementById("nextPageBtn")

    if (prevPageBtn) {
        prevPageBtn.addEventListener("click", async () => {
            if (currentPage > 1) {
                currentPage--
                // Para ir a página anterior, necesitamos recargar desde el inicio
                // y saltar las páginas anteriores
                resetPagination()
                currentPage = Math.max(1, currentPage)
                await loadClientesWithOffset()
            }
        })
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener("click", async () => {
            if (currentPage < totalPages) {
                currentPage++
                await loadClientes()
            }
        })
    }
}

async function loadClientesWithOffset() {
    const tableBody = document.getElementById("clientsTableBody")
    if (!tableBody) return

    tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center"><span class="spinner"></span> Cargando clientes...</td></tr>'

    try {
        const clientesQuery = collection(db, "clientes")
        const queryConstraints = []

        // Aplicar filtros
        if (filtrosClientes.convenio) {
            queryConstraints.push(where("convenio", "==", filtrosClientes.convenio === "true"))
        }

        if (filtrosClientes.empresa) {
            queryConstraints.push(where("empresaId", "==", filtrosClientes.empresa))
        }

        queryConstraints.push(orderBy("nombre"))

        // Calcular cuántos documentos saltar
        const skipCount = (currentPage - 1) * CLIENTS_PER_PAGE
        queryConstraints.push(limit(CLIENTS_PER_PAGE + skipCount))

        const q = query(clientesQuery, ...queryConstraints)
        const clientesSnapshot = await getDocs(q)

        // Tomar solo los documentos de la página actual
        const allDocs = clientesSnapshot.docs
        const currentPageDocs = allDocs.slice(skipCount, skipCount + CLIENTS_PER_PAGE)

        // Actualizar lastVisible
        if (currentPageDocs.length > 0) {
            lastVisible = currentPageDocs[currentPageDocs.length - 1]
        }

        // Procesar clientes
        let clientes = []
        currentPageDocs.forEach((doc) => {
            clientes.push({
                id: doc.id,
                ...doc.data(),
            })
        })

        clientes = applyMemoryFilters(clientes)
        updatePaginationInfo()
        displayClients(clientes)

    } catch (error) {
        console.error("Error al cargar clientes con offset:", error)
        tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-red-500">Error al cargar clientes</td></tr>'
    }
}

// Función para cargar clientes con filtros mejorados
async function loadClientes(isPrevPage = false) {
    const tableBody = document.getElementById("clientsTableBody")
    if (!tableBody) return

    // Mostrar estado de carga
    tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center"><span class="spinner"></span> Cargando clientes...</td></tr>'

    try {
        // Construir la consulta base
        const clientesQuery = collection(db, "clientes")
        const queryConstraints = []

        // Aplicar filtros
        if (filtrosClientes.convenio) {
            queryConstraints.push(where("convenio", "==", filtrosClientes.convenio === "true"))
        }

        if (filtrosClientes.empresa) {
            queryConstraints.push(where("empresaId", "==", filtrosClientes.empresa))
        }

        // Ordenar por nombre
        queryConstraints.push(orderBy("nombre"))

        // Limitar resultados por página
        queryConstraints.push(limit(CLIENTS_PER_PAGE))

        // CORREGIDO: Aplicar paginación solo si no estamos en la primera página
        if (lastVisible && !isPrevPage && currentPage > 1) {
            queryConstraints.push(startAfter(lastVisible))
        } else if (isPrevPage) {
            // Para página anterior, necesitamos una lógica diferente
            // Por simplicidad, volvemos a la primera página
            resetPagination()
        }

        // Ejecutar la consulta
        const q = query(clientesQuery, ...queryConstraints)
        const clientesSnapshot = await getDocs(q)

        // Actualizar lastVisible para paginación solo si hay documentos
        const docs = clientesSnapshot.docs
        if (docs.length > 0) {
            lastVisible = docs[docs.length - 1]
        }

        // Calcular el total de páginas de manera más precisa
        await calculateTotalPages()

        // Actualizar información de paginación
        updatePaginationInfo()

        // Procesar clientes
        let clientes = []
        clientesSnapshot.forEach((doc) => {
            clientes.push({
                id: doc.id,
                ...doc.data(),
            })
        })

        // Aplicar filtros adicionales en memoria
        clientes = applyMemoryFilters(clientes)

        // Mostrar clientes en la tabla
        displayClients(clientes)

    } catch (error) {
        console.error("Error al cargar clientes:", error)
        tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-red-500">Error al cargar clientes</td></tr>'
        showToast("Error al cargar clientes", "danger")
    }
}

async function calculateTotalPages() {
    try {
        // Construir consulta para contar total de clientes con filtros aplicados
        const clientesQuery = collection(db, "clientes")
        const queryConstraints = []

        // Aplicar los mismos filtros que en la consulta principal
        if (filtrosClientes.convenio) {
            queryConstraints.push(where("convenio", "==", filtrosClientes.convenio === "true"))
        }

        if (filtrosClientes.empresa) {
            queryConstraints.push(where("empresaId", "==", filtrosClientes.empresa))
        }

        const q = query(clientesQuery, ...queryConstraints)
        const totalClientsSnapshot = await getDocs(q)

        // Aplicar filtros en memoria para obtener el conteo real
        let totalClients = 0
        totalClientsSnapshot.forEach((doc) => {
            const cliente = { id: doc.id, ...doc.data() }
            const filteredClientes = applyMemoryFilters([cliente])
            if (filteredClientes.length > 0) {
                totalClients++
            }
        })

        totalPages = Math.max(1, Math.ceil(totalClients / CLIENTS_PER_PAGE))
    } catch (error) {
        console.error("Error al calcular total de páginas:", error)
        totalPages = 1
    }
}

// Función para aplicar filtros en memoria
function applyMemoryFilters(clientes) {
    let filteredClientes = [...clientes]

    // Filtro de búsqueda
    if (filtrosClientes.busqueda) {
        const busqueda = filtrosClientes.busqueda.toLowerCase()
        filteredClientes = filteredClientes.filter(cliente =>
            (cliente.nombre && cliente.nombre.toLowerCase().includes(busqueda)) ||
            (cliente.telefono && cliente.telefono.includes(busqueda)) ||
            (cliente.email && cliente.email.toLowerCase().includes(busqueda))
        )
    }

    // Filtro de fecha de registro
    if (filtrosClientes.fechaRegistro) {
        const fechaFiltro = new Date(filtrosClientes.fechaRegistro)
        filteredClientes = filteredClientes.filter(cliente => {
            if (!cliente.fechaRegistro) return false
            const fechaRegistro = cliente.fechaRegistro instanceof Timestamp
                ? cliente.fechaRegistro.toDate()
                : new Date(cliente.fechaRegistro)
            return fechaRegistro >= fechaFiltro
        })
    }

    // Filtro de última visita
    if (filtrosClientes.ultimaVisita) {
        const diasAtras = parseInt(filtrosClientes.ultimaVisita)
        const fechaLimite = new Date()
        fechaLimite.setDate(fechaLimite.getDate() - diasAtras)

        filteredClientes = filteredClientes.filter(cliente => {
            if (!cliente.ultimaVisita) return false
            const ultimaVisita = cliente.ultimaVisita instanceof Timestamp
                ? cliente.ultimaVisita.toDate()
                : new Date(cliente.ultimaVisita)
            return ultimaVisita >= fechaLimite
        })
    }

    return filteredClientes
}

// Función para mostrar clientes en la tabla
function displayClients(clientes) {
    const tableBody = document.getElementById("clientsTableBody")

    if (clientes.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center">No se encontraron clientes</td></tr>'
        return
    }

    tableBody.innerHTML = ""

    clientes.forEach((cliente) => {
        // Formatear fecha de última visita
        let ultimaVisitaText = "Nunca"
        if (cliente.ultimaVisita) {
            const fecha = cliente.ultimaVisita instanceof Timestamp
                ? cliente.ultimaVisita.toDate()
                : new Date(cliente.ultimaVisita)
            ultimaVisitaText = fecha.toLocaleDateString()
        }

        const row = document.createElement("tr")
        row.className = "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"

        row.innerHTML = `
            <td class="py-3 px-4 font-mono text-sm">${cliente.id.substring(0, 8)}...</td>
            <td class="py-3 px-4 font-medium">${cliente.nombre || ""}</td>
            <td class="py-3 px-4">${cliente.telefono || ""}</td>
            <td class="py-3 px-4">${cliente.email || "No disponible"}</td>
            <td class="py-3 px-4">${ultimaVisitaText}</td>
            <td class="py-3 px-4">
                <div class="flex space-x-2">
                    <button class="view-client text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors" 
                            data-id="${cliente.id}" title="Ver cliente">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                    </button>
                    <button class="edit-client text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors" 
                            data-id="${cliente.id}" title="Editar cliente">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button class="delete-client text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors" 
                            data-id="${cliente.id}" title="Eliminar cliente">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        `

        tableBody.appendChild(row)
    })

    // Configurar eventos para los botones de acción
    setupClientActionEvents()
}

// Función para actualizar información de paginación
function updatePaginationInfo() {
    document.getElementById("currentPage").textContent = currentPage
    document.getElementById("totalPages").textContent = totalPages

    const prevBtn = document.getElementById("prevPageBtn")
    const nextBtn = document.getElementById("nextPageBtn")

    if (prevBtn) prevBtn.disabled = currentPage <= 1
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages
}

// Configurar eventos para los botones de acción de clientes
function setupClientActionEvents() {
    // Botones para ver clientes
    const viewButtons = document.querySelectorAll(".view-client")
    viewButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const clientId = button.getAttribute("data-id")
            viewClient(clientId)
        })
    })

    // Botones para editar clientes
    const editButtons = document.querySelectorAll(".edit-client")
    editButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const clientId = button.getAttribute("data-id")
            editClient(clientId)
        })
    })

    // Botones para eliminar clientes
    const deleteButtons = document.querySelectorAll(".delete-client")
    deleteButtons.forEach((button) => {
        button.addEventListener("click", async () => {
            const clientId = button.getAttribute("data-id")
            await confirmDeleteClient(clientId)
        })
    })
}

// Función para ver un cliente
async function viewClient(clientId) {
    try {
        const docRef = doc(db, "clientes", clientId)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
            const cliente = docSnap.data()
            currentClient = {
                id: clientId,
                ...cliente,
            }

            showClientCard(cliente)
            await loadClientHistory(clientId)
        } else {
            showToast("No se encontró el cliente", "danger")
        }
    } catch (error) {
        console.error("Error al obtener cliente:", error)
        showToast("Error al obtener el cliente", "danger")
    }
}

// Función para mostrar la tarjeta del cliente
function showClientCard(cliente) {
    const modal = document.getElementById("clientCardModal")
    if (!modal) return

    modal.style.display = "block"

    // Llenar información del cliente
    document.getElementById("cardClientName").textContent = cliente.nombre || "Sin nombre"
    document.getElementById("cardClientPhone").textContent = cliente.telefono || "No disponible"
    document.getElementById("cardClientEmail").textContent = cliente.email || "No disponible"
    document.getElementById("cardClientAddress").textContent = cliente.direccion || "No disponible"

    // Formatear fecha de nacimiento
    let fechaNacimientoText = "No disponible"
    if (cliente.fechaNacimiento) {
        const fecha = cliente.fechaNacimiento instanceof Timestamp
            ? cliente.fechaNacimiento.toDate()
            : new Date(cliente.fechaNacimiento)
        fechaNacimientoText = fecha.toLocaleDateString()
    }
    document.getElementById("cardClientBirthdate").textContent = fechaNacimientoText

    // Mostrar información de convenio
    document.getElementById("cardClientConvenio").textContent = cliente.convenio ? "Sí" : "No"

    // Mostrar información de empresa
    if (cliente.convenio && cliente.empresaId) {
        const empresa = empresas.find((e) => e.id === cliente.empresaId)
        document.getElementById("cardClientEmpresa").textContent = empresa ? empresa.nombre : "No especificada"
        document.getElementById("cardClientEmpresaContainer").style.display = "block"
    } else {
        document.getElementById("cardClientEmpresaContainer").style.display = "none"
    }
}

// Función para cargar el historial del cliente
async function loadClientHistory(clientId) {
    try {
        const historyBody = document.getElementById("clientHistoryBody")
        if (!historyBody) return

        historyBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center"><span class="spinner"></span> Cargando historial...</td></tr>'

        // Obtener ventas del cliente
        const ventasQuery = query(
            collection(db, "ventas"),
            where("clienteId", "==", clientId),
            orderBy("fecha", "desc")
        )

        const ventasSnapshot = await getDocs(ventasQuery)

        if (ventasSnapshot.empty) {
            historyBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center">No hay compras registradas</td></tr>'
            return
        }

        historyBody.innerHTML = ""
        let saldoTotalPendiente = 0

        // Procesar cada venta
        for (const ventaDoc of ventasSnapshot.docs) {
            const venta = {
                id: ventaDoc.id,
                ...ventaDoc.data(),
            }

            // Formatear fecha de la venta
            const fechaVenta = venta.fecha instanceof Timestamp ? venta.fecha.toDate() : new Date(venta.fecha)

            // Obtener información de productos
            let productosInfo = "Venta"
            if (venta.productos && venta.productos.length > 0) {
                productosInfo = venta.productos.map((p) => p.nombreProducto).join(", ")
                // Limitar longitud del texto
                if (productosInfo.length > 50) {
                    productosInfo = productosInfo.substring(0, 50) + "..."
                }
            }

            // Determinar estado inicial
            let estado = "Pendiente"
            let estadoClass = "text-yellow-500"

            // Crear fila principal de la venta
            const ventaRow = document.createElement("tr")
            ventaRow.className = "bg-gray-50 dark:bg-gray-700 font-semibold"

            ventaRow.innerHTML = `
                <td class="py-2 px-4">${fechaVenta.toLocaleDateString()}</td>
                <td class="py-2 px-4">${productosInfo}</td>
                <td class="py-2 px-4">
                    <span class="${estadoClass} font-semibold">${estado}</span>
                </td>
                <td class="py-2 px-4 flex justify-between items-center">
                    <span class="font-bold">$${venta.total.toFixed(2)}</span>
                    <button class="text-blue-500 hover:text-blue-700 text-sm" onclick="toggleVentaDetails('${venta.id}')">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </td>
            `

            historyBody.appendChild(ventaRow)

            // Crear contenedor para los detalles de la venta
            const detallesContainer = document.createElement("tr")
            detallesContainer.id = `detalles-${venta.id}`
            detallesContainer.style.display = "none"
            detallesContainer.innerHTML = `
                <td colspan="4" class="py-0 px-4">
                    <div class="bg-white dark:bg-gray-800 border-l-4 border-blue-500 pl-4 py-2">
                        <div id="detalles-content-${venta.id}">
                            <div class="text-center text-gray-500">Cargando detalles...</div>
                        </div>
                    </div>
                </td>
            `

            historyBody.appendChild(detallesContainer)

            // Cargar detalles de abonos y pagos
            await loadVentaDetails(venta.id, venta.total, venta.abono || 0)
        }

        // Calcular y mostrar saldo total pendiente
        await calculateAndShowTotalPending(historyBody, clientId)

        // Configurar eventos para los botones de pago
        setupPaymentButtons(clientId)

    } catch (error) {
        console.error("Error al cargar historial del cliente:", error)
        const historyBody = document.getElementById("clientHistoryBody")
        if (historyBody) {
            historyBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-red-500">Error al cargar historial</td></tr>'
        }
    }
}

async function loadVentaDetails(ventaId, totalVenta, abonoInicial) {
    try {
        const contentDiv = document.getElementById(`detalles-content-${ventaId}`)
        if (!contentDiv) return

        let detallesHTML = ""
        let totalAbonado = 0
        let totalPagado = 0

        // Agregar abono inicial si existe
        if (abonoInicial > 0) {
            const fechaVenta = new Date() // Usaremos la fecha de la venta
            detallesHTML += `
                <div class="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-600">
                    <div class="flex items-center">
                        <span class="text-sm text-gray-600 dark:text-gray-400 mr-2">${fechaVenta.toLocaleDateString()}</span>
                        <span class="text-sm">Abono inicial</span>
                    </div>
                    <span class="text-green-500 font-semibold">+$${abonoInicial.toFixed(2)}</span>
                </div>
            `
            totalAbonado += abonoInicial
        }

        // Obtener abonos adicionales
        const abonosQuery = query(
            collection(db, "abonos"),
            where("ventaId", "==", ventaId),
            orderBy("fecha", "asc")
        )

        const abonosSnapshot = await getDocs(abonosQuery)
        abonosSnapshot.forEach((doc) => {
            const abono = doc.data()
            // Evitar duplicar el abono inicial
            if (abono.descripcion !== 'Abono inicial') {
                const fechaAbono = abono.fecha instanceof Timestamp ? abono.fecha.toDate() : new Date(abono.fecha)
                detallesHTML += `
                    <div class="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-600">
                        <div class="flex items-center">
                            <span class="text-sm text-gray-600 dark:text-gray-400 mr-2">${fechaAbono.toLocaleDateString()}</span>
                            <span class="text-sm">${abono.descripcion || 'Abono'}</span>
                        </div>
                        <span class="text-green-500 font-semibold">+$${abono.monto.toFixed(2)}</span>
                    </div>
                `
                totalAbonado += abono.monto
            }
        })

        // Obtener pagos
        const pagosQuery = query(
            collection(db, "pagos"),
            where("ventaId", "==", ventaId),
            orderBy("fecha", "asc")
        )

        const pagosSnapshot = await getDocs(pagosQuery)
        pagosSnapshot.forEach((doc) => {
            const pago = doc.data()
            const fechaPago = pago.fecha instanceof Timestamp ? pago.fecha.toDate() : new Date(pago.fecha)
            detallesHTML += `
                <div class="flex justify-between items-center py-1 border-b border-gray-200 dark:border-gray-600">
                    <div class="flex items-center">
                        <span class="text-sm text-gray-600 dark:text-gray-400 mr-2">${fechaPago.toLocaleDateString()}</span>
                        <span class="text-sm">${pago.descripcion || 'Pago'} (${pago.metodoPago || 'Efectivo'})</span>
                    </div>
                    <span class="text-blue-500 font-semibold">+$${pago.monto.toFixed(2)}</span>
                </div>
            `
            totalPagado += pago.monto
        })

        // Calcular saldo pendiente
        const saldoPendiente = totalVenta - totalAbonado - totalPagado

        // Agregar fila de saldo pendiente
        detallesHTML += `
            <div class="flex justify-between items-center py-2 mt-2 bg-gray-100 dark:bg-gray-700 rounded px-2">
                <span class="font-semibold">Saldo pendiente</span>
                <div class="flex items-center gap-2">
                    <span class="font-bold ${saldoPendiente > 0 ? 'text-red-500' : 'text-green-500'}">
                        $${saldoPendiente.toFixed(2)}
                    </span>
                    ${saldoPendiente > 0 ? `
                        <button class="add-payment-btn bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1" 
                                data-venta-id="${ventaId}" data-saldo="${saldoPendiente.toFixed(2)}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Pagar
                        </button>
                    ` : `
                        <span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                            ✓ Pagado
                        </span>
                    `}
                </div>
            </div>
        `

        contentDiv.innerHTML = detallesHTML

    } catch (error) {
        console.error("Error al cargar detalles de venta:", error)
        const contentDiv = document.getElementById(`detalles-content-${ventaId}`)
        if (contentDiv) {
            contentDiv.innerHTML = '<div class="text-red-500 text-sm">Error al cargar detalles</div>'
        }
    }
}

async function calculateAndShowTotalPending(historyBody, clientId) {
    try {
        // Obtener todas las ventas del cliente
        const ventasQuery = query(
            collection(db, "ventas"),
            where("clienteId", "==", clientId)
        )

        const ventasSnapshot = await getDocs(ventasQuery)
        let saldoTotalPendiente = 0

        // Calcular saldo pendiente de cada venta
        for (const ventaDoc of ventasSnapshot.docs) {
            const saldoInfo = await calcularSaldoPendiente(ventaDoc.id)
            saldoTotalPendiente += saldoInfo.saldoPendiente
        }

        // Mostrar saldo total pendiente si hay alguno
        if (saldoTotalPendiente > 0) {
            const totalRow = document.createElement("tr")
            totalRow.className = "bg-red-50 dark:bg-red-900/20 border-t-2 border-red-500"

            totalRow.innerHTML = `
                <td class="py-3 px-4 font-bold text-lg" colspan="3">SALDO TOTAL PENDIENTE</td>
                <td class="py-3 px-4">
                    <div class="flex justify-between items-center">
                        <span class="text-red-600 font-bold text-lg">$${saldoTotalPendiente.toFixed(2)}</span>
                        <button class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm font-semibold" 
                                onclick="payAllPending('${clientId}', ${saldoTotalPendiente})">
                            Pagar Todo
                        </button>
                    </div>
                </td>
            `

            historyBody.appendChild(totalRow)
        }

    } catch (error) {
        console.error("Error al calcular saldo total pendiente:", error)
    }
}

window.toggleVentaDetails = function (ventaId) {
    const detallesRow = document.getElementById(`detalles-${ventaId}`)
    if (detallesRow) {
        if (detallesRow.style.display === "none") {
            detallesRow.style.display = "table-row"
        } else {
            detallesRow.style.display = "none"
        }
    }
}

// Función para configurar botones de pago
function setupPaymentButtons(clientId) {
    // Remover event listeners anteriores
    document.querySelectorAll(".add-payment-btn").forEach(button => {
        button.replaceWith(button.cloneNode(true))
    })

    // Agregar nuevos event listeners
    document.querySelectorAll(".add-payment-btn").forEach((button) => {
        button.addEventListener("click", async (e) => {
            e.preventDefault()
            e.stopPropagation()

            const ventaId = button.getAttribute("data-venta-id")
            const saldoPendiente = parseFloat(button.getAttribute("data-saldo"))

            await openPaymentModal(ventaId, clientId, saldoPendiente)
        })
    })
}

async function openPaymentModal(ventaId, clienteId, saldoPendiente) {
    try {
        // Crear modal de pago si no existe
        let paymentModal = document.getElementById('paymentModal')
        if (!paymentModal) {
            paymentModal = document.createElement('div')
            paymentModal.id = 'paymentModal'
            paymentModal.className = 'modal'

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
                            <p class="text-sm text-gray-500 mt-1">Saldo pendiente: <span id="paymentSaldoPendiente"></span></p>
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

            // Configurar eventos para el modal
            setupPaymentModalEvents(paymentModal)
        }

        // Mostrar modal y llenar datos
        paymentModal.style.display = 'block'
        document.getElementById('paymentVentaId').value = ventaId
        document.getElementById('paymentClienteId').value = clienteId || ''
        document.getElementById('paymentSaldoPendiente').textContent = `$${saldoPendiente.toFixed(2)}`

        // Establecer fecha actual
        const today = new Date()
        const year = today.getFullYear()
        const month = String(today.getMonth() + 1).padStart(2, '0')
        const day = String(today.getDate()).padStart(2, '0')
        document.getElementById('paymentFecha').value = `${year}-${month}-${day}`

        // Limpiar otros campos
        document.getElementById('paymentTipo').value = 'abono'
        document.getElementById('paymentMonto').value = ''
        document.getElementById('paymentMetodo').value = 'efectivo'
        document.getElementById('paymentDescripcion').value = ''

    } catch (error) {
        console.error("Error al abrir modal de pago:", error)
        showToast('Error al abrir formulario de pago', 'danger')
    }
}

function setupPaymentModalEvents(paymentModal) {
    const closeBtn = paymentModal.querySelector('.close')
    const closeModalBtn = paymentModal.querySelector('.close-modal')

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            paymentModal.style.display = 'none'
        })
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            paymentModal.style.display = 'none'
        })
    }

    // Cerrar modal al hacer clic fuera del contenido
    paymentModal.addEventListener('click', (event) => {
        if (event.target === paymentModal) {
            paymentModal.style.display = 'none'
        }
    })

    // Configurar formulario de pago
    const paymentForm = document.getElementById('paymentForm')
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault()

            try {
                const ventaId = document.getElementById('paymentVentaId').value
                const clienteId = document.getElementById('paymentClienteId').value
                const tipo = document.getElementById('paymentTipo').value
                const monto = parseFloat(document.getElementById('paymentMonto').value) || 0
                const metodo = document.getElementById('paymentMetodo').value
                const fecha = document.getElementById('paymentFecha').value
                const descripcion = document.getElementById('paymentDescripcion').value

                // Validar monto
                if (monto <= 0) {
                    showToast('El monto debe ser mayor a cero', 'warning')
                    return
                }

                // Validar que el monto no sea mayor al saldo pendiente
                const saldoInfo = await calcularSaldoPendiente(ventaId)
                if (monto > saldoInfo.saldoPendiente) {
                    showToast('El monto no puede ser mayor al saldo pendiente', 'warning')
                    return
                }

                // Mostrar confirmación de pago
                const confirmed = await showPaymentConfirmation(monto, `${tipo === 'abono' ? 'el abono' : 'el pago'}`)

                if (!confirmed) {
                    return
                }

                // Registrar pago o abono
                if (tipo === 'abono') {
                    await registrarAbono(ventaId, clienteId, monto, descripcion || 'Abono', metodo, fecha ? new Date(fecha) : new Date())
                } else {
                    await registrarPago(ventaId, clienteId, monto, descripcion || 'Pago', metodo, fecha ? new Date(fecha) : new Date())
                }

                // Actualizar estado de la venta
                const nuevoSaldoInfo = await calcularSaldoPendiente(ventaId)
                let nuevoEstado = 'pendiente'

                if (nuevoSaldoInfo.saldoPendiente <= 0) {
                    nuevoEstado = 'pagada'
                } else if (nuevoSaldoInfo.totalAbonado > 0) {
                    nuevoEstado = 'parcial'
                }

                await updateDoc(doc(db, 'ventas', ventaId), {
                    estado: nuevoEstado,
                    updatedAt: serverTimestamp()
                })

                showToast(`${tipo === 'abono' ? 'Abono' : 'Pago'} registrado correctamente`, 'success')

                // Cerrar modal
                paymentModal.style.display = 'none'

                // Recargar historial del cliente
                await loadClientHistory(currentClient.id)

            } catch (error) {
                console.error(`Error al registrar ${tipo === 'abono' ? 'abono' : 'pago'}:`, error)
                showToast(`Error al registrar ${tipo === 'abono' ? 'abono' : 'pago'}`, 'danger')
            }
        })
    }

    // Configurar evento para cambiar tipo de pago
    const paymentTipo = document.getElementById('paymentTipo')
    const paymentMonto = document.getElementById('paymentMonto')

    if (paymentTipo && paymentMonto) {
        paymentTipo.addEventListener('change', async () => {
            const tipo = paymentTipo.value
            const ventaId = document.getElementById('paymentVentaId').value

            if (tipo === 'pago') {
                // Establecer monto igual al saldo pendiente
                const saldoInfo = await calcularSaldoPendiente(ventaId)
                paymentMonto.value = saldoInfo.saldoPendiente.toFixed(2)
            } else {
                // Limpiar monto
                paymentMonto.value = ''
            }
        })
    }
}

async function registrarAbono(ventaId, clienteId, monto, descripcion = 'Abono', metodoPago = 'efectivo', fecha = new Date()) {
    try {
        const abonoData = {
            ventaId,
            clienteId: clienteId || null,
            monto,
            descripcion,
            metodoPago,
            fecha: fecha,
            createdAt: serverTimestamp()
        }

        const abonoRef = await addDoc(collection(db, 'abonos'), abonoData)

        if (clienteId) {
            await updateDoc(doc(db, 'clientes', clienteId), {
                ultimaVisita: serverTimestamp()
            })
        }

        return abonoRef.id
    } catch (error) {
        console.error("Error al registrar abono:", error)
        throw error
    }
}

async function registrarPago(ventaId, clienteId, monto, descripcion = 'Pago', metodoPago = 'efectivo', fecha = new Date()) {
    try {
        const pagoData = {
            ventaId,
            clienteId: clienteId || null,
            monto,
            descripcion,
            metodoPago,
            fecha: fecha,
            createdAt: serverTimestamp()
        }

        const pagoRef = await addDoc(collection(db, 'pagos'), pagoData)

        if (clienteId) {
            await updateDoc(doc(db, 'clientes', clienteId), {
                ultimaVisita: serverTimestamp()
            })
        }

        return pagoRef.id
    } catch (error) {
        console.error("Error al registrar pago:", error)
        throw error
    }
}

window.payAllPending = async function (clienteId, saldoTotal) {
    const confirmed = await showPaymentConfirmation(saldoTotal, "el pago total de todas las deudas pendientes")

    if (confirmed) {
        try {
            // Obtener todas las ventas con saldo pendiente
            const ventasQuery = query(
                collection(db, "ventas"),
                where("clienteId", "==", clienteId)
            )

            const ventasSnapshot = await getDocs(ventasQuery)

            for (const ventaDoc of ventasSnapshot.docs) {
                const saldoInfo = await calcularSaldoPendiente(ventaDoc.id)

                if (saldoInfo.saldoPendiente > 0) {
                    // Registrar pago completo para esta venta
                    await registrarPago(
                        ventaDoc.id,
                        clienteId,
                        saldoInfo.saldoPendiente,
                        'Pago total pagado',
                        'efectivo'
                    )

                    // Actualizar estado de la venta
                    await updateDoc(doc(db, 'ventas', ventaDoc.id), {
                        estado: 'pagada',
                        updatedAt: serverTimestamp()
                    })
                }
            }

            showToast('Todos los pagos pendientes han sido registrados', 'success')

            // Recargar historial
            await loadClientHistory(clienteId)

        } catch (error) {
            console.error("Error al pagar todo:", error)
            showToast('Error al procesar los pagos', 'danger')
        }
    }
}

// Función para editar un cliente
async function editClient(clientId) {
    try {
        const docRef = doc(db, "clientes", clientId)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
            const cliente = docSnap.data()
            openClientModal({
                id: clientId,
                ...cliente
            })
        } else {
            showToast("No se encontró el cliente", "danger")
        }
    } catch (error) {
        console.error("Error al obtener cliente:", error)
        showToast("Error al obtener el cliente", "danger")
    }
}

// Función para confirmar eliminación de un cliente con doble verificación
async function confirmDeleteClient(clientId) {
    try {
        // Obtener información del cliente
        const docRef = doc(db, "clientes", clientId)
        const docSnap = await getDoc(docRef)

        if (!docSnap.exists()) {
            showToast("No se encontró el cliente", "danger")
            return
        }

        const cliente = docSnap.data()

        // Primera confirmación
        const firstConfirm = await showConfirmDialog(
            "Eliminar Cliente",
            `¿Está seguro de que desea eliminar al cliente "${cliente.nombre}"?`,
            "Sí, eliminar",
            "Cancelar",
            "warning"
        )

        if (firstConfirm) {
            // Segunda confirmación
            const secondConfirm = await showConfirmDialog(
                "Confirmación Final",
                `Esta acción eliminará permanentemente al cliente "${cliente.nombre}" y no se puede deshacer. ¿Está completamente seguro?`,
                "Eliminar definitivamente",
                "Cancelar",
                "danger"
            )

            if (secondConfirm) {
                await deleteClient(clientId)
            }
        }
    } catch (error) {
        console.error("Error al confirmar eliminación:", error)
        showToast("Error al procesar la eliminación", "danger")
    }
}

// Función para eliminar un cliente
async function deleteClient(clientId) {
    try {
        await deleteDoc(doc(db, "clientes", clientId))
        showToast("Cliente eliminado correctamente", "success")
        resetPagination()
        await loadClientes()
    } catch (error) {
        console.error("Error al eliminar cliente:", error)
        showToast("Error al eliminar el cliente", "danger")
    }
}

// Función para calcular saldo pendiente de una venta
async function calcularSaldoPendiente(ventaId) {
    try {
        const ventaDoc = await getDoc(doc(db, "ventas", ventaId))
        if (!ventaDoc.exists()) {
            throw new Error("La venta no existe")
        }

        const venta = ventaDoc.data()
        const total = venta.total

        // Obtener abonos
        const abonosQuery = query(collection(db, "abonos"), where("ventaId", "==", ventaId))
        const abonosSnapshot = await getDocs(abonosQuery)

        let totalAbonado = venta.abono || 0 // Incluir abono inicial
        abonosSnapshot.forEach((doc) => {
            const abono = doc.data()
            // Evitar contar el abono inicial dos veces
            if (abono.descripcion !== 'Abono inicial') {
                totalAbonado += abono.monto
            }
        })

        // Obtener pagos
        const pagosQuery = query(collection(db, "pagos"), where("ventaId", "==", ventaId))
        const pagosSnapshot = await getDocs(pagosQuery)

        let totalPagado = 0
        pagosSnapshot.forEach((doc) => {
            const pago = doc.data()
            totalPagado += pago.monto
        })

        const saldoPendiente = total - totalAbonado - totalPagado

        return {
            total,
            totalAbonado,
            totalPagado,
            saldoPendiente,
        }
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
