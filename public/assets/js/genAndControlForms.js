// Función para generar código automático basado en categoría
async function generarCodigoProducto(categoriaId) {
    // Obtener información de la categoría
    try {
        const response = await fetch(`http://localhost:3000/api/categorias/${categoriaId}`);
        const categoria = await response.json();

        // Obtener prefijo según la categoría
        let prefijo = '';
        switch (categoria.nombre.toLowerCase()) {
            case 'armazones':
                prefijo = 'ARM';
                break;
            case 'lentes de contacto':
                prefijo = 'CONT';
                break;
            case 'solares':
                prefijo = 'SOL';
                break;
            case 'accesorios':
                prefijo = 'ACC';
                break;
            case 'limpieza':
                prefijo = 'LIMP';
                break;
            default:
                // Usar las primeras 4 letras de la categoría
                prefijo = categoria.nombre.substring(0, 4).toUpperCase();
        }

        // Buscar el último código con ese prefijo
        const ultimoCodigoResponse = await fetch(`http://localhost:3000/api/productos/ultimo-codigo?prefijo=${prefijo}`);
        const data = await ultimoCodigoResponse.json();

        let secuencia = 1;
        if (data && data.ultimoCodigo) {
            // Extraer la secuencia numérica del último código
            const match = data.ultimoCodigo.match(/\d+$/);
            if (match) {
                secuencia = parseInt(match[0]) + 1;
            }
        }

        // Formatear la secuencia con ceros a la izquierda (3 dígitos)
        const secuenciaFormateada = secuencia.toString().padStart(3, '0');

        return `${prefijo}${secuenciaFormateada}`;
    } catch (error) {
        console.error('Error al generar código:', error);

        // Generar un código alternativo basado en fecha
        const hoy = new Date();
        const prefijo = 'PROD';
        const fechaStr = (hoy.getMonth() + 1).toString().padStart(2, '0') +
            hoy.getDate().toString().padStart(2, '0');
        const secuencia = Math.floor(Math.random() * 999).toString().padStart(3, '0');

        return `${prefijo}${fechaStr}${secuencia}`;
    }
}

// Sistema de notificaciones para alertas de stock
const notificaciones = {
    items: [],

    // Agregar una nueva notificación
    agregar: function (tipo, mensaje, itemId, itemTipo, itemNombre, accion) {
        const notificacion = {
            id: Date.now(), // ID único basado en timestamp
            tipo: tipo, // 'warning', 'danger', 'info'
            mensaje: mensaje,
            itemId: itemId,
            itemTipo: itemTipo, // 'producto' o 'armazon'
            itemNombre: itemNombre,
            accion: accion, // función a ejecutar si se hace clic en la notificación
            fecha: new Date(),
            leida: false
        };

        this.items.push(notificacion);
        this.actualizarContador();
        this.actualizarLista();

        return notificacion.id;
    },

    // Marcar una notificación como leída
    marcarLeida: function (id) {
        const index = this.items.findIndex(item => item.id === id);
        if (index !== -1) {
            this.items[index].leida = true;
            this.actualizarContador();
            this.actualizarLista();
        }
    },

    // Eliminar una notificación
    eliminar: function (id) {
        this.items = this.items.filter(item => item.id !== id);
        this.actualizarContador();
        this.actualizarLista();
    },

    // Limpiar todas las notificaciones
    limpiarTodas: function () {
        this.items = [];
        this.actualizarContador();
        this.actualizarLista();
    },

    // Actualizar el contador de notificaciones
    actualizarContador: function () {
        const noLeidas = this.items.filter(item => !item.leida).length;
        const contador = document.getElementById('notificationCount');

        if (contador) {
            if (noLeidas > 0) {
                contador.textContent = noLeidas > 99 ? '99+' : noLeidas;
                contador.classList.remove('hidden');
            } else {
                contador.classList.add('hidden');
            }
        }
    },

    // Actualizar la lista de notificaciones en el dropdown
    actualizarLista: function () {
        const lista = document.getElementById('notificationList');
        if (!lista) return;

        if (this.items.length === 0) {
            lista.innerHTML = `
                        <div class="notification-empty">
                            No hay notificaciones
                        </div>
                    `;
            return;
        }

        // Ordenar por fecha (más recientes primero)
        const ordenadas = [...this.items].sort((a, b) => b.fecha - a.fecha);

        lista.innerHTML = '';

        ordenadas.forEach(notif => {
            const item = document.createElement('div');
            item.className = `notification-item ${notif.tipo} ${notif.leida ? 'opacity-60' : ''}`;

            // Formatear la fecha
            const fecha = new Date(notif.fecha);
            const fechaFormateada = `${fecha.toLocaleDateString()} ${fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

            item.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="font-medium">${notif.itemNombre}</p>
                                <p class="text-sm">${notif.mensaje}</p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${fechaFormateada}</p>
                            </div>
                            <button class="delete-notification text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" data-id="${notif.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    `;

            // Agregar evento para marcar como leída al hacer clic
            item.addEventListener('click', (e) => {
                // No ejecutar si se hizo clic en el botón de eliminar
                if (e.target.closest('.delete-notification')) return;

                this.marcarLeida(notif.id);

                // Ejecutar acción asociada si existe
                if (typeof notif.accion === 'function') {
                    notif.accion();
                }
            });

            lista.appendChild(item);
        });

        // Agregar eventos para eliminar notificaciones
        document.querySelectorAll('.delete-notification').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.getAttribute('data-id'));
                this.eliminar(id);
            });
        });
    }
};

