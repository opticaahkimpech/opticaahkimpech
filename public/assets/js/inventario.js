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
    limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db } from "./firebase-config.js";
import { checkAndCreateInventoryCollection } from "./auth-check.js";

// Variables globales para almacenar datos
let categorias = [];
let proveedores = [];
let marcasArmazones = [];
let materialesArmazones = [];
let coloresArmazones = [];

// Variables para manejar colores y materiales en el formulario
let coloresSeleccionados = [];
let materialesSeleccionados = [];

// Configuración de stock
const CONFIG = {
    STOCK_MINIMO_PRODUCTO: 5,
    STOCK_CRITICO_PRODUCTO: 2,
    STOCK_MINIMO_ARMAZON: 3,
    STOCK_CRITICO_ARMAZON: 1
};

// Filtros activos
let filtrosProductos = {
    tipo: '',
    categoria: '',
    proveedor: '',
    precioMin: '',
    precioMax: '',
    busqueda: ''
};

let filtrosArmazones = {
    marca: '',
    material: '',
    proveedor: '',
    precioMin: '',
    precioMax: '',
    busqueda: ''
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Página de inventario cargada');
    
    try {
        // Verificar y crear colecciones necesarias
        // Ahora usamos la función importada de auth-check.js
        await checkAndCreateInventoryCollection();
        
        // Cargar categorías y proveedores
        await loadCategorias();
        await loadProveedores();
        
        // Configurar las pestañas
        setupTabs();
        
        // Configurar eventos para los modales
        setupModalEvents();
        
        // Configurar eventos para los formularios
        setupFormEvents();
        
        // Configurar eventos para los filtros
        setupFilterEvents();
        
        // Configurar eventos para las búsquedas
        setupSearchEvents();
        
        // Cargar datos iniciales
        await loadProductos();
        await loadArmazones();
        
        // Cargar valores únicos para filtros
        await loadUniqueValues();
        
        // Verificar productos con stock bajo
        checkLowStockItems();
    } catch (error) {
        console.error("Error al inicializar la página de inventario:", error);
        showToast('Error al cargar la página de inventario', 'danger');
    }
});

// Función para mostrar notificaciones toast
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="flex justify-between items-center">
            <span>${message}</span>
            <button type="button" class="ml-2 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Agregar evento para cerrar el toast
    const closeBtn = toast.querySelector('button');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            toast.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => {
                if (toastContainer.contains(toast)) {
                    toastContainer.removeChild(toast);
                }
            }, 300);
        });
    }
    
    // Cerrar automáticamente después de 5 segundos
    setTimeout(() => {
        if (toastContainer.contains(toast)) {
            toast.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => {
                if (toastContainer.contains(toast)) {
                    toastContainer.removeChild(toast);
                }
            }, 300);
        }
    }, 5000);
}

// Función para cargar valores únicos para los filtros
function updateProductTypeSelector() {
    const productoTipoSelect = document.getElementById('productoTipo');
    const filterProductoTipoSelect = document.getElementById('filterProductoTipo');
    
    const tiposProductos = [
        { value: 'producto', label: 'Producto General' },
        { value: 'lentes_contacto', label: 'Lentes de Contacto' },
        { value: 'lentes_solares', label: 'Lentes Solares' },
        { value: 'lentes_fotocromaticos', label: 'Lentes Fotocromáticos' },
        { value: 'lentes_oftalmicos', label: 'Lentes Oftálmicos' },
        { value: 'armazon', label: 'Armazón' },
        { value: 'accesorio', label: 'Accesorio' }
    ];
    
    if (productoTipoSelect) {
        productoTipoSelect.innerHTML = '<option value="">Seleccione un tipo</option>';
        tiposProductos.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.value;
            option.textContent = tipo.label;
            productoTipoSelect.appendChild(option);
        });
    }
    
    if (filterProductoTipoSelect) {
        filterProductoTipoSelect.innerHTML = '<option value="">Todos</option>';
        tiposProductos.forEach(tipo => {
            const option = document.createElement('option');
            option.value = tipo.value;
            option.textContent = tipo.label;
            filterProductoTipoSelect.appendChild(option);
        });
    }
}

// Función para configurar las pestañas
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
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

