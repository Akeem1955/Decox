# Decox Python LangGraph & LangChain Multimodal Microservice

Dedicated AI backend microservice powering the Decox mobile spatial redesign engine.

## Features
- **LangGraph Stateful Graph**: Routes between discrete retail store items (**Route 1: COMMERCE_DIY**) and authentic artisan surface craft (**Route 2: ARTISAN_FINISH**).
- **Gemini 3.8 Flash**: Current state-of-the-art multimodal spatial understanding and material extraction.
- **FastAPI**: Asynchronous high-performance REST API with CORS support for Ionic / Capacitor mobile apps.
- **Artisan Pin Matching**: Matches requests directly with Nigerian master artisans (tiling, fluted wood slat panels, compound pavers, microcement).

## Quickstart

### 1. Set Up Environment
\\\ ash
# Using uv (recommended)
uv venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate # Linux/Mac

uv pip install -r requirements.txt
\\\

### 2. Configure Environment Variables
Create a \.env\ file (or let it inherit from root \../.env\):
\\\env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.8-flash
PORT=8000
DATABASE_URL=postgresql://...
\\\

### 3. Run Service
\\\ ash
python -m uvicorn app.main:app --port 8000 --reload
\\\

### 4. Endpoints
- \GET /health\ - Service status and model check.
- \POST /api/concierge\ - Execute LangGraph redesign flow.
