"""Design CRUD — save, publish, and query AI-redesigned spatial designs."""
import logging
import uuid
import json
from typing import Optional, Dict, Any, List
import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import settings

logger = logging.getLogger(__name__)


VALID_SPACE_TYPES = {
    "HOME_ROOM",
    "COMPOUND_OUTDOOR",
    "OFFICE_WORKSPACE",
    "RECREATIONAL_CENTER",
    "RETAIL_SHOP",
    "PUBLIC_PARK",
}


def normalize_space_type(space_type: Optional[str]) -> str:
    """Normalize arbitrary room/space types into valid PostgreSQL SpaceType enum values."""
    if not space_type:
        return "HOME_ROOM"
    st = str(space_type).strip().upper()
    if st in VALID_SPACE_TYPES:
        return st

    st_lower = str(space_type).strip().lower()
    if any(k in st_lower for k in ["office", "workstation", "desk", "study", "work"]):
        return "OFFICE_WORKSPACE"
    elif any(k in st_lower for k in ["outdoor", "compound", "garden", "patio", "balcony", "exterior"]):
        return "COMPOUND_OUTDOOR"
    elif any(k in st_lower for k in ["recreation", "gym", "pool", "game", "club"]):
        return "RECREATIONAL_CENTER"
    elif any(k in st_lower for k in ["shop", "retail", "store", "boutique", "showroom"]):
        return "RETAIL_SHOP"
    elif any(k in st_lower for k in ["park", "public", "plaza"]):
        return "PUBLIC_PARK"
    else:
        return "HOME_ROOM"


def normalize_branch(route: Optional[str]) -> str:
    """Map LangGraph route to PostgreSQL WorkflowBranch enum ('COMMERCE_DIY' | 'PHYSICAL_LABOR')."""
    if not route:
        return "COMMERCE_DIY"
    r = str(route).strip().upper()
    if r in ["ARTISAN_FINISH", "CONTRACTOR_PROJECT", "STRUCTURAL_ESTIMATE", "SITE_INSPECTION", "PHYSICAL_LABOR"]:
        return "PHYSICAL_LABOR"
    return "COMMERCE_DIY"


def _get_conn():
    return psycopg2.connect(settings.DATABASE_URL)


def ensure_design_table():
    """Ensure SpatialDesign table has needed columns (idempotent)."""
    conn = _get_conn()
    conn.autocommit = True
    cur = conn.cursor()
    try:
        # Add columns needed for feed and persistence functionality
        cur.execute("""
            ALTER TABLE "SpatialDesign"
            ADD COLUMN IF NOT EXISTS "userId" TEXT REFERENCES "User"("id") ON DELETE CASCADE,
            ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS "route" TEXT DEFAULT 'COMMERCE_DIY',
            ADD COLUMN IF NOT EXISTS "shoppingList" JSONB DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS "actionCard" JSONB DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS "mockupImageUrl" TEXT,
            ADD COLUMN IF NOT EXISTS "originalImageUrl" TEXT,
            ADD COLUMN IF NOT EXISTS "spaceType" "SpaceType" DEFAULT 'HOME_ROOM',
            ADD COLUMN IF NOT EXISTS "stylePref" TEXT DEFAULT 'Contemporary',
            ADD COLUMN IF NOT EXISTS "prompt" TEXT DEFAULT '',
            ADD COLUMN IF NOT EXISTS "estimatedTotalNaira" INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "matchedArtisan" JSONB,
            ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();

            ALTER TABLE "SpatialDesign" ALTER COLUMN "branch" SET DEFAULT 'COMMERCE_DIY'::"WorkflowBranch";
        """)
        logger.info("[DesignService] SpatialDesign table columns ensured")
    except Exception as e:
        logger.warning(f"[DesignService] Migration note: {e}")
    finally:
        cur.close()
        conn.close()


def save_design(
    user_id: str,
    route: str,
    prompt: str,
    original_image_url: Optional[str],
    mockup_image_url: Optional[str],
    shopping_list: List[Dict],
    action_card: Dict,
    space_type: str = "HOME_ROOM",
    style_pref: str = "Contemporary",
    estimated_total: int = 0,
    matched_artisan: Optional[Dict] = None,
    is_public: bool = False,
) -> Dict[str, Any]:
    """Save a completed AI redesign to Cloud SQL."""
    conn = _get_conn()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        design_id = str(uuid.uuid4())[:25]
        normalized_st = normalize_space_type(space_type)
        branch_val = normalize_branch(route)

        # Normalize relative static paths to permanent GCS URL before storing
        normalized_mockup = _normalize_url(mockup_image_url)
        normalized_original = _normalize_url(original_image_url)

        cur.execute(
            """
            INSERT INTO "SpatialDesign" (
                id, "userId", route, branch, prompt, "originalImageUrl", "mockupImageUrl",
                "shoppingList", "actionCard", "spaceType", "stylePref",
                "estimatedTotalNaira", "matchedArtisan", "isPublic",
                "createdAt", "updatedAt"
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
            ) RETURNING *
            """,
            (
                design_id, user_id, route, branch_val, prompt, normalized_original, normalized_mockup,
                json.dumps(shopping_list or []), json.dumps(action_card or {}),
                normalized_st, style_pref or "Contemporary", int(estimated_total or 0),
                json.dumps(matched_artisan) if matched_artisan else None,
                bool(is_public),
            ),
        )
        row = dict(cur.fetchone())
        logger.info(f"[DesignService] Saved design: {design_id} (public={is_public})")
        return _normalize_design_row(row)
    finally:
        cur.close()
        conn.close()


