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
let currentSale = null;
let lastVisible = null;
const SALES_PER_PAGE = 10;
let clientes = [];
let productos = [];
let armazones = [];
let empresas = [];
let currentClientId = null;

// Filtros activos
let filtrosVentas = {
    cliente: '',
    estado: '',
    fechaInicio: '',
    fechaFin: '',
    busqueda: ''
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Página de ventas cargada');
    
    try {
        // Verificar autenticación (esto ya lo hace auth-check.js)
        
        // Verificar colecciones de inventario (reusando la función existente)
        await checkAndCreateInventoryCollection();
        
        // Verificar y crear colecciones específicas para ventas
        await checkAndCreateVentasCollection();
        
        // Verificar si hay un cliente en la URL (para ventas desde la página de clientes)
        checkClienteFromURL();
        
        // Cargar datos necesarios
        await Promise.all([
            loadClientes(),
            loadProductos(),
            loadArmazones(),
            loadEmpresas()
        ]);
        
        // Configurar eventos para los modales
        setupModalEvents();
        
        // Configurar eventos para los formularios
        setupFormEvents();
        
        // Configurar eventos para las búsquedas
        setupSearchEvents();
        
        // Cargar datos iniciales de ventas
        await loadVentas();
        
    } catch (error) {
        console.error("Error al inicializar la página de ventas:", error);
        showToast('Error al cargar la página de ventas', 'danger');
    }
});

// Función para verificar y crear colecciones necesarias para ventas
async function checkAndCreateVentasCollection() {
    try {
        console.log("Verificando colecciones de ventas...");
        
        // Verificar si existe la colección de ventas
        const ventasSnapshot = await getDocs(collection(db, 'ventas'));
        if (ventasSnapshot.empty) {
            console.log("Creando colección de ventas...");
            // No es necesario crear un documento placeholder, la colección se creará automáticamente
            // al agregar la primera venta
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
        
        // Verificar si existe la colección de métodos de pago
        const metodosPagoSnapshot = await getDocs(collection(db, 'metodosPago'));
        if (metodosPagoSnapshot.empty) {
            console.log("Creando colección de métodos de pago...");
            // Crear métodos de pago iniciales
            const metodosPagoIniciales = [
                { nombre: 'Efectivo', descripcion: 'Pago en efectivo' },
                { nombre: 'Tarjeta de crédito', descripcion: 'Pago con tarjeta de crédito' },
                { nombre: 'Tarjeta de débito', descripcion: 'Pago con tarjeta de débito' },
                { nombre: 'Transferencia', descripcion: 'Pago por transferencia bancaria' }
            ];
            
            for (const metodoPago of metodosPagoIniciales) {
                await addDoc(collection(db, 'metodosPago'), {
                    ...metodoPago,
                    createdAt: serverTimestamp()
                });
            }
        }
        
        console.log("Verificación de colecciones de ventas completada");
    } catch (error) {
        console.error("Error al verificar o crear colecciones de ventas:", error);
        throw error;
    }
}

// Función para verificar si hay un cliente en la URL
function checkClienteFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('clientId');
    
    if (clientId) {
        currentClientId = clientId;
        console.log("Cliente seleccionado desde URL:", currentClientId);
        
        // Abrir modal de nueva venta automáticamente
        setTimeout(() => {
            const addSaleBtn = document.getElementById('addSaleBtn');
            if (addSaleBtn) {
                addSaleBtn.click();
            }
        }, 500);
    }
}

