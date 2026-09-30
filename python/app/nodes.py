import re
import json
import logging
from typing import Dict, Any, List, Optional
from app.state import RoomDesignState
from app.services.gemini_service import analyze_room_intent, get_gemini_client, extract_first_url
from app.services.parallel_service import search_retail_products, scrape_custom_product_url
from app.services.vector_service import search_artisan_pins
from app.services.compositor_service import composite_spatial_staging, parse_image_to_part
from app.config import settings

logger = logging.getLogger(__name__)

# ============================================================================
# NODE 1: INTENT CLASSIFICATION
# ============================================================================
def classify_intent_node(state: RoomDesignState) -> Dict[str, Any]:
    """Node 1: Multimodal Intent & Target Classification via Gemini 3.8 Flash."""
    prompt = state.get("user_prompt", "")
    room_img = state.get("room_image")

    logger.info(f"[LangGraph:Node 1] Classifying intent for prompt: '{prompt}'")
    try:
        intent_data = analyze_room_intent(prompt, room_img)
        return {
            "route": intent_data["route"],
            "suggested_category": intent_data["suggested_category"],
            "target_items": intent_data.get("target_items", []),
            "search_query": intent_data.get("search_query") or prompt,
            "source_url": intent_data.get("source_url"),
            "specs": intent_data.get("specs", {}),
            "inspection_report": intent_data.get("defect_detected"),
            "declutter_plan": {"actions": intent_data.get("declutter_actions", [])},
            "status": "CLASSIFIED"
        }
    except Exception as e:
        logger.error(f"[LangGraph:Node 1] Intent classification failed: {e}")
        return {
            "route": "COMMERCE_DIY",
            "suggested_category": "FURNITURE_CARPENTRY",
            "target_items": [],
            "search_query": prompt,
            "specs": {"title": "Space Staging", "style": "Contemporary", "materials": []},
            "error": f"INTENT_ANALYSIS_FAILED: {str(e)}",
            "status": "ERROR"
        }

# ============================================================================
# NODE 2A: ROUTE 1 - STORE RETAIL (PARALLEL API)
# ============================================================================
def source_parallel_store_node(state: RoomDesignState) -> Dict[str, Any]:
    """Node 2A: Parallel API Deep Retail Sourcing on Nigerian Marketplaces."""
    if state.get("error"):
        return {"status": "SKIPPED"}

    query = state.get("search_query") or state.get("user_prompt", "living room furniture")
    pref_store = state.get("preferred_store")
    target_items = state.get("target_items")
    logger.info(f"[LangGraph:Node 2A] Parallel API sourcing for query: '{query}' (items={target_items}, store={pref_store})")

    try:
        products = search_retail_products(
            query=query,
            limit=15,
            preferred_store=pref_store,
            target_items=target_items
        )
        if not products:
            logger.warning(f"[LangGraph:Node 2A] No live products found for '{query}'")
            return {
                "shopping_list": [],
                "estimated_total_naira": 0,
                "error": "STORE_NOT_FOUND",
                "status": "STORE_EMPTY"
            }

        known_prices = [p["price_naira"] for p in products if p.get("price_naira") is not None]
        total_naira = sum(known_prices) if known_prices else 0
        return {
            "shopping_list": products,
            "estimated_total_naira": total_naira,
            "status": "STORE_SOURCED"
        }
    except Exception as e:
        logger.error(f"[LangGraph:Node 2A] Parallel sourcing failed: {e}")
        return {
            "shopping_list": [],
            "estimated_total_naira": 0,
            "error": f"PARALLEL_API_FAILED: {str(e)}",
            "status": "ERROR"
        }

