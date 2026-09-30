"""Artisan portfolio upload and management service."""
import logging
import uuid
import json
import base64
from pathlib import Path
from typing import Optional, Dict, Any, List
from psycopg2.extras import RealDictCursor

from app.config import settings
from app.services.vector_service import embed_text

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "generated"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger(__name__)


def _get_conn():
    import psycopg2
    return psycopg2.connect(settings.DATABASE_URL)



def submit_artisan_work(
    user_id: str,
    image_url: str,
    title: str,
    description: str,
    category: str,
    estimated_cost_naira: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Submit artisan portfolio work directly without AI verification gating.
    """
    # Persist base64 image to GCS (artisan_portfolio)
    persisted_image_url = image_url
    if image_url.startswith("data:image") or (len(image_url) > 256 and not image_url.startswith("http")):
        try:
            mime = "image/jpeg"
            if image_url.startswith("data:image"):
                header, encoded = image_url.split(",", 1)
                mime = header.split(";")[0].split(":")[1]
                ext = "png" if "png" in mime else "jpg"
                img_data = base64.b64decode(encoded)
            else:
                img_data = base64.b64decode(image_url)
                ext = "jpg"
            file_name = f"artisan_{uuid.uuid4().hex[:12]}.{ext}"

            # 2a. Save locally as cache
            file_path = STATIC_DIR / file_name
            try:
                with open(file_path, "wb") as f:
                    f.write(img_data)
            except Exception as fs_err:
                logger.warning(f"[ArtisanUpload] Local file cache write skipped: {fs_err}")

            # 2b. Persist permanently to Google Cloud Storage
            gcs_url = f"https://storage.googleapis.com/{settings.GCS_BUCKET}/artisan_portfolio/{file_name}"
            try:
                from app.services import storage_service
                uploaded = storage_service.upload_bytes(
                    data=img_data,
                    filename=file_name,
                    content_type=mime,
                    folder="artisan_portfolio",
                )
                if uploaded:
                    gcs_url = uploaded
                logger.info(f"[ArtisanUpload] Persisted artisan image to GCS: {gcs_url}")
            except Exception as gcs_err:
                logger.error(f"[ArtisanUpload] GCS upload error: {gcs_err}")

            persisted_image_url = gcs_url
        except Exception as err:
            logger.warning(f"[ArtisanUpload] Failed saving base64 image: {err}")

    # Step 3: Generate embedding for pgvector search
    embed_text_content = f"{title} {description} {category}"
    embedding = embed_text(embed_text_content)

    conn = _get_conn()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        item_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO "PortfolioItem" (
                id, "userId", title, description, "imageUrl", category,
                "spaceType", "estimatedCost", embedding, "isVerified", "createdAt"
            ) VALUES (
                %s, %s, %s, %s, %s, %s::"WorkerCategory", 'HOME_ROOM'::"SpaceType",
                %s, %s, true, NOW()
            ) RETURNING id, "userId", title, description, "imageUrl", category,
                        "spaceType", "estimatedCost" as "estimatedCostNaira", "createdAt"
            """,
            (
                item_id, user_id, title, description, persisted_image_url,
                category, float(estimated_cost_naira) if estimated_cost_naira else None,
                str(embedding) if embedding else None,
            ),
        )
        row = dict(cur.fetchone())
        logger.info(f"[ArtisanUpload] Verified and stored: {item_id} ({title})")
        return _normalize_artisan_row(row)
    except Exception as e:
        logger.error(f"[ArtisanUpload] Storage failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()


def _normalize_artisan_row(row: Dict[str, Any]) -> Dict[str, Any]:
    d = dict(row)
    val = d.get("imageUrl")
    if not val:
        return d
    base = (settings.APP_URL or "https://decox-backend-871640164960.us-central1.run.app").rstrip("/")

    # If already a full backend URL, keep it
    if val.startswith(base):
        return d

    # Convert relative or localhost paths to Cloud Run proxy
    if "127.0.0.1" in val or "localhost" in val:
        if "/static/" in val:
            path = val.split("/static/")[-1]
            d["imageUrl"] = f"{base}/static/{path}"
            return d
    elif val.startswith("/static/"):
        d["imageUrl"] = f"{base}{val}"
        return d
    elif "storage.googleapis.com/decox-media/" in val:
        path = val.split("storage.googleapis.com/decox-media/")[-1]
        d["imageUrl"] = f"{base}/static/{path}"
        return d

    return d


def get_artisan_feed(page: int = 1, limit: int = 20) -> List[Dict[str, Any]]:
    """Paginated verified artisan work for Home feed Artisan tab."""
    conn = _get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    offset = (page - 1) * limit
    try:
        cur.execute(
            """
            SELECT p.id, p.title, p.description, p."imageUrl", p.category,
                   COALESCE(p."estimatedCost", 0) as "estimatedCostNaira", p."createdAt",
                   COALESCE(u.name, v.name, 'Adetunji Akeem') as "artisanName",
                   COALESCE(u."firebaseUid", 'JvLaoDLXBCMYqDO0SyKpeEC6HY42') as "artisanUid",
                   COALESCE(u.id, v.id) as "artisanId"
            FROM "PortfolioItem" p
            LEFT JOIN "User" u ON p."userId" = u.id
            LEFT JOIN "Vendor" v ON p."vendorId" = v.id
            WHERE p."isVerified" IS NOT FALSE
            ORDER BY p."createdAt" DESC
            LIMIT %s OFFSET %s
            """,
            (limit, offset),
        )
        return [_normalize_artisan_row(row) for row in cur.fetchall()]
    except Exception as e:
        logger.error(f"[ArtisanUpload] Feed query failed: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def ensure_portfolio_columns():
    """Ensure PortfolioItem schema compatibility."""
    conn = _get_conn()
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute("""
            ALTER TABLE "PortfolioItem"
            ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN DEFAULT true;
            ALTER TABLE "PortfolioItem"
            ALTER COLUMN "vendorId" DROP NOT NULL;
            UPDATE "PortfolioItem" SET "isVerified" = true WHERE "isVerified" IS NULL OR "isVerified" = false;
        """)
    except Exception as e:
        logger.warning(f"[ArtisanUpload] Migration note: {e}")
    finally:
        cur.close()
        conn.close()


# Run migration on import
try:
    ensure_portfolio_columns()
except Exception as e:
    logger.warning(f"[ArtisanUpload] Initial migration skipped: {e}")
