import {
    collection,
    getDocs,
    doc,
    getDoc,
    deleteDoc,
    addDoc,
    updateDoc,
    setDoc,
    serverTimestamp,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";
import { checkAndCreateInventoryCollection } from "./auth-check.js";

// Variables globales
let currentClient = null;
let lastVisible = null;
const CLIENTS_PER_PAGE = 10;
let empresas = [];

// Configuración de paginación
let currentPage = 1;
let totalPages = 1;

// Filtros activos
let filtrosClientes = {
    convenio: '',
    empresa: '',
    busqueda: ''
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Página de clientes cargada');

    try {
        // Verificar colecciones de inventario (reusando la función existente)
        await checkAndCreateInventoryCollection();

        // Verificar y crear colecciones específicas para clientes
        await checkAndCreateClientesCollection();

        // Cargar empresas para los filtros y formularios
        await loadEmpresas();

        // Configurar eventos para los modales
        setupModalEvents();

        // Configurar eventos para los formularios
        setupFormEvents();

        // Configurar eventos para los filtros
        setupFilterEvents();

        // Configurar eventos para las búsquedas
        setupSearchEvents();

        // Configurar eventos para las pestañas de historial
        setupHistoryTabs();

        // Configurar eventos para la paginación
        setupPaginationEvents();

        // Cargar datos iniciales
        await loadClientes();

    } catch (error) {
        console.error("Error al inicializar la página de clientes:", error);
        showToast('Error al cargar la página de clientes', 'danger');
    }
});

// Función para verificar y crear colecciones necesarias para clientes
async function checkAndCreateClientesCollection() {
    try {
        console.log("Verificando colecciones de clientes...");

        // Verificar si existe la colección de clientes
        const clientesSnapshot = await getDocs(collection(db, 'clientes'));
        if (clientesSnapshot.empty) {
            console.log("Creando colección de clientes...");
            // No es necesario crear un documento placeholder, la colección se creará automáticamente
            // al agregar el primer cliente
        }

        // Verificar si existe la colección de empresas (para convenios)
        const empresasSnapshot = await getDocs(collection(db, 'empresas'));
        if (empresasSnapshot.empty) {
            console.log("Creando colección de empresas...");
            // Crear algunas empresas de ejemplo para convenios
            const empresasIniciales = [
                { nombre: 'IMSS', descripcion: 'Instituto Mexicano del Seguro Social', descuento: 10 },
                { nombre: 'ISSSTE', descripcion: 'Instituto de Seguridad y Servicios Sociales de los Trabajadores del Estado', descuento: 15 },
                { nombre: 'CFE', descripcion: 'Comisión Federal de Electricidad', descuento: 8 },
                { nombre: 'PEMEX', descripcion: 'Petróleos Mexicanos', descuento: 12 }
            ];

            for (const empresa of empresasIniciales) {
                await addDoc(collection(db, 'empresas'), {
                    ...empresa,
                    createdAt: serverTimestamp()
                });
            }
        }

        // Verificar si existe la colección de ventas
        const ventasSnapshot = await getDocs(collection(db, 'ventas'));
        if (ventasSnapshot.empty) {
            console.log("Creando colección de ventas...");
            // No es necesario crear un documento placeholder
        }

        // Verificar si existe la colección de abonos
        const abonosSnapshot = await getDocs(collection(db, 'abonos'));
        if (abonosSnapshot.empty) {
            console.log("Creando colección de abonos...");
            // No es necesario crear un documento placeholder
        }

        // Verificar si existe la colección de pagos
        const pagosSnapshot = await getDocs(collection(db, 'pagos'));
        if (pagosSnapshot.empty) {
            console.log("Creando colección de pagos...");
            // No es necesario crear un documento placeholder
        }

        // Verificar si existe la colección de recetas
        const recetasSnapshot = await getDocs(collection(db, 'recetas'));
        if (recetasSnapshot.empty) {
            console.log("Creando colección de recetas...");
            // No es necesario crear un documento placeholder
        }

        // Verificar si existe la colección de citas
        const citasSnapshot = await getDocs(collection(db, 'citas'));
        if (citasSnapshot.empty) {
            console.log("Creando colección de citas...");
            // No es necesario crear un documento placeholder
        }

        console.log("Verificación de colecciones de clientes completada");
    } catch (error) {
        console.error("Error al verificar o crear colecciones de clientes:", error);
        throw error;
    }
}

// Función para cargar empresas
async function loadEmpresas() {
    try {
        const empresasSnapshot = await getDocs(collection(db, 'empresas'));
        empresas = [];

        empresasSnapshot.forEach(doc => {
            empresas.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Actualizar los selectores de empresas
        const clientEmpresaSelect = document.getElementById('clientEmpresa');
        const filtroEmpresaSelect = document.getElementById('filtroEmpresa');

        if (clientEmpresaSelect) {
            clientEmpresaSelect.innerHTML = '<option value="">Sin convenio</option>';
            empresas.forEach(empresa => {
                const option = document.createElement('option');
                option.value = empresa.id;
                option.textContent = empresa.nombre;
                clientEmpresaSelect.appendChild(option);
            });
        }

        if (filtroEmpresaSelect) {
            filtroEmpresaSelect.innerHTML = '<option value="">Todas</option>';
            empresas.forEach(empresa => {
                const option = document.createElement('option');
                option.value = empresa.id;
                option.textContent = empresa.nombre;
                filtroEmpresaSelect.appendChild(option);
            });
        }

        console.log("Empresas cargadas:", empresas.length);
    } catch (error) {
        console.error("Error al cargar empresas:", error);
        showToast('Error al cargar empresas', 'danger');
    }
}

// Función para mostrar notificaciones toast
function showToast(message, type = 'info') {
    // Crear contenedor de toast si no existe
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'fixed top-4 right-4 z-50 max-w-xs';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 mb-3 flex items-center justify-between border-l-4 ${type === 'success' ? 'border-green-500' :
            type === 'danger' ? 'border-red-500' :
                type === 'warning' ? 'border-yellow-500' : 'border-blue-500'
        }`;

    toast.innerHTML = `
        <div class="flex items-center">
            <span class="${type === 'success' ? 'text-green-500' :
            type === 'danger' ? 'text-red-500' :
                type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
        }">${message}</span>
        </div>
        <button type="button" class="ml-4 text-gray-400 hover:text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    `;

    toastContainer.appendChild(toast);

    // Agregar evento para cerrar el toast
    const closeBtn = toast.querySelector('button');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            toast.remove();
        });
    }

    // Cerrar automáticamente después de 5 segundos
    setTimeout(() => {
        if (toastContainer.contains(toast)) {
            toast.remove();
        }
    }, 5000);
}