# ============================================================================
# NODE 2B: ROUTE 2 - ARTISAN FINISH (CLOUD SQL PGVECTOR)
# ============================================================================
def source_pgvector_artisan_node(state: RoomDesignState) -> Dict[str, Any]:
    """Node 2B: Cloud SQL pgvector Semantic Cosine Search for Master Artisans."""
    if state.get("error"):
        return {"status": "SKIPPED"}

    query = state.get("search_query") or state.get("user_prompt", "artisan craft")
    category = state.get("suggested_category")
    logger.info(f"[LangGraph:Node 2B] pgvector search for: '{query}' (category={category})")

    try:
        matches = search_artisan_pins(query=query, limit=3, threshold=0.40, category=category)
        if not matches:
            matches = search_artisan_pins(query=query, limit=3, threshold=0.40, category=None)

        if not matches:
            logger.warning(f"[LangGraph:Node 2B] No artisan pin matched query: '{query}'")
            return {
                "matched_artisan": None,
                "estimated_total_naira": 0,
                "error": "ARTISAN_NOT_FOUND",
                "status": "ARTISAN_EMPTY"
            }

        top_artisan = matches[0]
        labor_cost = top_artisan.get("estimated_cost_naira", 85000)
        return {
            "matched_artisan": top_artisan,
            "estimated_total_naira": labor_cost,
            "status": "ARTISAN_MATCHED"
        }
    except Exception as e:
        logger.error(f"[LangGraph:Node 2B] pgvector artisan search failed: {e}")
        return {
            "matched_artisan": None,
            "estimated_total_naira": 0,
            "error": f"PGVECTOR_SEARCH_FAILED: {str(e)}",
            "status": "ERROR"
        }

# ============================================================================
# NODE 2C: ROUTE 3 - HYBRID COMPOSITE SOURCING
# ============================================================================
def source_hybrid_node(state: RoomDesignState) -> Dict[str, Any]:
    """Node 2C: Combines Parallel API Retail Sourcing AND pgvector Artisan Matching."""
    if state.get("error"):
        return {"status": "SKIPPED"}

    query = state.get("search_query") or state.get("user_prompt", "")
    category = state.get("suggested_category")
    logger.info(f"[LangGraph:Node 2C] Executing Hybrid Sourcing for: '{query}'")

    # 1. Source retail furniture items
    pref_store = state.get("preferred_store")
    furniture_query = f"{query} furniture store online Nigeria"
    try:
        products = search_retail_products(query=furniture_query, limit=15, preferred_store=pref_store)
    except Exception as e:
        logger.warning(f"[LangGraph:Node 2C] Retail search failed in hybrid: {e}")
        products = []

    # 2. Source master craftsman for surface finish
    try:
        matches = search_artisan_pins(query=query, limit=2, threshold=0.38, category=category)
        if not matches:
            matches = search_artisan_pins(query=query, limit=2, threshold=0.38, category=None)
        artisan = matches[0] if matches else None
    except Exception as e:
        logger.warning(f"[LangGraph:Node 2C] Artisan search failed in hybrid: {e}")
        artisan = None

    if not products and not artisan:
        return {
            "shopping_list": [],
            "matched_artisan": None,
            "estimated_total_naira": 0,
            "error": "HYBRID_SOURCING_FAILED",
            "status": "ERROR"
        }

    known_retail = [p["price_naira"] for p in products if p.get("price_naira") is not None]
    retail_total = sum(known_retail) if known_retail else 0
    artisan_labor = artisan.get("estimated_cost_naira", 0) if artisan else 0
    total_naira = retail_total + artisan_labor

    return {
        "shopping_list": products,
        "matched_artisan": artisan,
        "estimated_total_naira": total_naira,
        "status": "HYBRID_SOURCED"
    }

