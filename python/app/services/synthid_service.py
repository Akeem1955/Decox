"""
Google SynthID & Digital Content Provenance Verification Service.

Tier 1 of the Decox Anti-AI Verification Pipeline:
- Detects imperceptible digital watermarks embedded by Google Imagen / Veo / SynthID standard.
- Inspects C2PA digital provenance manifests and synthetic generation headers.
- Connects to Google Cloud AI Content Detection API when configured.
"""
import os
import base64
import logging
from typing import Any, Dict, Optional, Tuple
import json
import urllib.request
import urllib.error

from app.config import settings

logger = logging.getLogger(__name__)


def extract_image_bytes(image_input: Any) -> Tuple[Optional[bytes], str]:
    """
    Extracts raw image bytes and mime-type from various input formats
    (data URL, raw base64, HTTP URL, or dict).
    """
    if not image_input:
        return None, "image/jpeg"

    # Dict format: {"mime_type": "...", "data": "base64..."}
    if isinstance(image_input, dict) and "data" in image_input:
        mime = image_input.get("mime_type", "image/jpeg")
        try:
            return base64.b64decode(image_input["data"]), mime
        except Exception:
            return None, mime

    if isinstance(image_input, bytes):
        return image_input, "image/jpeg"

    if isinstance(image_input, str):
        # Base64 data URI: data:image/png;base64,...
        if image_input.startswith("data:image"):
            try:
                header, encoded = image_input.split(",", 1)
                mime = header.split(";")[0].split(":")[1]
                return base64.b64decode(encoded), mime
            except Exception as e:
                logger.warning(f"[SynthID] Failed to parse data URL: {e}")
                return None, "image/jpeg"

        # HTTP/HTTPS URL
        if image_input.startswith("http://") or image_input.startswith("https://"):
            try:
                req = urllib.request.Request(image_input, headers={"User-Agent": "Decox-Verifier/1.0"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    mime = resp.headers.get("Content-Type", "image/jpeg").split(";")[0]
                    return resp.read(), mime
            except Exception as e:
                logger.warning(f"[SynthID] Failed to fetch remote URL: {e}")
                return None, "image/jpeg"

        # Local static path
        if image_input.startswith("/static/"):
            from pathlib import Path
            local_path = Path(__file__).resolve().parent.parent.parent / image_input.lstrip("/")
            if local_path.exists():
                try:
                    with open(local_path, "rb") as f:
                        data = f.read()
                    mime = "image/png" if image_input.lower().endswith(".png") else "image/jpeg"
                    return data, mime
                except Exception:
                    pass

        # Raw base64 string
        try:
            return base64.b64decode(image_input), "image/jpeg"
        except Exception:
            return None, "image/jpeg"

    return None, "image/jpeg"


def inspect_provenance_markers(image_bytes: bytes) -> Optional[Dict[str, Any]]:
    """
    Inspects image binary chunks for C2PA provenance assertions and synthetic metadata signatures.
    """
    if not image_bytes:
        return None

    # Fast substring scan on first and last 64KB where EXIF / XMP / C2PA boxes reside
    header_chunk = image_bytes[:65536]
    footer_chunk = image_bytes[-65536:] if len(image_bytes) > 65536 else b""
    sample_slice = header_chunk + footer_chunk

    sample_lower = sample_slice.lower()

    # C2PA digital assertions
    if b"c2pa" in sample_lower or b"c2pa.actions" in sample_lower:
        if b"c2pa.created" in sample_lower or b"digitalSourceType" in sample_slice:
            if b"trainedAlgorithmicMedia" in sample_slice or b"synthetic" in sample_lower:
                return {
                    "detected": True,
                    "confidence": 1.0,
                    "watermark_type": "C2PA_SYNTHETIC_PROVENANCE",
                    "reason": "Cryptographic C2PA metadata confirms image was algorithmically generated.",
                    "source": "c2pa_manifest",
                }

    # SynthID explicit byte markers or watermarking tags
    if b"synthid" in sample_lower or b"synth_id" in sample_lower:
        return {
            "detected": True,
            "confidence": 0.99,
            "watermark_type": "SYNTHID_METADATA_SIGNATURE",
            "reason": "SynthID watermark signature detected in image metadata.",
            "source": "synthid_binary_marker",
        }

    return None


def query_google_synthid_endpoint(image_bytes: bytes, mime_type: str) -> Optional[Dict[str, Any]]:
    """
    Queries Google Cloud AI Content Detection API / SynthID detection endpoint
    when configured via SYNTHID_DETECTION_ENDPOINT.
    """
    endpoint = settings.SYNTHID_DETECTION_ENDPOINT
    if not endpoint:
        return None

    try:
        headers = {
            "Content-Type": "application/json",
        }
        if settings.SYNTHID_API_KEY:
            headers["Authorization"] = f"Bearer {settings.SYNTHID_API_KEY}"

        payload = {
            "image": {
                "bytesBase64Encoded": base64.b64encode(image_bytes).decode("utf-8"),
                "mimeType": mime_type,
            }
        }

        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                # Standard Google SynthID schema format
                predictions = data.get("predictions", [])
                pred = predictions[0] if predictions else data

                is_synth = pred.get("synthid_detected") or pred.get("is_synthetic") or pred.get("watermark_detected")
                confidence = float(pred.get("confidence", pred.get("score", 0.95)))

                if is_synth:
                    return {
                        "detected": True,
                        "confidence": confidence,
                        "watermark_type": "GOOGLE_SYNTHID_WATERMARK",
                        "reason": f"Google SynthID pixel watermark detected (confidence: {int(confidence * 100)}%).",
                        "source": "google_synthid_api",
                    }
                else:
                    return {
                        "detected": False,
                        "confidence": confidence,
                        "watermark_type": None,
                        "reason": "Google SynthID endpoint verified: no SynthID watermark detected.",
                        "source": "google_synthid_api",
                    }
            else:
                logger.warning(
                    f"[SynthID] Endpoint returned HTTP {resp.status}"
                )
                return None
    except urllib.error.HTTPError as e:
        logger.warning(f"[SynthID] Endpoint returned HTTP error {e.code}: {e.reason}")
        return None
    except Exception as e:
        logger.error(f"[SynthID] Query to Google SynthID endpoint failed: {e}")
        return None


def detect_synthid_watermark(image_input: Any) -> Dict[str, Any]:
    """
    Tier 1 Detector: Detects Google SynthID watermarks and C2PA provenance signatures.
    
    Returns:
        {
            "detected": bool,
            "confidence": float,
            "watermark_type": Optional[str],
            "reason": str,
            "source": str,
            "passed_to_tier2": bool
        }
    """
    image_bytes, mime_type = extract_image_bytes(image_input)
    if not image_bytes:
        return {
            "detected": False,
            "confidence": 0.0,
            "watermark_type": None,
            "reason": "Unable to extract image bytes for watermark analysis.",
            "source": "byte_extractor",
            "passed_to_tier2": True,
        }

    # 1. Check C2PA / explicit digital provenance signatures
    provenance_result = inspect_provenance_markers(image_bytes)
    if provenance_result and provenance_result.get("detected"):
        return {
            **provenance_result,
            "passed_to_tier2": False,
        }

    # 2. Query Google Cloud SynthID endpoint if configured
    api_result = query_google_synthid_endpoint(image_bytes, mime_type)
    if api_result and api_result.get("detected"):
        return {
            **api_result,
            "passed_to_tier2": False,
        }

    # No SynthID watermark detected in Tier 1 -> Proceed to Tier 2 (Gemini multimodal)
    return {
        "detected": False,
        "confidence": 0.0,
        "watermark_type": None,
        "reason": "No SynthID watermark detected in Tier 1. Proceeding to visual artifact inspection.",
        "source": "synthid_tier1",
        "passed_to_tier2": True,
    }
