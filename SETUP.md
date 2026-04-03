# AGRIO - Development Setup Guide

This repo has **two separate projects**:

- `frontend/` -> Expo React Native app (disease detection, irrigation UI, dashboard, auth)
- `backend/` -> FastAPI backend (auth, irrigation AI agent, MQTT IoT gateway, PostgreSQL)

Most setup problems happen when commands are run from the repo root instead of the correct subfolder.

## Prerequisites

| Tool | Recommended | Check |
|---|---|---|
| Node.js | 20+ (24 also works) | `node -v` |
| npm | 10+ | `npm -v` |
| Python | 3.11+ | `python --version` |
| Docker Desktop | latest | `docker --version` |
| Git | 2.30+ | `git --version` |
| Git LFS | latest | `git lfs version` |
| Java JDK | 17 | `java -version` |
| Android Studio | latest | open Android Studio |

> Use **JDK 17** for Android builds.

## Android SDK Requirements (Frontend)

Install with Android Studio SDK Manager:

- Android SDK Platform (latest stable)
- Android SDK Platform-Tools
- Android SDK Build-Tools
- Android Emulator
- NDK (Side by side) 26.x
- CMake 3.22.1

---

## 1) Clone + LFS

```bash
git lfs install
git clone https://github.com/hendch/Esprit-PIDS-4DS2-2026-agrio.git
cd Esprit-PIDS-4DS2-2026-agrio
git lfs pull
```

The disease detection model file should exist here:

```
frontend/assets/model/efficientnet_plantvillage.tflite
```

---

## 2) Backend Setup

### 2.1) Start PostgreSQL with Docker

```bash
cd backend
docker compose up -d
```

This starts a Postgres container (`postgres:15`) on port `5432` with user `postgres`, password `postgres`, database `agrio`.

> If you previously ran compose with different `POSTGRES_*` values, do a one-time reset:
> ```bash
> docker compose down -v
> docker compose up -d
> ```

### 2.2) Create your env file

```bash
cd backend
cp .env.example backend.env
```

Edit `backend.env` and fill in:

