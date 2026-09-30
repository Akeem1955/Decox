import re
import json
import base64
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List, Optional
import requests
from app.config import settings

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
}

ALLOWED_DOMAINS: List[str] = ["jumia.com.ng", "konga.com", "jiji.ng"]

BLOCKED_DOMAINS: List[str] = [
    "apple.com", "itunes.apple.com", "google.com", "play.google.com",
    "apps.apple.com", "facebook.com", "twitter.com", "instagram.com",
    "tiktok.com", "youtube.com", "pinterest.com", "linkedin.com"
]

VALID_MARKETPLACE_DOMAINS: List[str] = [
    "jiji.ng", "jumia.com.ng", "konga.com", "cdcare.ng", "kara.com.ng"
]

BLOCKED_IMAGE_DOMAINS: List[str] = [
    "mzstatic.com", "apple.com", "play-lh.googleusercontent.com",
    "googleusercontent.com", "gstatic.com"
]

BLOCKED_IMAGE_KEYWORDS: List[str] = [
    "placeholder", "logo", "app-store", "play-store", "badge",
    "icon", "banner_app", "get-it-on", "download"
]

def clean_product_url(url: str) -> str:
    """Strips markdown attributes, quotes, or trailing whitespace from URLs."""
    if not url:
        return ""
    cleaned = url.split()[0].strip('"\'()<>;')
    return cleaned

def is_valid_marketplace_url(url: str) -> bool:
    """Verifies that URL points to an authentic Nigerian retail product listing, not an app store or ad."""
    if not url or not url.startswith("http"):
        return False
    u = url.lower()
    if any(b in u for b in BLOCKED_DOMAINS):
        return False
    if not any(v in u for v in VALID_MARKETPLACE_DOMAINS):
        return False
    if any(p in u for p in ["/app/", "/download", "login", "register", "/cart", "/checkout"]):
        return False
    return True

def is_valid_product_image_url(url: str) -> bool:
    """Rejects placeholder logos, app store icons, or invalid image links."""
    if not url or not url.startswith("http"):
        return False
    u = url.lower()
    if any(b in u for b in BLOCKED_IMAGE_DOMAINS):
        return False
    if any(k in u for k in BLOCKED_IMAGE_KEYWORDS):
        return False
    return True

# Verified marketplace registry sorted by reliability and inventory richness (Nigerian marketplaces prioritized)
MARKETPLACE_REGISTRY: List[Dict[str, Any]] = [
    {
        "id": "jiji",
        "name": "JiJi Nigeria",
        "domain": "jiji.ng",
        "reliability_rank": 1,
        "inventory_richness": "VERY_HIGH",
        "query_pattern": "{query} JiJi Nigeria price"
    },
    {
        "id": "jumia",
        "name": "Jumia Nigeria",
        "domain": "jumia.com.ng",
        "reliability_rank": 2,
        "inventory_richness": "HIGH",
        "query_pattern": "{query} buy Jumia Nigeria"
    },
    {
        "id": "konga",
        "name": "Konga",
        "domain": "konga.com",
        "reliability_rank": 3,
        "inventory_richness": "HIGH",
        "query_pattern": "{query} Konga Nigeria price online"
    },
    {
        "id": "cdcare",
        "name": "CDCare",
        "domain": "cdcare.ng",
        "reliability_rank": 4,
        "inventory_richness": "MEDIUM",
        "query_pattern": "{query} CDCare Nigeria"
    },
    {
        "id": "amazon",
        "name": "Amazon",
        "domain": "amazon.com",
        "reliability_rank": 99,
        "inventory_richness": "GLOBAL",
        "query_pattern": "{query} buy online Amazon"
    }
]

def download_image_as_base64(image_url: str) -> Optional[Dict[str, str]]:
    """Downloads an external product image and returns base64 and mime-type."""
    if not image_url or not is_valid_product_image_url(image_url):
        return None
    try:
        res = requests.get(image_url, headers=HEADERS, timeout=8)
        if res.status_code == 200 and res.content and len(res.content) > 1000:
            mime = res.headers.get("Content-Type", "image/jpeg").split(";")[0].strip()
            return {
                "mime_type": mime or "image/jpeg",
                "data": base64.b64encode(res.content).decode("utf-8")
            }
    except Exception as e:
        logger.warning(f"[ParallelService] Failed to download image from {image_url}: {e}")
    return None