// Función para cargar categorías
async function loadCategorias() {
    try {
        const categoriasSnapshot = await getDocs(collection(db, 'categorias'));
        categorias = [];
        
        categoriasSnapshot.forEach(doc => {
            categorias.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Actualizar los selectores de categorías
        const productoCategoriaSelect = document.getElementById('productoCategoria');
        const filterProductoCategoriaSelect = document.getElementById('filterProductoCategoria');
        
        if (productoCategoriaSelect) {
            productoCategoriaSelect.innerHTML = '<option value="">Seleccione una categoría</option>';
            categorias.forEach(categoria => {
                const option = document.createElement('option');
                option.value = categoria.id;
                option.textContent = categoria.nombre;
                productoCategoriaSelect.appendChild(option);
            });
        }
        
        if (filterProductoCategoriaSelect) {
            filterProductoCategoriaSelect.innerHTML = '<option value="">Todas</option>';
            categorias.forEach(categoria => {
                const option = document.createElement('option');
                option.value = categoria.id;
                option.textContent = categoria.nombre;
                filterProductoCategoriaSelect.appendChild(option);
            });
        }
        
        console.log("Categorías cargadas:", categorias.length);
    } catch (error) {
        console.error("Error al cargar categorías:", error);
        showToast('Error al cargar categorías', 'danger');
    }
}

// Función para cargar proveedores
async function loadProveedores() {
    try {
        const proveedoresSnapshot = await getDocs(collection(db, 'proveedores'));
        proveedores = [];
        
        proveedoresSnapshot.forEach(doc => {
            proveedores.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Actualizar los selectores de proveedores
        const productoProveedorSelect = document.getElementById('productoProveedor');
        const armazonProveedorSelect = document.getElementById('armazonProveedor');
        const filterProductoProveedorSelect = document.getElementById('filterProductoProveedor');
        const filterArmazonProveedorSelect = document.getElementById('filterArmazonProveedor');
        
        if (productoProveedorSelect) {
            productoProveedorSelect.innerHTML = '<option value="">Seleccione un proveedor</option>';
            proveedores.forEach(proveedor => {
                const option = document.createElement('option');
                option.value = proveedor.id;
                option.textContent = proveedor.nombre;
                productoProveedorSelect.appendChild(option);
            });
        }
        
        if (armazonProveedorSelect) {
            armazonProveedorSelect.innerHTML = '<option value="">Seleccione un proveedor</option>';
            proveedores.forEach(proveedor => {
                const option = document.createElement('option');
                option.value = proveedor.id;
                option.textContent = proveedor.nombre;
                armazonProveedorSelect.appendChild(option);
            });
        }
        
        if (filterProductoProveedorSelect) {
            filterProductoProveedorSelect.innerHTML = '<option value="">Todos</option>';
            proveedores.forEach(proveedor => {
                const option = document.createElement('option');
                option.value = proveedor.id;
                option.textContent = proveedor.nombre;
                filterProductoProveedorSelect.appendChild(option);
            });
        }
        
        if (filterArmazonProveedorSelect) {
            filterArmazonProveedorSelect.innerHTML = '<option value="">Todos</option>';
            proveedores.forEach(proveedor => {
                const option = document.createElement('option');
                option.value = proveedor.id;
                option.textContent = proveedor.nombre;
                filterArmazonProveedorSelect.appendChild(option);
            });
        }
        
        console.log("Proveedores cargados:", proveedores.length);
    } catch (error) {
        console.error("Error al cargar proveedores:", error);
        showToast('Error al cargar proveedores', 'danger');
    }
}

// Función para cargar valores únicos para filtros
async function loadUniqueValues() {
    try {
        // Cargar marcas únicas de armazones
        const armazonesSnapshot = await getDocs(collection(db, 'armazones'));
        const marcasSet = new Set();
        const materialesSet = new Set();
        const coloresSet = new Set();
        
        armazonesSnapshot.forEach(doc => {
            const armazon = doc.data();
            
            // Agregar marca si existe
            if (armazon.marca) {
                marcasSet.add(armazon.marca);
            }
            
            // Agregar materiales si existen
            if (armazon.materiales && Array.isArray(armazon.materiales)) {
                armazon.materiales.forEach(material => materialesSet.add(material));
            }
            
            // Agregar colores si existen
            if (armazon.colores && Array.isArray(armazon.colores)) {
                armazon.colores.forEach(color => coloresSet.add(color));
            }
        });
        
        // Convertir sets a arrays
        marcasArmazones = Array.from(marcasSet).sort();
        materialesArmazones = Array.from(materialesSet).sort();
        coloresArmazones = Array.from(coloresSet).sort();
        
        // Actualizar selectores de filtros
        const filterArmazonMarcaSelect = document.getElementById('filterArmazonMarca');
        const filterArmazonMaterialSelect = document.getElementById('filterArmazonMaterial');
        
        if (filterArmazonMarcaSelect) {
            filterArmazonMarcaSelect.innerHTML = '<option value="">Todas</option>';
            marcasArmazones.forEach(marca => {
                const option = document.createElement('option');
                option.value = marca;
                option.textContent = marca;
                filterArmazonMarcaSelect.appendChild(option);
            });
        }
        
        if (filterArmazonMaterialSelect) {
            filterArmazonMaterialSelect.innerHTML = '<option value="">Todos</option>';
            materialesArmazones.forEach(material => {
                const option = document.createElement('option');
                option.value = material;
                option.textContent = material;
                filterArmazonMaterialSelect.appendChild(option);
            });
        }
        
        console.log("Valores únicos cargados:", {
            marcas: marcasArmazones.length,
            materiales: materialesArmazones.length,
            colores: coloresArmazones.length
        });
    } catch (error) {
        console.error("Error al cargar valores únicos:", error);
    }
}

// Función para cargar productos
async function loadProductos() {
    const tableBody = document.getElementById('productosTableBody');
    if (!tableBody) return;
    
    // Limpiar tabla
    tableBody.innerHTML = '<tr><td colspan="8" class="py-4 text-center">Cargando productos...</td></tr>';
    
    try {
        // Obtener todos los productos
        const productosSnapshot = await getDocs(collection(db, 'productos'));
        
        if (productosSnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="8" class="py-4 text-center">No hay productos registrados</td></tr>';
            return;
        }
        
        // Filtrar productos según los filtros activos
        let productos = [];
        productosSnapshot.forEach(doc => {
            productos.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Aplicar filtros
        productos = productos.filter(producto => {
            // Filtro por tipo
            if (filtrosProductos.tipo && producto.tipo !== filtrosProductos.tipo) {
                return false;
            }
            
            // Filtro por categoría
            if (filtrosProductos.categoria && producto.categoriaId !== filtrosProductos.categoria) {
                return false;
            }
            
            // Filtro por proveedor
            if (filtrosProductos.proveedor && producto.proveedorId !== filtrosProductos.proveedor) {
                return false;
            }
            
            // Filtro por precio mínimo
            if (filtrosProductos.precioMin && producto.precioVenta < parseFloat(filtrosProductos.precioMin)) {
                return false;
            }
            
            // Filtro por precio máximo
            if (filtrosProductos.precioMax && producto.precioVenta > parseFloat(filtrosProductos.precioMax)) {
                return false;
            }
            
            // Filtro por búsqueda
            if (filtrosProductos.busqueda) {
                const busqueda = filtrosProductos.busqueda.toLowerCase();
                const coincide = 
                    (producto.codigo && producto.codigo.toLowerCase().includes(busqueda)) ||
                    (producto.nombre && producto.nombre.toLowerCase().includes(busqueda)) ||
                    (producto.descripcion && producto.descripcion.toLowerCase().includes(busqueda));
                
                if (!coincide) {
                    return false;
                }
            }
            
            return true;
        });
        
        // Limpiar tabla
        tableBody.innerHTML = '';
        
        if (productos.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="py-4 text-center">No se encontraron productos con los filtros aplicados</td></tr>';
            return;
        }
        
        // Agregar productos a la tabla
        productos.forEach(producto => {
            // Buscar nombre de categoría
            let categoriaNombre = 'No especificada';
            if (producto.categoriaId) {
                const categoria = categorias.find(c => c.id === producto.categoriaId);
                if (categoria) {
                    categoriaNombre = categoria.nombre;
                }
            }
            
            // Buscar nombre de proveedor
            let proveedorNombre = 'No especificado';
            if (producto.proveedorId) {
                const proveedor = proveedores.find(p => p.id === producto.proveedorId);
                if (proveedor) {
                    proveedorNombre = proveedor.nombre;
                }
            }
            
            // Determinar clase de stock
            let stockClass = 'stock-normal';
            let stockMinimo = producto.stockMinimo || CONFIG.STOCK_MINIMO_PRODUCTO;
            let stockCritico = producto.stockCritico || CONFIG.STOCK_CRITICO_PRODUCTO;
            
            if (producto.stock <= stockCritico) {
                stockClass = 'stock-danger';
            } else if (producto.stock <= stockMinimo) {
                stockClass = 'stock-warning';
            }
            
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
            
            row.innerHTML = `
                <td class="py-3 px-4">${producto.codigo || ''}</td>
                <td class="py-3 px-4">${producto.nombre || ''}</td>
                <td class="py-3 px-4">${categoriaNombre}</td>
                <td class="py-3 px-4">${proveedorNombre}</td>
                <td class="py-3 px-4">$${(producto.precioCompra || 0).toFixed(2)}</td>
                <td class="py-3 px-4">$${(producto.precioVenta || 0).toFixed(2)}</td>
                <td class="py-3 px-4 ${stockClass}">${producto.stock || 0}</td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        <button class="edit-producto text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${producto.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button class="delete-producto text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${producto.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Configurar eventos para los botones de editar y eliminar
        setupProductoEvents();
    } catch (error) {
        console.error("Error al cargar productos:", error);
        tableBody.innerHTML = '<tr><td colspan="8" class="py-4 text-center text-red-500">Error al cargar productos</td></tr>';
        showToast('Error al cargar productos', 'danger');
    }
}

// Función para cargar armazones
async function loadArmazones() {
    const tableBody = document.getElementById('armazonesTableBody');
    if (!tableBody) return;
    
    // Limpiar tabla
    tableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center">Cargando armazones...</td></tr>';
    
    try {
        // Obtener todos los armazones
        const armazonesSnapshot = await getDocs(collection(db, 'armazones'));
        
        if (armazonesSnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center">No hay armazones registrados</td></tr>';
            return;
        }
        
        // Filtrar armazones según los filtros activos
        let armazones = [];
        armazonesSnapshot.forEach(doc => {
            armazones.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Aplicar filtros
        armazones = armazones.filter(armazon => {
            // Filtro por marca
            if (filtrosArmazones.marca && armazon.marca !== filtrosArmazones.marca) {
                return false;
            }
            
            // Filtro por material
            if (filtrosArmazones.material && (!armazon.materiales || !armazon.materiales.includes(filtrosArmazones.material))) {
                return false;
            }
            
            // Filtro por proveedor
            if (filtrosArmazones.proveedor && armazon.proveedorId !== filtrosArmazones.proveedor) {
                return false;
            }
            
            // Filtro por precio mínimo
            if (filtrosArmazones.precioMin && armazon.precioVenta < parseFloat(filtrosArmazones.precioMin)) {
                return false;
            }
            
            // Filtro por precio máximo
            if (filtrosArmazones.precioMax && armazon.precioVenta > parseFloat(filtrosArmazones.precioMax)) {
                return false;
            }
            
            // Filtro por búsqueda
            if (filtrosArmazones.busqueda) {
                const busqueda = filtrosArmazones.busqueda.toLowerCase();
                const coincide = 
                    (armazon.codigo && armazon.codigo.toLowerCase().includes(busqueda)) ||
                    (armazon.nombre && armazon.nombre.toLowerCase().includes(busqueda)) ||
                    (armazon.marca && armazon.marca.toLowerCase().includes(busqueda)) ||
                    (armazon.modelo && armazon.modelo.toLowerCase().includes(busqueda));
                
                if (!coincide) {
                    return false;
                }
            }
            
            return true;
        });
        
        // Limpiar tabla
        tableBody.innerHTML = '';
        
        if (armazones.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center">No se encontraron armazones con los filtros aplicados</td></tr>';
            return;
        }
        
        // Agregar armazones a la tabla
        armazones.forEach(armazon => {
            // Buscar nombre de proveedor
            let proveedorNombre = 'No especificado';
            if (armazon.proveedorId) {
                const proveedor = proveedores.find(p => p.id === armazon.proveedorId);
                if (proveedor) {
                    proveedorNombre = proveedor.nombre;
                }
            }
            
            // Formatear colores
            let coloresHTML = 'No especificados';
            if (armazon.colores && armazon.colores.length > 0) {
                coloresHTML = armazon.colores.map(color => 
                    `<span class="tag">${color}</span>`
                ).join(' ');
            }
            
            // Formatear materiales
            let materialesHTML = 'No especificados';
            if (armazon.materiales && armazon.materiales.length > 0) {
                materialesHTML = armazon.materiales.map(material => 
                    `<span class="tag">${material}</span>`
                ).join(' ');
            }
            
            // Determinar clase de stock
            let stockClass = 'stock-normal';
            let stockMinimo = armazon.stockMinimo || CONFIG.STOCK_MINIMO_ARMAZON;
            let stockCritico = armazon.stockCritico || CONFIG.STOCK_CRITICO_ARMAZON;
            
            if (armazon.stock <= stockCritico) {
                stockClass = 'stock-danger';
            } else if (armazon.stock <= stockMinimo) {
                stockClass = 'stock-warning';
            }
            
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
            
            row.innerHTML = `
                <td class="py-3 px-4">${armazon.codigo || ''}</td>
                <td class="py-3 px-4">${armazon.nombre || ''}</td>
                <td class="py-3 px-4">${armazon.marca || ''}</td>
                <td class="py-3 px-4">${armazon.modelo || ''}</td>
                <td class="py-3 px-4">${coloresHTML}</td>
                <td class="py-3 px-4">${materialesHTML}</td>
                <td class="py-3 px-4">$${(armazon.precioVenta || 0).toFixed(2)}</td>
                <td class="py-3 px-4 ${stockClass}">${armazon.stock || 0}</td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        <button class="edit-armazon text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${armazon.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button class="delete-armazon text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${armazon.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Configurar eventos para los botones de editar y eliminar
        setupArmazonEvents();
    } catch (error) {
        console.error("Error al cargar armazones:", error);
        tableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center text-red-500">Error al cargar armazones</td></tr>';
        showToast('Error al cargar armazones', 'danger');
    }
}

// Configurar eventos para los modales
function setupModalEvents() {
    // Configurar botón para agregar producto
    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            // Mostrar modal de producto
            const modal = document.getElementById('productoModal');
            if (modal) {
                modal.style.display = 'block';
                document.getElementById('productoModalTitle').textContent = 'Agregar Producto';
                document.getElementById('productoForm').reset();
                document.getElementById('productoId').value = '';
                
                // Establecer valores predeterminados para stock mínimo y crítico
                document.getElementById('productoStockMinimo').value = CONFIG.STOCK_MINIMO_PRODUCTO;
                document.getElementById('productoStockCritico').value = CONFIG.STOCK_CRITICO_PRODUCTO;
                
                // Ocultar mensaje de error
                const errorMessage = document.getElementById('error-message');
                if (errorMessage) {
                    errorMessage.classList.add('hidden');
                    errorMessage.textContent = '';
                }
            }
        });
    }
    
    // Configurar botón para agregar armazón
    const addArmazonBtn = document.getElementById('addArmazonBtn');
    if (addArmazonBtn) {
        addArmazonBtn.addEventListener('click', () => {
            // Mostrar modal de armazón
            const modal = document.getElementById('armazonModal');
            if (modal) {
                modal.style.display = 'block';
                document.getElementById('armazonModalTitle').textContent = 'Agregar Armazón';
                document.getElementById('armazonForm').reset();
                document.getElementById('armazonId').value = '';
                
                // Establecer valores predeterminados para stock mínimo y crítico
                document.getElementById('armazonStockMinimo').value = CONFIG.STOCK_MINIMO_ARMAZON;
                document.getElementById('armazonStockCritico').value = CONFIG.STOCK_CRITICO_ARMAZON;
                
                // Limpiar colores y materiales
                coloresSeleccionados = [];
                materialesSeleccionados = [];
                actualizarColoresUI();
                actualizarMaterialesUI();
                
                // Ocultar mensaje de error
                const errorMessage = document.getElementById('armazon-error-message');
                if (errorMessage) {
                    errorMessage.classList.add('hidden');
                    errorMessage.textContent = '';
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
    
    // Configurar botones para agregar colores y materiales
    const addColorBtn = document.getElementById('addColorBtn');
    if (addColorBtn) {
        addColorBtn.addEventListener('click', () => {
            const nuevoColor = document.getElementById('nuevoColor').value.trim();
            if (nuevoColor) {
                if (!coloresSeleccionados.includes(nuevoColor)) {
                    coloresSeleccionados.push(nuevoColor);
                    actualizarColoresUI();
                }
                document.getElementById('nuevoColor').value = '';
            }
        });
    }
    
    const addMaterialBtn = document.getElementById('addMaterialBtn');
    if (addMaterialBtn) {
        addMaterialBtn.addEventListener('click', () => {
            const nuevoMaterial = document.getElementById('nuevoMaterial').value.trim();
            if (nuevoMaterial) {
                if (!materialesSeleccionados.includes(nuevoMaterial)) {
                    materialesSeleccionados.push(nuevoMaterial);
                    actualizarMaterialesUI();
                }
                document.getElementById('nuevoMaterial').value = '';
            }
        });
    }
    
    // Configurar eventos para el modal de confirmación
    const confirmModal = document.getElementById('confirmModal');
    const confirmCancel = document.getElementById('confirmCancel');
    
    if (confirmCancel) {
        confirmCancel.addEventListener('click', () => {
            if (confirmModal) {
                confirmModal.style.display = 'none';
            }
        });
    }
    
    // Configurar eventos para el modal de producto agotado
    const outOfStockModal = document.getElementById('outOfStockModal');
    const keepProduct = document.getElementById('keepProduct');
    const removeProduct = document.getElementById('removeProduct');
    
    if (keepProduct) {
        keepProduct.addEventListener('click', () => {
            if (outOfStockModal) {
                outOfStockModal.style.display = 'none';
            }
        });
    }
}

// Función para actualizar la UI de colores
function actualizarColoresUI() {
    const coloresContainer = document.getElementById('coloresContainer');
    const coloresHidden = document.getElementById('armazonColoresHidden');
    
    if (coloresContainer && coloresHidden) {
        coloresContainer.innerHTML = '';
        
        coloresSeleccionados.forEach((color, index) => {
            const tag = document.createElement('div');
            tag.className = 'tag flex items-center';
            tag.innerHTML = `
                <span>${color}</span>
                <button type="button" class="ml-1 text-xs text-gray-500 hover:text-red-500" data-index="${index}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            `;
            
            coloresContainer.appendChild(tag);
            
            // Agregar evento para eliminar color
            const deleteBtn = tag.querySelector('button');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    coloresSeleccionados.splice(index, 1);
                    actualizarColoresUI();
                });
            }
        });
        
        // Actualizar campo oculto
        coloresHidden.value = JSON.stringify(coloresSeleccionados);
    }
}

// Función para actualizar la UI de materiales
function actualizarMaterialesUI() {
    const materialesContainer = document.getElementById('materialesContainer');
    const materialesHidden = document.getElementById('armazonMaterialesHidden');
    
    if (materialesContainer && materialesHidden) {
        materialesContainer.innerHTML = '';
        
        materialesSeleccionados.forEach((material, index) => {
            const tag = document.createElement('div');
            tag.className = 'tag flex items-center';
            tag.innerHTML = `
                <span>${material}</span>
                <button type="button" class="ml-1 text-xs text-gray-500 hover:text-red-500" data-index="${index}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            `;
            
            materialesContainer.appendChild(tag);
            
            // Agregar evento para eliminar material
            const deleteBtn = tag.querySelector('button');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    materialesSeleccionados.splice(index, 1);
                    actualizarMaterialesUI();
                });
            }
        });
        
        // Actualizar campo oculto
        materialesHidden.value = JSON.stringify(materialesSeleccionados);
    }
}

// Configurar eventos para los formularios
function setupFormEvents() {
    // Configurar formulario de producto
    const productoForm = document.getElementById('productoForm');
    if (productoForm) {
        productoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const productoId = document.getElementById('productoId').value;
                const codigo = document.getElementById('productoCodigo').value;
                const nombre = document.getElementById('productoNombre').value;
                const descripcion = document.getElementById('productoDescripcion').value;
                const tipo = document.getElementById('productoTipo').value;
                const categoriaId = document.getElementById('productoCategoria').value;
                const proveedorId = document.getElementById('productoProveedor').value;
                const precioCompra = parseFloat(document.getElementById('productoPrecioCompra').value);
                const precioVenta = parseFloat(document.getElementById('productoPrecioVenta').value);
                const stock = parseInt(document.getElementById('productoStock').value);
                const stockMinimo = parseInt(document.getElementById('productoStockMinimo').value);
                const stockCritico = parseInt(document.getElementById('productoStockCritico').value);
                
                // Validar campos requeridos
                if (!codigo || !nombre || !tipo || !categoriaId || isNaN(precioCompra) || isNaN(precioVenta) || isNaN(stock)) {
                    const errorMessage = document.getElementById('error-message');
                    errorMessage.textContent = 'Por favor, complete todos los campos requeridos.';
                    errorMessage.classList.remove('hidden');
                    return;
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
                    updatedAt: serverTimestamp()
                };
                
                if (!productoId) {
                    // Agregar fecha de creación para nuevos productos
                    productoData.createdAt = serverTimestamp();
                    
                    // Verificar si ya existe un producto con el mismo código
                    const codigoQuery = query(
                        collection(db, 'productos'),
                        where('codigo', '==', codigo)
                    );
                    const codigoSnapshot = await getDocs(codigoQuery);
                    
                    if (!codigoSnapshot.empty) {
                        const errorMessage = document.getElementById('error-message');
                        errorMessage.textContent = 'Ya existe un producto con este código.';
                        errorMessage.classList.remove('hidden');
                        return;
                    }
                    
                    // Agregar nuevo producto
                    await addDoc(collection(db, 'productos'), productoData);
                    showToast('Producto agregado correctamente', 'success');
                } else {
                    // Actualizar producto existente
                    await updateDoc(doc(db, 'productos', productoId), productoData);
                    showToast('Producto actualizado correctamente', 'success');
                }
                
                // Cerrar modal
                document.getElementById('productoModal').style.display = 'none';
                
                // Recargar productos
                await loadProductos();
                
                // Verificar stock bajo
                checkLowStockItems();
            } catch (error) {
                console.error('Error al guardar producto:', error);
                const errorMessage = document.getElementById('error-message');
                errorMessage.textContent = 'Error al guardar el producto. Inténtelo de nuevo.';
                errorMessage.classList.remove('hidden');
                showToast('Error al guardar el producto', 'danger');
            }
        });
    }
    
    // Configurar formulario de armazón
    const armazonForm = document.getElementById('armazonForm');
    if (armazonForm) {
        armazonForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const armazonId = document.getElementById('armazonId').value;
                const codigo = document.getElementById('armazonCodigo').value;
                const nombre = document.getElementById('armazonNombre').value;
                const marca = document.getElementById('armazonMarca').value;
                const modelo = document.getElementById('armazonModelo').value;
                const proveedorId = document.getElementById('armazonProveedor').value;
                const precioCompra = parseFloat(document.getElementById('armazonPrecioCompra').value);
                const precioVenta = parseFloat(document.getElementById('armazonPrecioVenta').value);
                const stock = parseInt(document.getElementById('armazonStock').value);
                const stockMinimo = parseInt(document.getElementById('armazonStockMinimo').value);
                const stockCritico = parseInt(document.getElementById('armazonStockCritico').value);
                
                // Validar campos requeridos
                if (!codigo || !nombre || !marca || !modelo || isNaN(precioCompra) || isNaN(precioVenta) || isNaN(stock)) {
                    const errorMessage = document.getElementById('armazon-error-message');
                    errorMessage.textContent = 'Por favor, complete todos los campos requeridos.';
                    errorMessage.classList.remove('hidden');
                    return;
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
                    updatedAt: serverTimestamp()
                };
                
                if (!armazonId) {
                    // Agregar fecha de creación para nuevos armazones
                    armazonData.createdAt = serverTimestamp();
                    
                    // Verificar si ya existe un armazón con el mismo código
                    const codigoQuery = query(
                        collection(db, 'armazones'),
                        where('codigo', '==', codigo)
                    );
                    const codigoSnapshot = await getDocs(codigoQuery);
                    
                    if (!codigoSnapshot.empty) {
                        const errorMessage = document.getElementById('armazon-error-message');
                        errorMessage.textContent = 'Ya existe un armazón con este código.';
                        errorMessage.classList.remove('hidden');
                        return;
                    }
                    
                    // Agregar nuevo armazón
                    await addDoc(collection(db, 'armazones'), armazonData);
                    showToast('Armazón agregado correctamente', 'success');
                } else {
                    // Actualizar armazón existente
                    await updateDoc(doc(db, 'armazones', armazonId), armazonData);
                    showToast('Armazón actualizado correctamente', 'success');
                }
                
                // Cerrar modal
                document.getElementById('armazonModal').style.display = 'none';
                
                // Recargar armazones
                await loadArmazones();
                
                // Actualizar valores únicos para filtros
                await loadUniqueValues();
                
                // Verificar stock bajo
                checkLowStockItems();
            } catch (error) {
                console.error('Error al guardar armazón:', error);
                const errorMessage = document.getElementById('armazon-error-message');
                errorMessage.textContent = 'Error al guardar el armazón. Inténtelo de nuevo.';
                errorMessage.classList.remove('hidden');
                showToast('Error al guardar el armazón', 'danger');
            }
        });
    }
}