// Configurar eventos para los modales
function setupModalEvents() {
    // Configurar botón para agregar cliente
    const addClientBtn = document.getElementById('addClientBtn');
    if (addClientBtn) {
        addClientBtn.addEventListener('click', () => {
            // Mostrar modal de cliente
            const modal = document.getElementById('clientModal');
            if (modal) {
                modal.style.display = 'block';
                document.getElementById('modalTitle').textContent = 'Nuevo Cliente';
                document.getElementById('clientForm').reset();
                document.getElementById('clientId').value = '';

                // Deshabilitar el selector de empresa si no hay convenio
                const clientConvenio = document.getElementById('clientConvenio');
                const clientEmpresaGroup = document.getElementById('clientEmpresaGroup');
                const clientEmpresa = document.getElementById('clientEmpresa');

                if (clientConvenio && clientEmpresaGroup && clientEmpresa) {
                    clientConvenio.checked = false;
                    clientEmpresaGroup.classList.add('opacity-50');
                    clientEmpresa.disabled = true;
                }
            }
        });
    }

    // Configurar botones para cerrar modales
    const closeButtons = document.querySelectorAll('.close, .close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });

    // Cerrar modal al hacer clic fuera del contenido
    window.addEventListener('click', (event) => {
        document.querySelectorAll('.modal').forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Configurar checkbox de convenio
    const clientConvenio = document.getElementById('clientConvenio');
    const clientEmpresaGroup = document.getElementById('clientEmpresaGroup');
    const clientEmpresa = document.getElementById('clientEmpresa');

    if (clientConvenio && clientEmpresaGroup && clientEmpresa) {
        clientConvenio.addEventListener('change', () => {
            if (clientConvenio.checked) {
                clientEmpresaGroup.classList.remove('opacity-50');
                clientEmpresa.disabled = false;
            } else {
                clientEmpresaGroup.classList.add('opacity-50');
                clientEmpresa.disabled = true;
                clientEmpresa.value = '';
            }
        });
    }

    // Configurar botón para cerrar tarjeta de cliente
    const closeCardBtn = document.getElementById('closeCardBtn');
    if (closeCardBtn) {
        closeCardBtn.addEventListener('click', () => {
            const clientCardModal = document.getElementById('clientCardModal');
            if (clientCardModal) {
                clientCardModal.style.display = 'none';
            }
        });
    }

    // Configurar botón para imprimir tarjeta
    const printCardBtn = document.getElementById('printCardBtn');
    if (printCardBtn) {
        printCardBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // Configurar botones para nuevas acciones
    const newSaleBtn = document.getElementById('newSaleBtn');
    if (newSaleBtn) {
        newSaleBtn.addEventListener('click', () => {
            if (currentClient) {
                // Redirigir a la página de ventas con el ID del cliente
                window.location.href = `ventas.html?clientId=${currentClient.id}`;
            }
        });
    }

    const newRecetaBtn = document.getElementById('newRecetaBtn');
    if (newRecetaBtn) {
        newRecetaBtn.addEventListener('click', () => {
            // Implementar lógica para nueva receta
            showToast('Funcionalidad de nueva receta en desarrollo', 'info');
        });
    }

    const newCitaBtn = document.getElementById('newCitaBtn');
    if (newCitaBtn) {
        newCitaBtn.addEventListener('click', () => {
            // Implementar lógica para nueva cita
            showToast('Funcionalidad de nueva cita en desarrollo', 'info');
        });
    }
}

// Configurar eventos para los formularios
function setupFormEvents() {
    // Configurar formulario de cliente
    const clientForm = document.getElementById('clientForm');
    if (clientForm) {
        clientForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                const clientId = document.getElementById('clientId').value;
                const nombre = document.getElementById('clientName').value;
                const telefono = document.getElementById('clientPhone').value;
                const email = document.getElementById('clientEmail').value;
                const direccion = document.getElementById('clientAddress').value;
                const fechaNacimiento = document.getElementById('clientBirthdate').value;
                const convenio = document.getElementById('clientConvenio').checked;
                const empresaId = convenio ? document.getElementById('clientEmpresa').value : '';

                // Validar campos requeridos
                if (!nombre || !telefono) {
                    showToast('Por favor, complete los campos requeridos', 'warning');
                    return;
                }

                // Crear objeto de cliente
                const clienteData = {
                    nombre,
                    telefono,
                    email: email || '',
                    direccion: direccion || '',
                    fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
                    convenio,
                    empresaId: empresaId || null,
                    updatedAt: serverTimestamp()
                };

                if (!clientId) {
                    // Agregar fecha de registro para nuevos clientes
                    clienteData.fechaRegistro = serverTimestamp();
                    clienteData.ultimaVisita = null;

                    // Agregar nuevo cliente
                    await addDoc(collection(db, 'clientes'), clienteData);
                    showToast('Cliente agregado correctamente', 'success');
                } else {
                    // Actualizar cliente existente
                    await updateDoc(doc(db, 'clientes', clientId), clienteData);
                    showToast('Cliente actualizado correctamente', 'success');
                }

                // Cerrar modal
                document.getElementById('clientModal').style.display = 'none';

                // Recargar clientes
                await loadClientes();

            } catch (error) {
                console.error('Error al guardar cliente:', error);
                showToast('Error al guardar el cliente', 'danger');
            }
        });
    }
}

// Configurar eventos para los filtros
function setupFilterEvents() {
    // Mostrar/ocultar filtros
    const toggleFiltrosBtn = document.createElement('button');
    toggleFiltrosBtn.id = 'toggleFiltrosBtn';
    toggleFiltrosBtn.className = 'btn-action bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white py-2 px-4 rounded shadow-sm flex items-center ml-2';
    toggleFiltrosBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Filtros
    `;

    // Insertar el botón después del botón de agregar cliente
    const addClientBtn = document.getElementById('addClientBtn');
    if (addClientBtn && addClientBtn.parentNode) {
        addClientBtn.parentNode.insertBefore(toggleFiltrosBtn, addClientBtn.nextSibling);
    }

    const filtrosPanel = document.getElementById('filtrosPanel');

    if (toggleFiltrosBtn && filtrosPanel) {
        toggleFiltrosBtn.addEventListener('click', () => {
            if (filtrosPanel.style.display === 'none') {
                filtrosPanel.style.display = 'block';
            } else {
                filtrosPanel.style.display = 'none';
            }
        });
    }

    // Aplicar filtros
    const aplicarFiltrosBtn = document.getElementById('aplicarFiltrosBtn');

    if (aplicarFiltrosBtn) {
        aplicarFiltrosBtn.addEventListener('click', () => {
            filtrosClientes.convenio = document.getElementById('filtroConvenio').value;
            filtrosClientes.empresa = document.getElementById('filtroEmpresa').value;

            // Reiniciar paginación
            currentPage = 1;
            lastVisible = null;

            loadClientes();
        });
    }
}

// Configurar eventos para las búsquedas
function setupSearchEvents() {
    // Búsqueda de clientes
    const searchClienteBtn = document.getElementById('searchClienteBtn');
    const searchCliente = document.getElementById('searchCliente');

    if (searchClienteBtn && searchCliente) {
        searchClienteBtn.addEventListener('click', () => {
            filtrosClientes.busqueda = searchCliente.value.trim();

            // Reiniciar paginación
            currentPage = 1;
            lastVisible = null;

            loadClientes();
        });

        searchCliente.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                filtrosClientes.busqueda = searchCliente.value.trim();

                // Reiniciar paginación
                currentPage = 1;
                lastVisible = null;

                loadClientes();
            }
        });
    }
}

// Configurar eventos para las pestañas de historial
function setupHistoryTabs() {
    const tabButtons = document.querySelectorAll('.history-tab-btn');
    const tabContents = document.querySelectorAll('.history-tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remover clase active de todos los botones
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.querySelector('span').classList.add('opacity-0');
            });

            // Agregar clase active al botón clickeado
            button.classList.add('active');
            button.querySelector('span').classList.remove('opacity-0');

            // Mostrar el contenido de la pestaña correspondiente
            const tabId = button.getAttribute('data-tab');
            tabContents.forEach(content => {
                content.style.display = content.id === tabId + '-tab' ? 'block' : 'none';
            });
        });
    });
}

// Configurar eventos para la paginación
function setupPaginationEvents() {
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadClientes(true); // Cargar página anterior
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadClientes();
            }
        });
    }
}

// Función para cargar clientes
async function loadClientes(isPrevPage = false) {
    const tableBody = document.getElementById('clientsTableBody');
    if (!tableBody) return;

    // Limpiar tabla
    tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center">Cargando clientes...</td></tr>';

    try {
        // Construir la consulta base
        let clientesQuery = collection(db, 'clientes');
        let queryConstraints = [];

        // Aplicar filtros si existen
        if (filtrosClientes.convenio) {
            queryConstraints.push(where('convenio', '==', filtrosClientes.convenio === 'true'));
        }

        if (filtrosClientes.empresa) {
            queryConstraints.push(where('empresaId', '==', filtrosClientes.empresa));
        }

        // Ordenar por nombre
        queryConstraints.push(orderBy('nombre'));

        // Limitar resultados por página
        queryConstraints.push(limit(CLIENTS_PER_PAGE));

        // Aplicar paginación
        if (lastVisible && !isPrevPage) {
            queryConstraints.push(startAfter(lastVisible));
        } else if (isPrevPage) {
            // Implementar lógica para página anterior
            // Esto es más complejo y requiere mantener un historial de documentos
            // Por simplicidad, volvemos a la primera página
            currentPage = 1;
            lastVisible = null;
        }

        // Ejecutar la consulta
        const q = query(clientesQuery, ...queryConstraints);
        const clientesSnapshot = await getDocs(q);

        // Actualizar lastVisible para paginación
        const docs = clientesSnapshot.docs;
        if (docs.length > 0) {
            lastVisible = docs[docs.length - 1];
        }

        // Estimar el total de páginas (esto es aproximado)
        // Para una implementación más precisa, se necesitaría contar todos los documentos
        const totalClientsQuery = await getDocs(collection(db, 'clientes'));
        const totalClients = totalClientsQuery.size;
        totalPages = Math.ceil(totalClients / CLIENTS_PER_PAGE);

        // Actualizar información de paginación
        document.getElementById('currentPage').textContent = currentPage;
        document.getElementById('totalPages').textContent = totalPages;

        // Habilitar/deshabilitar botones de paginación
        document.getElementById('prevPageBtn').disabled = currentPage <= 1;
        document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;

        // Limpiar tabla
        tableBody.innerHTML = '';

        if (clientesSnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center">No se encontraron clientes</td></tr>';
            return;
        }

        // Filtrar por búsqueda en memoria (para búsquedas más complejas)
        let clientes = [];
        clientesSnapshot.forEach(doc => {
            clientes.push({
                id: doc.id,
                ...doc.data()
            });
        });

        if (filtrosClientes.busqueda) {
            const busqueda = filtrosClientes.busqueda.toLowerCase();
            clientes = clientes.filter(cliente =>
                (cliente.nombre && cliente.nombre.toLowerCase().includes(busqueda)) ||
                (cliente.telefono && cliente.telefono.includes(busqueda)) ||
                (cliente.email && cliente.email.toLowerCase().includes(busqueda))
            );
        }

        if (clientes.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center">No se encontraron clientes con los filtros aplicados</td></tr>';
            return;
        }

        // Agregar clientes a la tabla
        clientes.forEach(cliente => {
            // Formatear fecha de última visita
            let ultimaVisitaText = 'Nunca';
            if (cliente.ultimaVisita) {
                const fecha = cliente.ultimaVisita instanceof Timestamp
                    ? cliente.ultimaVisita.toDate()
                    : new Date(cliente.ultimaVisita);
                ultimaVisitaText = fecha.toLocaleDateString();
            }

            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';

            row.innerHTML = `
                <td class="py-3 px-4">${cliente.id.substring(0, 8)}...</td>
                <td class="py-3 px-4">${cliente.nombre || ''}</td>
                <td class="py-3 px-4">${cliente.telefono || ''}</td>
                <td class="py-3 px-4">${cliente.email || ''}</td>
                <td class="py-3 px-4">${ultimaVisitaText}</td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        <button class="view-client text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${cliente.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                        <button class="edit-client text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" data-id="${cliente.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button class="delete-client text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${cliente.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            `;

            tableBody.appendChild(row);
        });

        // Configurar eventos para los botones de ver, editar y eliminar
        setupClientEvents();

    } catch (error) {
        console.error("Error al cargar clientes:", error);
        tableBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-red-500">Error al cargar clientes</td></tr>';
        showToast('Error al cargar clientes', 'danger');
    }
}

