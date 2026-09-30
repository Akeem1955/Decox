import os
from pathlib import Path
try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs):
        pass

# Try loading from local python/.env first, then root ../.env
python_env = Path(__file__).resolve().parent.parent / ".env"
root_env = Path(__file__).resolve().parent.parent.parent / ".env"

if python_env.exists():
    load_dotenv(python_env)
elif root_env.exists():
    load_dotenv(root_env)
else:
    load_dotenv()

class Settings:
    PROJECT_NAME: str = "Decox LangGraph Multimodal Engine"
    VERSION: str = "1.0.0"
    
    # AI Models
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    # External APIs
    PARALLEL_API_KEY: str = os.getenv("PARALLEL_API_KEY", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    # Firebase
    FIREBASE_PROJECT_ID: str = os.getenv("FIREBASE_PROJECT_ID", "decox-3a9ba")
    
    # GCS
    GCS_BUCKET: str = os.getenv("GCS_BUCKET", "decox-media")
    
    # Server Host/Port
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    APP_URL: str = os.getenv("APP_URL", "")

settings = Settings()
