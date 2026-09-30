# Decox: Mobile Spatial Redesign Engine & Artisan Craft Network

Decox is a mobile-first spatial redesign and sourcing platform that transforms physical spaces (rooms, offices, compound patios, garden landscapes) into photorealistic concepts grounded in **verifiable retail store products** and **authentic artisan craftsmanship**.

---

## 📱 Download Android APK
Get the live Android build directly to test on your phone:
- **Download Link (Google Drive):** [Download Decox APK](https://drive.google.com/file/d/1e_L5kmCQyT-x4JuPVoY3y9Akb0zuP2mB/view?usp=sharing)
- **File Name:** `decox.apk` (177 MB)
- **Target OS:** Android 10+ (Built with Expo & React Native)

---

## 🌟 Key Features
- **Grounding in Real Commerce:** Ends hallucinated "AI slop" by searching live e-commerce stores (Jumia, Amazon, Jiji) for real, buyable items with verified pricing and direct checkout URLs.
- **Multimodal Spatial Staging (Gemini 3.8 Flash):** Seamlessly composites sourced retail items into the user's room while preserving original walls, windows, structural geometry, and ambient lighting.
- **Vetted Artisan Sourcing:** Matches custom architectural surface work (POP ceilings, fluted wood paneling, screeding, tiling, compound pavers) directly to verified local master artisans via PostgreSQL `pgvector` semantic search.
- **In-App Messaging & Portfolio Publishing:** Direct chat between homeowners and craftspeople, plus a community artisan feed with 1-tap portfolio submissions.

---

## 📁 Repository Structure

```
Decox/
├── mobile/                  # React Native & Expo Mobile Client
│   ├── app.json             # Expo project configuration
│   ├── App.tsx              # Application root with Theme & Auth providers
│   ├── src/
│   │   ├── components/      # MasonryGrid, AddPortfolioModal, PaywallModal, BottomNav
│   │   ├── navigation/      # Auth & Main Tab navigators
│   │   ├── screens/         # HomeFeed, CreateUpload, Processing, ResultScreen, Chat
│   │   ├── services/        # apiClient, authService, revenueCatService
│   │   └── config/          # firebaseConfig
│   └── package.json
│
├── python/                  # LangGraph & Multimodal AI Backend
│   ├── app/
│   │   ├── main.py          # FastAPI application & REST endpoints
│   │   ├── graph.py         # Compiled LangGraph StateGraph
│   │   ├── state.py         # RoomDesignState schema
│   │   ├── nodes.py         # Classification, store sourcing, artisan matching, staging
│   │   └── services/        # Gemini 3.8 Flash, Parallel.ai, pgvector search, GCS
│   ├── Dockerfile           # Production container for Cloud Run deployment
│   ├── cloudrun.env.yaml    # Cloud Run deployment configuration
│   └── requirements.txt     # fastapi, uvicorn, langgraph, google-genai, psycopg2
│
├── decox_assets/            # App icons, high-res presentation assets & sample designs
├── .gitignore               # Strict exclusion of secrets, keys, and build binaries
└── README.md
```

---

## 🚀 Quickstart Guide

### 1. Launch Python LangGraph Microservice
```bash
cd python
# Setup virtual environment
uv venv .venv
.venv\Scripts\activate   # On Windows (or source .venv/bin/activate on Mac/Linux)
uv pip install -r requirements.txt

# Start FastAPI server on port 8000
python -m uvicorn app.main:app --port 8000 --reload
```
Check health: `curl http://127.0.0.1:8000/health`

### 2. Launch Mobile App (Expo)
```bash
cd mobile
npm install
npx expo start
```
Scan the QR code with Expo Go on Android/iOS, or press `a` to run on an attached Android device / emulator.

---

## 🛠️ Tech Stack
- **AI & Perception:** Google Gemini 3.8 Flash (`google-genai` SDK)
- **Agent Orchestration:** Python LangGraph & LangChain (`RoomDesignState`)
- **Live Commerce Extraction:** Parallel.ai real-time web retrieval
- **Vector Database:** Google Cloud SQL PostgreSQL with `pgvector`
- **Backend Infrastructure:** Google Cloud Run (Serverless Docker) & Google Cloud Storage (GCS)
- **Mobile Frontend:** React Native, Expo, TypeScript
- **Monetization:** RevenueCat In-App Purchases SDK