// Función para mostrar el modal de producto agotado
function showOutOfStockModal(nombreProducto, stock, tipo, id) {
    const outOfStockModal = document.getElementById("outOfStockModal");
    const outOfStockTitle = document.getElementById("outOfStockTitle");
    const outOfStockMessage = document.getElementById("outOfStockMessage");
    const keepProduct = document.getElementById("keepProduct");
    const removeProduct = document.getElementById("removeProduct");

    if (outOfStockModal && outOfStockTitle && outOfStockMessage && keepProduct && removeProduct) {
        outOfStockTitle.textContent = `¡Stock Agotado!`;
        outOfStockMessage.textContent = `El ${tipo} ${nombreProducto} tiene un stock de ${stock}. ¿Deseas eliminarlo del inventario o conservarlo para un posible reabastecimiento?`;

        outOfStockModal.style.display = "block";

        // Configurar evento para el botón de mantener
        const handleKeep = () => {
            outOfStockModal.style.display = "none";
            showToast(`Se conservará el ${tipo} ${nombreProducto} en el inventario`, "info");

            // Eliminar la notificación relacionada
            const notificacionesRelacionadas = notificaciones.items.filter(
                n => n.itemId === id && n.itemTipo === tipo
            );
            notificacionesRelacionadas.forEach(n => notificaciones.eliminar(n.id));

            keepProduct.removeEventListener("click", handleKeep);
        };

        // Configurar evento para el botón de eliminar
        const handleRemove = async () => {
            try {
                // Importar las funciones necesarias de Firebase
                const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                const { db } = await import("./firebase-config.js");
                // Importar las funciones necesarias para recargar los productos y armazones
                const { loadProductos } = await import("./productos.js");
                const { loadArmazones } = await import("./armazones.js");

                if (tipo === "producto") {
                    await deleteDoc(doc(db, "productos", id));
                    showToast("Producto eliminado correctamente", "success");
                    await loadProductos();
                } else if (tipo === "armazon") {
                    await deleteDoc(doc(db, "armazones", id));
                    showToast("Armazón eliminado correctamente", "success");
                    await loadArmazones();
                }

                outOfStockModal.style.display = "none";

                // Eliminar la notificación relacionada
                const notificacionesRelacionadas = notificaciones.items.filter(
                    n => n.itemId === id && n.itemTipo === tipo
                );
                notificacionesRelacionadas.forEach(n => notificaciones.eliminar(n.id));

                removeProduct.removeEventListener("click", handleRemove);
            } catch (error) {
                console.error(`Error al eliminar ${tipo}:`, error);
                showToast(`Error al eliminar el ${tipo}`, "danger");
            }
        };

        // Remover eventos anteriores para evitar duplicados
        keepProduct.removeEventListener("click", handleKeep);
        removeProduct.removeEventListener("click", handleRemove);

        // Agregar nuevos eventos
        keepProduct.addEventListener("click", handleKeep);
        removeProduct.addEventListener("click", handleRemove);
    }
}

// Función para mostrar el modal de categorías
function mostrarModalCategorias() {
    const categoriasModal = document.getElementById("categoriasModal");
    if (categoriasModal) {
        categoriasModal.style.display = "block";
        
        // Cargar las categorías en el modal
        loadCategoriasToModal();
    } else {
        console.error("No se encontró el modal de categorías");
        showToast("Error al mostrar el modal de categorías", "danger");
    }
}