// Configurar eventos para los clientes
function setupClientEvents() {
    // Configurar botones para ver clientes
    const viewButtons = document.querySelectorAll('.view-client');
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            const clientId = button.getAttribute('data-id');
            viewClient(clientId);
        });
    });

    // Configurar botones para editar clientes
    const editButtons = document.querySelectorAll('.edit-client');
    editButtons.forEach(button => {
        button.addEventListener('click', () => {
            const clientId = button.getAttribute('data-id');
            editClient(clientId);
        });
    });

    // Configurar botones para eliminar clientes
    const deleteButtons = document.querySelectorAll('.delete-client');
    deleteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const clientId = button.getAttribute('data-id');
            confirmDeleteClient(clientId);
        });
    });
}

// Función para ver un cliente
async function viewClient(clientId) {
    try {
        // Obtener datos del cliente
        const docRef = doc(db, 'clientes', clientId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const cliente = docSnap.data();
            currentClient = {
                id: clientId,
                ...cliente
            };

            // Mostrar modal de tarjeta de cliente
            const modal = document.getElementById('clientCardModal');
            if (modal) {
                modal.style.display = 'block';

                // Llenar información del cliente
                document.getElementById('cardClientName').textContent = cliente.nombre || 'Sin nombre';
                document.getElementById('cardClientPhone').textContent = cliente.telefono || 'No disponible';
                document.getElementById('cardClientEmail').textContent = cliente.email || 'No disponible';
                document.getElementById('cardClientAddress').textContent = cliente.direccion || 'No disponible';

                // Formatear fecha de nacimiento
                let fechaNacimientoText = 'No disponible';
                if (cliente.fechaNacimiento) {
                    const fecha = cliente.fechaNacimiento instanceof Timestamp
                        ? cliente.fechaNacimiento.toDate()
                        : new Date(cliente.fechaNacimiento);
                    fechaNacimientoText = fecha.toLocaleDateString();
                }
                document.getElementById('cardClientBirthdate').textContent = fechaNacimientoText;

                // Mostrar información de convenio
                document.getElementById('cardClientConvenio').textContent = cliente.convenio ? 'Sí' : 'No';

                // Mostrar información de empresa
                if (cliente.convenio && cliente.empresaId) {
                    const empresa = empresas.find(e => e.id === cliente.empresaId);
                    document.getElementById('cardClientEmpresa').textContent = empresa ? empresa.nombre : 'No especificada';
                    document.getElementById('cardClientEmpresaContainer').style.display = 'block';
                } else {
                    document.getElementById('cardClientEmpresaContainer').style.display = 'none';
                }

                // Cargar historial del cliente
                await loadClientHistory(clientId);
            }
        } else {
            console.error("No se encontró el cliente");
            showToast('No se encontró el cliente', 'danger');
        }
    } catch (error) {
        console.error("Error al obtener cliente:", error);
        showToast('Error al obtener el cliente', 'danger');
    }
}

