import logging
from typing import Dict, Any, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from google import genai
from app.config import settings

logger = logging.getLogger(__name__)

def get_gemini_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured in settings.")
    return genai.Client(api_key=settings.GEMINI_API_KEY)

def embed_text(text: str) -> List[float]:
    """Generates 3072-dimensional vector embedding using gemini-embedding-2."""
    client = get_gemini_client()
    clean_text = text.strip()
    try:
        response = client.models.embed_content(
            model="gemini-embedding-2",
            contents=clean_text
        )
        if hasattr(response, "embeddings") and response.embeddings:
            return response.embeddings[0].values
        raise ValueError("Gemini embedding response contained no embeddings.")
    except Exception as e:
        logger.error(f"[VectorService] Embedding generation failed: {e}")
        raise RuntimeError(f"Embedding generation failed: {e}")

def search_artisan_pins(
    query: str,
    limit: int = 3,
    threshold: float = 0.45,
    category: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Executes semantic cosine distance search against PostgreSQL pgvector PortfolioItem table.
    Returns authentic Nigerian master artisan pins with live contact details.
    Under 'work or fail': returns empty list if no matches exceed similarity threshold.
    """
    if not settings.DATABASE_URL:
        raise ValueError("DATABASE_URL is not configured in settings.")

    logger.info(f"[VectorService] Computing embedding for query: '{query}'")
    query_vector = embed_text(query)
    vector_str = str(query_vector)

    sql = """
        SELECT 
            p.id as pin_id,
            p."vendorId" as vendor_id,
            v.name as vendor_name,
            v.bio as vendor_bio,
            v.rating as vendor_rating,
            p.title,
            p.description,
            p."imageUrl" as image_url,
            p."estimatedCost" as estimated_cost_naira,
            p.category::text as category,
            p."spaceType"::text as space_type,
            (1 - (p.embedding <=> %s::vector)) as similarity_score
        FROM "PortfolioItem" p
        JOIN "Vendor" v ON p."vendorId" = v.id
        WHERE p.embedding IS NOT NULL
    """
    params = [vector_str]

    if category:
        sql += " AND p.category = %s"
        params.append(category)

    sql += """
        ORDER BY p.embedding <=> %s::vector ASC
        LIMIT %s;
    """
    params.extend([vector_str, limit])

    try:
        conn = psycopg2.connect(settings.DATABASE_URL, connect_timeout=8)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
        conn.close()
    except Exception as e:
        logger.error(f"[VectorService] Cloud SQL pgvector query failed: {e}")
        raise RuntimeError(f"Cloud SQL pgvector query failed: {e}")

    results: List[Dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        sim = float(item.get("similarity_score", 0.0))
        if sim >= threshold:
            results.append({
                "pin_id": item["pin_id"],
                "vendor_id": item["vendor_id"],
                "vendor_name": item["vendor_name"],
                "in_app_chat_available": True,
                "vendor_bio": item.get("vendor_bio"),
                "vendor_rating": float(item.get("vendor_rating", 5.0)),
                "title": item["title"],
                "description": item["description"],
                "image_url": item["image_url"],
                "estimated_cost_naira": int(item.get("estimated_cost_naira") or 85000),
                "category": item["category"],
                "similarity_score": round(sim, 4)
            })

    logger.info(f"[VectorService] Retrieved {len(results)} artisan pins (threshold={threshold}).")
    return results