// Función para cargar clientes
async function loadClientes() {
    try {
        const clientesSnapshot = await getDocs(collection(db, 'clientes'));
        clientes = [];
        
        clientesSnapshot.forEach(doc => {
            clientes.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Actualizar el selector de clientes en el formulario de venta
        const clienteIdSelect = document.getElementById('clienteId');
        if (clienteIdSelect) {
            clienteIdSelect.innerHTML = '<option value="">Venta de mostrador</option>';
            clientes.forEach(cliente => {
                const option = document.createElement('option');
                option.value = cliente.id;
                option.textContent = cliente.nombre;
                
                // Si hay un cliente seleccionado desde la URL, seleccionarlo
                if (cliente.id === currentClientId) {
                    option.selected = true;
                }
                
                clienteIdSelect.appendChild(option);
            });
            
            // Disparar el evento change para actualizar la información de convenio
            if (currentClientId) {
                const event = new Event('change');
                clienteIdSelect.dispatchEvent(event);
            }
        }
        
        console.log("Clientes cargados:", clientes.length);
    } catch (error) {
        console.error("Error al cargar clientes:", error);
        showToast('Error al cargar clientes', 'danger');
    }
}

// Función para cargar productos
async function loadProductos() {
    try {
        const productosSnapshot = await getDocs(collection(db, 'productos'));
        productos = [];
        
        productosSnapshot.forEach(doc => {
            // Excluir el documento placeholder
            if (doc.id !== 'placeholder' && !doc.data().isPlaceholder) {
                productos.push({
                    id: doc.id,
                    ...doc.data()
                });
            }
        });
        
        console.log("Productos cargados:", productos.length);
    } catch (error) {
        console.error("Error al cargar productos:", error);
        showToast('Error al cargar productos', 'danger');
    }
}

// Función para cargar armazones
async function loadArmazones() {
    try {
        const armazonesSnapshot = await getDocs(collection(db, 'armazones'));
        armazones = [];
        
        armazonesSnapshot.forEach(doc => {
            // Excluir el documento placeholder
            if (doc.id !== 'placeholder' && !doc.data().isPlaceholder) {
                armazones.push({
                    id: doc.id,
                    ...doc.data()
                });
            }
        });
        
        console.log("Armazones cargados:", armazones.length);
    } catch (error) {
        console.error("Error al cargar armazones:", error);
        showToast('Error al cargar armazones', 'danger');
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
    toast.className = `bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 mb-3 flex items-center justify-between border-l-4 ${
        type === 'success' ? 'border-green-500' : 
        type === 'danger' ? 'border-red-500' : 
        type === 'warning' ? 'border-yellow-500' : 'border-blue-500'
    }`;
    
    toast.innerHTML = `
        <div class="flex items-center">
            <span class="${
                type === 'success' ? 'text-green-500' : 
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
    // Configurar botón para agregar venta
    const addSaleBtn = document.getElementById('addSaleBtn');
    if (addSaleBtn) {
        addSaleBtn.addEventListener('click', () => {
            // Mostrar modal de venta
            const modal = document.getElementById('saleModal');
            if (modal) {
                modal.style.display = 'block';
                document.getElementById('modalTitle').textContent = 'Registrar Nueva Venta';
                
                // Limpiar formulario
                document.getElementById('saleForm').reset();
                document.getElementById('saleId').value = '';
                
                // Establecer fecha actual
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                document.getElementById('fechaVenta').value = `${year}-${month}-${day}`;
                
                // Limpiar contenedor de productos
                const productosContainer = document.getElementById('productosContainer');
                if (productosContainer) {
                    productosContainer.innerHTML = '';
                    // Agregar el primer producto
                    addProductoItem();
                }
                
                // Deshabilitar checkbox de convenio
                const esConvenio = document.getElementById('esConvenio');
                const infoConvenio = document.getElementById('infoConvenio');
                if (esConvenio && infoConvenio) {
                    esConvenio.checked = false;
                    infoConvenio.style.display = 'none';
                }

                // Configurar el campo de abono según el tipo de venta
                const clienteIdSelect = document.getElementById('clienteId');
                const abonoGroup = document.getElementById('abonoGroup');
                if (clienteIdSelect && abonoGroup) {
                    if (!clienteIdSelect.value) {
                        // Venta de mostrador - ocultar campo de abono y establecer al total
                        abonoGroup.style.display = 'none';
                    } else {
                        // Venta a cliente registrado - mostrar campo de abono
                        abonoGroup.style.display = 'block';
                    }
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
    
    // Configurar botón para agregar producto
    const addProductoBtn = document.getElementById('addProductoBtn');
    if (addProductoBtn) {
        addProductoBtn.addEventListener('click', () => {
            addProductoItem();
        });
    }
}

// Función para agregar un elemento de producto al formulario
function addProductoItem() {
    const productosContainer = document.getElementById('productosContainer');
    if (!productosContainer) return;
    
    const productoIndex = document.querySelectorAll('.producto-item').length;
    
    const productoItem = document.createElement('div');
    productoItem.className = 'producto-item';
    productoItem.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <h4 class="font-semibold">Producto ${productoIndex + 1}</h4>
            ${productoIndex > 0 ? `
                <button type="button" class="remove-producto text-red-500 hover:text-red-700">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            ` : ''}
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
                <input type="number" id="cantidad_${productoIndex}" class="cantidad w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" min="1" value="1" required>
            </div>
            <div class="form-group">
                <label for="precio_${productoIndex}" class="block mb-1 font-medium">Precio unitario</label>
                <input type="number" step="0.01" id="precio_${productoIndex}" class="precio w-full p-2 border border-mediumGray rounded-md text-base focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-700 dark:border-gray-600" required readonly>
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
    `;
    
    productosContainer.appendChild(productoItem);
    
    // Configurar eventos para el nuevo producto
    setupProductoEvents(productoIndex);
}

// Configurar eventos para un producto
function setupProductoEvents(index) {
    // Evento para eliminar producto
    const removeBtn = document.querySelector(`.producto-item:nth-child(${index + 1}) .remove-producto`);
    if (removeBtn) {
        removeBtn.addEventListener('click', function() {
            this.closest('.producto-item').remove();
            // Renumerar productos
            document.querySelectorAll('.producto-item').forEach((item, i) => {
                item.querySelector('h4').textContent = `Producto ${i + 1}`;
            });
            // Recalcular total
            calcularTotal();
        });
    }
    
    // Evento para cambiar tipo de producto
    const tipoProducto = document.getElementById(`tipoProducto_${index}`);
    const productoSelect = document.getElementById(`producto_${index}`);
    
    if (tipoProducto && productoSelect) {
        tipoProducto.addEventListener('change', () => {
            const tipo = tipoProducto.value;
            
            // Habilitar/deshabilitar selector de producto
            productoSelect.disabled = !tipo;
            productoSelect.innerHTML = '<option value="">Seleccione producto</option>';
            
            if (tipo === 'producto') {
                // Cargar productos
                productos.forEach(producto => {
                    // Solo mostrar productos con stock disponible
                    if (producto.stock > 0) {
                        const option = document.createElement('option');
                        option.value = producto.id;
                        option.textContent = `${producto.nombre} (Stock: ${producto.stock})`;
                        option.dataset.precio = producto.precioVenta || 0;
                        option.dataset.stock = producto.stock || 0;
                        productoSelect.appendChild(option);
                    }
                });
            } else if (tipo === 'armazon') {
                // Cargar armazones
                armazones.forEach(armazon => {
                    // Solo mostrar armazones con stock disponible
                    if (armazon.stock > 0) {
                        const option = document.createElement('option');
                        option.value = armazon.id;
                        option.textContent = `${armazon.marca} - ${armazon.modelo} (Stock: ${armazon.stock})`;
                        option.dataset.precio = armazon.precioVenta || 0;
                        option.dataset.stock = armazon.stock || 0;
                        productoSelect.appendChild(option);
                    }
                });
            }
        });
        
        // Evento para seleccionar producto
        productoSelect.addEventListener('change', () => {
            const selectedOption = productoSelect.options[productoSelect.selectedIndex];
            const precio = selectedOption.dataset.precio || 0;
            const stock = selectedOption.dataset.stock || 0;
            
            // Establecer precio
            const precioInput = document.getElementById(`precio_${index}`);
            if (precioInput) {
                precioInput.value = precio;
                precioInput.dataset.original = precio; // Guardar precio original para descuentos
                precioInput.readOnly = true; // Hacer el campo de solo lectura
                
                // Disparar evento para calcular subtotal
                precioInput.dispatchEvent(new Event('input'));
            }
            
            // Establecer stock máximo
            const cantidadInput = document.getElementById(`cantidad_${index}`);
            if (cantidadInput) {
                cantidadInput.max = stock;
                cantidadInput.dataset.stock = stock;
                cantidadInput.value = 1; // Establecer valor predeterminado a 1
                
                // Mostrar información de stock
                const stockInfo = document.getElementById(`stockInfo_${index}`);
                if (stockInfo) {
                    stockInfo.textContent = `Stock disponible: ${stock}`;
                    stockInfo.style.display = 'block';
                }
            }
        });
        
        // Eventos para calcular subtotal
        const cantidadInput = document.getElementById(`cantidad_${index}`);
        const precioInput = document.getElementById(`precio_${index}`);
        const subtotalInput = document.getElementById(`subtotal_${index}`);
        const descuentoInput = document.getElementById(`descuento_${index}`);
        
        if (cantidadInput && precioInput && subtotalInput) {
            const calcularSubtotal = () => {
                const cantidad = parseInt(cantidadInput.value) || 0;
                const precio = parseFloat(precioInput.value) || 0;
                const stock = parseInt(cantidadInput.dataset.stock) || 0;
                
                // Validar que la cantidad sea al menos 1
                if (cantidad < 1) {
                    cantidadInput.value = 1;
                }
                
                // Validar que la cantidad no exceda el stock
                if (cantidad > stock) {
                    showToast(`No hay suficiente stock. Máximo disponible: ${stock}`, 'warning');
                    cantidadInput.value = stock;
                }
                
                // Recalcular con el valor final
                const cantidadFinal = parseInt(cantidadInput.value) || 0;
                const subtotal = cantidadFinal * precio;
                subtotalInput.value = subtotal.toFixed(2);
                
                // Calcular total general
                calcularTotal();
            };
            
            cantidadInput.addEventListener('input', calcularSubtotal);
            precioInput.addEventListener('input', calcularSubtotal);
            
            // Evento para aplicar descuento
            if (descuentoInput) {
                descuentoInput.addEventListener('input', () => {
                    const descuento = parseFloat(descuentoInput.value) || 0;
                    const precioOriginal = parseFloat(precioInput.dataset.original) || 0;
                    
                    if (descuento > 0 && descuento <= 100) {
                        // Calcular precio con descuento
                        const precioConDescuento = precioOriginal * (1 - (descuento / 100));
                        precioInput.value = precioConDescuento.toFixed(2);
                        
                        // Habilitar edición manual del precio
                        precioInput.readOnly = false;
                    } else {
                        // Restaurar precio original
                        precioInput.value = precioOriginal;
                        precioInput.readOnly = true;
                    }
                    
                    // Recalcular subtotal
                    precioInput.dispatchEvent(new Event('input'));
                });
            }
        }
    }
}

// Función para calcular el total de la venta
function calcularTotal() {
    const subtotales = document.querySelectorAll('.subtotal');
    let total = 0;
    
    subtotales.forEach(subtotal => {
        total += parseFloat(subtotal.value) || 0;
    });
    
    const totalInput = document.getElementById('total');
    if (totalInput) {
        totalInput.value = total.toFixed(2);
    }
    
    // Actualizar abono máximo
    const abonoInput = document.getElementById('abono');
    if (abonoInput) {
        abonoInput.max = total;
        
        // Si es venta de mostrador, actualizar el abono automáticamente al total
        const clienteId = document.getElementById('clienteId').value;
        if (!clienteId) {
            abonoInput.value = total.toFixed(2);
        }
    }
}

// Configurar eventos para los formularios
function setupFormEvents() {
    // Configurar formulario de venta
    const saleForm = document.getElementById('saleForm');
    if (saleForm) {
        saleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const saleId = document.getElementById('saleId').value;
                const clienteId = document.getElementById('clienteId').value;
                const fechaVenta = document.getElementById('fechaVenta').value;
                const abono = parseFloat(document.getElementById('abono').value) || 0;
                const total = parseFloat(document.getElementById('total').value) || 0;
                const observaciones = document.getElementById('observaciones').value;
                
                // Validar que haya al menos un producto
                const productosItems = document.querySelectorAll('.producto-item');
                if (productosItems.length === 0) {
                    showToast('Debe agregar al menos un producto', 'warning');
                    return;
                }
                
                // Validar que todos los productos tengan tipo, producto, cantidad y precio
                let isValid = true;
                const productos = [];
                const productosParaActualizar = [];
                
                productosItems.forEach((item, index) => {
                    const tipoProducto = document.getElementById(`tipoProducto_${index}`).value;
                    const productoId = document.getElementById(`producto_${index}`).value;
                    const cantidad = parseInt(document.getElementById(`cantidad_${index}`).value) || 0;
                    const precio = parseFloat(document.getElementById(`precio_${index}`).value) || 0;
                    const subtotal = parseFloat(document.getElementById(`subtotal_${index}`).value) || 0;
                    const descuento = parseFloat(document.getElementById(`descuento_${index}`).value) || 0;
                    
                    if (!tipoProducto || !productoId || cantidad <= 0 || precio <= 0) {
                        isValid = false;
                        return;
                    }
                    
                    // Obtener nombre del producto
                    let nombreProducto = '';
                    const productoSelect = document.getElementById(`producto_${index}`);
                    if (productoSelect) {
                        nombreProducto = productoSelect.options[productoSelect.selectedIndex].text;
                    }
                    
                    productos.push({
                        tipo: tipoProducto,
                        productoId,
                        nombreProducto,
                        cantidad,
                        precio,
                        descuento,
                        subtotal
                    });
                    
                    // Agregar a la lista de productos para actualizar inventario
                    productosParaActualizar.push({
                        tipo: tipoProducto,
                        id: productoId,
                        cantidad
                    });
                });
                
                if (!isValid) {
                    showToast('Por favor, complete todos los campos de productos correctamente', 'warning');
                    return;
                }
                
                // Validar abono según tipo de venta
                if (abono > total) {
                    showToast('El abono no puede ser mayor al total', 'warning');
                    return;
                }

                // Para ventas de mostrador, el pago debe ser completo
                if (!clienteId && abono < total) {
                    showToast('Las ventas de mostrador deben pagarse completamente', 'warning');
                    return;
                }
                
                // Confirmar la reducción de stock
                const confirmMessage = `Esta venta reducirá el stock de ${productosParaActualizar.length} producto(s). ¿Desea continuar?`;
                if (!confirm(confirmMessage)) {
                    return;
                }
                
                // Determinar si es venta a cliente registrado o venta de mostrador
                const esVentaCliente = !!clienteId;
                
                // Determinar si el cliente tiene convenio
                let convenio = false;
                let empresaId = null;
                
                if (esVentaCliente) {
                    const cliente = clientes.find(c => c.id === clienteId);
                    if (cliente && cliente.convenio) {
                        convenio = true;
                        empresaId = cliente.empresaId;
                    }
                }
                
                // Determinar estado de la venta
                let estado = 'pendiente';
                if (abono >= total) {
                    estado = 'pagada';
                } else if (abono > 0) {
                    estado = 'parcial';
                }
                
                // Crear objeto de venta
                const ventaData = {
                    clienteId: esVentaCliente ? clienteId : null,
                    fecha: fechaVenta ? new Date(fechaVenta) : new Date(),
                    productos,
                    total,
                    abono,
                    saldo: total - abono,
                    estado,
                    convenio,
                    empresaId,
                    observaciones: observaciones || '',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };
                
                if (!saleId) {
                    // Agregar nueva venta
                    const ventaRef = await addDoc(collection(db, 'ventas'), ventaData);
                    
                    // Actualizar inventario
                    await actualizarInventario(productosParaActualizar);
                    
                    // Si hay abono, registrarlo
                    if (abono > 0) {
                        await registrarAbono(ventaRef.id, clienteId, abono, 'Abono inicial');
                    }
                    
                    // Si es venta a cliente registrado, actualizar última visita
                    if (esVentaCliente) {
                        await updateDoc(doc(db, 'clientes', clienteId), {
                            ultimaVisita: serverTimestamp()
                        });
                    }
                    
                    showToast('Venta registrada correctamente', 'success');
                } else {
                    // Actualizar venta existente (esto normalmente no se debería hacer)
                    await updateDoc(doc(db, 'ventas', saleId), ventaData);
                    showToast('Venta actualizada correctamente', 'success');
                }
                
                // Cerrar modal
                document.getElementById('saleModal').style.display = 'none';
                
                // Recargar ventas
                await loadVentas();
                
                // Recargar productos y armazones para actualizar stock
                await Promise.all([
                    loadProductos(),
                    loadArmazones()
                ]);
                
            } catch (error) {
                console.error('Error al guardar venta:', error);
                showToast('Error al guardar la venta', 'danger');
            }
        });
        
        // Evento para cambiar cliente y verificar convenio
        const clienteIdSelect = document.getElementById('clienteId');
        if (clienteIdSelect) {
            clienteIdSelect.addEventListener('change', () => {
                const clienteId = clienteIdSelect.value;
                const esConvenio = document.getElementById('esConvenio');
                const infoConvenio = document.getElementById('infoConvenio');
                const empresaConvenio = document.getElementById('empresaConvenio');
                
                if (clienteId && esConvenio && infoConvenio && empresaConvenio) {
                    // Buscar cliente
                    const cliente = clientes.find(c => c.id === clienteId);
                    
                    if (cliente && cliente.convenio) {
                        // Cliente con convenio
                        esConvenio.checked = true;
                        
                        // Buscar empresa
                        const empresa = empresas.find(e => e.id === cliente.empresaId);
                        if (empresa) {
                            empresaConvenio.textContent = empresa.nombre;
                        } else {
                            empresaConvenio.textContent = 'Empresa no encontrada';
                        }
                        
                        infoConvenio.style.display = 'block';
                    } else {
                        // Cliente sin convenio
                        esConvenio.checked = false;
                        infoConvenio.style.display = 'none';
                    }
                } else {
                    // Venta de mostrador
                    if (esConvenio) esConvenio.checked = false;
                    if (infoConvenio) infoConvenio.style.display = 'none';

                    // Mostrar/ocultar campo de abono según tipo de venta
                    const abonoGroup = document.getElementById('abonoGroup');
                    if (abonoGroup) {
                        if (clienteId) {
                            // Venta a cliente registrado - permitir abonos
                            abonoGroup.style.display = 'block';
                        } else {
                            // Venta de mostrador - pago completo
                            abonoGroup.style.display = 'none';
                            document.getElementById('abono').value = document.getElementById('total').value;
                        }
                    }
                }
            });
        }
    }
}