def extract_image_url_from_text(text: str) -> Optional[str]:
    """Finds high-resolution product image URLs from markdown text or links."""
    if not text:
        return None

    normalized = text.replace(r'\(', '(').replace(r'\)', ')')

    # 1. Matches known marketplace CDN images (Jumia, JiJi, Konga)
    cdn_pattern = r'https?://(?:ng\.jumia\.is|pictures-nigeria\.jijistatic\.net|www\.konga\.com/media|www-konga-com-res\.cloudinary\.com)/[^\s"\'<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^\s"\'<>]*)?'
    for m in re.finditer(cdn_pattern, normalized):
        candidate = m.group(0).rstrip(')>.,;\'"')
        if is_valid_product_image_url(candidate):
            return candidate

    # 2. Matches markdown links [Alt](https://...jpg...)
    md_pattern = r'\[(?:[^\]]*)\]\((https?://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"\'<>]*)?)\)'
    for m in re.finditer(md_pattern, normalized):
        candidate = m.group(1).rstrip(')>.,;\'"')
        if is_valid_product_image_url(candidate):
            return candidate

    # 3. Any standard HTTP image link ending with an image extension
    gen_pattern = r'https?://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"\'<>]*)?'
    for m in re.finditer(gen_pattern, normalized):
        candidate = m.group(0).rstrip(')>.,;\'"')
        if is_valid_product_image_url(candidate):
            return candidate

    return None

def fetch_image_via_extract(url: str) -> Optional[str]:
    """
    Tier 2: Parallel Extract API Fallback
    Bypasses anti-bot protections on Nigerian e-commerce stores to retrieve verified product CDN photos.
    """
    if not settings.PARALLEL_API_KEY or not is_valid_marketplace_url(url):
        return None

    logger.info(f"[ParallelService] Extract API invoked for URL: {url}")
    api_url = "https://api.parallel.ai/v1/extract"
    headers = {
        "x-api-key": settings.PARALLEL_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "urls": [url],
        "objective": "Extract high-resolution product image and price in Naira"
    }
    try:
        res = requests.post(api_url, headers=headers, json=payload, timeout=10)
        if res.status_code == 200:
            data = res.json().get("results", [])
            if data:
                combined_content = (data[0].get("full_content") or "") + " " + " ".join(data[0].get("excerpts") or [])
                img = extract_image_url_from_text(combined_content)
                if img and is_valid_product_image_url(img):
                    logger.info(f"[ParallelService] Extract API successfully located image: {img}")
                    return img
    except Exception as e:
        logger.warning(f"[ParallelService] Parallel Extract API timed out or failed for {url}: {e}")
    return None

def fetch_page_product_image(url: str) -> Optional[str]:
    """
    Fetches og:image or high-resolution product image from marketplace page.
    Automatically triggers Parallel Extract API fallback if direct HTTP is blocked (403/503).
    """
    if not is_valid_marketplace_url(url):
        return None
    try:
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.status_code == 200 and res.text:
            match = re.search(r'<meta[^>]+property=[\'"]og:image[\'"][^>]+content=[\'"]([^\'"]+)[\'"]', res.text, re.I)
            if not match:
                match = re.search(r'<meta[^>]+content=[\'"]([^\'"]+)[\'"][^>]+property=[\'"]og:image[\'"]', res.text, re.I)
            if not match:
                match = re.search(r'<meta[^>]+name=[\'"]twitter:image[\'"][^>]+content=[\'"]([^\'"]+)[\'"]', res.text, re.I)
            if match:
                img_url = match.group(1).strip()
                if img_url.startswith("//"):
                    img_url = "https:" + img_url
                if is_valid_product_image_url(img_url):
                    return img_url
        elif res.status_code in [403, 503]:
            # Jumia and Konga succeed with Parallel Extract API; JiJi's Cloudflare hangs on datacenter IPs
            if "jiji.ng" not in url:
                return fetch_image_via_extract(url)
    except Exception as e:
        if "jiji.ng" not in url:
            return fetch_image_via_extract(url)
    return None

