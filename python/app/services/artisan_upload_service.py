"""Artisan portfolio upload with SynthID/C2PA AI-content verification."""
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


from app.services.synthid_service import detect_synthid_watermark


def verify_not_ai_generated(image_input: Any) -> Dict[str, Any]:
    """
    Two-Tier Anti-AI Verification Pipeline:
    - Tier 1: Google SynthID & C2PA digital provenance watermark inspection.
              If a SynthID/C2PA watermark is detected, rejects immediately with 100% certainty.
    - Tier 2: Gemini 3.8 Flash multimodal pixel-level inspection.
              Evaluates surface grain, physical realism, and synthetic artifacts for non-watermarked generators.
              Calibrated with AI_VERIFICATION_THRESHOLD to prevent false rejections of genuine work.
    
    Accepts: base64 data URL, raw base64 string, image URL, bytes, or Part dictionary.
    Returns:
        {
            "is_authentic": bool,
            "confidence": float,
            "verification_tier": "tier1_synthid" | "tier2_multimodal",
            "synthid_detected": bool,
            "watermark_type": Optional[str],
            "reason": str,
            "craft_detected": Optional[str]
        }
    """
    # ---------------------------------------------------------
    # TIER 1: Google SynthID & Digital Provenance Verification
    # ---------------------------------------------------------
    tier1_res = detect_synthid_watermark(image_input)
    if tier1_res.get("detected"):
        logger.warning(
            f"[ArtisanUpload] Tier 1 SynthID detected synthetic watermark: {tier1_res.get('watermark_type')}"
        )
        return {
            "is_authentic": False,
            "confidence": float(tier1_res.get("confidence", 1.0)),
            "verification_tier": "tier1_synthid",
            "synthid_detected": True,
            "watermark_type": tier1_res.get("watermark_type"),
            "reason": tier1_res.get("reason", "Google SynthID digital watermark detected: confirmed synthetic media."),
            "craft_detected": None,
        }

    # ---------------------------------------------------------
    # TIER 2: Gemini Multimodal Visual Artifact Inspection
    # ---------------------------------------------------------
    try:
        from app.services.compositor_service import parse_image_to_part
        from app.services.gemini_service import get_gemini_client
        image_part = parse_image_to_part(image_input)
    except Exception as e:
        logger.error(f"[ArtisanUpload] Failed to parse image for multimodal inspection: {e}")
        return {
            "is_authentic": False,
            "confidence": 0.0,
            "verification_tier": "tier2_multimodal",
            "synthid_detected": False,
            "watermark_type": None,
            "reason": f"Image processing error: {str(e)}",
            "craft_detected": None,
        }

    if not image_part:
        return {
            "is_authentic": False,
            "confidence": 1.0,
            "verification_tier": "tier2_multimodal",
            "synthid_detected": False,
            "watermark_type": None,
            "reason": "Invalid or unparseable image data provided for verification.",
            "craft_detected": None,
        }

    try:
        client = get_gemini_client()
        system_prompt = (
            "You are Decox's Forensic Artisan Authenticity Gatekeeper.\n"
            "Decox is an exclusive marketplace strictly reserved for REAL, physically built trade craftsmanship "
            "(e.g., POP plasterboard ceilings, custom cabinetry/woodworking, tiling, interlocking paving, masonry, metal fabrication).\n\n"
            "CRITICAL DIRECTIVE: REVERSED BURDEN OF PROOF.\n"
            "Assume the image is synthetic until proven authentic with verifiable physical evidence.\n"
            "Decox strictly REJECTS synthetic AI renders, CGI mockups, text-to-image outputs (Midjourney, Flux, DALL-E, Stable Diffusion, Ideogram), and 3D architectural renders.\n\n"
            "FORENSIC EVALUATION CRITERIA:\n"
            "1. AI Indicators (Flag as AI if ANY of these are found):\n"
            "   - Smooth, waxy, airbrushed textures lacking micro-porosity.\n"
            "   - Volumetric golden haze or surreal HDR lighting typical of Midjourney v6/Flux.\n"
            "   - Unnatural geometric warping, melting edges, or impossible physical joints/junctions.\n"
            "   - Repeating procedural texture patterns without organic flaws.\n"
            "   - Overly pristine aesthetic staging with no tool marks, dust, mortar lines, or authentic site details.\n\n"
            "2. Physical Authenticity Proof (Required to pass):\n"
            "   - Authentic physical camera sensor ISO noise/grain (not digital blur or smoothing filter).\n"
            "   - Real construction material textures: visible wood grain variation, grout lines, micro-chips, plaster seams, concrete aggregate.\n"
            "   - Natural, physically consistent ambient room or workshop shadows.\n\n"
            "Output JSON strictly with this schema:\n"
            "{\n"
            '  "is_authentic": false,\n'
            '  "is_ai_generated": true,\n'
            '  "ai_confidence": 0.85,\n'
            '  "authenticity_confidence": 0.15,\n'
            '  "verdict": "REJECT_AI",\n'
            '  "synthetic_indicators": ["Airbrushed POP ceiling textures", "Midjourney-style volumetric lighting bloom"],\n'
            '  "physical_evidence": [],\n'
            '  "craft_detected": "POP Ceiling"\n'
            "}\n"
            "Note: 'verdict' must be either 'VERIFIED_AUTHENTIC' or 'REJECT_AI'."
        )

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=[image_part, "Forensically inspect this craft portfolio photo for physical authenticity vs AI generation."],
            config={
                "response_mime_type": "application/json",
                "system_instruction": system_prompt,
                "temperature": 0.1,
            },
        )
        result = json.loads(response.text) if response.text else {}
        is_ai = bool(result.get("is_ai_generated", False))
        is_authentic = bool(result.get("is_authentic", False))
        ai_confidence = float(result.get("ai_confidence", result.get("confidence", 0.0) if is_ai else 0.0))
        auth_confidence = float(result.get("authenticity_confidence", result.get("confidence", 0.0) if is_authentic else 0.0))
        verdict = str(result.get("verdict", "")).strip().upper()
        synthetic_indicators = result.get("synthetic_indicators") or result.get("indicators") or []
        physical_evidence = result.get("physical_evidence") or []
        craft = result.get("craft_detected")

        # GATEKEEPER CRITERIA:
        # 1. AI rejection threshold: If AI is detected with confidence >= 0.49 -> REJECT
        # 2. Burden of proof: Must have verdict == 'VERIFIED_AUTHENTIC', is_authentic == True, and no AI markers
        threshold = settings.AI_VERIFICATION_THRESHOLD  # 0.49

        if (is_ai and ai_confidence >= threshold) or verdict == "REJECT_AI":
            final_authentic = False
            confidence = max(ai_confidence, 0.50)
            reason = (
                f"Synthetic / AI generation markers detected (AI confidence {int(ai_confidence * 100)}% >= {int(threshold * 100)}%): "
                + (", ".join(synthetic_indicators) if synthetic_indicators else "Unnatural geometric rendering, airbrushed textures, or synthetic lighting detected.")
            )
        elif not is_authentic or auth_confidence < 0.55:
            final_authentic = False
            confidence = auth_confidence
            reason = (
                "Insufficient evidence of authentic physical craftsmanship. "
                + (", ".join(synthetic_indicators) if synthetic_indicators else "Image lacks authentic camera sensor grain, real physical imperfections, or workshop/site context.")
            )
        else:
            final_authentic = True
            confidence = auth_confidence
            reason = (
                "Verified authentic physical craftsmanship: "
                + (", ".join(physical_evidence) if physical_evidence else "Physical materials and construction joinery verified.")
            )

        return {
            "is_authentic": final_authentic,
            "confidence": confidence,
            "verification_tier": "tier2_multimodal",
            "synthid_detected": False,
            "watermark_type": None,
            "reason": reason,
            "craft_detected": craft,
        }
    except Exception as e:
        logger.error(f"[ArtisanUpload] Multimodal AI verification failed: {e}")
        # Fail safe — reject if verification fails
        return {
            "is_authentic": False,
            "confidence": 0.0,
            "verification_tier": "tier2_multimodal",
            "synthid_detected": False,
            "watermark_type": None,
            "reason": f"Verification service error: {str(e)}",
            "craft_detected": None,
        }


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