// Función para cargar el historial del cliente
async function loadClientHistory(clientId) {
    try {
        // Cargar historial de compras
        const historyBody = document.getElementById('clientHistoryBody');
        if (historyBody) {
            historyBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center">Cargando historial...</td></tr>';

            // Obtener ventas del cliente
            const ventasQuery = query(
                collection(db, 'ventas'),
                where('clienteId', '==', clientId),
                orderBy('fecha', 'desc')
            );

            const ventasSnapshot = await getDocs(ventasQuery);

            if (ventasSnapshot.empty) {
                historyBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center">No hay compras registradas</td></tr>';
                return;
            }

            // Limpiar tabla
            historyBody.innerHTML = '';

            // Variables para calcular el saldo total pendiente
            let saldoTotalPendiente = 0;

            // Agregar ventas a la tabla
            const ventas = [];
            ventasSnapshot.forEach(doc => {
                ventas.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Para cada venta, obtener sus abonos y pagos
            for (const venta of ventas) {
                // Obtener abonos de la venta
                const abonosQuery = query(
                    collection(db, 'abonos'),
                    where('ventaId', '==', venta.id),
                    orderBy('fecha', 'asc')
                );

                const abonosSnapshot = await getDocs(abonosQuery);

                // Obtener pagos de la venta
                const pagosQuery = query(
                    collection(db, 'pagos'),
                    where('ventaId', '==', venta.id),
                    orderBy('fecha', 'asc')
                );

                const pagosSnapshot = await getDocs(pagosQuery);

                // Calcular total abonado (incluyendo abono inicial)
                let totalAbonado = venta.abono || 0;
                let abonosAdicionales = [];

                abonosSnapshot.forEach(doc => {
                    const abono = doc.data();
                    // Evitar contar el abono inicial dos veces
                    if (abono.descripcion !== 'Abono inicial') {
                        totalAbonado += abono.monto;
                        abonosAdicionales.push({
                            id: doc.id,
                            ...abono
                        });
                    }
                });

                // Calcular total pagado
                let totalPagado = 0;
                let pagosRealizados = [];

                pagosSnapshot.forEach(doc => {
                    const pago = doc.data();
                    totalPagado += pago.monto;
                    pagosRealizados.push({
                        id: doc.id,
                        ...pago
                    });
                });

                // Calcular saldo pendiente
                const saldoPendiente = venta.total - totalAbonado - totalPagado;
                saldoTotalPendiente += saldoPendiente;

                // Determinar estado de la venta
                let estado = 'Pendiente';
                let estadoClass = 'text-red-500';

                if (saldoPendiente <= 0) {
                    estado = 'Pagado';
                    estadoClass = 'text-green-500';
                } else if (totalAbonado > 0 || totalPagado > 0) {
                    estado = 'Abonado';
                    estadoClass = 'text-yellow-500';
                }

                // Formatear fecha
                const fecha = venta.fecha instanceof Timestamp
                    ? venta.fecha.toDate()
                    : new Date(venta.fecha);

                // Crear fila para la venta
                const ventaRow = document.createElement('tr');
                ventaRow.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';

                // Obtener información de productos
                let productosInfo = '';
                if (venta.productos && venta.productos.length > 0) {
                    productosInfo = venta.productos.map(p => p.nombreProducto).join(', ');
                } else {
                    productosInfo = 'Venta';
                }

                ventaRow.innerHTML = `
                    <td class="py-2 px-4">${fecha.toLocaleDateString()}</td>
                    <td class="py-2 px-4">${productosInfo}</td>
                    <td class="py-2 px-4">
                        <span class="${estadoClass} font-semibold">${estado}</span>
                    </td>
                    <td class="py-2 px-4 flex justify-between">
                        <span class="font-semibold">$${venta.total.toFixed(2)}</span>
                        ${saldoPendiente > 0 ? `
                            <button class="pay-btn add-payment-btn" 
                                    data-venta-id="${venta.id}" 
                                    data-saldo="${saldoPendiente.toFixed(2)}">
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
                        ` : ''}
                    </td>
                `;

                historyBody.appendChild(ventaRow);

                // Si hay abono inicial, mostrarlo
                if (venta.abono > 0) {
                    const abonoInicialRow = document.createElement('tr');
                    abonoInicialRow.className = 'bg-gray-50 dark:bg-gray-700 text-sm';

                    abonoInicialRow.innerHTML = `
                        <td class="py-2 px-4 pl-8">${fecha.toLocaleDateString()}</td>
                        <td class="py-2 px-4">Abono inicial</td>
                        <td class="py-2 px-4"></td>
                        <td class="py-2 px-4 text-green-500">-$${venta.abono.toFixed(2)}</td>
                    `;

                    historyBody.appendChild(abonoInicialRow);
                }

                // Agregar filas para los abonos adicionales
                abonosAdicionales.forEach(abono => {
                    const abonoFecha = abono.fecha instanceof Timestamp
                        ? abono.fecha.toDate()
                        : new Date(abono.fecha);

                    const metodoPago = abono.metodoPago ?
                        ` (${formatMetodoPago(abono.metodoPago)})` : '';

                    const abonoRow = document.createElement('tr');
                    abonoRow.className = 'bg-gray-50 dark:bg-gray-700 text-sm';

                    abonoRow.innerHTML = `
                        <td class="py-2 px-4 pl-8">${abonoFecha.toLocaleDateString()}</td>
                        <td class="py-2 px-4">Abono${metodoPago}</td>
                        <td class="py-2 px-4"></td>
                        <td class="py-2 px-4 text-green-500">-$${abono.monto.toFixed(2)}</td>
                    `;

                    historyBody.appendChild(abonoRow);
                });

                // Agregar filas para los pagos
                pagosRealizados.forEach(pago => {
                    const pagoFecha = pago.fecha instanceof Timestamp
                        ? pago.fecha.toDate()
                        : new Date(pago.fecha);

                    const metodoPago = pago.metodoPago ?
                        ` (${formatMetodoPago(pago.metodoPago)})` : '';

                    const pagoRow = document.createElement('tr');
                    pagoRow.className = 'bg-gray-100 dark:bg-gray-600 text-sm';

                    pagoRow.innerHTML = `
                        <td class="py-2 px-4 pl-8">${pagoFecha.toLocaleDateString()}</td>
                        <td class="py-2 px-4">Pago${metodoPago}</td>
                        <td class="py-2 px-4"></td>
                        <td class="py-2 px-4 text-blue-500">-$${pago.monto.toFixed(2)}</td>
                    `;

                    historyBody.appendChild(pagoRow);
                });

                // Si hay saldo pendiente, mostrar
                if (saldoPendiente > 0) {
                    const saldoRow = document.createElement('tr');
                    saldoRow.className = 'bg-gray-100 dark:bg-gray-800 font-semibold';

                    saldoRow.innerHTML = `
                        <td class="py-2 px-4"></td>
                        <td class="py-2 px-4" colspan="2">Saldo pendiente</td>
                        <td class="py-2 px-4 text-red-500">$${saldoPendiente.toFixed(2)}</td>
                    `;

                    historyBody.appendChild(saldoRow);
                }

                // Agregar separador entre ventas
                const separatorRow = document.createElement('tr');
                separatorRow.innerHTML = `<td colspan="4" class="py-1 border-b-2 border-gray-200 dark:border-gray-700"></td>`;
                historyBody.appendChild(separatorRow);
            }

            // Mostrar saldo total pendiente si hay alguno
            if (saldoTotalPendiente > 0) {
                const totalRow = document.createElement('tr');
                totalRow.className = 'bg-primary/10 dark:bg-primary/20 font-bold';

                totalRow.innerHTML = `
                    <td class="py-3 px-4" colspan="3">SALDO TOTAL PENDIENTE</td>
                    <td class="py-3 px-4 text-red-600">$${saldoTotalPendiente.toFixed(2)}</td>
                `;

                historyBody.appendChild(totalRow);
            }

            // Configurar eventos para los botones de agregar pago
            setupAddPaymentButtons(clientId);
        }

        // Función para formatear el método de pago
        function formatMetodoPago(metodoPago) {
            switch (metodoPago) {
                case 'efectivo': return 'Efectivo';
                case 'tarjeta_credito': return 'Tarjeta de Crédito';
                case 'tarjeta_debito': return 'Tarjeta de Débito';
                case 'transferencia': return 'Transferencia';
                default: return metodoPago;
            }
        }

        // Función para configurar los botones de agregar pago
        function setupAddPaymentButtons(clientId) {
            const addPaymentButtons = document.querySelectorAll('.add-payment-btn');

            addPaymentButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const ventaId = button.getAttribute('data-venta-id');
                    const saldoPendiente = parseFloat(button.getAttribute('data-saldo'));

                    // Mostrar modal de pago
                    showPaymentModal(clientId, ventaId);
                });
            });
        }

        // Función para mostrar el modal de registro de pago
        function showPaymentModal(clientId, ventaId = null) {
            // Crear modal si no existe
            let paymentModal = document.getElementById('paymentModal');

            if (!paymentModal) {
                paymentModal = document.createElement('div');
                paymentModal.id = 'paymentModal';
                paymentModal.className = 'modal';

                paymentModal.innerHTML = `
            <div class="modal-content bg-white dark:bg-gray-800 w-11/12 md:w-2/3 lg:w-1/2 max-w-xl mx-auto mt-16 rounded-lg shadow-modal p-6">
                <div class="flex justify-between items-center mb-4 border-b border-mediumGray dark:border-gray-700 pb-3">
                    <h3 class="text-xl font-semibold">Registrar Pago</h3>
                    <span class="close text-2xl cursor-pointer hover:text-gray-600 dark:hover:text-gray-300">&times;</span>
                </div>
                <form id="paymentForm" class="space-y-4">
                    <input type="hidden" id="paymentClientId" value="${clientId}">
                    <input type="hidden" id="paymentVentaId" value="${ventaId || ''}">
                    
                    <div class="form-group" id="ventaSelectGroup" style="${ventaId ? 'display:none' : ''}">
                        <label for="ventaSelect" class="block mb-1 font-medium">Seleccionar Venta</label>
                        <select id="ventaSelect" class="w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" required>
                            <option value="">Seleccione una venta</option>
                        </select>
                        <p class="text-sm text-gray-500 mt-1">Saldo pendiente: <span id="saldoPendienteVenta">$0.00</span></p>
                    </div>
                    
                    <div class="form-group">
                        <label for="paymentTipo" class="block mb-1 font-medium">Tipo de Pago</label>
                        <select id="paymentTipo" class="w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" required>
                            <option value="abono">Abono</option>
                            <option value="pago">Pago completo</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="paymentMonto" class="block mb-1 font-medium">Monto</label>
                        <input type="number" id="paymentMonto" step="0.01" min="0" class="w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="paymentMetodo" class="block mb-1 font-medium">Método de Pago</label>
                        <select id="paymentMetodo" class="w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" required>
                            <option value="efectivo">Efectivo</option>
                            <option value="tarjeta_credito">Tarjeta de Crédito</option>
                            <option value="tarjeta_debito">Tarjeta de Débito</option>
                            <option value="transferencia">Transferencia</option>
                        </select>
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
        `;

                document.body.appendChild(paymentModal);

                // Configurar eventos del modal
                const closeBtn = paymentModal.querySelector('.close');
                const closeModalBtn = paymentModal.querySelector('.close-modal');

                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        paymentModal.style.display = 'none';
                    });
                }

                if (closeModalBtn) {
                    closeModalBtn.addEventListener('click', () => {
                        paymentModal.style.display = 'none';
                    });
                }

                // Cerrar modal al hacer clic fuera del contenido
                paymentModal.addEventListener('click', (event) => {
                    if (event.target === paymentModal) {
                        paymentModal.style.display = 'none';
                    }
                });

                // Configurar formulario de pago
                const paymentForm = document.getElementById('paymentForm');
                if (paymentForm) {
                    paymentForm.addEventListener('submit', async (e) => {
                        e.preventDefault();

                        try {
                            const clientId = document.getElementById('paymentClientId').value;
                            let ventaId = document.getElementById('paymentVentaId').value;

                            // Si no hay ventaId preseleccionada, tomar del select
                            if (!ventaId) {
                                ventaId = document.getElementById('ventaSelect').value;
                            }

                            const tipo = document.getElementById('paymentTipo').value;
                            const monto = parseFloat(document.getElementById('paymentMonto').value) || 0;
                            const metodo = document.getElementById('paymentMetodo').value;
                            const descripcion = document.getElementById('paymentDescripcion').value;

                            // Validar campos
                            if (!ventaId) {
                                alert('Debe seleccionar una venta');
                                return;
                            }

                            if (monto <= 0) {
                                alert('El monto debe ser mayor a cero');
                                return;
                            }

                            // Obtener saldo pendiente
                            const saldoInfo = await calcularSaldoPendiente(ventaId);

                            // Validar que el monto no sea mayor al saldo pendiente
                            if (monto > saldoInfo.saldoPendiente) {
                                alert('El monto no puede ser mayor al saldo pendiente');
                                return;
                            }

                            // Registrar pago o abono
                            if (tipo === 'abono') {
                                await registrarAbono(
                                    ventaId,
                                    clientId,
                                    monto,
                                    descripcion || 'Abono',
                                    metodo
                                );
                            } else {
                                await registrarPago(
                                    ventaId,
                                    clientId,
                                    saldoInfo.saldoPendiente, // Pago completo
                                    descripcion || 'Pago completo',
                                    metodo
                                );
                            }

                            // Actualizar estado de la venta
                            await actualizarEstadoVenta(ventaId);

                            alert(`${tipo === 'abono' ? 'Abono' : 'Pago'} registrado correctamente`);

                            // Cerrar modal
                            paymentModal.style.display = 'none';

                            // Recargar historial
                            await loadClientHistory(clientId);

                        } catch (error) {
                            console.error('Error al registrar pago:', error);
                            alert('Error al registrar el pago');
                        }
                    });
                }

                // Configurar evento para cambio de venta
                const ventaSelect = document.getElementById('ventaSelect');
                if (ventaSelect) {
                    ventaSelect.addEventListener('change', async () => {
                        const ventaId = ventaSelect.value;
                        if (ventaId) {
                            // Obtener saldo pendiente
                            const saldoInfo = await calcularSaldoPendiente(ventaId);
                            document.getElementById('saldoPendienteVenta').textContent = `$${saldoInfo.saldoPendiente.toFixed(2)}`;

                            // Si es pago completo, establecer el monto al saldo pendiente
                            const tipoSelect = document.getElementById('paymentTipo');
                            if (tipoSelect.value === 'pago') {
                                document.getElementById('paymentMonto').value = saldoInfo.saldoPendiente.toFixed(2);
                            }
                        } else {
                            document.getElementById('saldoPendienteVenta').textContent = '$0.00';
                        }
                    });
                }

                // Configurar evento para cambio de tipo de pago
                const tipoSelect = document.getElementById('paymentTipo');
                if (tipoSelect) {
                    tipoSelect.addEventListener('change', async () => {
                        const tipo = tipoSelect.value;
                        const ventaId = document.getElementById('paymentVentaId').value || document.getElementById('ventaSelect').value;

                        if (tipo === 'pago' && ventaId) {
                            // Obtener saldo pendiente
                            const saldoInfo = await calcularSaldoPendiente(ventaId);
                            document.getElementById('paymentMonto').value = saldoInfo.saldoPendiente.toFixed(2);
                        } else {
                            document.getElementById('paymentMonto').value = '';
                        }
                    });
                }
            }

            // Mostrar modal
            paymentModal.style.display = 'block';

            // Si no hay ventaId específica, cargar ventas pendientes
            if (!ventaId) {
                loadPendingVentas(clientId);
            } else {
                // Si hay ventaId, cargar información de la venta
                loadVentaInfo(ventaId);
            }
        }

        // Función para cargar ventas pendientes
        async function loadPendingVentas(clientId) {
            try {
                const ventaSelect = document.getElementById('ventaSelect');
                if (!ventaSelect) return;

                // Limpiar select
                ventaSelect.innerHTML = '<option value="">Seleccione una venta</option>';

                // Obtener ventas pendientes del cliente
                const ventasQuery = query(
                    collection(db, 'ventas'),
                    where('clienteId', '==', clientId),
                    where('estado', 'in', ['pendiente', 'parcial'])
                );

                const ventasSnapshot = await getDocs(ventasQuery);

                if (ventasSnapshot.empty) {
                    ventaSelect.innerHTML = '<option value="">No hay ventas pendientes</option>';
                    return;
                }

                // Procesar cada venta
                for (const ventaDoc of ventasSnapshot.docs) {
                    const venta = {
                        id: ventaDoc.id,
                        ...ventaDoc.data()
                    };

                    // Calcular saldo pendiente
                    const saldoInfo = await calcularSaldoPendiente(venta.id);

                    if (saldoInfo.saldoPendiente <= 0) continue;

                    // Formatear fecha
                    const fechaVenta = venta.fecha instanceof Timestamp
                        ? venta.fecha.toDate()
                        : new Date(venta.fecha);

                    const fechaVentaFormateada = fechaVenta.toLocaleDateString();

                    // Determinar descripción de la venta
                    let descripcionVenta = 'Venta';
                    if (venta.productos && venta.productos.length > 0) {
                        // Tomar el primer producto para la descripción
                        descripcionVenta = venta.productos[0].nombreProducto;

                        // Si hay más productos, indicarlo
                        if (venta.productos.length > 1) {
                            descripcionVenta += ` + ${venta.productos.length - 1} más`;
                        }
                    }

                    // Crear opción
                    const option = document.createElement('option');
                    option.value = venta.id;
                    option.textContent = `${fechaVentaFormateada} - ${descripcionVenta} - Pendiente: $${saldoInfo.saldoPendiente.toFixed(2)}`;

                    ventaSelect.appendChild(option);
                }

            } catch (error) {
                console.error('Error al cargar ventas pendientes:', error);
                const ventaSelect = document.getElementById('ventaSelect');
                if (ventaSelect) {
                    ventaSelect.innerHTML = '<option value="">Error al cargar ventas</option>';
                }
            }
        }

        // Función para cargar información de una venta específica
        async function loadVentaInfo(ventaId) {
            try {
                // Obtener datos de la venta
                const ventaDoc = await getDoc(doc(db, 'ventas', ventaId));

                if (!ventaDoc.exists()) {
                    alert('La venta no existe');
                    return;
                }

                const venta = ventaDoc.data();

                // Calcular saldo pendiente
                const saldoInfo = await calcularSaldoPendiente(ventaId);

                // Actualizar información en el modal
                document.getElementById('saldoPendienteVenta').textContent = `$${saldoInfo.saldoPendiente.toFixed(2)}`;

                // Si es pago completo, establecer el monto al saldo pendiente
                const tipoSelect = document.getElementById('paymentTipo');
                if (tipoSelect.value === 'pago') {
                    document.getElementById('paymentMonto').value = saldoInfo.saldoPendiente.toFixed(2);
                }

            } catch (error) {
                console.error('Error al cargar información de la venta:', error);
            }
        }

        // Función para actualizar el estado de una venta
        async function actualizarEstadoVenta(ventaId) {
            try {
                // Calcular saldo pendiente
                const saldoInfo = await calcularSaldoPendiente(ventaId);

                // Determinar nuevo estado
                let nuevoEstado = 'pendiente';

                if (saldoInfo.saldoPendiente <= 0) {
                    nuevoEstado = 'pagada';
                } else if (saldoInfo.totalAbonado > 0 || saldoInfo.totalPagado > 0) {
                    nuevoEstado = 'parcial';
                }

                // Actualizar estado
                await updateDoc(doc(db, 'ventas', ventaId), {
                    estado: nuevoEstado,
                    updatedAt: serverTimestamp()
                });

                return nuevoEstado;
            } catch (error) {
                console.error('Error al actualizar estado de la venta:', error);
                throw error;
            }
        }

        // Cargar historial de recetas
        const recetasBody = document.getElementById('clientRecetasBody');
        if (recetasBody) {
            recetasBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center">No hay recetas registradas</td></tr>';
            // Implementar carga de recetas cuando se desarrolle esa funcionalidad
        }

        // Cargar historial de citas
        const citasBody = document.getElementById('clientCitasBody');
        if (citasBody) {
            citasBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center">No hay citas registradas</td></tr>';
            // Implementar carga de citas cuando se desarrolle esa funcionalidad
        }

    } catch (error) {
        console.error("Error al cargar historial del cliente:", error);
        const historyBody = document.getElementById('clientHistoryBody');
        if (historyBody) {
            historyBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-red-500">Error al cargar historial</td></tr>';
        }
    }
}