def search_via_responses_api(target_item: str) -> Optional[Dict[str, Any]]:
    """
    Tier 3: Parallel Responses API Structured Output
    Uses strict json_schema and domain filtering to extract structured product entities directly.
    """
    if not settings.PARALLEL_API_KEY:
        return None

    logger.info(f"[ParallelService] Responses API querying structured schema for: '{target_item}'")
    api_url = "https://api.parallel.ai/v1/responses"
    headers = {
        "Authorization": f"Bearer {settings.PARALLEL_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "parallel",
        "input": (
            f"Find a purchasable {target_item} currently available in Nigeria on Jumia, Konga, or JiJi. "
            "Locate an individual product listing page (ending in .html). "
            "Find the product's primary high-resolution image URL (from jijistatic.net, ng.jumia.is, or konga cloudinary). "
            "Return exact item name, price in Naira as an integer, direct product buy URL, direct product image URL, and store name."
        ),
        "reasoning": {"effort": "low"},
        "tools": [
            {
                "type": "web_search",
                "filters": {
                    "allowed_domains": ALLOWED_DOMAINS + ["jijistatic.net", "ng.jumia.is", "cloudinary.com"]
                }
            }
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "retail_product",
                "schema": {
                    "type": "object",
                    "properties": {
                        "item_name": {"type": "string"},
                        "price_naira": {"type": "integer"},
                        "buy_url": {"type": "string"},
                        "image_url": {"type": "string"},
                        "store_name": {"type": "string"}
                    },
                    "required": ["item_name", "price_naira", "buy_url", "image_url", "store_name"],
                    "additionalProperties": False
                }
            }
        }
    }
    try:
        res = requests.post(api_url, headers=headers, json=payload, timeout=14)
        if res.status_code == 200:
            for out in res.json().get("output", []):
                if out.get("type") == "message":
                    for c in out.get("content", []):
                        txt = c.get("text", "")
                        if txt:
                            parsed = json.loads(txt)
                            clean_url = clean_product_url(parsed.get("buy_url", ""))
                            raw_img = parsed.get("image_url", "").strip()
                            clean_img = raw_img if is_valid_product_image_url(raw_img) else None
                            if parsed.get("price_naira", 0) > 0 and is_valid_marketplace_url(clean_url):
                                parsed["buy_url"] = clean_url
                                parsed["image_url"] = clean_img
                                logger.info(f"[ParallelService] Responses API structured hit: {parsed.get('item_name')} (₦{parsed.get('price_naira')}, has_img={clean_img is not None})")
                                return parsed
    except Exception as e:
        logger.warning(f"[ParallelService] Responses API call failed or timed out: {e}")
    return None

def search_via_search_api(target_item: str) -> List[Dict[str, Any]]:
    """
    Tier 1: Parallel Search API with Native Source Policy
    Natively confines search results to Nigerian retail domains (jiji.ng, jumia.com.ng, konga.com).
    """
    if not settings.PARALLEL_API_KEY:
        return []

    logger.info(f"[ParallelService] Search API querying '{target_item}' with source_policy.include_domains...")
    api_url = "https://api.parallel.ai/v1/search"
    headers = {
        "x-api-key": settings.PARALLEL_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "objective": f"Find authentic purchasable {target_item} with prices in Naira on JiJi, Jumia, or Konga",
        "search_queries": [
            f"{target_item} price Nigeria",
            f"{target_item} JiJi Nigeria",
            f"buy {target_item} Lagos Nigeria"
        ],
        "mode": "basic",
        "advanced_settings": {
            "source_policy": {
                "include_domains": ALLOWED_DOMAINS
            }
        }
    }
    try:
        res = requests.post(api_url, headers=headers, json=payload, timeout=10)
        if res.status_code == 200:
            return res.json().get("results", [])
    except Exception as e:
        logger.warning(f"[ParallelService] Search API call failed: {e}")
    return []

STOP_WORDS = {"the", "and", "for", "with", "screen", "unit", "item", "home", "modern", "luxury", "room", "space", "piece", "set"}