// Función para actualizar el inventario después de una venta
async function actualizarInventario(productos) {
    try {
        for (const producto of productos) {
            if (producto.tipo === 'producto') {
                // Actualizar stock de producto
                const productoRef = doc(db, 'productos', producto.id);
                const productoDoc = await getDoc(productoRef);
                
                if (productoDoc.exists()) {
                    const productoData = productoDoc.data();
                    const nuevoStock = Math.max(0, (productoData.stock || 0) - producto.cantidad);
                    
                    await updateDoc(productoRef, {
                        stock: nuevoStock,
                        updatedAt: serverTimestamp()
                    });
                    
                    console.log(`Stock de producto ${producto.id} actualizado: ${productoData.stock} -> ${nuevoStock}`);
                }
            } else if (producto.tipo === 'armazon') {
                // Actualizar stock de armazón
                const armazonRef = doc(db, 'armazones', producto.id);
                const armazonDoc = await getDoc(armazonRef);
                
                if (armazonDoc.exists()) {
                    const armazonData = armazonDoc.data();
                    const nuevoStock = Math.max(0, (armazonData.stock || 0) - producto.cantidad);
                    
                    await updateDoc(armazonRef, {
                        stock: nuevoStock,
                        updatedAt: serverTimestamp()
                    });
                    
                    console.log(`Stock de armazón ${producto.id} actualizado: ${armazonData.stock} -> ${nuevoStock}`);
                }
            }
        }
        
        return true;
    } catch (error) {
        console.error("Error al actualizar inventario:", error);
        throw error;
    }
}