// Configurar eventos para los filtros
function setupFilterEvents() {
    // Mostrar/ocultar filtros de productos
    const toggleProductFilters = document.getElementById('toggleProductFilters');
    const productFiltersContainer = document.getElementById('productFiltersContainer');
    
    if (toggleProductFilters && productFiltersContainer) {
        toggleProductFilters.addEventListener('click', () => {
            productFiltersContainer.classList.toggle('hidden');
        });
    }
    
    // Mostrar/ocultar filtros de armazones
    const toggleArmazonFilters = document.getElementById('toggleArmazonFilters');
    const armazonFiltersContainer = document.getElementById('armazonFiltersContainer');
    
    if (toggleArmazonFilters && armazonFiltersContainer) {
        toggleArmazonFilters.addEventListener('click', () => {
            armazonFiltersContainer.classList.toggle('hidden');
        });
    }
    
    // Aplicar filtros de productos
    const applyProductFilters = document.getElementById('applyProductFilters');
    
    if (applyProductFilters) {
        applyProductFilters.addEventListener('click', () => {
            filtrosProductos.tipo = document.getElementById('filterProductoTipo').value;
            filtrosProductos.categoria = document.getElementById('filterProductoCategoria').value;
            filtrosProductos.proveedor = document.getElementById('filterProductoProveedor').value;
            filtrosProductos.precioMin = document.getElementById('filterProductoPrecioMin').value;
            filtrosProductos.precioMax = document.getElementById('filterProductoPrecioMax').value;
            
            loadProductos();
        });
    }
    
    // Limpiar filtros de productos
    const resetProductFilters = document.getElementById('resetProductFilters');
    
    if (resetProductFilters) {
        resetProductFilters.addEventListener('click', () => {
            document.getElementById('filterProductoTipo').value = '';
            document.getElementById('filterProductoCategoria').value = '';
            document.getElementById('filterProductoProveedor').value = '';
            document.getElementById('filterProductoPrecioMin').value = '';
            document.getElementById('filterProductoPrecioMax').value = '';
            
            filtrosProductos = {
                tipo: '',
                categoria: '',
                proveedor: '',
                precioMin: '',
                precioMax: '',
                busqueda: ''
            };
            
            document.getElementById('searchProducto').value = '';
            
            loadProductos();
        });
    }
    
    // Aplicar filtros de armazones
    const applyArmazonFilters = document.getElementById('applyArmazonFilters');
    
    if (applyArmazonFilters) {
        applyArmazonFilters.addEventListener('click', () => {
            filtrosArmazones.marca = document.getElementById('filterArmazonMarca').value;
            filtrosArmazones.material = document.getElementById('filterArmazonMaterial').value;
            filtrosArmazones.proveedor = document.getElementById('filterArmazonProveedor').value;
            filtrosArmazones.precioMin = document.getElementById('filterArmazonPrecioMin').value;
            filtrosArmazones.precioMax = document.getElementById('filterArmazonPrecioMax').value;
            
            loadArmazones();
        });
    }
    
    // Limpiar filtros de armazones
    const resetArmazonFilters = document.getElementById('resetArmazonFilters');
    
    if (resetArmazonFilters) {
        resetArmazonFilters.addEventListener('click', () => {
            document.getElementById('filterArmazonMarca').value = '';
            document.getElementById('filterArmazonMaterial').value = '';
            document.getElementById('filterArmazonProveedor').value = '';
            document.getElementById('filterArmazonPrecioMin').value = '';
            document.getElementById('filterArmazonPrecioMax').value = '';
            
            filtrosArmazones = {
                marca: '',
                material: '',
                proveedor: '',
                precioMin: '',
                precioMax: '',
                busqueda: ''
            };
            
            document.getElementById('searchArmazon').value = '';
            
            loadArmazones();
        });
    }
}

