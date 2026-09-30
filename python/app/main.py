import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException, Depends, Response
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.config import settings
from app.graph import decox_graph
from app.state import RoomDesignState
from app.services.parallel_service import MARKETPLACE_REGISTRY
from app.services.firebase_auth import get_current_user, get_optional_user
from app.services import user_service, storage_service, design_service, artisan_upload_service

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Decox LangGraph Multimodal Engine for Spatial Redesign & Artisan Grounding"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static directory configuration
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/static/generated/{filename}")
async def get_static_generated(filename: str):
    """Serve staged room visual from container disk if present, else stream directly from GCS bucket."""
    local_file = STATIC_DIR / "generated" / filename
    if local_file.is_file():
        mime = "image/png" if filename.endswith(".png") else "image/jpeg"
        return FileResponse(local_file, media_type=mime)
    try:
        from app.services import storage_service
        bucket = storage_service._get_bucket()
        blob = bucket.blob(f"generated/{filename}")
        if blob.exists():
            content = blob.download_as_bytes()
            mime = "image/png" if filename.endswith(".png") else "image/jpeg"
            return Response(
                content=content,
                media_type=mime,
                headers={"Cache-Control": "public, max-age=86400, s-maxage=86400"}
            )
    except Exception as e:
        logger.error(f"[Static] Error streaming generated from GCS: {e}")
    raise HTTPException(status_code=404, detail="Image not found")


@app.get("/static/artisan_portfolio/{filename}")
async def get_static_artisan_portfolio(filename: str):
    """Serve verified artisan craft from container disk if present, else stream directly from GCS bucket."""
    local_file = STATIC_DIR / "artisan_portfolio" / filename
    if local_file.is_file():
        mime = "image/png" if filename.endswith(".png") else "image/jpeg"
        return FileResponse(local_file, media_type=mime)
    try:
        from app.services import storage_service
        bucket = storage_service._get_bucket()
        blob = bucket.blob(f"artisan_portfolio/{filename}")
        if blob.exists():
            content = blob.download_as_bytes()
            mime = "image/png" if filename.endswith(".png") else "image/jpeg"
            return Response(
                content=content,
                media_type=mime,
                headers={"Cache-Control": "public, max-age=86400, s-maxage=86400"}
            )
    except Exception as e:
        logger.error(f"[Static] Error streaming artisan from GCS: {e}")
    raise HTTPException(status_code=404, detail="Image not found")


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.on_event("startup")
async def on_startup():
    """Ensure database tables and columns exist on application start."""
    try:
        user_service.ensure_user_table()
    except Exception as e:
        logger.warning(f"[Startup] User table migration note: {e}")
    try:
        design_service.ensure_design_table()
    except Exception as e:
        logger.warning(f"[Startup] Design table migration note: {e}")
    try:
        artisan_upload_service.ensure_portfolio_columns()
    except Exception as e:
        logger.warning(f"[Startup] Portfolio table migration note: {e}")


# ============================================================================
# REQUEST / RESPONSE MODELS
# ============================================================================

class ConciergeRequest(BaseModel):
    prompt: Optional[str] = Field(default="", description="User design prompt or request")
    roomImage: Optional[str] = Field(default=None, description="Base64 dataUrl or image URL of space")
    spaceType: Optional[str] = Field(default="HOME_ROOM", description="Type of space")
    preferredStore: Optional[str] = Field(default=None, description="Preferred retail store ID")
    messages: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Chat turn history")

class ConciergeResponse(BaseModel):
    success: bool
    route: str
    text: str
    options: List[Dict[str, str]]
    specs: Dict[str, Any]
    shoppingList: List[Dict[str, Any]]
    matchedArtisan: Optional[Dict[str, Any]] = None
    mockupImageUrl: Optional[str] = None
    mockupImageData: Optional[str] = None
    declutterPlan: Optional[Dict[str, Any]] = None
    inspectionReport: Optional[Dict[str, Any]] = None
    availableStores: Optional[List[Dict[str, Any]]] = None
    actionCard: Dict[str, Any]
    error: Optional[str] = None

class RegisterRequest(BaseModel):
    name: str = Field(description="User display name")
    interests: Optional[List[str]] = None
    styles: Optional[List[str]] = None

class PreferencesRequest(BaseModel):
    interests: Optional[List[str]] = None
    styles: Optional[List[str]] = None

class UploadUrlRequest(BaseModel):
    filename: str = Field(description="File name (e.g. room-photo.jpg)")
    content_type: str = Field(default="image/jpeg")
    folder: str = Field(default="rooms", description="Subfolder: rooms, designs, portfolio")

class SaveDesignRequest(BaseModel):
    route: str
    prompt: str
    originalImageUrl: Optional[str] = None
    mockupImageUrl: Optional[str] = None
    shoppingList: List[Dict[str, Any]] = Field(default_factory=list)
    actionCard: Dict[str, Any] = Field(default_factory=dict)
    spaceType: str = "HOME_ROOM"
    stylePref: str = "Contemporary"
    estimatedTotalNaira: int = 0
    matchedArtisan: Optional[Dict[str, Any]] = None
    isPublic: bool = False

