import { 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { 
    doc, 
    getDoc,
    collection,
    getDocs,
    setDoc,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Verificando autenticación...");
    
    // Verificar si hay un usuario autenticado
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Si no hay usuario autenticado, redirigir al login
            console.log("No hay usuario autenticado, redirigiendo al login...");
            window.location.href = '../../index.html';
            return;
        }
        
        console.log("Usuario autenticado:", user.email);
        
        try {
            // Verificar si existe la colección de inventario
            await checkAndCreateInventoryCollection();
            
            // Cargar información del usuario desde sessionStorage
            const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
            
            if (!currentUser) {
                // Si no hay información en sessionStorage, intentar obtenerla de Firestore
                console.log("Obteniendo información del usuario desde Firestore...");
                const userDocRef = doc(db, 'usuarios', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    sessionStorage.setItem('currentUser', JSON.stringify({
                        uid: user.uid,
                        email: userData.email,
                        role: userData.role
                    }));
                    
                    setupUserInterface(userData);
                } else {
                    console.error("No se encontró información del usuario en la base de datos");
                    await signOut(auth);
                    window.location.href = '../../index.html';
                }
            } else {
                // Usar la información del usuario desde sessionStorage
                console.log("Usando información del usuario desde sessionStorage");
                setupUserInterface(currentUser);
            }
        } catch (error) {
            console.error("Error al verificar usuario o colecciones:", error);
            await signOut(auth);
            window.location.href = '../../index.html';
        }
    });
    
    // Configurar el botón de cerrar sesión
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                // Limpiar sessionStorage
                sessionStorage.removeItem('currentUser');
                // Redirigir al login
                window.location.href = '../../index.html';
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
            }
        });
    }
});

// Función para verificar y crear la colección de inventario si no existe
export async function checkAndCreateInventoryCollection() {
    try {
        console.log("Verificando colecciones de inventario...");
        
        // Verificar si existe la colección de categorías
        const categoriasSnapshot = await getDocs(collection(db, 'categorias'));
        if (categoriasSnapshot.empty) {
            console.log("Creando colección de categorías...");
            // Crear categorías iniciales
            const categoriasIniciales = [
                { nombre: 'General', descripcion: 'Productos generales' },
                { nombre: 'Lentes de Contacto', descripcion: 'Lentes de contacto' },
                { nombre: 'Lentes Solares', descripcion: 'Lentes para sol' },
                { nombre: 'Lentes Fotocromáticos', descripcion: 'Lentes fotocromáticos' },
                { nombre: 'Lentes Oftálmicos', descripcion: 'Lentes oftálmicos' },
                { nombre: 'Armazones', descripcion: 'Armazones para lentes' },
                { nombre: 'Accesorios', descripcion: 'Accesorios para lentes' },
                { nombre: 'Limpieza', descripcion: 'Productos de limpieza' }
            ];
            
            for (const categoria of categoriasIniciales) {
                await addDoc(collection(db, 'categorias'), {
                    ...categoria,
                    createdAt: serverTimestamp()
                });
            }
        }
        
        // Verificar si existe la colección de proveedores
        const proveedoresSnapshot = await getDocs(collection(db, 'proveedores'));
        if (proveedoresSnapshot.empty) {
            console.log("Creando colección de proveedores...");
            // Crear un proveedor inicial
            await addDoc(collection(db, 'proveedores'), {
                nombre: 'Proveedor General',
                telefono: '',
                email: '',
                direccion: '',
                createdAt: serverTimestamp()
            });
        }
        
        // Verificar si existe la colección de productos
        const productosSnapshot = await getDocs(collection(db, 'productos'));
        if (productosSnapshot.empty) {
            console.log("Creando colección de productos...");
            // Crear un documento vacío para inicializar la colección
            await setDoc(doc(db, 'productos', 'placeholder'), {
                isPlaceholder: true,
                createdAt: serverTimestamp()
            });
        }
        
        // Verificar si existe la colección de armazones
        const armazonesSnapshot = await getDocs(collection(db, 'armazones'));
        if (armazonesSnapshot.empty) {
            console.log("Creando colección de armazones...");
            // Crear un documento vacío para inicializar la colección
            await setDoc(doc(db, 'armazones', 'placeholder'), {
                isPlaceholder: true,
                createdAt: serverTimestamp()
            });
        }
        
        console.log("Verificación de colecciones completada");
    } catch (error) {
        console.error("Error al verificar o crear colecciones:", error);
        throw error; // Propagar el error para manejarlo en el nivel superior
    }
}

// Configurar la interfaz de usuario según el rol
function setupUserInterface(userData) {
    // Mostrar el email del usuario
    const userEmail = document.getElementById('userEmail');
    if (userEmail) {
        userEmail.textContent = userData.email;
    }
    
    // Mostrar/ocultar secciones según el rol
    const adminSection = document.getElementById('adminSection');
    if (adminSection) {
        // Solo mostrar la sección de administración si el rol es 'admin'
        adminSection.style.display = userData.role === 'admin' ? 'block' : 'none';
    }
    
    console.log(`Interfaz configurada para usuario con rol: ${userData.role}`);
}