// Función para cargar las categorías en el modal
async function loadCategoriasToModal() {
    const categoriasTableBody = document.getElementById("categoriasTableBody");
    if (!categoriasTableBody) return;

    try {
        categoriasTableBody.innerHTML = '<tr><td colspan="3" class="py-4 text-center">Cargando categorías...</td></tr>';

        // Importar las funciones necesarias de Firebase
        const { collection, getDocs, doc, getDoc, deleteDoc, addDoc, updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const { db } = await import("./firebase-config.js");

        const categoriasSnapshot = await getDocs(collection(db, "categorias"));

        if (categoriasSnapshot.empty) {
            categoriasTableBody.innerHTML = '<tr><td colspan="3" class="py-4 text-center">No hay categorías registradas</td></tr>';
            return;
        }

        categoriasTableBody.innerHTML = "";

        categoriasSnapshot.forEach((doc) => {
            const categoria = doc.data();
            const row = document.createElement("tr");
            row.className = "hover:bg-gray-50 dark:hover:bg-gray-700";

            row.innerHTML = `
                <td class="py-3 px-4">${doc.id.substring(0, 8)}...</td>
                <td class="py-3 px-4">${categoria.nombre || ""}</td>
                <td class="py-3 px-4 text-right">
                    <div class="flex justify-end space-x-2">
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
            `;

            categoriasTableBody.appendChild(row);
        });

        // Configurar eventos para los botones de editar y eliminar
        setupCategoriaEvents();
    } catch (error) {
        console.error("Error al cargar categorías en el modal:", error);
        categoriasTableBody.innerHTML = '<tr><td colspan="3" class="py-4 text-center text-red-500">Error al cargar categorías</td></tr>';
        showToast("Error al cargar categorías", "danger");
    }
}

// Función para configurar eventos para las categorías
function setupCategoriaEvents() {
    // Configurar botones para editar categorías
    const editButtons = document.querySelectorAll(".edit-categoria");
    editButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const categoriaId = button.getAttribute("data-id");
            editCategoria(categoriaId);
        });
    });

    // Configurar botones para eliminar categorías
    const deleteButtons = document.querySelectorAll(".delete-categoria");
    deleteButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const categoriaId = button.getAttribute("data-id");
            confirmDeleteCategoria(categoriaId);
        });
    });

    // Configurar botón para agregar categoría
    const addCategoriaBtn = document.getElementById("addCategoriaBtn");
    if (addCategoriaBtn) {
        addCategoriaBtn.addEventListener("click", async () => {
            const nuevaCategoria = document.getElementById("nuevaCategoria").value.trim();
            if (!nuevaCategoria) {
                showToast("Ingrese un nombre para la categoría", "warning");
                return;
            }

            try {
                // Importar las funciones necesarias de Firebase
                const { collection, addDoc, serverTimestamp, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                const { db } = await import("./firebase-config.js");

                // Verificar si ya existe una categoría con ese nombre
                const categoriaQuery = query(collection(db, "categorias"), where("nombre", "==", nuevaCategoria));
                const categoriaSnapshot = await getDocs(categoriaQuery);

                if (!categoriaSnapshot.empty) {
                    showToast("Ya existe una categoría con ese nombre", "warning");
                    return;
                }

                // Agregar nueva categoría
                await addDoc(collection(db, "categorias"), {
                    nombre: nuevaCategoria,
                    createdAt: serverTimestamp(),
                });

                showToast("Categoría agregada correctamente", "success");
                document.getElementById("nuevaCategoria").value = "";

                // Recargar categorías
                loadCategoriasToModal();
            } catch (error) {
                console.error("Error al agregar categoría:", error);
                showToast("Error al agregar categoría", "danger");
            }
        });
    }
}