def publish_design(user_id: str, design_id: str) -> Optional[Dict[str, Any]]:
    """Mark a design as public (visible in AI Redesigns feed)."""
    conn = _get_conn()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            UPDATE "SpatialDesign"
            SET "isPublic" = true, "updatedAt" = NOW()
            WHERE id = %s AND "userId" = %s
            RETURNING *
            """,
            (design_id, user_id),
        )
        row = cur.fetchone()
        return _normalize_design_row(dict(row)) if row else None
    finally:
        cur.close()
        conn.close()


def _normalize_url(url: Optional[str]) -> Optional[str]:
    """Map image paths to reliable Cloud Run backend static endpoints with GCS streaming fallback."""
    if not url:
        return url
    base = (settings.APP_URL or "https://decox-backend-871640164960.us-central1.run.app").rstrip("/")

    # If it's already a full backend URL, keep it
    if url.startswith(base):
        return url

    # Clean legacy localhost / 127.0.0.1
    if "127.0.0.1" in url or "localhost" in url:
        if "/static/" in url:
            path = url.split("/static/")[-1]
            return f"{base}/static/{path}"

    # Route GCS URLs through Cloud Run proxy so mobile Fresco/OkHttp and regional ISPs load 100% reliably
    if "storage.googleapis.com/decox-media/" in url:
        path = url.split("storage.googleapis.com/decox-media/")[-1]
        return f"{base}/static/{path}"

    # Prefix relative /static paths
    if url.startswith("/static/"):
        return f"{base}{url}"

    return url


def _normalize_design_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize relative /static paths to public GCS URLs."""
    d = dict(row)
    for col in ("mockupImageUrl", "originalImageUrl"):
        d[col] = _normalize_url(d.get(col))
    return d


def get_public_designs(page: int = 1, limit: int = 20) -> List[Dict[str, Any]]:
    """Paginated query for public AI redesigns (Home feed AI tab)."""
    conn = _get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    offset = (page - 1) * limit
    try:
        cur.execute(
            """
            SELECT d.*, u.name as "userName"
            FROM "SpatialDesign" d
            LEFT JOIN "User" u ON d."userId" = u.id
            WHERE d."isPublic" = true
              AND (d."mockupImageUrl" IS NOT NULL OR d."originalImageUrl" IS NOT NULL)
              AND d.prompt IS NOT NULL
            ORDER BY d."createdAt" DESC
            LIMIT %s OFFSET %s
            """,
            (limit, offset),
        )
        return [_normalize_design_row(row) for row in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def get_user_designs(user_id: str) -> List[Dict[str, Any]]:
    """Fetch all designs by a user (for Profile screen)."""
    conn = _get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT * FROM "SpatialDesign"
            WHERE "userId" = %s
            ORDER BY "createdAt" DESC
            """,
            (user_id,),
        )
        return [_normalize_design_row(row) for row in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def search_all(query: str = "", category: str = "", limit: int = 30) -> List[Dict[str, Any]]:
    """
    Unified text search across SpatialDesign (AI redesigns) and PortfolioItem (artisan work).
    Returns a mixed list of results sorted by recency.
    """
    conn = _get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    results = []
    search_pattern = f"%{query}%" if query else "%"

    try:
        # Search AI redesigns
        cur.execute(
            """
            SELECT d.id, d.prompt as title, d."mockupImageUrl" as "imageUrl",
                   d."spaceType", d."stylePref", d."shoppingList",
                   d."estimatedTotalNaira", d."createdAt",
                   u.name as "userName",
                   'ai_redesign' as "pinType", true as "isAi"
            FROM "SpatialDesign" d
            LEFT JOIN "User" u ON d."userId" = u.id
            WHERE d."isPublic" = true
              AND (
                d.prompt ILIKE %s
                OR d."spaceType"::text ILIKE %s
                OR d."stylePref" ILIKE %s
              )
            ORDER BY d."createdAt" DESC
            LIMIT %s
            """,
            (search_pattern, search_pattern, search_pattern, limit),
        )
        for row in cur.fetchall():
            r = dict(row)
            r["imageUrl"] = _normalize_url(r.get("imageUrl"))
            r["category"] = r.get("stylePref", "")
            shopping = r.get("shoppingList")
            if shopping and isinstance(shopping, list) and len(shopping) > 0:
                r["hasBuyableItems"] = True
                total = r.get("estimatedTotalNaira", 0)
                r["priceDisplay"] = f"₦{total:,} Total" if total else None
            results.append(r)

        # Search artisan portfolio items
        cur.execute(
            """
            SELECT p.id, p.title, p."imageUrl", p.description,
                   p.category::text as category,
                   p."estimatedCost" as "estimatedCostNaira", p."createdAt",
                   u.name as "artisanName",
                   'artisan_craft' as "pinType", false as "isAi"
            FROM "PortfolioItem" p
            LEFT JOIN "User" u ON p."userId" = u.id
            WHERE p."isVerified" = true
              AND (
                p.title ILIKE %s
                OR p.description ILIKE %s
                OR p.category::text ILIKE %s
              )
            ORDER BY p."createdAt" DESC
            LIMIT %s
            """,
            (search_pattern, search_pattern, search_pattern, limit),
        )
        for row in cur.fetchall():
            r = dict(row)
            r["imageUrl"] = _normalize_url(r.get("imageUrl"))
            r["isAi"] = False
            results.append(r)

        # Filter by category if specified
        if category and category.lower() != "all":
            cat_lower = category.lower()
            results = [
                r for r in results
                if cat_lower in (r.get("category", "") or "").lower()
                or cat_lower in (r.get("stylePref", "") or "").lower()
                or cat_lower in (r.get("title", "") or "").lower()
            ]

        return results[:limit]
    finally:
        cur.close()
        conn.close()


# Run migrations on import
try:
    ensure_design_table()
except Exception as e:
    logger.warning(f"[DesignService] Initial migration skipped: {e}")