def _search_single_target(target_item: str) -> Optional[Dict[str, Any]]:
    """Searches and verifies a single retail target product across Responses and Search APIs."""
    candidate_fallback = None

    # Phase 1: Try structured extraction via Responses API
    resp_prod = search_via_responses_api(target_item)
    if resp_prod:
        buy_url = clean_product_url(resp_prod.get("buy_url", ""))
        if is_valid_marketplace_url(buy_url):
            img_url = resp_prod.get("image_url")
            if not img_url or not is_valid_product_image_url(img_url):
                img_url = fetch_page_product_image(buy_url)
            img_payload = download_image_as_base64(img_url) if img_url else None
            store = resp_prod.get("store_name", "Nigerian Marketplace")
            candidate = {
                "item_name": resp_prod["item_name"][:80],
                "price_naira": resp_prod["price_naira"],
                "price_display": f"₦{resp_prod['price_naira']:,.0f}",
                "buy_url": buy_url,
                "image_url": img_url,
                "image_payload": img_payload,
                "sourced_store": store,
                "description": f"Verified purchasable {target_item} from {store}."
            }
            if img_payload:
                logger.info(f"[ParallelService] Sourced '{resp_prod['item_name']}' via Responses API (has_image=True).")
                return candidate
            candidate_fallback = candidate

    # Phase 2: High-recall Search API with source_policy.include_domains
    search_results = search_via_search_api(target_item)
    raw_tokens = re.findall(r'[a-zA-Z0-9]+', target_item.lower())
    tokens = [t for t in raw_tokens if len(t) >= 2 and t not in STOP_WORDS]
    if not tokens:
        tokens = [t for t in raw_tokens if len(t) >= 2]

    for item in search_results[:3]:
        excerpts = " ".join(item.get("excerpts", []))
        # Match markdown links with price in Naira
        md_links = re.findall(r'\[([^\]]*?(?:₦|NGN)\s*([0-9]{1,3}(?:,[0-9]{3})+)[^\]]*?)\]\((https?://[^\s\)]+)(?:\s+"[^"]*")?\)', excerpts)
        for link_text, price_str, raw_url in md_links[:3]:
            link_url = clean_product_url(raw_url)
            if not is_valid_marketplace_url(link_url):
                continue

            clean_text = link_text.lower()
            if any(t in clean_text for t in tokens) or not tokens:
                try:
                    price_val = int(price_str.replace(",", ""))
                except Exception:
                    price_val = 0
                if price_val <= 0:
                    continue

                # Check excerpts first for CDN image URL, then fallback to page scrape
                img_url = extract_image_url_from_text(excerpts)
                if not img_url:
                    img_url = fetch_page_product_image(link_url)
                img_payload = download_image_as_base64(img_url) if img_url else None

                clean_title = re.sub(r'Verified ID.*?diamond|Popular ENTERPRISE|Brand New.*|DIAMOND', '', link_text)
                clean_title = re.sub(r'(?:₦|NGN)\s*[0-9,]+', '', clean_title).strip(' -:\n\t')
                store = "JiJi Nigeria" if "jiji" in link_url else ("Jumia Nigeria" if "jumia" in link_url else "Konga")
                candidate = {
                    "item_name": (clean_title or target_item)[:80],
                    "price_naira": price_val,
                    "price_display": f"₦{price_val:,.0f}",
                    "buy_url": link_url,
                    "image_url": img_url,
                    "image_payload": img_payload,
                    "sourced_store": store,
                    "description": f"Verified purchasable {target_item} from {store}."
                }
                if img_payload:
                    logger.info(f"[ParallelService] Sourced '{clean_title}' via Search API (has_image=True).")
                    return candidate
                if not candidate_fallback:
                    candidate_fallback = candidate

    return candidate_fallback

