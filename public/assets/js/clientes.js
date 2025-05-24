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

// Función para mostrar notificaciones toast
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
            window.print()
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
        button.addEventListener("click", () => {
            const clientId = button.getAttribute("data-id")
            confirmDeleteClient(clientId)
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

            // Calcular saldo pendiente de la venta
            const saldoInfo = await calcularSaldoPendiente(venta.id)
            saldoTotalPendiente += saldoInfo.saldoPendiente

            // Determinar estado de la venta
            let estado = "Pendiente"
            let estadoClass = "text-red-500"

            if (saldoInfo.saldoPendiente <= 0) {
                estado = "Pagado"
                estadoClass = "text-green-500"
            } else if (saldoInfo.totalAbonado > 0 || saldoInfo.totalPagado > 0) {
                estado = "Abonado"
                estadoClass = "text-yellow-500"
            }

            // Formatear fecha
            const fecha = venta.fecha instanceof Timestamp ? venta.fecha.toDate() : new Date(venta.fecha)

            // Obtener información de productos
            let productosInfo = "Venta"
            if (venta.productos && venta.productos.length > 0) {
                productosInfo = venta.productos.map((p) => p.nombreProducto).join(", ")
            }

            // Crear fila para la venta
            const ventaRow = document.createElement("tr")
            ventaRow.className = "hover:bg-gray-50 dark:hover:bg-gray-700"

            ventaRow.innerHTML = `
                <td class="py-2 px-4">${fecha.toLocaleDateString()}</td>
                <td class="py-2 px-4">${productosInfo}</td>
                <td class="py-2 px-4">
                    <span class="${estadoClass} font-semibold">${estado}</span>
                </td>
                <td class="py-2 px-4 flex justify-between">
                    <span class="font-semibold">$${venta.total.toFixed(2)}</span>
                    ${saldoInfo.saldoPendiente > 0 ? `
                        <button class="pay-btn add-payment-btn" data-venta-id="${venta.id}" data-saldo="${saldoInfo.saldoPendiente.toFixed(2)}">
                            <span class="btn-text">Pagar</span>
                            <div class="icon-container">
                                <svg viewBox="0 0 24 24" class="icon card-icon">
                                    <path d="M20,8H4V6H20M20,18H4V12H20M20,4H4C2.89,4 2,4.89 2,6V18C2,19.11 2.89,20 4,20H20C21.11,20 22,19.11 22,18V6C22,4.89 21.11,4 20,4Z" fill="currentColor"></path>
                                </svg>
                                <svg viewBox="0 0 24 24" class="icon payment-icon">
                                    <path d="M2,17H22V21H2V17M6.25,7H9V6H6V3H18V6H15V7H17.75L19,17H5L6.25,7M9,10H15V8H9V10M9,13H15V11H9V13Z" fill="currentColor"></path>
                                </svg>
                                <svg viewBox="0 0 24 24" class="icon dollar-icon">
                                    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" fill="currentColor"></path>
                                </svg>
                                <svg viewBox="0 0 24 24" class="icon wallet-icon default-icon">
                                    <path d="M21,18V19A2,2 0 0,1 19,21H5C3.89,21 3,20.1 3,19V5A2,2 0 0,1 5,3H19A2,2 0 0,1 21,5V6H12C10.89,6 10,6.9 10,8V16A2,2 0 0,0 12,18M12,16H22V8H12M16,13.5A1.5,1.5 0 0,1 14.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,12A1.5,1.5 0 0,1 16,13.5Z" fill="currentColor"></path>
                                </svg>
                                <svg viewBox="0 0 24 24" class="icon check-icon">
                                    <path d="M9,16.17L4.83,12L3.41,13.41L9,19L21,7L19.59,5.59L9,16.17Z" fill="currentColor"></path>
                                </svg>
                            </div>
                        </button>
                    ` : ""}
                </td>
            `

            historyBody.appendChild(ventaRow)
        }

        // Mostrar saldo total pendiente si hay alguno
        if (saldoTotalPendiente > 0) {
            const totalRow = document.createElement("tr")
            totalRow.className = "bg-primary/10 dark:bg-primary/20 font-bold"

            totalRow.innerHTML = `
                <td class="py-3 px-4" colspan="3">SALDO TOTAL PENDIENTE</td>
                <td class="py-3 px-4 text-red-600">$${saldoTotalPendiente.toFixed(2)}</td>
            `

            historyBody.appendChild(totalRow)
        }

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

// Función para configurar botones de pago
function setupPaymentButtons(clientId) {
    const paymentButtons = document.querySelectorAll(".add-payment-btn")
    paymentButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const ventaId = button.getAttribute("data-venta-id")
            showToast("Funcionalidad de pagos en desarrollo", "info")
            // Aquí se implementaría el modal de pagos
        })
    })
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

// Función para confirmar eliminación de un cliente
function confirmDeleteClient(clientId) {
    if (confirm("¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer.")) {
        deleteClient(clientId)
    }
}

// Función para eliminar un cliente
async function deleteClient(clientId) {
    try {
        await deleteDoc(doc(db, "clientes", clientId))
        showToast("Cliente eliminado correctamente", "success")
        loadClientes()
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

        let totalAbonado = 0
        abonosSnapshot.forEach((doc) => {
            const abono = doc.data()
            totalAbonado += abono.monto
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