| Variable | Required | Notes |
|---|---|---|
| `AGRIO_DATABASE_URL` | Yes | Already set correctly in the template |
| `AGRIO_JWT_SECRET` | Yes | Set to any non-empty string (e.g. `mysecret123`). Do NOT leave empty |
| `AGRIO_GROQ_API_KEY` | Yes | Get a free key from [console.groq.com](https://console.groq.com). Needed for the irrigation AI agent |
| `AGRIO_DEBUG` | No | `true` for dev |
| `AGRIO_CORS_ORIGINS` | No | Uncomment if testing from web browser |
| `AGRIO_MQTT_*` | No | Defaults work with the Wokwi ESP32 simulator |

> **IMPORTANT:** Never commit `backend.env`. Only `backend/.env.example` is shared.

### 2.3) Install Python dependencies and run

```bash
cd backend
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -e ".[dev]"
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 2.4) Verify backend is working

```bash
# Health check
curl http://localhost:8000/health

# Register a test user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@test.com\",\"password\":\"Test1234\"}"

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@test.com\",\"password\":\"Test1234\"}"
```

---

## 3) Frontend Setup

Run all commands from `frontend/`:

```bash
cd frontend
npm install
```

If PowerShell blocks `npm` script execution, use `npm.cmd install`.

### Run on Android

```bash
npx expo prebuild --platform android
npx expo run:android
```

> **Note:** `npx expo start` (Expo Go) will NOT work because the app uses native modules (`react-native-fast-tflite`). You must use `npx expo run:android`.

If Android SDK is not found, create `frontend/android/local.properties`:

```properties
sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk
```

---

## 4) IoT Simulation (Wokwi ESP32)

The irrigation system uses an ESP32 that communicates with the backend via MQTT.

1. Open the Wokwi project (ask the team for the link or use the `sketch.txt` + `diagram.json` in the repo root)
2. Press **Play** to start the simulation
3. The ESP32 connects to `test.mosquitto.org` and publishes soil moisture values to `farm/soil_moisture`
4. The backend listens on the same MQTT topic and can send irrigation commands back to `farm/irrigation_command`

---

## 5) Testing the Full System

1. **Start PostgreSQL**: `cd backend && docker compose up -d`
2. **Start backend**: `cd backend && uvicorn app.main:app --reload`
3. **Start frontend**: `cd frontend && npx expo run:android`
4. **Start Wokwi simulation**: Press Play in the Wokwi editor

### In the app:
- **Sign Up** with an email and password
- **Log In** to reach the Dashboard
- **Water tab** (Irrigation): Press "Evaluate Field Now" to trigger the AI agent. It reads MQTT sensor data + weather forecast and decides whether to irrigate. Check the Wokwi Serial Monitor for `Pump ON` / `Pump OFF`.
- **Crop tab** (Disease Detection): Take or pick a photo of a plant leaf to get disease diagnosis and treatment advice
- **Autonomous Control toggle**: When enabled, the backend automatically checks irrigation every 6 hours

---

## App Features

| Feature | Screen | Backend API |
|---|---|---|
| User Auth | Login, Sign Up | `/api/v1/auth/` |
| Dashboard | Home tab | - |
| Irrigation | Water tab | `/api/v1/irrigation/` |
| Disease Detection | Crop tab | On-device TFLite model |
| Satellite/Land | Land tab | `/api/v1/satellite/` |
| Livestock | Livestock tab | `/api/v1/livestock/` |
| Community | Community tab | - |
| Alerts | Alerts tab | - |

---

## Project Structure

```
backend/
  app/
    api/v1/          # Route handlers (auth, irrigation, disease, etc.)
    middleware/       # Auth JWT middleware, CORS, logging
    modules/          # Business logic (auth, irrigation, ai, iot_gateway, etc.)
    persistence/      # Database engine, base model, session
    settings.py       # Pydantic settings (reads from backend.env / .env)
  docker-compose.yml  # PostgreSQL container
  backend.env         # Your local secrets (DO NOT COMMIT)
  .env.example        # Template for backend.env

frontend/
  src/
    core/             # Navigation, theme, stores, API client
    features/         # Feature modules (auth, dashboard, irrigation, diseaseDetection, etc.)
    bootstrap/        # App initialization, feature registration
  assets/model/       # TFLite model for disease detection
```

---

## Troubleshooting

### "Groq API key not set" or 500 error on Evaluate Field
Make sure `AGRIO_GROQ_API_KEY` is set in `backend/backend.env` (or `backend/.env`) with a valid key. Restart uvicorn after changing env values.

### "Failed to reach backend API" from the Android emulator
The emulator uses `10.0.2.2` to reach your host machine's `localhost`. This is already handled in `frontend/src/core/api/apiBaseUrl.ts`. If using a physical device, update the base URL to your computer's local IP address.

### Invalid character TS errors in language files
Text files were corrupted (null-byte content). Replace with clean UTF-8 text files.

### Metro cannot resolve `.tflite`
Confirm `frontend/metro.config.js` exists and pushes `"tflite"` into `config.resolver.assetExts`.

### NDK/CMake native build errors
Install NDK + CMake from Android Studio, then clean and rebuild:

```bash
cd frontend/android
./gradlew clean
cd ..
npx expo run:android
```

### Windows `Filename longer than 260 characters` or `std::format` C++ errors
If Android build fails in `safe-area-context` codegen or `expo-modules-core` with `x86_64` on Windows:

1. Keep New Architecture disabled:
   - `frontend/app.json` -> `"newArchEnabled": false`
   - `frontend/android/gradle.properties` -> `newArchEnabled=false`
2. Clean and rebuild:
```bash
cd frontend/android
./gradlew clean
cd ..
npx expo run:android
```

### "Cannot find module 'buffer'" or `jpeg-js`

```bash
cd frontend
# Windows PowerShell:
Remove-Item -LiteralPath node_modules -Recurse -Force
# macOS/Linux:
# rm -rf node_modules
npm install
```

### Docker Postgres port conflict
If port 5432 is already in use, stop the other Postgres or change the port in `docker-compose.yml`.

---

## Quick Start (TL;DR)

```bash
git lfs install
git clone https://github.com/hendch/Esprit-PIDS-4DS2-2026-agrio.git
cd Esprit-PIDS-4DS2-2026-agrio

# Backend
cd backend
docker compose up -d
cp .env.example backend.env
# Edit backend.env: set AGRIO_JWT_SECRET and AGRIO_GROQ_API_KEY
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -e ".[dev]"
uvicorn app.main:app --reload

# Frontend (new terminal)
cd frontend
npm install
npx expo prebuild --platform android
npx expo run:android
```