# ============================================================================
# NODE 2D: ROUTE 4 - CUSTOM PRODUCT URL SOURCING
# ============================================================================
def source_custom_url_node(state: RoomDesignState) -> Dict[str, Any]:
    """Node 2D: Extracts specific product details from user-provided external link."""
    if state.get("error"):
        return {"status": "SKIPPED"}

    url = state.get("source_url") or extract_first_url(state.get("user_prompt", ""))
    if not url:
        return {
            "scraped_item": None,
            "error": "MISSING_PRODUCT_URL",
            "status": "ERROR"
        }

    logger.info(f"[LangGraph:Node 2D] Sourcing custom URL: {url}")
    try:
        item = scrape_custom_product_url(url)
        return {
            "source_url": url,
            "scraped_item": item,
            "estimated_total_naira": item.get("price_naira", 75000),
            "status": "CUSTOM_URL_SOURCED"
        }
    except Exception as e:
        logger.error(f"[LangGraph:Node 2D] Failed scraping custom URL: {e}")
        return {
            "scraped_item": None,
            "error": f"SCRAPE_URL_FAILED: {str(e)}",
            "status": "ERROR"
        }

# ============================================================================
# NODE 2E: ROUTE 5 - SPATIAL DECLUTTERING & RESTAGING
# ============================================================================
def source_declutter_node(state: RoomDesignState) -> Dict[str, Any]:
    """Node 2E: Generates architectural decluttering and layout optimization plan."""
    if state.get("error"):
        return {"status": "SKIPPED"}

    prompt = state.get("user_prompt", "")
    room_img = state.get("room_image")
    logger.info(f"[LangGraph:Node 2E] Formulating spatial declutter plan")

    client = get_gemini_client()
    contents = []
    room_part = parse_image_to_part(room_img) if room_img else None
    if room_part:
        contents.append(room_part)
    contents.append(
        f"Analyze this room for spatial decluttering and aesthetic reset. Request: {prompt}.\n"
        "Provide a concrete 3-step action plan in JSON:\n"
        "{\n"
        '  "clutter_items_to_remove": ["Item 1", "Item 2"],\n'
        '  "spatial_flow_improvements": ["Tip 1", "Tip 2"],\n'
        '  "lighting_adjustments": "Guidance on natural light path clearing"\n'
        "}"
    )

    try:
        resp = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contents,
            config={"response_mime_type": "application/json", "temperature": 0.2}
        )
        plan = json.loads(resp.text) if resp.text else {}
    except Exception as e:
        logger.warning(f"[LangGraph:Node 2E] Declutter LLM call error: {e}")
        plan = {
            "clutter_items_to_remove": ["Excess loose floor items", "Visual cords"],
            "spatial_flow_improvements": ["Clear walkway toward natural window light"],
            "lighting_adjustments": "Maximize ambient daytime exposure"
        }

    return {
        "declutter_plan": plan,
        "estimated_total_naira": 0,  # Zero purchasing cost
        "status": "DECLUTTER_PLANNED"
    }

# ============================================================================
# NODE 2F: ROUTE 6 - INSPECTION & DEFECT REMEDIATION
# ============================================================================
def source_inspection_node(state: RoomDesignState) -> Dict[str, Any]:
    """Node 2F: Multimodal structural/finish inspection and contractor matching."""
    if state.get("error"):
        return {"status": "SKIPPED"}

    prompt = state.get("user_prompt", "")
    room_img = state.get("room_image")
    logger.info(f"[LangGraph:Node 2F] Inspecting defect: '{prompt}'")

    existing_defect = state.get("inspection_report") or {}
    defect_type = existing_defect.get("type") or "Surface Structural Defect"
    severity = existing_defect.get("severity") or "MEDIUM"

    # Match specialized restoration artisan based on detected defect
    repair_query = f"{defect_type} {prompt} repair masonry screeding plumbing"
    try:
        matches = search_artisan_pins(query=repair_query, limit=2, threshold=0.35)
        matched_contractor = matches[0] if matches else None
    except Exception as e:
        logger.warning(f"[LangGraph:Node 2F] Repair artisan search error: {e}")
        matched_contractor = None

    remediation_cost = matched_contractor.get("estimated_cost_naira", 65000) if matched_contractor else 65000

    report = {
        "defect_type": defect_type,
        "severity": severity,
        "recommended_remediation": existing_defect.get("remediation") or "Technical trade surface repair and waterproofing.",
        "assigned_contractor": matched_contractor
    }

    return {
        "inspection_report": report,
        "matched_artisan": matched_contractor,
        "estimated_total_naira": remediation_cost,
        "status": "INSPECTION_COMPLETED"
    }

