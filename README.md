# 🚌 Proyecto: Transporte Colectivo Inteligente (Hackathon)

Este es el repositorio del MVP para la hackathon de "Transporte Colectivo Inteligente". El proyecto implementa un sistema de seguimiento en tiempo real para el transporte público de Juliaca, con un enfoque 100% gratuito (sin APIs de pago).

## 🛠️ Arquitectura del Stack

El proyecto es un **monorepo** que contiene 3 partes:

1.  **Backend (`/backend`)**
    * **Servicios:** Firebase (Firestore, Authentication, Cloud Functions)
    * **Lenguaje:** TypeScript
    * **Entorno:** Emuladores de Firebase (para desarrollo local)

2.  **App Móvil (`/transporte_app`)**
    * **Framework:** Flutter (una sola app con rol de Pasajero y Conductor)
    * **Mapas:** `flutter_map` (Gratuito, basado en OpenStreetMap)
    * **GPS:** `geolocator`
    * **Backend:** `cloud_firestore`, `firebase_auth`

3.  **Dashboard Web (`/dashboard_web`)**
    * **Framework:** Next.js (con App Router)
    * **Lenguaje:** TypeScript
    * **Mapas:** `react-leaflet` (Gratuito, basado en OpenStreetMap)
    * **Backend:** `firebase`

---

## 🚀 Cómo Levantar el Proyecto (Guía de Inicio)

Sigue estos pasos para tener todo el entorno corriendo localmente.

### 1. Pre-requisitos (Instalar una sola vez)

Asegúrate de tener todo esto instalado en tu sistema:

* **Node.js** (v22+)
* **Flutter SDK** (v3.x+)
* **Java JDK** (v17+). Necesario para los emuladores de Firebase.
* **Firebase CLI:** `npm install -g firebase-tools`
* **FlutterFire CLI:** `dart pub global activate flutterfire_cli`
* **VS Code** con las extensiones de Flutter y Dart.
* **Git**

### 2. Configuración Inicial (Hacer una sola vez)

1.  **Clonar el Repositorio:**
    ```bash
    git clone [URL_DEL_REPO_PRIVADO]
    cd proyecto_transporte
    ```

2.  **Instalar Dependencias del Backend:**
    ```bash
    cd backend/functions
    npm install
    cd ../.. 
    # (Vuelve a la raíz)
    ```

3.  **Instalar Dependencias del Dashboard Web:**
    ```bash
    cd dashboard_web
    npm install
    cd ..
    # (Vuelve a la raíz)
    ```

4.  **Instalar Dependencias de la App Móvil:**
    ```bash
    cd transporte_app
    flutter pub get
    cd ..
    # (Vuelve a la raíz)
    ```

### 3. Ejecutar el Entorno Completo

Para trabajar, necesitas **3 terminales abiertas** al mismo tiempo.

#### Terminal 1: Backend (Firebase Emulators)

Estos emuladores simulan Firebase en tu PC.

```bash
# 1. Ve a la carpeta del backend
cd backend

# 2. Compila el código de las funciones
cd functions
npm run build
cd ..

# 3. Inicia los emuladores
firebase emulators:start
```

- API de Funciones: `http://127.0.0.1:5001`
- UI del Emulador (para ver la DB): `http://127.0.0.1:4000`

---

#### Terminal 2: Dashboard Web (Next.js)

```bash
# 1. Ve a la carpeta web
cd dashboard_web

# 2. Inicia el servidor de desarrollo
npm run dev
```
- App Web corriendo en: `http://localhost:3000`

---

#### Terminal 3: App Móvil (Flutter)
```bash
# 1. Ve a la carpeta web
cd dashboard_web

# 2. Inicia el servidor de desarrollo
npm run dev
```

- App Web corriendo en: `http://localhost:3000`

---

#### Terminal 3: App Móvil (Flutter)

```bash
# 1. Ve a la carpeta móvil
cd transporte_app

# 2. Conecta un emulador de Android o un teléfono físico

# 3. Ejecuta la app
flutter run
```

- Usa **'r' (Hot Reload)** para aplicar cambios al instante.

- Usa **'R' (Hot Restart)** para reiniciar la app.
