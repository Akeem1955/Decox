import re
import json
import logging
from typing import Dict, Any, Optional, List
from google import genai
from google.genai import types
from app.config import settings
from app.services.compositor_service import parse_image_to_part

logger = logging.getLogger(__name__)

def get_gemini_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured in settings.")
    return genai.Client(api_key=settings.GEMINI_API_KEY)

def extract_first_url(text: str) -> Optional[str]:
    """Extracts first HTTP/HTTPS URL from user prompt if present."""
    match = re.search(r'https?://[^\s<>"]+|www\.[^\s<>"]+', text)
    if match:
        url = match.group(0)
        if url.startswith("www."):
            url = "https://" + url
        return url
    return None

def analyze_room_intent(user_prompt: str, room_image: Optional[Any] = None) -> Dict[str, Any]:
    """
    Multimodally analyzes room image and user prompt using Gemini 3.8 Flash.
    Determines execution route across the 6 architectural routes:
    - 'COMMERCE_DIY': Loose store furniture & decor
    - 'ARTISAN_FINISH': Hard surface craftsmanship & installations
    - 'HYBRID': Both surface finishes AND retail furniture
    - 'CUSTOM_URL': Staging a specific product from an external link
    - 'DECLUTTER': Spatial restaging, organizing, and clutter elimination
    - 'INSPECTION_REPAIR': Physical defect diagnosis & maintenance remediation
    """
    client = get_gemini_client()
    contents = []

    room_part = parse_image_to_part(room_image) if room_image else None
    if room_part:
        contents.append(room_part)

    prompt_text = user_prompt.strip() if user_prompt else "Analyze space and recommend optimal restyling"
    contents.append(prompt_text)

    detected_url = extract_first_url(prompt_text)

    system_instruction = (
        "You are Decox's expert interior architect, spatial diagnostic, and staging AI.\n"
        "Analyze the user's room image (if provided) and text prompt.\n"
        "Classify the request into EXACTLY ONE of the following 6 routes:\n"
        "1. 'COMMERCE_DIY': Loose purchasable manufactured items, furniture, lighting, rugs, or decor (interior or exterior).\n"
        "2. 'ARTISAN_FINISH': Fixed architectural surface work requiring a master craftsman (e.g. floor tiling, marble, fluted wood slats, microcement, masonry, interlocking compound pavers, screeding).\n"
        "3. 'HYBRID': Projects combining BOTH surface finishes (e.g. wood slat wall or new floor tiles) AND loose store items (e.g. armchair, rug, lamp).\n"
        "4. 'CUSTOM_URL': User provided a specific external product/item URL to inpaint into the space.\n"
        "5. 'DECLUTTER': User wants to clean up, remove clutter/mess, organize space, or reset room geometry without purchasing new items.\n"
        "6. 'INSPECTION_REPAIR': User reported or photo shows physical damage (cracks, dampness/water leakage, peeling screed, broken tiles/pipes, structural damage) needing maintenance remediation.\n\n"
        "CRITICAL REQUIREMENT FOR COMMERCE_DIY / HYBRID:\n"
        "Identify an explicit list of the top 3-4 primary focal physical items needed to stage this space in 'target_items' (e.g. key furniture, essential equipment, primary seating/table). Limit to at most 4 items.\n\n"
        "Return ONLY a valid JSON object matching this schema:\n"
        "{\n"
        '  "route": "COMMERCE_DIY" | "ARTISAN_FINISH" | "HYBRID" | "CUSTOM_URL" | "DECLUTTER" | "INSPECTION_REPAIR",\n'
        '  "space_context": "INTERIOR" | "EXTERIOR",\n'
        '  "suggested_category": "FURNITURE_CARPENTRY" | "GENERAL_MASONRY" | "PAINTING_FINISHING" | "LANDSCAPING_OUTDOOR" | "PLUMBING" | "ELECTRICAL",\n'
        '  "target_items": ["Item 1", "Item 2", "Item 3", "..."],\n'
        '  "search_query": "concise targeted search query for retail store or artisan vector index",\n'
        '  "source_url": "extracted URL or null",\n'
        '  "specs": {\n'
        '    "title": "short punchy spatial concept title",\n'
        '    "style": "e.g. Japandi Minimalist, Contemporary Afro-Modern, Industrial Luxury, Structural Remediation",\n'
        '    "materials": ["Material 1", "Material 2", "Material 3"],\n'
        '    "room_analysis": "1-2 sentence assessment of lighting, geometry, and structural conditions",\n'
        '    "summary": "brief 2-sentence rationale for the suggested route"\n'
        '  },\n'
        '  "defect_detected": {\n'
        '    "type": "e.g. Capillary Dampness / Structural Wall Fracture / Cracked Porcelain Grout (or null)",\n'
        '    "severity": "LOW" | "MEDIUM" | "CRITICAL" (or null),\n'
        '    "remediation": "Recommended technical trade solution (or null)"\n'
        '  },\n'
        '  "declutter_actions": ["Action 1", "Action 2"] (or empty list)\n'
        "}"
    )

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contents,
            config={
                "response_mime_type": "application/json",
                "system_instruction": system_instruction,
                "temperature": 0.2
            }
        )
    except Exception as e:
        logger.error(f"[GeminiService] Gemini API call failed: {e}")
        raise RuntimeError(f"Room intent analysis failed: {e}")

    if not response.text:
        raise RuntimeError("Gemini returned an empty response for intent analysis.")

    try:
        parsed = json.loads(response.text)
    except json.JSONDecodeError as e:
        logger.error(f"[GeminiService] Failed to parse JSON response: {response.text}")
        raise RuntimeError(f"Invalid JSON from intent analyzer: {e}")

    route = parsed.get("route", "COMMERCE_DIY")
    # If a URL was explicitly found in prompt and route wasn't set, prefer CUSTOM_URL
    if detected_url and route == "COMMERCE_DIY":
        route = "CUSTOM_URL"

    category = parsed.get("suggested_category", "FURNITURE_CARPENTRY")
    search_query = parsed.get("search_query") or user_prompt
    specs = parsed.get("specs", {})
    source_url = parsed.get("source_url") or detected_url
    defect_detected = parsed.get("defect_detected")
    declutter_actions = parsed.get("declutter_actions", [])

    logger.info(f"[GeminiService] Intent classified: route={route}, category={category}, query='{search_query}'")

    return {
        "route": route,
        "suggested_category": category,
        "target_items": parsed.get("target_items", []),
        "space_context": parsed.get("space_context", "INTERIOR"),
        "search_query": search_query,
        "source_url": source_url,
        "specs": specs,
        "defect_detected": defect_detected,
        "declutter_actions": declutter_actions
    }
