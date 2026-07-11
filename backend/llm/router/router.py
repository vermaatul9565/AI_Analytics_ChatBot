import logging
import os

logger = logging.getLogger("uvicorn")

def is_valid_key(key_name: str) -> bool:
    """Helper to verify if a provider API key exists and is not a placeholder/dummy value."""
    key = os.environ.get(key_name)
    if not key:
        return False
    key_lower = key.lower()
    if key_lower.startswith("your_") or "dummy" in key_lower:
        return False
    return True

class LLMRouter:
    @staticmethod
    def route_query(prompt: str) -> str:
        """
        Classifies prompt complexity and checks active environment keys to route to 
        the best available model dynamically.
        """
        prompt_lower = prompt.lower().strip()
        
        # 1. Classify prompt complexity
        is_simple = False
        
        # Rule 1a: Very short prompts or greetings are simple
        if len(prompt_lower) < 25 or prompt_lower in ["hello", "hi", "hey", "how are you", "what is your name"]:
            is_simple = True
            
        # Rule 1b: Basic date/time queries are simple
        elif "date" in prompt_lower or "time" in prompt_lower or "today" in prompt_lower:
            is_simple = True
            
        # 2. Dynamic Routing based on active API keys
        if is_simple:
            # Route simple tasks to high-speed LPU or cheap flash
            if is_valid_key("GROQ_API_KEY"):
                resolved = "groq-llama-3.1-8b"  # Groq Llama 3.1 8B (fast LPU speed)
            else:
                resolved = "gemini-3.5-flash-low"  # Gemini 1.5 Flash 8B (default fallback)
            logger.info(f"[LLMRouter] Routed SIMPLE query to active: {resolved}")
            return resolved
            
        else:
            # Analytical or coding tasks require frontier reasoning models
            complex_keywords = [
                "analyze", "analytics", "sql", "chart", "database", "graph", "plot",
                "write code", "refactor", "bug", "error", "debug", "explain", "how to",
                "architecture", "design", "system", "compare", "versus", "vs", "summarize",
                "web search", "search the web", "tavily"
            ]
            
            is_analytical = any(kw in prompt_lower for kw in complex_keywords) or len(prompt_lower) > 100
            
            if is_analytical:
                # Rank reasoning models based on active keys
                if is_valid_key("ANTHROPIC_API_KEY"):
                    resolved = "claude-sonnet-4.6"
                elif is_valid_key("OPENAI_API_KEY"):
                    resolved = "gpt-4.6-omni"
                elif is_valid_key("GROQ_API_KEY"):
                    resolved = "groq-llama-3.3-70b"
                else:
                    resolved = "gemini-3.1-pro-low"
                logger.info(f"[LLMRouter] Routed COMPLEX query to active: {resolved}")
                return resolved
            else:
                # Balanced query: Default standard flash
                if is_valid_key("GROQ_API_KEY"):
                    resolved = "groq-llama-3.1-8b"
                else:
                    resolved = "gemini-3.5-flash-medium"
                logger.info(f"[LLMRouter] Routed STANDARD query to active: {resolved}")
                return resolved
