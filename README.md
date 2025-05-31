
# 👓 Servicios Ópticos Ah Kim Pech

Sistema web para la gestión integral de ópticas: inventario, ventas, clientes, convenios y usuarios.  
Desarrollado con **Firebase**, **Firestore**, **Express.js** y **JavaScript** moderno.

---

## 📚 Tabla de Contenidos

- [👓 Servicios Ópticos Ah Kim Pech](#-servicios-ópticos-ah-kim-pech)
  - [📚 Tabla de Contenidos](#-tabla-de-contenidos)
  - [✨ Características](#-características)
  - [🗂️ Estructura del Proyecto](#️-estructura-del-proyecto)
  - [⚙️ Instalación](#️-instalación)
  - [📜 Scripts](#-scripts)
  - [🧪 Tecnologías Utilizadas](#-tecnologías-utilizadas)
  - [🧩 Funcionalidades Principales](#-funcionalidades-principales)
    - [🗃️ Inventario](#️-inventario)
    - [💳 Ventas](#-ventas)
    - [👥 Clientes](#-clientes)
    - [🏢 Convenios](#-convenios)
    - [🔐 Usuarios](#-usuarios)
    - [🔔 Notificaciones y Alertas](#-notificaciones-y-alertas)
  - [🛡️ Notas de Seguridad](#️-notas-de-seguridad)
  - [📄 Licencia](#-licencia)

---

## ✨ Características

- **Gestión de Inventario:** Productos y armazones, stock, materiales, proveedores y categorías.
- **Ventas:** Registro de ventas, abonos, historial y detalle de cada venta.
- **Clientes:** Alta, edición, historial de compras, abonos y convenios.
- **Convenios:** Empresas, miembros, sucursales y control de crédito.
- **Usuarios:** Administración de empleados y administradores, roles y permisos.
- **Notificaciones:** Alertas de stock bajo, acciones importantes y mensajes toast unificados.
- **Filtros y Búsquedas:** Avanzados en todas las vistas principales.
- **Paginación:** Navegación eficiente en tablas grandes.
- **Diseño Responsive:** Adaptado para escritorio y dispositivos móviles.
- **Modo Oscuro:** Soporte completo para dark mode.

---

## 🗂️ Estructura del Proyecto

```
/public
  /assets
  /css         # Hojas de estilo
  /js          # Archivos JavaScript (lógica de cada módulo)
  /img         # Imágenes y logotipos
  /views       # Vistas HTML principales (inventario, ventas, clientes, convenios, usuarios)
  index.html   # Página de inicio de sesión

/server
  /config      # Configuración de entorno y Firebase
  index.js     # Servidor Express principal

.env           # Variables de entorno (no incluido en el repo)
package.json   # Dependencias y scripts
```

---

## ⚙️ Instalación

1. **Clona el repositorio:**

   ```bash
   git clone https://github.com/tuusuario/proyecto-optica.git
   cd proyecto-optica
   ```

2. **Instala las dependencias del backend:**

   ```bash
   npm install
   ```

3. **Configura las variables de entorno:**

   Crea un archivo `.env` en la raíz con tus credenciales de Firebase y configuración del servidor.

   **Ejemplo:**

   ```env
   PORT=4000
   FIREBASE_API_KEY=...
   FIREBASE_AUTH_DOMAIN=...
   FIREBASE_PROJECT_ID=...
   ```

---

## 📜 Scripts

**Iniciar el servidor en modo desarrollo:**

```bash
npm start
```

El servidor Express servirá los archivos estáticos y la API en el puerto configurado (por defecto `4000`).

---

## 🧪 Tecnologías Utilizadas

- **Frontend:** HTML5, CSS3, TailwindCSS, JavaScript ES6+
- **Backend:** Node.js, Express.js
- **Base de datos:** Firebase Firestore
- **Autenticación:** Firebase Auth
- **Notificaciones:** Sistema propio + Firestore
- **Otros:** Morgan (logs), Dotenv (variables de entorno)

---

## 🧩 Funcionalidades Principales

### 🗃️ Inventario

- Gestión de productos y armazones.
- Filtros por categoría, proveedor, stock, etc.
- Notificaciones de stock bajo.
- Paginación y búsqueda en tiempo real.

### 💳 Ventas

- Registro de ventas y abonos.
- Historial detallado por cliente.
- Modal de detalle de venta.

### 👥 Clientes

- Alta y edición de clientes.
- Historial de compras y abonos.
- Integración con convenios empresariales.

### 🏢 Convenios

- Alta de empresas, sucursales y miembros.
- Control de crédito y deuda por empresa y miembro.

### 🔐 Usuarios

- Alta, edición y eliminación de usuarios.
- Roles: Administrador y Empleado.
- Control de acceso a secciones sensibles.
- Visualización de fecha de creación y última modificación.

### 🔔 Notificaciones y Alertas

- Toasts unificados en la parte superior derecha.
- Alertas de acciones importantes y errores.
- Notificaciones de stock y eventos críticos.

---

## 🛡️ Notas de Seguridad

- **Administradores:** Solo pueden ser creados con correo y contraseña, y requieren autenticación con Firebase Auth.
- **Empleados:** Tienen acceso limitado, no pueden ver ni gestionar usuarios.
- **Protección de rutas:** Acceso restringido según el rol del usuario.
- **Contraseñas:** No se almacenan en Firestore.

---

## 📄 Licencia

Este proyecto está protegido bajo una **Licencia de Uso Condicional** desarrollada por **Josué Hernández López**.

- El uso del software está permitido **únicamente con autorización expresa** del autor.
- El permiso puede ser revocado en cualquier momento, sin previo aviso.
- No se permite la redistribución, modificación o comercialización sin consentimiento.

🔒 **Este proyecto NO es de código abierto** bajo licencias estándar (MIT, GPL, Apache, etc.).  
Consulta el archivo LICENSE` para más información legal.

¿Deseas utilizar este software? Comunícate con el autor para obtener permiso:  
📧 chanpachecob@gmail.com  

---

Desarrollado por 🚀 **Brayan-chan** 🚀