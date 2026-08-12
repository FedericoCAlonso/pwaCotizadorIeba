# 🔐 Guía de Configuración e Integración Segura de Firebase

Guía paso a paso para conectar **Cotizador Eléctrico IEBA** con tu proyecto de Firebase de manera 100% segura, resguardando las credenciales y garantizando el aislamiento de datos entre usuarios.

---

## 1. Guardar las Credenciales en `.env.local`

En el frontend de aplicaciones web, las credenciales de Firebase identifican tu proyecto. Para mantenerlas aisladas de los repositorios de código:

1. Ve a la **Consola de Firebase** > **Configuración del proyecto** ⚙️ > **General**.
2. En la sección **Tus aplicaciones**, selecciona el ícono Web `</>` para registrar tu aplicación.
3. Copia el objeto `firebaseConfig`.
4. En la raíz del proyecto, crea el archivo `.env.local` (este archivo está excluido en `.gitignore` para nunca subirse a Git/GitHub) y pega tus credenciales:

```env
VITE_FIREBASE_API_KEY=AIzaSyYourApiKeyHere
VITE_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu-proyecto-id
VITE_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
```

> 💡 **Método Alternativo desde la App:** También puedes abrir la PWA en el navegador, ir a **Configuración** ⚙️ > **Sincronización Nube & Firebase** > **Configurar Claves** e ingresarlas directamente en la interfaz.

---

## 2. Habilitar Métodos de Autenticación

En la Consola de Firebase:
1. Ve al menú lateral **Authentication** > haz clic en **Comenzar**.
2. En la pestaña **Sign-in method** (Métodos de inicio de sesión):
   - **Correo electrónico / Contraseña**: Haz clic en Editar ✏️, activa **Habilitar** y guarda.
   - **Google**: Haz clic en Editar ✏️, activa **Habilitar**, selecciona tu correo de soporte y guarda.

---

## 3. Crear Firestore Database y Reglas de Seguridad (CRÍTICO)

En Firebase, la seguridad real la proporcionan las **Reglas de Seguridad de Firestore**. Esto asegura que ningún usuario pueda leer ni modificar los presupuestos de otro usuario:

1. En el menú lateral, ve a **Firestore Database** > **Crear base de datos**.
2. Selecciona el modo de producción y la ubicación geográfica (ej: `southamerica-east1` o `us-central`).
3. Ve a la pestaña **Reglas** (*Security Rules*), reemplaza el contenido por el siguiente bloque y haz clic en **Publicar**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Garantiza aislamiento total: solo el usuario autenticado puede leer/escribir en su propio directorio
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 4. Dominios Autorizados para Inicio de Sesión (Google Auth)

Para que el inicio de sesión con Google funcione tanto en desarrollo como en producción:
1. Ve a **Authentication** > pestaña **Settings** (Configuración) > **Authorized domains** (Dominios autorizados).
2. Asegúrate de tener agregado `localhost` (para desarrollo local) y agrega el dominio de producción donde alojes la PWA (ej: `tu-usuario.github.io`, Vercel, Firebase Hosting, etc.).

---

## 🏗️ Arquitectura de Sincronización Híbrida

```
[Dispositivo / PWA] <---> [Dexie.js / IndexedDB Local]
                                    |
                           (Al estar Online)
                                    |
                                    v
                     [Cloud Firestore: /users/{uid}/*]
```

- **Offline-First:** La app sigue funcionando 100% offline localmente mediante Dexie.js (IndexedDB).
- **Multi-dispositivo:** Al conectarte a internet e iniciar sesión, los presupuestos, insumos, clientes y registros se sincronizan automáticamente con Cloud Firestore.