// Configurar eventos para las búsquedas
function setupSearchEvents() {
    // Búsqueda de productos
    const searchProductoBtn = document.getElementById('searchProductoBtn');
    const searchProducto = document.getElementById('searchProducto');
    
    if (searchProductoBtn && searchProducto) {
        searchProductoBtn.addEventListener('click', () => {
            filtrosProductos.busqueda = searchProducto.value.trim();
            loadProductos();
        });
        
        searchProducto.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                filtrosProductos.busqueda = searchProducto.value.trim();
                loadProductos();
            }
        });
    }
    
    // Búsqueda de armazones
    const searchArmazonBtn = document.getElementById('searchArmazonBtn');
    const searchArmazon = document.getElementById('searchArmazon');
    
    if (searchArmazonBtn && searchArmazon) {
        searchArmazonBtn.addEventListener('click', () => {
            filtrosArmazones.busqueda = searchArmazon.value.trim();
            loadArmazones();
        });
        
        searchArmazon.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                filtrosArmazones.busqueda = searchArmazon.value.trim();
                loadArmazones();
            }
        });
    }
}

// Configurar eventos para los productos
function setupProductoEvents() {
    // Configurar botones para editar productos
    const editButtons = document.querySelectorAll('.edit-producto');
    editButtons.forEach(button => {
        button.addEventListener('click', () => {
            const productoId = button.getAttribute('data-id');
            editProducto(productoId);
        });
    });
    
    // Configurar botones para eliminar productos
    const deleteButtons = document.querySelectorAll('.delete-producto');
    deleteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const productoId = button.getAttribute('data-id');
            confirmDeleteProducto(productoId);
        });
    });
}