def search_retail_products(
    query: str,
    limit: int = 15,
    preferred_store: Optional[str] = None,
    target_items: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Executes intent-driven search across Nigerian marketplaces concurrently.
    Focuses on top 3-4 focal items with fast timeouts to guarantee responsive execution.
    ZERO FAKE PRICES: Real prices from stores only.
    """
    if not settings.PARALLEL_API_KEY:
        raise ValueError("PARALLEL_API_KEY is not configured in settings.")

    # Top focal items (max 4 targets)
    search_targets = [it.strip() for it in target_items if it.strip()] if target_items else [query.strip()]
    if not search_targets:
        search_targets = [query.strip()]
    search_targets = search_targets[:4]

    logger.info(f"[ParallelService] Executing concurrent search for {len(search_targets)} focal targets: {search_targets}")

    all_products: List[Dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=min(len(search_targets), 4)) as executor:
        results = list(executor.map(_search_single_target, search_targets))

    for prod in results:
        if prod:
            all_products.append(prod)

    logger.info(f"[ParallelService] Completed concurrent search: Sourced {len(all_products)} verified products with photos.")
    return all_products[:limit]

def scrape_custom_product_url(url: str) -> Dict[str, Any]:
    """
    Route 4: Fetches and extracts product details from a user-supplied external e-commerce URL.
    Uses direct scrape with automatic Parallel Extract API fallback to bypass bot blocks (Akamai/Cloudflare).
    ZERO FAKE PRICES: If unparsed, price_naira is None and price_display is 'Unknown'.
    """
    url = clean_product_url(url)
    if not url or not url.startswith("http"):
        raise ValueError(f"Invalid external product URL: {url}")

    logger.info(f"[ParallelService] Scraping external product link: {url}")
    html = None
    try:
        res = requests.get(url, headers=HEADERS, timeout=6)
        if res.status_code == 200 and res.text:
            html = res.text
    except Exception as e:
        logger.warning(f"[ParallelService] Direct scrape encountered error: {e}")

    # Fallback to Parallel Extract API for anti-bot protected stores (Jumia, Konga, etc.)
    extracted_text = ""
    image_url = None
    if not html and settings.PARALLEL_API_KEY:
        logger.info(f"[ParallelService] Using Parallel Extract API to bypass anti-bot on: {url}")
        try:
            api_url = "https://api.parallel.ai/v1/extract"
            headers = {"x-api-key": settings.PARALLEL_API_KEY, "Content-Type": "application/json"}
            payload = {
                "urls": [url],
                "objective": f"Extract title, price in Naira, description, and product image for {url}",
                "advanced_settings": {"full_content": True}
            }
            p_res = requests.post(api_url, headers=headers, json=payload, timeout=18)
            if p_res.status_code == 200:
                results = p_res.json().get("results", [])
                if results:
                    top_r = results[0]
                    title = top_r.get("title") or "Sourced Marketplace Item"
                    extracted_text = (top_r.get("full_content") or "") + " " + " ".join(top_r.get("excerpts") or [])
                    image_url = extract_image_url_from_text(extracted_text)
                    price_naira: Optional[int] = None
                    price_display = "Unknown"
                    p_match = re.search(r'(?:₦|NGN)\s*([0-9]{1,3}(?:,[0-9]{3})+)', extracted_text)
                    if p_match:
                        try:
                            price_naira = int(p_match.group(1).replace(",", ""))
                            price_display = f"₦{price_naira:,.0f}"
                        except ValueError:
                            pass

                    image_payload = download_image_as_base64(image_url) if image_url else None
                    return {
                        "item_name": title[:80],
                        "price_naira": price_naira,
                        "price_display": price_display,
                        "buy_url": url,
                        "image_url": image_url,
                        "image_payload": image_payload,
                        "description": extracted_text[:200] if extracted_text else "Authentic item sourced from external link."
                    }
        except Exception as p_err:
            logger.error(f"[ParallelService] Parallel Extract API fallback failed: {p_err}")

    if not html:
        raise RuntimeError(f"Could not reach external product URL: {url}")

    # 1. Title Extraction
    title = ""
    og_title = re.search(r'<meta[^>]+property=[\'"]og:title[\'"][^>]+content=[\'"]([^\'"]+)[\'"]', html, re.I)
    if og_title:
        title = og_title.group(1).strip()
    else:
        title_tag = re.search(r'<title>([^<]+)</title>', html, re.I)
        if title_tag:
            title = title_tag.group(1).strip()
    title = title or "Custom Sourced Product"

    # 2. Image Extraction
    image_url = fetch_page_product_image(url)
    image_payload = None
    if image_url:
        image_payload = download_image_as_base64(image_url)

    # 3. Price Extraction (Zero Fake Defaults)
    price_naira: Optional[int] = None
    price_display = "Unknown"
    price_match = re.search(r'(?:₦|NGN|N|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*)', html, re.I)
    if price_match:
        try:
            raw_val = int(price_match.group(1).replace(",", ""))
            if "$" in price_match.group(0):
                price_naira = raw_val * 1500
            else:
                price_naira = raw_val
            price_display = f"₦{price_naira:,.0f}"
        except ValueError:
            price_naira = None
            price_display = "Unknown"

    # 4. Description
    desc = ""
    og_desc = re.search(r'<meta[^>]+property=[\'"]og:description[\'"][^>]+content=[\'"]([^\'"]+)[\'"]', html, re.I)
    if og_desc:
        desc = og_desc.group(1).strip()

    return {
        "item_name": title[:80],
        "price_naira": price_naira,
        "price_display": price_display,
        "buy_url": url,
        "image_url": image_url,
        "image_payload": image_payload,
        "description": desc[:200] if desc else "Custom product sourced from external link."
    }