// Función para editar un cliente
async function editClient(clientId) {
    try {
        // Obtener datos del cliente
        const docRef = doc(db, 'clientes', clientId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const cliente = docSnap.data();

            // Mostrar modal de cliente
            const modal = document.getElementById('clientModal');
            if (modal) {
                modal.style.display = 'block';
                document.getElementById('modalTitle').textContent = 'Editar Cliente';

                // Llenar formulario con datos del cliente
                document.getElementById('clientId').value = clientId;
                document.getElementById('clientName').value = cliente.nombre || '';
                document.getElementById('clientPhone').value = cliente.telefono || '';
                document.getElementById('clientEmail').value = cliente.email || '';
                document.getElementById('clientAddress').value = cliente.direccion || '';

                // Formatear fecha de nacimiento para el input date
                if (cliente.fechaNacimiento) {
                    const fecha = cliente.fechaNacimiento instanceof Timestamp
                        ? cliente.fechaNacimiento.toDate()
                        : new Date(cliente.fechaNacimiento);

                    const year = fecha.getFullYear();
                    const month = String(fecha.getMonth() + 1).padStart(2, '0');
                    const day = String(fecha.getDate()).padStart(2, '0');
                    document.getElementById('clientBirthdate').value = `${year}-${month}-${day}`;
                } else {
                    document.getElementById('clientBirthdate').value = '';
                }

                // Configurar convenio y empresa
                const clientConvenio = document.getElementById('clientConvenio');
                const clientEmpresaGroup = document.getElementById('clientEmpresaGroup');
                const clientEmpresa = document.getElementById('clientEmpresa');

                if (clientConvenio && clientEmpresaGroup && clientEmpresa) {
                    clientConvenio.checked = cliente.convenio || false;

                    if (cliente.convenio) {
                        clientEmpresaGroup.classList.remove('opacity-50');
                        clientEmpresa.disabled = false;
                        clientEmpresa.value = cliente.empresaId || '';
                    } else {
                        clientEmpresaGroup.classList.add('opacity-50');
                        clientEmpresa.disabled = true;
                        clientEmpresa.value = '';
                    }
                }
            }
        } else {
            console.error("No se encontró el cliente");
            showToast('No se encontró el cliente', 'danger');
        }
    } catch (error) {
        console.error("Error al obtener cliente:", error);
        showToast('Error al obtener el cliente', 'danger');
    }
}