# ============================================================================
# NODE 3: MULTIMODAL SPATIAL INPAINTING & COMPOSITING
# ============================================================================
def composite_staging_node(state: RoomDesignState) -> Dict[str, Any]:
    """Node 3: Dynamic Inpainting via Gemini 3.1 Flash Image across all 6 routes."""
    if state.get("error"):
        return {"status": "SKIPPED"}

    room_img = state.get("room_image")
    route = state.get("route", "COMMERCE_DIY")
    specs = state.get("specs", {})
    prompt_base = f"{specs.get('title', 'Space Staging')} in {specs.get('style', 'Modern')} style. {state.get('user_prompt', '')}"
    space_context = specs.get("space_context", "interior").lower()

    asset_images: List[Any] = []

    if route == "ARTISAN_FINISH" or route == "INSPECTION_REPAIR":
        artisan = state.get("matched_artisan")
        if artisan and artisan.get("image_url"):
            asset_images.append(artisan["image_url"])
        prompt = f"Restore and stage this space with verified {specs.get('title', 'craft finish')}. {prompt_base}"

    elif route == "COMMERCE_DIY":
        shopping = state.get("shopping_list", [])
        target_items = state.get("target_items") or []

        # Collect verified product images
        for item in shopping:
            img = item.get("image_payload") or item.get("image_url")
            if img:
                asset_images.append(img)

        # STRICT GROUNDED COMMERCE MANDATE (Zero Synthetic Hallucination)
        if not asset_images:
            raise RuntimeError(
                "REAL_OR_FAIL_ABORT: Insufficient verified product photos from retailers (0 items had verified images). "
                "Staging rejected to prevent synthetic hallucination. No image, no design."
            )

        if shopping:
            item_names = [item['item_name'] for item in shopping]
        else:
            item_names = target_items or ["furniture and decor"]

        items_summary = "; ".join(item_names)
        prompt = (
            f"Composite these exact sourced physical items into the room: {items_summary}. "
            f"Preserve the room's authentic walls, windows, floor, and architecture completely without adding fantasy structures or unrequested decor. "
            "Accurately position each physical item with natural perspective and drop shadows."
        )

    elif route == "HYBRID":
        artisan = state.get("matched_artisan")
        if artisan and artisan.get("image_url"):
            asset_images.append(artisan["image_url"])
        shopping = state.get("shopping_list", [])
        for item in shopping:
            img = item.get("image_payload") or item.get("image_url")
            if img:
                asset_images.append(img)
        prompt = f"Hybrid transformation: combine architectural surface finish with verified furniture staging. {prompt_base}"

    elif route == "CUSTOM_URL":
        item = state.get("scraped_item") or {}
        img = item.get("image_payload") or item.get("image_url")
        if img:
            asset_images.append(img)
        prompt = f"Composite this exact product ({item.get('item_name', 'featured item')}) into the space. {prompt_base}"

    elif route == "DECLUTTER":
        asset_images = []
        prompt = (
            "Complete spatial declutter and minimalist architectural restaging: "
            "remove all clutter, disorganized items, and visual noise. "
            "Restore clean, open, pristine surfaces, balanced negative space, and natural lighting."
        )
    else:
        prompt = prompt_base

    logger.info(f"[LangGraph:Node 3] Visual staging via gemini-3.1-flash-image (route={route}, assets={len(asset_images)}, context={space_context})")
    try:
        staging_res = composite_spatial_staging(
            room_image=room_img,
            asset_images=asset_images,
            prompt=prompt,
            space_context=space_context
        )
        return {
            "mockup_image_url": staging_res["web_url"],
            "mockup_image_data": staging_res["data_url"],
            "status": "STAGED"
        }
    except Exception as e:
        logger.error(f"[LangGraph:Node 3] Visual staging failed: {e}")
        return {
            "mockup_image_url": None,
            "mockup_image_data": None,
            "error": f"VISUAL_STAGING_FAILED: {str(e)}",
            "status": "ERROR"
        }