// Configurar eventos para las búsquedas
function setupSearchEvents() {
    // Búsqueda de ventas
    const searchVentaBtn = document.getElementById('searchVentaBtn');
    const searchVenta = document.getElementById('searchVenta');
    
    if (searchVentaBtn && searchVenta) {
        searchVentaBtn.addEventListener('click', () => {
            filtrosVentas.busqueda = searchVenta.value.trim();
            loadVentas();
        });
        
        searchVenta.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                filtrosVentas.busqueda = searchVenta.value.trim();
                loadVentas();
            }
        });
    }
}

// Función para cargar ventas
async function loadVentas() {
    const tableBody = document.getElementById('ventasTableBody');
    if (!tableBody) return;
    
    // Limpiar tabla
    tableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center">Cargando ventas...</td></tr>';
    
    try {
        // Construir la consulta base
        let ventasQuery = collection(db, 'ventas');
        let queryConstraints = [];
        
        // Aplicar filtros si existen
        if (filtrosVentas.cliente) {
            queryConstraints.push(where('clienteId', '==', filtrosVentas.cliente));
        }
        
        if (filtrosVentas.estado) {
            queryConstraints.push(where('estado', '==', filtrosVentas.estado));
        }
        
        // Ordenar por fecha descendente
        queryConstraints.push(orderBy('fecha', 'desc'));
        
        // Limitar resultados
        queryConstraints.push(limit(50));
        
        // Ejecutar la consulta
        const q = query(ventasQuery, ...queryConstraints);
        const ventasSnapshot = await getDocs(q);
        
        // Limpiar tabla
        tableBody.innerHTML = '';
        
        if (ventasSnapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center">No se encontraron ventas</td></tr>';
            return;
        }
        
        // Filtrar por búsqueda en memoria (para búsquedas más complejas)
        let ventas = [];
        ventasSnapshot.forEach(doc => {
            ventas.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        if (filtrosVentas.busqueda) {
            const busqueda = filtrosVentas.busqueda.toLowerCase();
            ventas = ventas.filter(venta => {
                // Buscar por ID
                if (venta.id.toLowerCase().includes(busqueda)) return true;
                
                // Buscar por cliente
                if (venta.clienteId) {
                    const cliente = clientes.find(c => c.id === venta.clienteId);
                    if (cliente && cliente.nombre.toLowerCase().includes(busqueda)) return true;
                }
                
                // Buscar por productos
                if (venta.productos) {
                    for (const producto of venta.productos) {
                        if (producto.nombreProducto.toLowerCase().includes(busqueda)) return true;
                    }
                }
                
                return false;
            });
        }
        
        if (ventas.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center">No se encontraron ventas con los filtros aplicados</td></tr>';
            return;
        }
        
        // Agregar ventas a la tabla
        for (const venta of ventas) {
            // Formatear fecha
            let fechaText = 'No disponible';
            if (venta.fecha) {
                const fecha = venta.fecha instanceof Timestamp 
                    ? venta.fecha.toDate() 
                    : new Date(venta.fecha);
                fechaText = fecha.toLocaleDateString();
            }
            
            // Obtener nombre del cliente
            let clienteText = 'Venta de mostrador';
            if (venta.clienteId) {
                const cliente = clientes.find(c => c.id === venta.clienteId);
                if (cliente) {
                    clienteText = cliente.nombre;
                } else {
                    clienteText = 'Cliente no encontrado';
                }
            }
            
            // Calcular saldo pendiente actual (puede haber cambiado por abonos posteriores)
            const saldoInfo = await calcularSaldoPendiente(venta.id);
            
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
            
            row.innerHTML = `
                <td class="py-3 px-4">${venta.id.substring(0, 8)}...</td>
                <td class="py-3 px-4">${fechaText}</td>
                <td class="py-3 px-4">${clienteText}</td>
                <td class="py-3 px-4">$${venta.total.toFixed(2)}</td>
                <td class="py-3 px-4">$${saldoInfo.totalAbonado.toFixed(2)}</td>
                <td class="py-3 px-4">$${saldoInfo.saldoPendiente.toFixed(2)}</td>
                <td class="py-3 px-4">
                    <span class="status-${venta.estado}">${
                        venta.estado === 'pendiente' ? 'Pendiente' :
                        venta.estado === 'parcial' ? 'Abonado' :
                        venta.estado === 'pagada' ? 'Pagado' :
                        venta.estado === 'cancelada' ? 'Cancelado' : 'Desconocido'
                    }</span>
                </td>
                <td class="py-3 px-4">
                    ${venta.convenio ? 
                        `<span class="badge badge-success">Sí</span>` : 
                        `<span class="badge badge-secondary">No</span>`
                    }
                </td>
                <td class="py-3 px-4">
                    <div class="flex space-x-2">
                        <button class="view-sale text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" data-id="${venta.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                        ${saldoInfo.saldoPendiente > 0 ? `
                            <button class="add-payment text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" data-id="${venta.id}" data-cliente="${venta.clienteId || ''}">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </button>
                        ` : ''}
                        ${venta.estado !== 'cancelada' ? `
                            <button class="cancel-sale text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" data-id="${venta.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        }
        
        // Configurar eventos para los botones de ver, agregar pago y cancelar
        setupSaleEvents();
        
    } catch (error) {
        console.error("Error al cargar ventas:", error);
        tableBody.innerHTML = '<tr><td colspan="9" class="py-4 text-center text-red-500">Error al cargar ventas</td></tr>';
        showToast('Error al cargar ventas', 'danger');
    }
}

// Configurar eventos para las ventas
function setupSaleEvents() {
    // Configurar botones para ver ventas
    const viewButtons = document.querySelectorAll('.view-sale');
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            const saleId = button.getAttribute('data-id');
            viewSale(saleId);
        });
    });
    
    // Configurar botones para agregar pagos
    const addPaymentButtons = document.querySelectorAll('.add-payment');
    addPaymentButtons.forEach(button => {
        button.addEventListener('click', () => {
            const saleId = button.getAttribute('data-id');
            const clienteId = button.getAttribute('data-cliente');
            addPayment(saleId, clienteId);
        });
    });
    
    // Configurar botones para cancelar ventas
    const cancelButtons = document.querySelectorAll('.cancel-sale');
    cancelButtons.forEach(button => {
        button.addEventListener('click', () => {
            const saleId = button.getAttribute('data-id');
            confirmCancelSale(saleId);
        });
    });
}