// Función para confirmar eliminación de un cliente
function confirmDeleteClient(clientId) {
    if (confirm('¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer.')) {
        deleteClient(clientId);
    }
}

// Función para eliminar un cliente
async function deleteClient(clientId) {
    try {
        await deleteDoc(doc(db, 'clientes', clientId));
        showToast('Cliente eliminado correctamente', 'success');
        loadClientes();
    } catch (error) {
        console.error("Error al eliminar cliente:", error);
        showToast('Error al eliminar el cliente', 'danger');
    }
}

// Función para registrar una venta
async function registrarVenta(clienteId, descripcion, total, productos = []) {
    try {
        // Crear objeto de venta
        const ventaData = {
            clienteId,
            descripcion,
            total,
            productos,
            fecha: serverTimestamp(),
            createdAt: serverTimestamp()
        };

        // Agregar venta
        const ventaRef = await addDoc(collection(db, 'ventas'), ventaData);

        // Actualizar última visita del cliente
        await updateDoc(doc(db, 'clientes', clienteId), {
            ultimaVisita: serverTimestamp()
        });

        return ventaRef.id;
    } catch (error) {
        console.error("Error al registrar venta:", error);
        throw error;
    }
}

// Función para registrar un abono
async function registrarAbono(ventaId, clienteId, monto, descripcion = 'Abono') {
    try {
        // Crear objeto de abono
        const abonoData = {
            ventaId,
            clienteId,
            monto,
            descripcion,
            fecha: serverTimestamp(),
            createdAt: serverTimestamp()
        };

        // Agregar abono
        const abonoRef = await addDoc(collection(db, 'abonos'), abonoData);

        // Actualizar última visita del cliente
        await updateDoc(doc(db, 'clientes', clienteId), {
            ultimaVisita: serverTimestamp()
        });

        return abonoRef.id;
    } catch (error) {
        console.error("Error al registrar abono:", error);
        throw error;
    }
}