// Configurar eventos para los armazones
function setupArmazonEvents() {
    // Configurar botones para editar armazones
    const editButtons = document.querySelectorAll('.edit-armazon');
    editButtons.forEach(button => {
        button.addEventListener('click', () => {
            const armazonId = button.getAttribute('data-id');
            editArmazon(armazonId);
        });
    });
    
    // Configurar botones para eliminar armazones
    const deleteButtons = document.querySelectorAll('.delete-armazon');
    deleteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const armazonId = button.getAttribute('data-id');
            confirmDeleteArmazon(armazonId);
        });
    });
}

// Función para editar un producto
async function editProducto(productoId) {
    try {
        // Obtener datos del producto
        const docRef = doc(db, 'productos', productoId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const producto = docSnap.data();
            
            // Mostrar modal de producto
            const modal = document.getElementById('productoModal');
            if (modal) {
                modal.style.display = 'block';
                document.getElementById('productoModalTitle').textContent = 'Editar Producto';
                
                // Llenar formulario con datos del producto
                document.getElementById('productoId').value = productoId;
                document.getElementById('productoCodigo').value = producto.codigo || '';
                document.getElementById('productoNombre').value = producto.nombre || '';
                document.getElementById('productoDescripcion').value = producto.descripcion || '';
                document.getElementById('productoTipo').value = producto.tipo || '';
                document.getElementById('productoCategoria').value = producto.categoriaId || '';
                document.getElementById('productoProveedor').value = producto.proveedorId || '';
                document.getElementById('productoPrecioCompra').value = producto.precioCompra || '';
                document.getElementById('productoPrecioVenta').value = producto.precioVenta || '';
                document.getElementById('productoStock').value = producto.stock || '';
                document.getElementById('productoStockMinimo').value = producto.stockMinimo || CONFIG.STOCK_MINIMO_PRODUCTO;
                document.getElementById('productoStockCritico').value = producto.stockCritico || CONFIG.STOCK_CRITICO_PRODUCTO;
                
                // Ocultar mensaje de error
                const errorMessage = document.getElementById('error-message');
                if (errorMessage) {
                    errorMessage.classList.add('hidden');
                    errorMessage.textContent = '';
                }
            }
        } else {
            console.error("No se encontró el producto");
            showToast('No se encontró el producto', 'danger');
        }
    } catch (error) {
        console.error("Error al obtener producto:", error);
        showToast('Error al obtener el producto', 'danger');
    }
}

