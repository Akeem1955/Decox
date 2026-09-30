import logging
from langgraph.graph import StateGraph, START, END
from app.state import RoomDesignState
from app.nodes import (
    classify_intent_node,
    source_parallel_store_node,
    source_pgvector_artisan_node,
    source_hybrid_node,
    source_custom_url_node,
    source_declutter_node,
    source_inspection_node,
    composite_staging_node,
    synthesize_action_card_node
)

logger = logging.getLogger(__name__)

def route_branch(state: RoomDesignState) -> str:
    """
    Evaluates classified intent to dispatch to one of the 6 specialized sourcing pipelines:
    1. COMMERCE_DIY       -> source_parallel_store
    2. ARTISAN_FINISH     -> source_pgvector_artisan
    3. HYBRID             -> source_hybrid
    4. CUSTOM_URL         -> source_custom_url
    5. DECLUTTER          -> source_declutter
    6. INSPECTION_REPAIR  -> source_inspection
    """
    route = state.get("route", "COMMERCE_DIY")
    logger.info(f"[LangGraph:Router] Dispatching turn to pipeline: '{route}'")

    if route == "ARTISAN_FINISH":
        return "source_pgvector_artisan"
    elif route == "HYBRID":
        return "source_hybrid"
    elif route == "CUSTOM_URL":
        return "source_custom_url"
    elif route == "DECLUTTER":
        return "source_declutter"
    elif route == "INSPECTION_REPAIR":
        return "source_inspection"
    else:
        return "source_parallel_store"

def build_decox_graph():
    workflow = StateGraph(RoomDesignState)
    
    # 1. Register Intent Classifier
    workflow.add_node("classify_intent", classify_intent_node)
    
    # 2. Register 6 Specialized Sourcing Nodes
    workflow.add_node("source_parallel_store", source_parallel_store_node)
    workflow.add_node("source_pgvector_artisan", source_pgvector_artisan_node)
    workflow.add_node("source_hybrid", source_hybrid_node)
    workflow.add_node("source_custom_url", source_custom_url_node)
    workflow.add_node("source_declutter", source_declutter_node)
    workflow.add_node("source_inspection", source_inspection_node)
    
    # 3. Register Inpainting & Action Synthesis Nodes
    workflow.add_node("composite_staging", composite_staging_node)
    workflow.add_node("synthesize_action_card", synthesize_action_card_node)
    
    # 4. Wire Conditional Entry Branch
    workflow.add_edge(START, "classify_intent")
    
    workflow.add_conditional_edges(
        "classify_intent",
        route_branch,
        {
            "source_parallel_store": "source_parallel_store",
            "source_pgvector_artisan": "source_pgvector_artisan",
            "source_hybrid": "source_hybrid",
            "source_custom_url": "source_custom_url",
            "source_declutter": "source_declutter",
            "source_inspection": "source_inspection"
        }
    )
    
    # 5. Converge All 6 Sourcing Pipelines into Gemini 3.1 Flash Image Compositor
    workflow.add_edge("source_parallel_store", "composite_staging")
    workflow.add_edge("source_pgvector_artisan", "composite_staging")
    workflow.add_edge("source_hybrid", "composite_staging")
    workflow.add_edge("source_custom_url", "composite_staging")
    workflow.add_edge("source_declutter", "composite_staging")
    workflow.add_edge("source_inspection", "composite_staging")
    
    # 6. Wire Final Action Card Synthesis to Terminus
    workflow.add_edge("composite_staging", "synthesize_action_card")
    workflow.add_edge("synthesize_action_card", END)
    
    return workflow.compile()

# Pre-compiled production 6-route graph
decox_graph = build_decox_graph()