// Función para ver una venta
async function viewSale(saleId) {
    try {
        // Obtener datos de la venta
        const docRef = doc(db, 'ventas', saleId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const venta = docSnap.data();
            currentSale = {
                id: saleId,
                ...venta
            };
            
            // Crear modal de detalle de venta si no existe
            let saleDetailModal = document.getElementById('saleDetailModal');
            if (!saleDetailModal) {
                saleDetailModal = document.createElement('div');
                saleDetailModal.id = 'saleDetailModal';
                saleDetailModal.className = 'modal';
                
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
                                                <th class="py-2 px-4 text-left bg-primary text-white">Cantidad</th>
                                                <th class="py-2 px-4 text-left bg-primary text-white">Precio</th>
                                                <th class="py-2 px-4 text-left bg-primary text-white rounded-tr-lg">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody id="detailProductsBody" class="divide-y divide-mediumGray dark:divide-gray-700">
                                            <!-- Products will be loaded dynamically -->
                                        </tbody>
                                        <tfoot>
                                            <tr class="font-bold">
                                                <td class="py-2 px-4" colspan="3">Total</td>
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
                            <div class="flex justify-end space-x-4 pt-4 border-t border-mediumGray dark:border-gray-700">
                                <button id="detailAddPaymentBtn" class="btn-action bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded transition-colors flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
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
                `;
                
                document.body.appendChild(saleDetailModal);
                
                // Configurar eventos para el modal
                const closeBtn = saleDetailModal.querySelector('.close');
                const detailCloseBtn = document.getElementById('detailCloseBtn');
                const detailPrintBtn = document.getElementById('detailPrintBtn');
                const detailAddPaymentBtn = document.getElementById('detailAddPaymentBtn');
                
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        saleDetailModal.style.display = 'none';
                    });
                }
                
                if (detailCloseBtn) {
                    detailCloseBtn.addEventListener('click', () => {
                        saleDetailModal.style.display = 'none';
                    });
                }
                
                if (detailPrintBtn) {
                    detailPrintBtn.addEventListener('click', () => {
                        window.print();
                    });
                }
                
                if (detailAddPaymentBtn) {
                    detailAddPaymentBtn.addEventListener('click', () => {
                        saleDetailModal.style.display = 'none';
                        addPayment(currentSale.id, currentSale.clienteId);
                    });
                }
                
                // Cerrar modal al hacer clic fuera del contenido
                saleDetailModal.addEventListener('click', (event) => {
                    if (event.target === saleDetailModal) {
                        saleDetailModal.style.display = 'none';
                    }
                });
            }
            
            // Mostrar modal
            saleDetailModal.style.display = 'block';
            
            // Llenar información general
            document.getElementById('detailSaleId').textContent = saleId;
            
            // Formatear fecha
            let fechaText = 'No disponible';
            if (venta.fecha) {
                const fecha = venta.fecha instanceof Timestamp 
                    ? venta.fecha.toDate() 
                    : new Date(venta.fecha);
                fechaText = fecha.toLocaleDateString();
            }
            document.getElementById('detailSaleDate').textContent = fechaText;
            
            // Obtener nombre del cliente
            let clienteText = 'Venta de mostrador';
            if (venta.clienteId) {
                const cliente = clientes.find(c => c.id === venta.clienteId);
                if (cliente) {
                    clienteText = cliente.nombre;
                } else {
                    clienteText = 'Cliente no encontrado';
                }
            }
            document.getElementById('detailSaleClient').textContent = clienteText;
            
            // Estado
            const estadoText = venta.estado === 'pendiente' ? 'Pendiente' :
                              venta.estado === 'parcial' ? 'Abonado' :
                              venta.estado === 'pagada' ? 'Pagado' :
                              venta.estado === 'cancelada' ? 'Cancelado' : 'Desconocido';
            
            const estadoElement = document.getElementById('detailSaleStatus');
            estadoElement.textContent = estadoText;
            estadoElement.className = `status-${venta.estado}`;
            
            // Convenio
            const convenioContainer = document.getElementById('detailConvenioContainer');
            const empresaContainer = document.getElementById('detailEmpresaContainer');
            
            if (venta.convenio) {
                document.getElementById('detailSaleConvenio').textContent = 'Sí';
                convenioContainer.style.display = 'block';
                
                // Empresa
                if (venta.empresaId) {
                    const empresa = empresas.find(e => e.id === venta.empresaId);
                    document.getElementById('detailSaleEmpresa').textContent = empresa ? empresa.nombre : 'Empresa no encontrada';
                    empresaContainer.style.display = 'block';
                } else {
                    empresaContainer.style.display = 'none';
                }
            } else {
                convenioContainer.style.display = 'none';
                empresaContainer.style.display = 'none';
            }
            
            // Productos
            const productsBody = document.getElementById('detailProductsBody');
            productsBody.innerHTML = '';
            
            if (venta.productos && venta.productos.length > 0) {
                venta.productos.forEach(producto => {
                    const row = document.createElement('tr');
                    row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
                    
                    row.innerHTML = `
                        <td class="py-2 px-4">${producto.nombreProducto}</td>
                        <td class="py-2 px-4">${producto.cantidad}</td>
                        <td class="py-2 px-4">$${producto.precio.toFixed(2)}</td>
                        <td class="py-2 px-4">$${producto.subtotal.toFixed(2)}</td>
                    `;
                    
                    productsBody.appendChild(row);
                });
            } else {
                productsBody.innerHTML = '<tr><td colspan="4" class="py-2 px-4 text-center">No hay productos registrados</td></tr>';
            }
            
            // Total
            document.getElementById('detailSaleTotal').textContent = `$${venta.total.toFixed(2)}`;
            
            // Pagos y abonos
            const paymentsBody = document.getElementById('detailPaymentsBody');
            paymentsBody.innerHTML = '<tr><td colspan="4" class="py-2 px-4 text-center">Cargando pagos...</td></tr>';
            
            // Obtener abonos
            const abonosQuery = query(
                collection(db, 'abonos'),
                where('ventaId', '==', saleId),
                orderBy('fecha', 'asc')
            );
            
            const abonosSnapshot = await getDocs(abonosQuery);
            
            // Obtener pagos
            const pagosQuery = query(
                collection(db, 'pagos'),
                where('ventaId', '==', saleId),
                orderBy('fecha', 'asc')
            );
            
            const pagosSnapshot = await getDocs(pagosQuery);
            
            // Calcular total abonado y pagado
            let totalAbonado = 0;
            let totalPagado = 0;
            
            const pagos = [];
            
            // Agregar abono inicial si existe
            if (venta.abono > 0) {
                pagos.push({
                    tipo: 'abono',
                    fecha: venta.fecha,
                    descripcion: 'Abono inicial',
                    monto: venta.abono
                });
                
                totalAbonado += venta.abono;
            }
            
            // Agregar abonos adicionales
            abonosSnapshot.forEach(doc => {
                const abono = doc.data();
                
                // Evitar duplicar el abono inicial
                if (abono.descripcion !== 'Abono inicial') {
                    pagos.push({
                        tipo: 'abono',
                        fecha: abono.fecha,
                        descripcion: abono.descripcion || 'Abono',
                        monto: abono.monto
                    });
                    
                    totalAbonado += abono.monto;
                }
            });
            
            // Agregar pagos
            pagosSnapshot.forEach(doc => {
                const pago = doc.data();
                
                pagos.push({
                    tipo: 'pago',
                    fecha: pago.fecha,
                    descripcion: pago.descripcion || 'Pago',
                    monto: pago.monto
                });
                
                totalPagado += pago.monto;
            });
            
            // Ordenar pagos por fecha
            pagos.sort((a, b) => {
                const fechaA = a.fecha instanceof Timestamp ? a.fecha.toDate() : new Date(a.fecha);
                const fechaB = b.fecha instanceof Timestamp ? b.fecha.toDate() : new Date(b.fecha);
                return fechaA - fechaB;
            });
            
            // Limpiar tabla
            paymentsBody.innerHTML = '';
            
            if (pagos.length > 0) {
                pagos.forEach(pago => {
                    // Formatear fecha
                    let fechaText = 'No disponible';
                    if (pago.fecha) {
                        const fecha = pago.fecha instanceof Timestamp 
                            ? pago.fecha.toDate() 
                            : new Date(pago.fecha);
                        fechaText = fecha.toLocaleDateString();
                    }
                    
                    const row = document.createElement('tr');
                    row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
                    
                    row.innerHTML = `
                        <td class="py-2 px-4">${fechaText}</td>
                        <td class="py-2 px-4">${pago.tipo === 'abono' ? 'Abono' : 'Pago'}</td>
                        <td class="py-2 px-4">${pago.descripcion}</td>
                        <td class="py-2 px-4 ${pago.tipo === 'abono' ? 'text-green-500' : 'text-blue-500'}">$${pago.monto.toFixed(2)}</td>
                    `;
                    
                    paymentsBody.appendChild(row);
                });
            } else {
                paymentsBody.innerHTML = '<tr><td colspan="4" class="py-2 px-4 text-center">No hay pagos registrados</td></tr>';
            }
            
            // Saldo pendiente
            const saldoPendiente = venta.total - totalAbonado - totalPagado;
            const saldoElement = document.getElementById('detailSalePending');
            saldoElement.textContent = `$${saldoPendiente.toFixed(2)}`;
            saldoElement.className = saldoPendiente > 0 ? 'text-red-500' : 'text-green-500';
            
            // Observaciones
            const observacionesContainer = document.getElementById('detailObservacionesContainer');
            const observacionesElement = document.getElementById('detailSaleObservaciones');
            
            if (venta.observaciones) {
                observacionesElement.textContent = venta.observaciones;
                observacionesContainer.style.display = 'block';
            } else {
                observacionesContainer.style.display = 'none';
            }
            
            // Mostrar/ocultar botón de agregar pago
            const detailAddPaymentBtn = document.getElementById('detailAddPaymentBtn');
            if (detailAddPaymentBtn) {
                if (saldoPendiente > 0 && venta.estado !== 'cancelada') {
                    detailAddPaymentBtn.style.display = 'flex';
                } else {
                    detailAddPaymentBtn.style.display = 'none';
                }
            }
        } else {
            console.error("No se encontró la venta");
            showToast('No se encontró la venta', 'danger');
        }
    } catch (error) {
        console.error("Error al obtener venta:", error);
        showToast('Error al obtener la venta', 'danger');
    }
}

// Función para agregar un pago
async function addPayment(ventaId, clienteId) {
    try {
        // Obtener datos de la venta
        const docRef = doc(db, 'ventas', ventaId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
            showToast('No se encontró la venta', 'danger');
            return;
        }
        
        const venta = docSnap.data();

        // Verificar si es una venta de mostrador
        if (!venta.clienteId) {
            showToast('No se pueden realizar abonos en ventas de mostrador', 'warning');
            return;
        }
        
        // Calcular saldo pendiente
        const saldoInfo = await calcularSaldoPendiente(ventaId);
        
        // Crear modal de pago si no existe
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
            `;
            
            document.body.appendChild(paymentModal);
            
            // Configurar eventos para el modal
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
                        const ventaId = document.getElementById('paymentVentaId').value;
                        const clienteId = document.getElementById('paymentClienteId').value;
                        const tipo = document.getElementById('paymentTipo').value;
                        const monto = parseFloat(document.getElementById('paymentMonto').value) || 0;
                        const metodo = document.getElementById('paymentMetodo').value;
                        const fecha = document.getElementById('paymentFecha').value;
                        const descripcion = document.getElementById('paymentDescripcion').value;
                        
                        // Validar monto
                        if (monto <= 0) {
                            showToast('El monto debe ser mayor a cero', 'warning');
                            return;
                        }
                        
                        // Validar que el monto no sea mayor al saldo pendiente
                        const saldoInfo = await calcularSaldoPendiente(ventaId);
                        if (monto > saldoInfo.saldoPendiente) {
                            showToast('El monto no puede ser mayor al saldo pendiente', 'warning');
                            return;
                        }
                        
                        // Registrar pago o abono
                        if (tipo === 'abono') {
                            await registrarAbono(ventaId, clienteId, monto, descripcion || 'Abono', metodo, fecha ? new Date(fecha) : new Date());
                        } else {
                            await registrarPago(ventaId, clienteId, monto, descripcion || 'Pago', metodo, fecha ? new Date(fecha) : new Date());
                        }
                        
                        // Actualizar estado de la venta
                        const nuevoSaldoInfo = await calcularSaldoPendiente(ventaId);
                        let nuevoEstado = 'pendiente';
                        
                        if (nuevoSaldoInfo.saldoPendiente <= 0) {
                            nuevoEstado = 'pagada';
                        } else if (nuevoSaldoInfo.totalAbonado > 0) {
                            nuevoEstado = 'parcial';
                        }
                        
                        await updateDoc(doc(db, 'ventas', ventaId), {
                            estado: nuevoEstado,
                            updatedAt: serverTimestamp()
                        });
                        
                        showToast(`${tipo === 'abono' ? 'Abono' : 'Pago'} registrado correctamente`, 'success');
                        
                        // Cerrar modal
                        paymentModal.style.display = 'none';
                        
                        // Recargar ventas
                        await loadVentas();
                        
                    } catch (error) {
                        console.error(`Error al registrar ${tipo === 'abono' ? 'abono' : 'pago'}:`, error);
                        showToast(`Error al registrar ${tipo === 'abono' ? 'abono' : 'pago'}`, 'danger');
                    }
                });
            }
            
            // Configurar evento para cambiar tipo de pago
            const paymentTipo = document.getElementById('paymentTipo');
            const paymentMonto = document.getElementById('paymentMonto');
            
            if (paymentTipo && paymentMonto) {
                paymentTipo.addEventListener('change', async () => {
                    const tipo = paymentTipo.value;
                    const ventaId = document.getElementById('paymentVentaId').value;
                    
                    if (tipo === 'pago') {
                        // Establecer monto igual al saldo pendiente
                        const saldoInfo = await calcularSaldoPendiente(ventaId);
                        paymentMonto.value = saldoInfo.saldoPendiente.toFixed(2);
                    } else {
                        // Limpiar monto
                        paymentMonto.value = '';
                    }
                });
            }
        }
        
        // Mostrar modal
        paymentModal.style.display = 'block';
        
        // Llenar datos
        document.getElementById('paymentVentaId').value = ventaId;
        document.getElementById('paymentClienteId').value = clienteId || '';
        document.getElementById('paymentSaldoPendiente').textContent = `$${saldoInfo.saldoPendiente.toFixed(2)}`;
        
        // Establecer fecha actual
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        document.getElementById('paymentFecha').value = `${year}-${month}-${day}`;
        
        // Limpiar otros campos
        document.getElementById('paymentTipo').value = 'abono';
        document.getElementById('paymentMonto').value = '';
        document.getElementById('paymentMetodo').value = 'efectivo';
        document.getElementById('paymentDescripcion').value = '';
        
    } catch (error) {
        console.error("Error al preparar formulario de pago:", error);
        showToast('Error al preparar formulario de pago', 'danger');
    }
}