// Función para confirmar eliminación de un producto
function confirmDeleteProducto(productoId) {
    const confirmModal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmOk = document.getElementById('confirmOk');
    
    if (confirmModal && confirmTitle && confirmMessage && confirmOk) {
        confirmTitle.textContent = 'Eliminar Producto';
        confirmMessage.textContent = '¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.';
        
        confirmModal.style.display = 'block';
        
        // Configurar evento para el botón de confirmar
        const handleConfirm = async () => {
            try {
                await deleteProducto(productoId);
                confirmModal.style.display = 'none';
                
                // Remover el evento para evitar duplicados
                confirmOk.removeEventListener('click', handleConfirm);
            } catch (error) {
                console.error("Error al eliminar producto:", error);
                showToast('Error al eliminar el producto', 'danger');
                confirmModal.style.display = 'none';
                
                // Remover el evento para evitar duplicados
                confirmOk.removeEventListener('click', handleConfirm);
            }
        };
        
        // Remover eventos anteriores y agregar el nuevo
        confirmOk.removeEventListener('click', handleConfirm);
        confirmOk.addEventListener('click', handleConfirm);
    }
}

// Función para eliminar un producto
async function deleteProducto(productoId) {
    try {
        await deleteDoc(doc(db, 'productos', productoId));
        showToast('Producto eliminado correctamente', 'success');
        loadProductos();
    } catch (error) {
        console.error("Error al eliminar producto:", error);
        throw error;
    }
}

