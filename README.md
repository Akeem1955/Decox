# Decox: Mobile Spatial Redesign Engine & Artisan Craft Network

Decox is a mobile-first spatial redesign and sourcing platform that transforms physical spaces (rooms, offices, compound patios, garden landscapes) into photorealistic concepts grounded in **verifiable retail store products** and **authentic artisan craftsmanship**.

---

## 📁 Clean Repository Structure

```
CaterX/
├── ionic/                   # Clean Mobile App (Ionic / Capacitor / Next.js)
│   ├── capacitor.config.ts  # Native iOS & Android build config (appId: ng.decox.app)
│   ├── src/
│   │   ├── app/             # Mobile-first routes: /app (Studio), /app/designs, /app/feed, /app/settings
│   │   ├── components/      # AiConcierge, PaywallModal, AddPortfolioModal, ProfileDropdown
│   │   ├── lib/
│   │   │   ├── camera.ts    # Native camera/gallery capture hook (@capacitor/camera)
│   │   │   └── revenuecat.ts# In-app purchases & Pro subscriptions (@revenuecat/purchases-capacitor)
│   │   └── prisma/          # Database schema (User, PortfolioItem, SpatialDesign)
│   └── package.json
│
├── python/                  # Dedicated Python LangGraph & LangChain Microservice
│   ├── app/
│   │   ├── main.py          # FastAPI application exposing /health & /api/concierge
│   │   ├── graph.py         # Compiled LangGraph StateGraph
│   │   ├── state.py         # RoomDesignState TypedDict
│   │   ├── nodes.py         # Classification, store sourcing, artisan pin matching, action cards
│   │   └── services/        # Gemini 3.8 Flash client & Nigerian artisan catalog
│   ├── Dockerfile           # Production container for Cloud Run deployment
│   ├── requirements.txt     # fastapi, uvicorn, langgraph, langchain, google-genai
│   └── README.md
│
├── package.json             # Root unified workspace runner
└── pnpm-workspace.yaml      # Monorepo configuration
```

---

## 🚀 Quickstart Guide

### 1. Launch Python LangGraph Microservice
```bash
cd python
# Setup virtual environment with uv (or standard venv)
uv venv .venv
.venv\Scripts\activate   # On Windows (or source .venv/bin/activate on Mac/Linux)
uv pip install -r requirements.txt

# Start FastAPI server on port 8000
python -m uvicorn app.main:app --port 8000 --reload
```
Test health: `curl http://127.0.0.1:8000/health`

### 2. Launch Ionic Mobile Frontend
```bash
cd ionic
pnpm install
pnpm dev
```
Open `http://localhost:3000` to preview in mobile simulation mode.

---

## 💳 Native Mobile Capabilities (10-Day Launch Ready)

- **RevenueCat In-App Purchases:** Integrated in `@/lib/revenuecat` using `@revenuecat/purchases-capacitor` v13.6 with full support for Apple App Store and Google Play subscriptions (`PaywallModal.tsx`).
- **Native Camera & Gallery:** Integrated in `@/lib/camera` using `@capacitor/camera` v8.2 for instant spatial photo snapping.
- **Unified Role Space:** Normal users can freely design spaces, browse the Pinterest-style Craft Feed at `/app/feed`, or publish their own artisan craft pins with 1 tap.