// Función para editar una categoría
async function editCategoria(categoriaId) {
    try {
        // Importar las funciones necesarias de Firebase
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const { db } = await import("./firebase-config.js");

        const docRef = doc(db, "categorias", categoriaId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const categoria = docSnap.data();

            // Mostrar modal de edición
            const modal = document.getElementById("editCategoriaModal");
            if (modal) {
                modal.style.display = "block";

                // Llenar formulario con datos de la categoría
                document.getElementById("editCategoriaId").value = categoriaId;
                document.getElementById("editCategoriaNombre").value = categoria.nombre || "";

                // Configurar evento para el formulario de edición
                const editCategoriaForm = document.getElementById("editCategoriaForm");
                if (editCategoriaForm) {
                    editCategoriaForm.onsubmit = async (e) => {
                        e.preventDefault();
                        
                        const nuevoNombre = document.getElementById("editCategoriaNombre").value.trim();
                        if (!nuevoNombre) {
                            showToast("Ingrese un nombre para la categoría", "warning");
                            return;
                        }

                        try {
                            // Importar las funciones necesarias de Firebase
                            const { updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                            
                            await updateDoc(docRef, {
                                nombre: nuevoNombre,
                                updatedAt: serverTimestamp(),
                            });

                            showToast("Categoría actualizada correctamente", "success");
                            modal.style.display = "none";

                            // Recargar categorías
                            loadCategoriasToModal();
                        } catch (error) {
                            console.error("Error al actualizar categoría:", error);
                            showToast("Error al actualizar categoría", "danger");
                        }
                    };
                }
            }
        } else {
            console.error("No se encontró la categoría");
            showToast("No se encontró la categoría", "danger");
        }
    } catch (error) {
        console.error("Error al obtener categoría:", error);
        showToast("Error al obtener la categoría", "danger");
    }
}

// Función para confirmar eliminación de una categoría
function confirmDeleteCategoria(categoriaId) {
    const confirmModal = document.getElementById("confirmModal");
    const confirmTitle = document.getElementById("confirmTitle");
    const confirmMessage = document.getElementById("confirmMessage");
    const confirmOk = document.getElementById("confirmOk");
    const confirmCancel = document.getElementById("confirmCancel");

    if (confirmModal && confirmTitle && confirmMessage && confirmOk) {
        confirmTitle.textContent = "Eliminar Categoría";
        confirmMessage.textContent = "¿Estás seguro de que deseas eliminar esta categoría? Esta acción no se puede deshacer y podría afectar a los productos asociados.";

        confirmModal.style.display = "block";

        // Configurar evento para el botón de confirmar
        const handleConfirm = async () => {
            try {
                // Importar las funciones necesarias de Firebase
                const { doc, deleteDoc, collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                const { db } = await import("./firebase-config.js");

                // Verificar si hay productos asociados a esta categoría
                const productosQuery = query(collection(db, "productos"), where("categoriaId", "==", categoriaId));
                const productosSnapshot = await getDocs(productosQuery);

                if (!productosSnapshot.empty) {
                    showToast("No se puede eliminar la categoría porque hay productos asociados", "warning");
                    confirmModal.style.display = "none";
                    return;
                }

                await deleteDoc(doc(db, "categorias", categoriaId));
                showToast("Categoría eliminada correctamente", "success");
                confirmModal.style.display = "none";

                // Recargar categorías
                loadCategoriasToModal();
            } catch (error) {
                console.error("Error al eliminar categoría:", error);
                showToast("Error al eliminar la categoría", "danger");
                confirmModal.style.display = "none";
            }

            // Remover el evento para evitar duplicados
            confirmOk.removeEventListener("click", handleConfirm);
        };

        // Remover eventos anteriores y agregar el nuevo
        confirmOk.removeEventListener("click", handleConfirm);
        confirmOk.addEventListener("click", handleConfirm);

        // Configurar evento para el botón de cancelar
        confirmCancel.addEventListener("click", () => {
            confirmModal.style.display = "none";
        });
    }
}

// Función para mostrar el modal de proveedores
function mostrarModalProveedores() {
    const proveedoresModal = document.getElementById("proveedoresModal");
    if (proveedoresModal) {
        proveedoresModal.style.display = "block";
        
        // Cargar los proveedores en el modal
        loadProveedoresToModal();
    } else {
        console.error("No se encontró el modal de proveedores");
        showToast("Error al mostrar el modal de proveedores", "danger");
    }
}

// Función para cargar los proveedores en el modal
async function loadProveedoresToModal() {
    const proveedoresTableBody = document.getElementById("proveedoresTableBody");
    if (!proveedoresTableBody) return;

    try {
        proveedoresTableBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center">Cargando proveedores...</td></tr>';

        // Importar las funciones necesarias de Firebase
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const { db } = await import("./firebase-config.js");

        const proveedoresSnapshot = await getDocs(collection(db, "proveedores"));

        if (proveedoresSnapshot.empty) {
            proveedoresTableBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center">No hay proveedores registrados</td></tr>';
            return;
        }

        proveedoresTableBody.innerHTML = "";

        proveedoresSnapshot.forEach((doc) => {
            const proveedor = doc.data();
            const row = document.createElement("tr");
            row.className = "hover:bg-gray-50 dark:hover:bg-gray-700";

            row.innerHTML = `
                <td class="py-3 px-4">${doc.id.substring(0, 8)}...</td>
                <td class="py-3 px-4">${proveedor.nombre || ""}</td>
                <td class="py-3 px-4">${proveedor.contacto || ""}</td>
                <td class="py-3 px-4 text-right">
                    <div class="flex justify-end space-x-2">
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
            `;

            proveedoresTableBody.appendChild(row);
        });

        // Configurar eventos para los botones de editar y eliminar
        setupProveedorEvents();
    } catch (error) {
        console.error("Error al cargar proveedores en el modal:", error);
        proveedoresTableBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-red-500">Error al cargar proveedores</td></tr>';
        showToast("Error al cargar proveedores", "danger");
    }
}

// Función para configurar eventos para los proveedores
function setupProveedorEvents() {
    // Configurar botones para editar proveedores
    const editButtons = document.querySelectorAll(".edit-proveedor");
    editButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const proveedorId = button.getAttribute("data-id");
            editProveedor(proveedorId);
        });
    });

    // Configurar botones para eliminar proveedores
    const deleteButtons = document.querySelectorAll(".delete-proveedor");
    deleteButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const proveedorId = button.getAttribute("data-id");
            confirmDeleteProveedor(proveedorId);
        });
    });

    // Configurar botón para agregar proveedor
    const addProveedorBtn = document.getElementById("addProveedorBtn");
    if (addProveedorBtn) {
        addProveedorBtn.addEventListener("click", async () => {
            const nombreProveedor = document.getElementById("nuevoProveedorNombre").value.trim();
            const contactoProveedor = document.getElementById("nuevoProveedorContacto").value.trim();
            const telefonoProveedor = document.getElementById("nuevoProveedorTelefono").value.trim();
            const emailProveedor = document.getElementById("nuevoProveedorEmail").value.trim();

            if (!nombreProveedor) {
                showToast("Ingrese un nombre para el proveedor", "warning");
                return;
            }

            try {
                // Importar las funciones necesarias de Firebase
                const { collection, addDoc, serverTimestamp, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                const { db } = await import("./firebase-config.js");

                // Verificar si ya existe un proveedor con ese nombre
                const proveedorQuery = query(collection(db, "proveedores"), where("nombre", "==", nombreProveedor));
                const proveedorSnapshot = await getDocs(proveedorQuery);

                if (!proveedorSnapshot.empty) {
                    showToast("Ya existe un proveedor con ese nombre", "warning");
                    return;
                }

                // Agregar nuevo proveedor
                await addDoc(collection(db, "proveedores"), {
                    nombre: nombreProveedor,
                    contacto: contactoProveedor,
                    telefono: telefonoProveedor,
                    email: emailProveedor,
                    createdAt: serverTimestamp(),
                });

                showToast("Proveedor agregado correctamente", "success");
                document.getElementById("nuevoProveedorNombre").value = "";
                document.getElementById("nuevoProveedorContacto").value = "";
                document.getElementById("nuevoProveedorTelefono").value = "";
                document.getElementById("nuevoProveedorEmail").value = "";

                // Recargar proveedores
                loadProveedoresToModal();
            } catch (error) {
                console.error("Error al agregar proveedor:", error);
                showToast("Error al agregar proveedor", "danger");
            }
        });
    }
}