// Función para editar un armazón
async function editArmazon(armazonId) {
    try {
        // Obtener datos del armazón
        const docRef = doc(db, 'armazones', armazonId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const armazon = docSnap.data();
            
            // Mostrar modal de armazón
            const modal = document.getElementById('armazonModal');
            if (modal) {
                modal.style.display = 'block';
                document.getElementById('armazonModalTitle').textContent = 'Editar Armazón';
                
                // Llenar formulario con datos del armazón
                document.getElementById('armazonId').value = armazonId;
                document.getElementById('armazonCodigo').value = armazon.codigo || '';
                document.getElementById('armazonNombre').value = armazon.nombre || '';
                document.getElementById('armazonMarca').value = armazon.marca || '';
                document.getElementById('armazonModelo').value = armazon.modelo || '';
                document.getElementById('armazonProveedor').value = armazon.proveedorId || '';
                document.getElementById('armazonPrecioCompra').value = armazon.precioCompra || '';
                document.getElementById('armazonPrecioVenta').value = armazon.precioVenta || '';
                document.getElementById('armazonStock').value = armazon.stock || '';
                document.getElementById('armazonStockMinimo').value = armazon.stockMinimo || CONFIG.STOCK_MINIMO_ARMAZON;
                document.getElementById('armazonStockCritico').value = armazon.stockCritico || CONFIG.STOCK_CRITICO_ARMAZON;
                
                // Cargar colores y materiales
                coloresSeleccionados = armazon.colores || [];
                materialesSeleccionados = armazon.materiales || [];
                actualizarColoresUI();
                actualizarMaterialesUI();
                
                // Ocultar mensaje de error
                const errorMessage = document.getElementById('armazon-error-message');
                if (errorMessage) {
                    errorMessage.classList.add('hidden');
                    errorMessage.textContent = '';
                }
            }
        } else {
            console.error("No se encontró el armazón");
            showToast('No se encontró el armazón', 'danger');
        }
    } catch (error) {
        console.error("Error al obtener armazón:", error);
        showToast('Error al obtener el armazón', 'danger');
    }
}

// Función para confirmar eliminación de un armazón
function confirmDeleteArmazon(armazonId) {
    const confirmModal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmOk = document.getElementById('confirmOk');
    
    if (confirmModal && confirmTitle && confirmMessage && confirmOk) {
        confirmTitle.textContent = 'Eliminar Armazón';
        confirmMessage.textContent = '¿Estás seguro de que deseas eliminar este armazón? Esta acción no se puede deshacer.';
        
        confirmModal.style.display = 'block';
        
        // Configurar evento para el botón de confirmar
        const handleConfirm = async () => {
            try {
                await deleteArmazon(armazonId);
                confirmModal.style.display = 'none';
                
                // Remover el evento para evitar duplicados
                confirmOk.removeEventListener('click', handleConfirm);
            } catch (error) {
                console.error("Error al eliminar armazón:", error);
                showToast('Error al eliminar el armazón', 'danger');
                confirmModal.style.display = 'none';
                
                // Remover el evento para evitar duplicados
                confirmOk.removeEventListener('click', handleConfirm);
            }
        };
        
        // Remover eventos anteriores y agregar el nuevo
        confirmOk.removeEventListener('click', handleConfirm);
        confirmOk.addEventListener('click', handleConfirm);
    }
}

// Función para eliminar un armazón
async function deleteArmazon(armazonId) {
    try {
        await deleteDoc(doc(db, 'armazones', armazonId));
        showToast('Armazón eliminado correctamente', 'success');
        loadArmazones();
    } catch (error) {
        console.error("Error al eliminar armazón:", error);
        throw error;
    }
}