# ============================================================================
# NODE 4: ACTION CARD & EXECUTABLE OUTPUT SYNTHESIS
# ============================================================================
def synthesize_action_card_node(state: RoomDesignState) -> Dict[str, Any]:
    """Node 4: Synthesizes final response text and native action cards for all 6 routes."""
    error = state.get("error")
    route = state.get("route", "COMMERCE_DIY")
    specs = state.get("specs", {})
    title = specs.get("title", "Spatial Redesign")
    style = specs.get("style", "Modern")
    mockup_url = state.get("mockup_image_url")
    room_analysis = specs.get("room_analysis", "")
    analysis_sec = f"\n\n**Spatial Assessment:** {room_analysis}" if room_analysis else ""

    # Error fail-state handling
    if error:
        logger.warning(f"[LangGraph:Node 4] Executing fail-state synthesis: {error}")
        return _synthesize_error_card(state, error, title)

    # 1. Route: COMMERCE_DIY
    if route == "COMMERCE_DIY":
        shopping_list = state.get("shopping_list", [])
        total_naira = state.get("estimated_total_naira", 0)
        items_lines = []
        for i, item in enumerate(shopping_list):
            p_naira = item.get("price_naira")
            p_disp = item.get("price_display") or (f"₦{p_naira:,.0f}" if p_naira is not None else "Unknown")
            items_lines.append(f"{i + 1}. **{item['item_name']}** — {p_disp}\n   [Order Online via Store]({item.get('buy_url')})")
        items_md = "\n\n".join(items_lines)

        known_prices = [it["price_naira"] for it in shopping_list if it.get("price_naira") is not None]
        if len(known_prices) == len(shopping_list) and total_naira > 0:
            cart_str = f"**Total Estimated Cart:** ₦{total_naira:,.0f}"
        elif known_prices:
            cart_str = f"**Total Estimated Cart:** ₦{total_naira:,.0f} (+ {len(shopping_list) - len(known_prices)} item(s) price unknown)"
        else:
            cart_str = "**Total Estimated Cart:** Unknown"

        response_text = (
            f"### Staged Spatial Concept: {title}\n\n"
            f"Here is your AI-staged room concept in **{style}** style.{analysis_sec}\n\n"
            f"I sourced **{len(shopping_list)} authentic items** from live marketplaces with direct checkout URLs:\n\n"
            f"{items_md}\n\n"
            f"{cart_str}\n\n"
            f"Rendered with dynamic spatial lighting and drop shadows via **Gemini 3.1 Flash Image**."
        )
        options = [
            {"label": "View Full Cart Details", "value": "Break down the itemized cart specifications"},
            {"label": "Switch to Artisan Tiling", "value": "Show me Spanish porcelain tile installations"},
            {"label": "Redesign Compound Patio", "value": "Design heavy-duty compound paving stones"}
        ]
        action_card = {
            "type": "COMMERCE_CHECKOUT",
            "item_count": len(shopping_list),
            "total_cost_naira": total_naira,
            "items": shopping_list,
            "mockup_image_url": mockup_url
        }

    # 2. Route: ARTISAN_FINISH
    elif route == "ARTISAN_FINISH":
        artisan = state.get("matched_artisan") or {}
        artisan_name = artisan.get("vendor_name", "Master Artisan")
        artisan_cost = artisan.get("estimated_cost_naira")
        labor_display = f"NGN {artisan_cost:,.0f}" if artisan_cost else "Quote on physical inspection"
        artisan_desc = artisan.get("description", "Quality hand-finished installation")
        sim_score = artisan.get("similarity_score", 0.0)

        response_text = (
            f"### Artisan Craftsmanship & Surface Staging\n\n"
            f"I analyzed your room request for **{title}**.{analysis_sec}\n\n"
            f"Architectural finishes like custom tiling, wood slats, and microcement require verified master craftsmanship. "
            f"I matched your space with **{artisan_name}** ({artisan.get('title', 'Specialist')}) with a **{sim_score * 100:.0f}% semantic alignment**.\n\n"
            f"* **Craft Specialty:** {style}\n"
            f"* **Estimated Labor:** {labor_display}\n"
            f"* **Verified Portfolio:** \"{artisan_desc}\"\n"
            f"* **Communication:** In-app private chat available for measurements and scheduling.\n\n"
            f"Visual staging composited using **Gemini 3.1 Flash Image** grounded on the artisan's physical work."
        )
        options = [
            {"label": f"Message {artisan_name}", "value": f"Start in-app chat with {artisan_name}"},
            {"label": "Explore More Craft Pins", "value": "Show me more artisan surface craft pins"},
            {"label": "Switch to Store Furniture", "value": "Switch to store catalog furniture items"}
        ]
        action_card = {
            "type": "ARTISAN_RFQ",
            "vendor_name": artisan_name,
            "vendor_id": artisan.get("vendor_id") or artisan.get("pin_id"),
            "in_app_chat_available": True,
            "vendor_rating": artisan.get("vendor_rating", 5.0),
            "vendor_bio": artisan.get("vendor_bio"),
            "estimated_cost_naira": artisan_cost,
            "similarity_score": sim_score,
            "portfolio_image_url": artisan.get("image_url"),
            "mockup_image_url": mockup_url
        }

    # 3. Route: HYBRID
    elif route == "HYBRID":
        artisan = state.get("matched_artisan") or {}
        artisan_name = artisan.get("vendor_name", "Master Artisan")
        shopping_list = state.get("shopping_list", [])
        total_naira = state.get("estimated_total_naira", 0)

        artisan_cost = artisan.get("estimated_cost_naira")
        labor_estimate = f"₦{artisan_cost:,.0f}" if artisan_cost else "Quote on site inspection"

        hybrid_lines = []
        for it in shopping_list:
            p_naira = it.get("price_naira")
            p_disp = it.get("price_display") or (f"₦{p_naira:,.0f}" if p_naira is not None else "Unknown")
            hybrid_lines.append(f"- **{it['item_name']}**: {p_disp} ([View Product]({it.get('buy_url')}))")
        items_md = "\n".join(hybrid_lines)

        known_retail = [p["price_naira"] for p in shopping_list if p.get("price_naira") is not None]
        total_str = f"₦{total_naira:,.0f}" if known_retail or (artisan_cost and artisan_cost > 0) else "Unknown"

        response_text = (
            f"### Hybrid Architectural Renovation & Staging: {title}\n\n"
            f"This transformation combines custom surface finishing with curated loose furniture.{analysis_sec}\n\n"
            f"**1. Master Artisan Labor:**\n"
            f"* Contractor: **{artisan_name}** ({artisan.get('title', 'Specialist')})\n"
            f"* Labor Estimate: {labor_estimate}\n"
            f"* Private in-app messaging is available to coordinate execution.\n\n"
            f"**2. Sourced Furnishings:**\n"
            f"{items_md or 'Items sourced from marketplace.'}\n\n"
            f"**Combined Total Estimate:** {total_str}"
        )
        options = [
            {"label": f"Message {artisan_name}", "value": f"Chat with {artisan_name} in app about this project"},
            {"label": "Surface Only", "value": "Proceed with only artisan finish"},
            {"label": "Furniture Only", "value": "Proceed with only furniture items"}
        ]
        sanitized_artisan = {k: v for k, v in artisan.items() if k not in ["vendor_phone", "contractor_phone"]}
        sanitized_artisan["in_app_chat_available"] = True

        action_card = {
            "type": "HYBRID_PACKAGE",
            "artisan": sanitized_artisan,
            "shopping_list": shopping_list,
            "total_cost_naira": total_naira,
            "mockup_image_url": mockup_url
        }

    # 4. Route: CUSTOM_URL
    elif route == "CUSTOM_URL":
        item = state.get("scraped_item") or {}
        item_name = item.get("item_name", "Custom Sourced Product")
        item_price = item.get("price_naira")
        price_display = item.get("price_display") or (f"₦{item_price:,.0f}" if item_price is not None else "Unknown")
        buy_url = item.get("buy_url", state.get("source_url", "#"))

        response_text = (
            f"### External Product Staging: {item_name}\n\n"
            f"I extracted your target product from the provided link and composited it directly into your room geometry.\n\n"
            f"* **Product:** [{item_name}]({buy_url})\n"
            f"* **Retail Price:** {price_display}\n"
            f"* **Description:** {item.get('description', '')}\n\n"
            f"The asset has been staged with matching lighting, shadows, and perspective via **Gemini 3.1 Flash Image**."
        )
        options = [
            {"label": "Buy at Retailer", "value": f"Open external product page: {buy_url}"},
            {"label": "Find Local Artisan Alternative", "value": f"Can an artisan custom-build this {item_name}?"},
            {"label": "Stage Another Item", "value": "Stage a different product URL into my room"}
        ]
        action_card = {
            "type": "DIRECT_PRODUCT_BUY",
            "item_name": item_name,
            "price_naira": item_price,
            "buy_url": buy_url,
            "image_url": item.get("image_url"),
            "mockup_image_url": mockup_url
        }

    # 5. Route: DECLUTTER
    elif route == "DECLUTTER":
        plan = state.get("declutter_plan") or {}
        removals = "\n".join(f"- {act}" for act in plan.get("clutter_items_to_remove", ["Excess loose clutter"]))
        flows = "\n".join(f"- {flow}" for flow in plan.get("spatial_flow_improvements", ["Clear primary walkways"]))

        response_text = (
            f"### Spatial Declutter & Minimalist Reset\n\n"
            f"Here is your zero-cost spatial restructuring plan and clean restaged rendering.{analysis_sec}\n\n"
            f"**Recommended Removals:**\n{removals}\n\n"
            f"**Flow & Circulation Improvements:**\n{flows}\n\n"
            f"**Lighting Optimization:** {plan.get('lighting_adjustments', 'Open natural daylight angles.')}\n\n"
            f"Rendered as a serene, uncluttered space via **Gemini 3.1 Flash Image**."
        )
        options = [
            {"label": "Save Declutter Checklist", "value": "Save this declutter plan to my designs"},
            {"label": "Add Minimalist Slat Wall", "value": "Now show this decluttered space with a fluted oak slat wall"},
            {"label": "Add Accent Armchair", "value": "Suggest one signature armchair for this clean space"}
        ]
        action_card = {
            "type": "SPATIAL_RESET",
            "plan": plan,
            "cost_naira": 0,
            "mockup_image_url": mockup_url
        }

    # 6. Route: INSPECTION_REPAIR
    elif route == "INSPECTION_REPAIR":
        report = state.get("inspection_report") or {}
        artisan = state.get("matched_artisan") or {}
        contractor_name = artisan.get("vendor_name", "Remediation Specialist")
        cost = state.get("estimated_total_naira") or artisan.get("estimated_cost_naira")
        cost_display = f"NGN {cost:,.0f}" if cost else "Quote upon physical inspection"

        response_text = (
            f"### Diagnostic Inspection & Defect Remediation\n\n"
            f"**Diagnostic Finding:** {report.get('defect_type', 'Surface Damage')}\n"
            f"**Severity Level:** `{report.get('severity', 'MEDIUM')}`\n"
            f"**Technical Remediation:** {report.get('recommended_remediation', 'Trade surface repair.')}\n\n"
            f"I matched your project with verified restoration contractor **{contractor_name}**. "
            f"Private in-app chat is available to coordinate technical assessment.\n\n"
            f"* **Estimated Remediation Labor:** {cost_display}\n\n"
            f"The visualization shows the repaired surface restored to pristine architectural condition."
        )
        options = [
            {"label": f"Message {contractor_name}", "value": f"Chat with {contractor_name} in app about repair"},
            {"label": "Request Second Opinion", "value": "Request alternative contractor quote"},
            {"label": "Upgraded Tiling Option", "value": "Quote porcelain tile replacement instead"}
        ]
        action_card = {
            "type": "REPAIR_ESTIMATE",
            "defect_type": report.get("defect_type"),
            "severity": report.get("severity"),
            "contractor_name": contractor_name,
            "vendor_id": artisan.get("vendor_id") or artisan.get("pin_id"),
            "in_app_chat_available": True,
            "estimated_cost_naira": cost,
            "mockup_image_url": mockup_url
        }

    return {
        "response_text": response_text,
        "options": options,
        "action_card": action_card,
        "status": "COMPLETED"
    }

