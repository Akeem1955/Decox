from typing import Dict, List, Optional, Any, Literal
from typing_extensions import TypedDict

RouteType = Literal[
    "COMMERCE_DIY",
    "ARTISAN_FINISH",
    "HYBRID",
    "CUSTOM_URL",
    "DECLUTTER",
    "INSPECTION_REPAIR"
]

class RoomDesignState(TypedDict, total=False):
    # Inputs
    user_prompt: str
    room_image: Optional[str]
    space_type: str
    messages: List[Dict[str, str]]
    source_url: Optional[str]
    preferred_store: Optional[str]
    
    # Classification / Route
    route: RouteType
    suggested_category: str
    search_query: str
    target_items: List[str]
    specs: Dict[str, Any]
    
    # Route 1: Parallel API Retail Output
    shopping_list: List[Dict[str, Any]]
    
    # Route 2: Cloud SQL pgvector Artisan Output
    matched_artisan: Optional[Dict[str, Any]]
    
    # Route 4: Custom External URL Output
    scraped_item: Optional[Dict[str, Any]]
    
    # Route 5: Spatial Declutter Plan
    declutter_plan: Optional[Dict[str, Any]]
    
    # Route 6: Inspection & Maintenance Diagnostic
    inspection_report: Optional[Dict[str, Any]]
    
    # Inpainting & Staging Synthesis (Gemini 3.1 Flash Image)
    mockup_image_url: Optional[str]
    mockup_image_data: Optional[str]
    estimated_total_naira: int
    response_text: str
    options: List[Dict[str, str]]
    action_card: Dict[str, Any]
    status: str
    error: Optional[str]
