import os
import uuid
import base64
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
import urllib.request
import urllib.error
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

from app.config import settings

logger = logging.getLogger(__name__)

# Ensure static/generated directory exists
STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "generated"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

def get_gemini_client():
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured in settings.")
    if genai is None:
        raise ImportError("google-genai package is not installed.")
    return genai.Client(api_key=settings.GEMINI_API_KEY)

def parse_image_to_part(image_input: Any):
    """
    Parses an image input (base64 data URL, base64 dict, raw bytes, or HTTP URL)
    into a google.genai types.Part object.
    """
    if not image_input or types is None:
        return None

    # Dict format: {"mime_type": "...", "data": "base64..."}
    if isinstance(image_input, dict) and "data" in image_input:
        mime = image_input.get("mime_type", "image/jpeg")
        data_bytes = base64.b64decode(image_input["data"])
        return types.Part.from_bytes(data=data_bytes, mime_type=mime)

    # String input
    if isinstance(image_input, str):
        image_str = image_input.strip()

        # Base64 data URL: data:image/jpeg;base64,...
        if image_str.startswith("data:image"):
            try:
                header, encoded = image_str.split(",", 1)
                mime = header.split(";")[0].split(":")[1]
                data_bytes = base64.b64decode(encoded)
                logger.info(f"[CompositorService] Parsed data URL ({len(data_bytes)} bytes, {mime})")
                return types.Part.from_bytes(data=data_bytes, mime_type=mime)
            except Exception as e:
                logger.warning(f"[CompositorService] Failed parsing data URL: {e}")
                return None

        # Local static path
        if image_str.startswith("/static/"):
            local_path = Path(__file__).resolve().parent.parent.parent / image_str.lstrip("/")
            if local_path.exists():
                try:
                    with open(local_path, "rb") as f:
                        content = f.read()
                    mime = "image/png" if image_str.lower().endswith(".png") else "image/jpeg"
                    return types.Part.from_bytes(data=content, mime_type=mime)
                except Exception as e:
                    logger.warning(f"[CompositorService] Failed reading local static path: {e}")

        # HTTP / HTTPS URL
        if image_str.startswith("http://") or image_str.startswith("https://"):
            try:
                req = urllib.request.Request(image_str, headers={"User-Agent": "Decox-Verifier/1.0"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status == 200:
                        content = resp.read()
                        mime = resp.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
                        return types.Part.from_bytes(data=content, mime_type=mime)
            except Exception as e:
                logger.warning(f"[CompositorService] Failed downloading image URL {image_str}: {e}")
                return None

        # Pure base64 string
        try:
            data_bytes = base64.b64decode(image_str)
            if len(data_bytes) > 200:
                logger.info(f"[CompositorService] Parsed raw base64 string ({len(data_bytes)} bytes)")
                return types.Part.from_bytes(data=data_bytes, mime_type="image/jpeg")
        except Exception:
            pass

        logger.warning(f"[CompositorService] Could not parse image_input (prefix: {image_str[:50]}...)")

    return None

def composite_spatial_staging(
    room_image: Any,
    asset_images: Optional[List[Any]] = None,
    asset_image: Optional[Any] = None,  # Backward compatibility single-image
    prompt: str = "Modern space restyling",
    space_context: str = "interior"
) -> Dict[str, Any]:
    """
    Executes dynamic multimodal spatial inpainting and compositing using gemini-3.1-flash-image.
    STRICT 'REAL OR FAIL' GUARANTEE:
    If zero product asset images are provided, aborts immediately.
    Never hallucinates unprovided items. Uses decorator placement mode.
    """
    client = get_gemini_client()
    contents = []

    room_part = parse_image_to_part(room_image)
    if not room_part:
        raise ValueError("Room image is required for spatial staging.")
    contents.append(room_part)

    # Collect all provided product asset images
    collected_assets = []
    if asset_images:
        collected_assets.extend(asset_images)
    if asset_image and asset_image not in collected_assets:
        collected_assets.append(asset_image)

    asset_parts = []
    for asset in collected_assets:
        part = parse_image_to_part(asset)
        if part:
            asset_parts.append(part)
            contents.append(part)

    # STRICT GROUNDED COMMERCE MANDATE (Zero Synthetic Hallucination)
    # If no verified retailer product photos are provided, abort staging immediately.
    if not asset_parts:
        logger.error("[CompositorService] REAL_OR_FAIL_ABORT: Zero verified product photos provided.")
        raise RuntimeError(
            "REAL_OR_FAIL_ABORT: Insufficient verified product photos from retailers (0 items had verified images). "
            "Staging rejected to prevent synthetic hallucination. No image, no design."
        )

    # Clean spatial compositing prompt — strictly preserves room architecture without hallucinating fantasy decor
    compositing_prompt = (
        "You are an expert spatial compositor.\n"
        f"Design Concept: {prompt}.\n\n"
        "STRICT GROUNDING & COMPOSITING RULES:\n"
        "1. Faithful Asset Placement: Image 1 is the user's authentic empty room. The subsequent images are verified physical product assets. "
        "Realistically composite and inpaint the exact provided physical items into the room.\n"
        "2. Preserve Original Room Architecture: Do NOT alter, add, or reconstruct the room's walls, windows, doors, structural boundaries, or ceiling. "
        "Do NOT add built-in shelving, wall cabinets, unrequested wall art, or fake decor. Leave all structural surfaces completely intact.\n"
        "3. Perspective, Lighting & Scale: Seamlessly ground each item onto the floor plane with accurate spatial scale, natural perspective alignment, "
        "and realistic ambient contact drop shadows cast by the window lighting.\n"
        "4. Absolute Prohibition on Logos: Under NO circumstances render store logos, app badges, watermarks, or UI icons as room decor.\n"
        "Output the final photorealistic staged room."
    )
    contents.append(compositing_prompt)

    logger.info(f"[CompositorService] Calling gemini-3.1-flash-image (parts: {len(contents)})")
    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-image",
            contents=contents
        )
    except Exception as e:
        logger.error(f"[CompositorService] gemini-3.1-flash-image API error: {e}")
        raise RuntimeError(f"Visual staging generation failed: {e}")

    # Extract image bytes
    if not response.candidates or not response.candidates[0].content or not response.candidates[0].content.parts:
        raise RuntimeError("gemini-3.1-flash-image returned an empty response candidate.")

    image_bytes: Optional[bytes] = None
    mime_type = "image/jpeg"

    for part in response.candidates[0].content.parts:
        if hasattr(part, "inline_data") and part.inline_data and part.inline_data.data:
            image_bytes = part.inline_data.data
            mime_type = getattr(part.inline_data, "mime_type", "image/jpeg")
            break

    if not image_bytes:
        raise RuntimeError("gemini-3.1-flash-image did not produce inline image data.")

    # Save to disk
    file_id = str(uuid.uuid4())
    ext = "png" if "png" in mime_type else "jpg"
    file_name = f"{file_id}.{ext}"
    file_path = STATIC_DIR / file_name

    try:
        with open(file_path, "wb") as f:
            f.write(image_bytes)
    except Exception as fs_err:
        logger.warning(f"[CompositorService] Local disk write skipped: {fs_err}")

    # Persist to Google Cloud Storage (decox-media/generated)
    gcs_url = f"https://storage.googleapis.com/{settings.GCS_BUCKET}/generated/{file_name}"
    try:
        from app.services import storage_service
        uploaded_url = storage_service.upload_bytes(
            data=image_bytes,
            filename=file_name,
            content_type=mime_type,
            folder="generated",
        )
        if uploaded_url:
            gcs_url = uploaded_url
        logger.info(f"[CompositorService] Staged visual persisted to GCS: {gcs_url}")
    except Exception as gcs_err:
        logger.error(f"[CompositorService] Failed uploading to GCS bucket: {gcs_err}")

    base64_data = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{base64_data}"
    web_url = gcs_url

    logger.info(f"[CompositorService] Saved staged visual ({len(image_bytes)} bytes): {web_url}")

    return {
        "file_name": file_name,
        "file_path": str(file_path),
        "web_url": web_url,
        "gcs_url": gcs_url,
        "data_url": data_url,
        "bytes_len": len(image_bytes)
    }