// Función para confirmar cancelación de venta
function confirmCancelSale(saleId) {
    if (confirm('¿Estás seguro de que deseas cancelar esta venta? Esta acción no se puede deshacer.')) {
        cancelSale(saleId);
    }
}

// Función para cancelar una venta
async function cancelSale(saleId) {
    try {
        await updateDoc(doc(db, 'ventas', saleId), {
            estado: 'cancelada',
            updatedAt: serverTimestamp()
        });
        
        showToast('Venta cancelada correctamente', 'success');
        
        // Recargar ventas
        await loadVentas();
    } catch (error) {
        console.error("Error al cancelar venta:", error);
        showToast('Error al cancelar la venta', 'danger');
    }
}

// Función para registrar un abono
async function registrarAbono(ventaId, clienteId, monto, descripcion = 'Abono', metodoPago = 'efectivo', fecha = new Date()) {
    try {
        // Crear objeto de abono
        const abonoData = {
            ventaId,
            clienteId: clienteId || null,
            monto,
            descripcion,
            metodoPago,
            fecha: fecha,
            createdAt: serverTimestamp()
        };
        
        // Agregar abono
        const abonoRef = await addDoc(collection(db, 'abonos'), abonoData);
        
        // Si hay cliente, actualizar última visita
        if (clienteId) {
            await updateDoc(doc(db, 'clientes', clienteId), {
                ultimaVisita: serverTimestamp()
            });
        }
        
        return abonoRef.id;
    } catch (error) {
        console.error("Error al registrar abono:", error);
        throw error;
    }
}

// Función para registrar un pago
async function registrarPago(ventaId, clienteId, monto, descripcion = 'Pago', metodoPago = 'efectivo', fecha = new Date()) {
    try {
        // Crear objeto de pago
        const pagoData = {
            ventaId,
            clienteId: clienteId || null,
            monto,
            descripcion,
            metodoPago,
            fecha: fecha,
            createdAt: serverTimestamp()
        };
        
        // Agregar pago
        const pagoRef = await addDoc(collection(db, 'pagos'), pagoData);
        
        // Si hay cliente, actualizar última visita
        if (clienteId) {
            await updateDoc(doc(db, 'clientes', clienteId), {
                ultimaVisita: serverTimestamp()
            });
        }
        
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
        let totalAbonado = venta.abono || 0; // Incluir abono inicial
        
        abonosSnapshot.forEach(doc => {
            const abono = doc.data();
            // Evitar contar el abono inicial dos veces
            if (abono.descripcion !== 'Abono inicial') {
                totalAbonado += abono.monto;
            }
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