// Función para verificar productos con stock bajo
async function checkLowStockItems() {
    try {
        const alertsContainer = document.getElementById('alertsContainer');
        if (!alertsContainer) return;
        
        // Limpiar alertas anteriores
        alertsContainer.innerHTML = '';
        
        // Verificar productos con stock bajo
        const productosSnapshot = await getDocs(collection(db, 'productos'));
        const productosStockBajo = [];
        const productosStockCritico = [];
        const productosAgotados = [];
        
        productosSnapshot.forEach(doc => {
            const producto = doc.data();
            const stockMinimo = producto.stockMinimo || CONFIG.STOCK_MINIMO_PRODUCTO;
            const stockCritico = producto.stockCritico || CONFIG.STOCK_CRITICO_PRODUCTO;
            
            if (producto.stock === 0) {
                productosAgotados.push({
                    id: doc.id,
                    ...producto
                });
            } else if (producto.stock <= stockCritico) {
                productosStockCritico.push({
                    id: doc.id,
                    ...producto
                });
            } else if (producto.stock <= stockMinimo) {
                productosStockBajo.push({
                    id: doc.id,
                    ...producto
                });
            }
        });
        
        // Verificar armazones con stock bajo
        const armazonesSnapshot = await getDocs(collection(db, 'armazones'));
        const armazonesStockBajo = [];
        const armazonesStockCritico = [];
        const armazonesAgotados = [];
        
        armazonesSnapshot.forEach(doc => {
            const armazon = doc.data();
            const stockMinimo = armazon.stockMinimo || CONFIG.STOCK_MINIMO_ARMAZON;
            const stockCritico = armazon.stockCritico || CONFIG.STOCK_CRITICO_ARMAZON;
            
            if (armazon.stock === 0) {
                armazonesAgotados.push({
                    id: doc.id,
                    ...armazon
                });
            } else if (armazon.stock <= stockCritico) {
                armazonesStockCritico.push({
                    id: doc.id,
                    ...armazon
                });
            } else if (armazon.stock <= stockMinimo) {
                armazonesStockBajo.push({
                    id: doc.id,
                    ...armazon
                });
            }
        });
        
        // Mostrar alertas de productos agotados
        if (productosAgotados.length > 0) {
            productosAgotados.forEach(producto => {
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-danger';
                alertDiv.innerHTML = `
                    <div class="flex justify-between items-center w-full">
                        <div>
                            <strong>Producto Agotado:</strong> ${producto.nombre}
                        </div>
                        <div class="flex space-x-2">
                            <button type="button" class="keep-product text-blue-600 hover:text-blue-800" data-id="${producto.id}" data-type="producto">
                                Conservar
                            </button>
                            <button type="button" class="remove-product text-red-600 hover:text-red-800" data-id="${producto.id}" data-type="producto">
                                Eliminar
                            </button>
                        </div>
                    </div>
                `;
                
                alertsContainer.appendChild(alertDiv);
                
                // Agregar eventos para los botones
                const keepBtn = alertDiv.querySelector('.keep-product');
                const removeBtn = alertDiv.querySelector('.remove-product');
                
                if (keepBtn) {
                    keepBtn.addEventListener('click', () => {
                        alertDiv.remove();
                    });
                }
                
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        confirmDeleteProducto(producto.id);
                        alertDiv.remove();
                    });
                }
            });
        }
        
        // Mostrar alertas de armazones agotados
        if (armazonesAgotados.length > 0) {
            armazonesAgotados.forEach(armazon => {
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-danger';
                alertDiv.innerHTML = `
                    <div class="flex justify-between items-center w-full">
                        <div>
                            <strong>Armazón Agotado:</strong> ${armazon.nombre}
                        </div>
                        <div class="flex space-x-2">
                            <button type="button" class="keep-armazon text-blue-600 hover:text-blue-800" data-id="${armazon.id}" data-type="armazon">
                                Conservar
                            </button>
                            <button type="button" class="remove-armazon text-red-600 hover:text-red-800" data-id="${armazon.id}" data-type="armazon">
                                Eliminar
                            </button>
                        </div>
                    </div>
                `;
                
                alertsContainer.appendChild(alertDiv);
                
                // Agregar eventos para los botones
                const keepBtn = alertDiv.querySelector('.keep-armazon');
                const removeBtn = alertDiv.querySelector('.remove-armazon');
                
                if (keepBtn) {
                    keepBtn.addEventListener('click', () => {
                        alertDiv.remove();
                    });
                }
                
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        confirmDeleteArmazon(armazon.id);
                        alertDiv.remove();
                    });
                }
            });
        }
        
        // Mostrar alertas de productos con stock crítico
        if (productosStockCritico.length > 0) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-warning';
            
            let content = '<strong>Stock Crítico:</strong> ';
            productosStockCritico.forEach((producto, index) => {
                content += `${producto.nombre} (${producto.stock})`;
                if (index < productosStockCritico.length - 1) {
                    content += ', ';
                }
            });
            
            alertDiv.innerHTML = content;
            alertsContainer.appendChild(alertDiv);
        }
        
        // Mostrar alertas de armazones con stock crítico
        if (armazonesStockCritico.length > 0) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-warning';
            
            let content = '<strong>Armazones con Stock Crítico:</strong> ';
            armazonesStockCritico.forEach((armazon, index) => {
                content += `${armazon.nombre} (${armazon.stock})`;
                if (index < armazonesStockCritico.length - 1) {
                    content += ', ';
                }
            });
            
            alertDiv.innerHTML = content;
            alertsContainer.appendChild(alertDiv);
        }
        
        // Mostrar alertas de productos con stock bajo
        if (productosStockBajo.length > 0) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-info';
            
            let content = '<strong>Stock Bajo:</strong> ';
            productosStockBajo.forEach((producto, index) => {
                content += `${producto.nombre} (${producto.stock})`;
                if (index < productosStockBajo.length - 1) {
                    content += ', ';
                }
            });
            
            alertDiv.innerHTML = content;
            alertsContainer.appendChild(alertDiv);
        }
        
        // Mostrar alertas de armazones con stock bajo
        if (armazonesStockBajo.length > 0) {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-info';
            
            let content = '<strong>Armazones con Stock Bajo:</strong> ';
            armazonesStockBajo.forEach((armazon, index) => {
                content += `${armazon.nombre} (${armazon.stock})`;
                if (index < armazonesStockBajo.length - 1) {
                    content += ', ';
                }
            });
            
            alertDiv.innerHTML = content;
            alertsContainer.appendChild(alertDiv);
        }
    } catch (error) {
        console.error("Error al verificar stock bajo:", error);
    }
}