// Función para registrar un pago
async function registrarPago(ventaId, clienteId, monto, descripcion = 'Pago') {
    try {
        // Crear objeto de pago
        const pagoData = {
            ventaId,
            clienteId,
            monto,
            descripcion,
            fecha: serverTimestamp(),
            createdAt: serverTimestamp()
        };

        // Agregar pago
        const pagoRef = await addDoc(collection(db, 'pagos'), pagoData);

        // Actualizar última visita del cliente
        await updateDoc(doc(db, 'clientes', clienteId), {
            ultimaVisita: serverTimestamp()
        });

        return pagoRef.id;
    } catch (error) {
        console.error("Error al registrar pago:", error);
        throw error;
    }
}

// Función para calcular saldo pendiente de una venta
async function calcularSaldoPendiente(ventaId) {
    try {
        // Obtener venta
        const ventaDoc = await getDoc(doc(db, 'ventas', ventaId));
        if (!ventaDoc.exists()) {
            throw new Error('La venta no existe');
        }

        const venta = ventaDoc.data();
        const total = venta.total;

        // Obtener abonos
        const abonosQuery = query(
            collection(db, 'abonos'),
            where('ventaId', '==', ventaId)
        );

        const abonosSnapshot = await getDocs(abonosQuery);

        // Calcular total abonado
        let totalAbonado = 0;
        abonosSnapshot.forEach(doc => {
            const abono = doc.data();
            totalAbonado += abono.monto;
        });

        // Obtener pagos
        const pagosQuery = query(
            collection(db, 'pagos'),
            where('ventaId', '==', ventaId)
        );

        const pagosSnapshot = await getDocs(pagosQuery);

        // Calcular total pagado
        let totalPagado = 0;
        pagosSnapshot.forEach(doc => {
            const pago = doc.data();
            totalPagado += pago.monto;
        });

        // Calcular saldo pendiente
        const saldoPendiente = total - totalAbonado - totalPagado;

        return {
            total,
            totalAbonado,
            totalPagado,
            saldoPendiente
        };
    } catch (error) {
        console.error("Error al calcular saldo pendiente:", error);
        throw error;
    }
}