// Función para editar un proveedor
async function editProveedor(proveedorId) {
    try {
        // Importar las funciones necesarias de Firebase
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const { db } = await import("./firebase-config.js");

        const docRef = doc(db, "proveedores", proveedorId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const proveedor = docSnap.data();

            // Mostrar modal de edición
            const modal = document.getElementById("editProveedorModal");
            if (modal) {
                modal.style.display = "block";

                // Llenar formulario con datos del proveedor
                document.getElementById("editProveedorId").value = proveedorId;
                document.getElementById("editProveedorNombre").value = proveedor.nombre || "";
                document.getElementById("editProveedorContacto").value = proveedor.contacto || "";
                document.getElementById("editProveedorTelefono").value = proveedor.telefono || "";
                document.getElementById("editProveedorEmail").value = proveedor.email || "";

                // Configurar evento para el formulario de edición
                const editProveedorForm = document.getElementById("editProveedorForm");
                if (editProveedorForm) {
                    editProveedorForm.onsubmit = async (e) => {
                        e.preventDefault();
                        
                        const nuevoNombre = document.getElementById("editProveedorNombre").value.trim();
                        const nuevoContacto = document.getElementById("editProveedorContacto").value.trim();
                        const nuevoTelefono = document.getElementById("editProveedorTelefono").value.trim();
                        const nuevoEmail = document.getElementById("editProveedorEmail").value.trim();

                        if (!nuevoNombre) {
                            showToast("Ingrese un nombre para el proveedor", "warning");
                            return;
                        }

                        try {
                            // Importar las funciones necesarias de Firebase
                            const { updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                            
                            await updateDoc(docRef, {
                                nombre: nuevoNombre,
                                contacto: nuevoContacto,
                                telefono: nuevoTelefono,
                                email: nuevoEmail,
                                updatedAt: serverTimestamp(),
                            });

                            showToast("Proveedor actualizado correctamente", "success");
                            modal.style.display = "none";

                            // Recargar proveedores
                            loadProveedoresToModal();
                        } catch (error) {
                            console.error("Error al actualizar proveedor:", error);
                            showToast("Error al actualizar proveedor", "danger");
                        }
                    };
                }
            }
        } else {
            console.error("No se encontró el proveedor");
            showToast("No se encontró el proveedor", "danger");
        }
    } catch (error) {
        console.error("Error al obtener proveedor:", error);
        showToast("Error al obtener el proveedor", "danger");
    }
}

// Función para confirmar eliminación de un proveedor
function confirmDeleteProveedor(proveedorId) {
    const confirmModal = document.getElementById("confirmModal");
    const confirmTitle = document.getElementById("confirmTitle");
    const confirmMessage = document.getElementById("confirmMessage");
    const confirmOk = document.getElementById("confirmOk");
    const confirmCancel = document.getElementById("confirmCancel");

    if (confirmModal && confirmTitle && confirmMessage && confirmOk) {
        confirmTitle.textContent = "Eliminar Proveedor";
        confirmMessage.textContent = "¿Estás seguro de que deseas eliminar este proveedor? Esta acción no se puede deshacer y podría afectar a los productos asociados.";

        confirmModal.style.display = "block";

        // Configurar evento para el botón de confirmar
        const handleConfirm = async () => {
            try {
                // Importar las funciones necesarias de Firebase
                const { doc, deleteDoc, collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
                const { db } = await import("./firebase-config.js");

                // Verificar si hay productos asociados a este proveedor
                const productosQuery = query(collection(db, "productos"), where("proveedorId", "==", proveedorId));
                const productosSnapshot = await getDocs(productosQuery);

                if (!productosSnapshot.empty) {
                    showToast("No se puede eliminar el proveedor porque hay productos asociados", "warning");
                    confirmModal.style.display = "none";
                    return;
                }

                // Verificar si hay armazones asociados a este proveedor
                const armazonesQuery = query(collection(db, "armazones"), where("proveedorId", "==", proveedorId));
                const armazonesSnapshot = await getDocs(armazonesQuery);

                if (!armazonesSnapshot.empty) {
                    showToast("No se puede eliminar el proveedor porque hay armazones asociados", "warning");
                    confirmModal.style.display = "none";
                    return;
                }

                await deleteDoc(doc(db, "proveedores", proveedorId));
                showToast("Proveedor eliminado correctamente", "success");
                confirmModal.style.display = "none";

                // Recargar proveedores
                loadProveedoresToModal();
            } catch (error) {
                console.error("Error al eliminar proveedor:", error);
                showToast("Error al eliminar el proveedor", "danger");
                confirmModal.style.display = "none";
            }

            // Remover el evento para evitar duplicados
            confirmOk.removeEventListener("click", handleConfirm);
        };

        // Remover eventos anteriores y agregar el nuevo
        confirmOk.removeEventListener("click", handleConfirm);
        confirmOk.addEventListener("click", handleConfirm);

        // Configurar evento para el botón de cancelar
        confirmCancel.addEventListener("click", () => {
            confirmModal.style.display = "none";
        });
    }
}

// Función para mostrar notificaciones toast
function showToast(message, type = "info") {
    // Crear contenedor de toast si no existe
    let toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.id = "toastContainer";
        toastContainer.className = "fixed top-4 right-4 z-50 max-w-xs";
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement("div");
    toast.className = `bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 mb-3 flex items-center justify-between border-l-4 ${
        type === "success"
            ? "border-green-500"
            : type === "danger"
                ? "border-red-500"
                : type === "warning"
                    ? "border-yellow-500"
                    : "border-blue-500"
    }`;

    toast.innerHTML = `
        <div class="flex items-center">
            <span class="${
                type === "success"
                    ? "text-green-500"
                    : type === "danger"
                        ? "text-red-500"
                        : type === "warning"
                            ? "text-yellow-500"
                            : "text-blue-500"
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
    const closeBtn = toast.querySelector("button");
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
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

// Configurar eventos cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', function () {
    // Botones para generar códigos
    const generateProductCodeBtn = document.getElementById('generateProductCodeBtn');
    if (generateProductCodeBtn) {
        generateProductCodeBtn.addEventListener('click', async () => {
            const categoriaSelect = document.getElementById('productoCategoria');
            if (categoriaSelect && categoriaSelect.value) {
                const codigo = await generarCodigoProducto(categoriaSelect.value);
                document.getElementById('productoCodigo').value = codigo;
            } else {
                alert('Por favor, seleccione una categoría primero');
            }
        });
    }

    const generateFrameCodeBtn = document.getElementById('generateFrameCodeBtn');
    if (generateFrameCodeBtn) {
        generateFrameCodeBtn.addEventListener('click', async () => {
            // Buscar la categoría de armazones o generar un código genérico
            try {
                const response = await fetch('http://localhost:3000/api/categorias');
                const categorias = await response.json();

                const armazonesCategoria = categorias.find(cat =>
                    cat.nombre.toLowerCase() === 'armazones');

                if (armazonesCategoria) {
                    const codigo = await generarCodigoProducto(armazonesCategoria.id);
                    document.getElementById('armazonCodigo').value = codigo;
                } else {
                    // Generar código genérico para armazones
                    const hoy = new Date();
                    const prefijo = 'ARM';
                    const fechaStr = (hoy.getMonth() + 1).toString().padStart(2, '0') +
                        hoy.getDate().toString().padStart(2, '0');
                    const secuencia = Math.floor(Math.random() * 999).toString().padStart(3, '0');

                    document.getElementById('armazonCodigo').value = `${prefijo}${fechaStr}${secuencia}`;
                }
            } catch (error) {
                console.error('Error al generar código para armazón:', error);

                // Generar código genérico para armazones en caso de error
                const hoy = new Date();
                const prefijo = 'ARM';
                const fechaStr = (hoy.getMonth() + 1).toString().padStart(2, '0') +
                    hoy.getDate().toString().padStart(2, '0');
                const secuencia = Math.floor(Math.random() * 999).toString().padStart(3, '0');

                document.getElementById('armazonCodigo').value = `${prefijo}${fechaStr}${secuencia}`;
            }
        });
    }

    // Botones para administrar categorías
    const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
    if (manageCategoriesBtn) {
        manageCategoriesBtn.addEventListener('click', () => {
            mostrarModalCategorias();
        });
    }

    // Botones para administrar proveedores
    const manageProvidersBtn = document.getElementById('manageProvidersBtn');
    if (manageProvidersBtn) {
        manageProvidersBtn.addEventListener('click', () => {
            mostrarModalProveedores();
        });
    }

    // Configurar el botón de notificaciones
    const notificationBell = document.getElementById('notificationBell');
    const notificationDropdown = document.getElementById('notificationDropdown');

    if (notificationBell && notificationDropdown) {
        notificationBell.addEventListener('click', () => {
            if (notificationDropdown.style.display === 'block') {
                notificationDropdown.style.display = 'none';
            } else {
                notificationDropdown.style.display = 'block';
                notificaciones.actualizarLista();
            }
        });

        // Cerrar dropdown al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!notificationBell.contains(e.target) && !notificationDropdown.contains(e.target)) {
                notificationDropdown.style.display = 'none';
            }
        });

        // Botón para limpiar todas las notificaciones
        const clearAllBtn = document.getElementById('clearAllNotifications');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                notificaciones.limpiarTodas();
            });
        }
    }
});