class ArtisanSubmitRequest(BaseModel):
    imageUrl: str
    title: str
    description: str
    category: str
    estimatedCostNaira: Optional[int] = None


# ============================================================================
# HEALTH (no auth)
# ============================================================================

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "model": settings.GEMINI_MODEL
    }


# ============================================================================
# AUTH & USER
# ============================================================================

@app.post("/api/auth/register")
async def register_user(
    request: RegisterRequest,
    user: dict = Depends(get_current_user),
):
    """Create/update user profile after Firebase signup."""
    uid = user["sub"]
    email = user.get("email", "")
    profile = user_service.create_or_update_user(
        firebase_uid=uid,
        email=email,
        name=request.name,
        interests=request.interests,
        styles=request.styles,
    )
    return {"success": True, "user": profile}


@app.get("/api/user/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    """Get current user profile."""
    uid = user["sub"]
    profile = user_service.get_user_by_firebase_uid(uid)
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")
    return {"success": True, "user": profile}


@app.put("/api/user/preferences")
async def update_preferences(
    request: PreferencesRequest,
    user: dict = Depends(get_current_user),
):
    """Update user interests and style preferences."""
    uid = user["sub"]
    profile = user_service.update_preferences(
        firebase_uid=uid,
        interests=request.interests,
        styles=request.styles,
    )
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "user": profile}


@app.get("/api/artisan/{artisan_id}")
async def get_artisan(
    artisan_id: str,
    user: dict = Depends(get_current_user),
):
    """Get artisan profile + portfolio."""
    profile = user_service.get_artisan_profile(artisan_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Artisan not found")
    return {"success": True, "artisan": profile}


# ============================================================================
# STORAGE (GCS signed URLs)
# ============================================================================

@app.post("/api/upload/signed-url")
async def get_upload_url(
    request: UploadUrlRequest,
    user: dict = Depends(get_current_user),
):
    """Generate a GCS signed upload URL for direct mobile → GCS upload."""
    uid = user["sub"]
    result = storage_service.generate_upload_url(
        uid=uid,
        filename=request.filename,
        content_type=request.content_type,
        folder=request.folder,
    )
    return {"success": True, **result}


# ============================================================================
# FEED ENDPOINTS
# ============================================================================

@app.get("/api/feed/ai-redesigns")
async def feed_ai_redesigns(
    page: int = 1,
    limit: int = 20,
    user: Optional[dict] = Depends(get_optional_user),
):
    """Paginated public AI redesign feed (Home feed AI tab)."""
    designs = design_service.get_public_designs(page=page, limit=limit)
    return {"success": True, "designs": designs, "page": page}


@app.get("/api/feed/artisan")
async def feed_artisan(
    page: int = 1,
    limit: int = 20,
    user: Optional[dict] = Depends(get_optional_user),
):
    """Paginated verified artisan work feed (Home feed Artisan tab)."""
    items = artisan_upload_service.get_artisan_feed(page=page, limit=limit)
    return {"success": True, "items": items, "page": page}


@app.get("/api/search")
async def search_content(
    q: str = "",
    category: str = "",
    limit: int = 30,
    user: dict = Depends(get_current_user),
):
    """Unified search across AI redesigns and artisan portfolio items."""
    results = design_service.search_all(query=q, category=category, limit=limit)
    return {"success": True, "results": results}


# ============================================================================
# DESIGN CRUD
# ============================================================================

@app.post("/api/designs/save")
async def save_design(
    request: SaveDesignRequest,
    user: dict = Depends(get_current_user),
):
    """Save a completed AI redesign."""
    uid = user["sub"]
    db_user = user_service.get_user_by_firebase_uid(uid)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    design = design_service.save_design(
        user_id=db_user["id"],
        route=request.route,
        prompt=request.prompt,
        original_image_url=request.originalImageUrl,
        mockup_image_url=request.mockupImageUrl,
        shopping_list=request.shoppingList,
        action_card=request.actionCard,
        space_type=request.spaceType,
        style_pref=request.stylePref,
        estimated_total=request.estimatedTotalNaira,
        matched_artisan=request.matchedArtisan,
        is_public=request.isPublic,
    )
    return {"success": True, "design": design}


@app.put("/api/designs/{design_id}/publish")
async def publish_design(
    design_id: str,
    user: dict = Depends(get_current_user),
):
    """Publish a design to the public feed."""
    uid = user["sub"]
    db_user = user_service.get_user_by_firebase_uid(uid)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    design = design_service.publish_design(user_id=db_user["id"], design_id=design_id)
    if not design:
        raise HTTPException(status_code=404, detail="Design not found")
    return {"success": True, "design": design}


@app.get("/api/designs/mine")
async def my_designs(user: dict = Depends(get_current_user)):
    """Get current user's designs (Profile screen)."""
    uid = user["sub"]
    db_user = user_service.get_user_by_firebase_uid(uid)
    if not db_user:
        return {"success": True, "designs": []}
    designs = design_service.get_user_designs(user_id=db_user["id"])
    return {"success": True, "designs": designs}


# ============================================================================
# ARTISAN UPLOADS
# ============================================================================


@app.post("/api/artisan/submit")
async def submit_artisan_work(
    request: ArtisanSubmitRequest,
    user: dict = Depends(get_current_user),
):
    """Submit artisan portfolio work (strictly verified for authenticity)."""
    uid = user["sub"]
    db_user = user_service.get_user_by_firebase_uid(uid)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        item = artisan_upload_service.submit_artisan_work(
            user_id=db_user["id"],
            image_url=request.imageUrl,
            title=request.title,
            description=request.description,
            category=request.category,
            estimated_cost_naira=request.estimatedCostNaira,
        )
        return {"success": True, "item": item}
    except ValueError as e:
        # AI-generated content rejected before storage/indexing
        raise HTTPException(status_code=422, detail=str(e))


# ============================================================================
# CONCIERGE (AI EDITING PIPELINE) — now auth-protected
# ============================================================================

@app.post("/api/concierge", response_model=ConciergeResponse)
async def run_concierge(
    request: ConciergeRequest,
    user: dict = Depends(get_current_user),
):
    user_prompt = (request.prompt or "").strip()
    if not user_prompt and not request.roomImage:
        raise HTTPException(status_code=400, detail="Either prompt or roomImage must be provided.")

    logger.info(
        f"[Concierge] Request: prompt='{user_prompt}', "
        f"roomImage={'present (' + str(len(request.roomImage)) + ' chars, prefix=' + request.roomImage[:30] + ')' if request.roomImage else 'None'}, "
        f"spaceType={request.spaceType}"
    )

    initial_state: RoomDesignState = {
        "user_prompt": user_prompt,
        "room_image": request.roomImage,
        "space_type": request.spaceType or "HOME_ROOM",
        "preferred_store": request.preferredStore,
        "messages": request.messages or [],
        "status": "INITIALIZED"
    }

    try:
        final_state = await decox_graph.ainvoke(initial_state)

        raw_mockup = final_state.get("mockup_image_url")
        mockup_url = None
        if raw_mockup:
            base = (settings.APP_URL or "https://decox-backend-871640164960.us-central1.run.app").rstrip("/")
            if raw_mockup.startswith("/static/"):
                mockup_url = f"{base}{raw_mockup}"
            elif "storage.googleapis.com/decox-media/" in raw_mockup:
                path = raw_mockup.split("storage.googleapis.com/decox-media/")[-1]
                mockup_url = f"{base}/static/{path}"
            elif raw_mockup.startswith("http"):
                mockup_url = raw_mockup
            else:
                mockup_url = f"{base}/static/{raw_mockup.lstrip('/')}"

        stores_summary = [
            {
                "id": s["id"],
                "name": s["name"],
                "domain": s["domain"],
                "reliability_rank": s["reliability_rank"],
                "richness": s["inventory_richness"],
                "is_active": request.preferredStore == s["id"]
            }
            for s in sorted(MARKETPLACE_REGISTRY, key=lambda x: x["reliability_rank"])
        ]

        # Enforce privacy: never leak raw personal phone numbers in client payloads
        raw_artisan = final_state.get("matched_artisan")
        sanitized_artisan = None
        if raw_artisan and isinstance(raw_artisan, dict):
            sanitized_artisan = {k: v for k, v in raw_artisan.items() if k not in ["vendor_phone", "contractor_phone"]}
            sanitized_artisan["in_app_chat_available"] = True

        raw_action_card = final_state.get("action_card", {})
        sanitized_action_card = {}
        if isinstance(raw_action_card, dict):
            sanitized_action_card = {k: v for k, v in raw_action_card.items() if k not in ["vendor_phone", "contractor_phone"]}
            sanitized_action_card["in_app_chat_available"] = True

        return ConciergeResponse(
            success=True,
            route=final_state.get("route", "COMMERCE_DIY"),
            text=final_state.get("response_text", ""),
            options=final_state.get("options", []),
            specs=final_state.get("specs", {}),
            shoppingList=final_state.get("shopping_list", []),
            matchedArtisan=sanitized_artisan,
            mockupImageUrl=mockup_url,
            mockupImageData=final_state.get("mockup_image_data"),
            declutterPlan=final_state.get("declutter_plan"),
            inspectionReport=final_state.get("inspection_report"),
            availableStores=stores_summary,
            actionCard=sanitized_action_card,
            error=final_state.get("error")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LangGraph execution failed: {str(e)}")


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
