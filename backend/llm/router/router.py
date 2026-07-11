import logging
from llm.router.routing_engine import RoutingEngine

logger = logging.getLogger("uvicorn")

class LLMRouter:
    """Backward-compatible wrapper around the new policy-based RoutingEngine."""
    
    @staticmethod
    def route_query(prompt: str) -> str:
        """Routes prompt to the best available model, returning the unified model ID."""
        model_meta, _ = RoutingEngine.route_request(prompt)
        return model_meta.id