def _synthesize_error_card(state: RoomDesignState, error: str, title: str) -> Dict[str, Any]:
    """Empirical fail-state synthesis adhering strictly to work-or-fail."""
    if "STORE_NOT_FOUND" in error:
        text = (
            f"### Live Marketplace Sourcing Notice\n\n"
            f"No active purchasable items matching \"{state.get('search_query')}\" were found on live Nigerian retail stores (Jumia/Konga).\n"
            f"Under Decox zero-conjecture rules, we do not present simulated items. Would you like to refine the search terms or connect with a custom carpenter?"
        )
        opts = [
            {"label": "Search Oak Accent Chair", "value": "Find minimalist oak armchair on Jumia"},
            {"label": "Switch to Custom Carpenter", "value": "Commission Ade Woodworks for custom furniture"}
        ]
        card = {"type": "ERROR_RETRY", "reason": "STORE_NOT_FOUND"}
    elif "ARTISAN_NOT_FOUND" in error:
        text = (
            f"### Artisan Verification Notice\n\n"
            f"No vetted master artisan matched your exact specialty (\"{state.get('search_query')}\") in Cloud SQL.\n"
            f"Would you like to explore nearby specialties or store alternatives?"
        )
        opts = [
            {"label": "Explore Floor Tiling", "value": "Show me master porcelain tiling artisans"},
            {"label": "Explore Wood Slat Panels", "value": "Show me fluted oak wood slat specialists"}
        ]
        card = {"type": "ERROR_RETRY", "reason": "ARTISAN_NOT_FOUND"}
    elif "MISSING_PRODUCT_URL" in error:
        text = (
            f"### External Link Required\n\n"
            f"You requested staging of an external product, but no valid HTTP/HTTPS product link was detected in your message.\n"
            f"Please paste the direct product URL (e.g. from Jumia, Konga, or Amazon) to stage it."
        )
        opts = [
            {"label": "Browse Marketplace Instead", "value": "Find modern armchair on Jumia Nigeria"}
        ]
        card = {"type": "ERROR_RETRY", "reason": "MISSING_PRODUCT_URL"}
    else:
        text = f"### Pipeline Notice\n\nAn operational issue occurred during processing: `{error}`."
        opts = [{"label": "Retry Request", "value": state.get("user_prompt", "Redesign living room")}]
        card = {"type": "ERROR_RETRY", "reason": error}

    return {
        "response_text": text,
        "options": opts,
        "action_card": card,
        "status": "FAILED"
    }
