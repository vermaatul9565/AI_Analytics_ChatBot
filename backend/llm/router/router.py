import logging

logger = logging.getLogger("uvicorn")

class LLMRouter:
    @staticmethod
    def route_query(prompt: str) -> str:
        """
        Classifies the user prompt complexity and returns the target unified model key.
        Optimizes for response latency and cost by picking flash models for basic queries 
        and pro models for reasoning/analytics queries.
        """
        prompt_lower = prompt.lower().strip()
        
        # Rule 1: Very short prompts or greetings are mapped to low-cost Flash 8B
        if len(prompt_lower) < 25 or prompt_lower in ["hello", "hi", "hey", "how are you", "what is your name"]:
            resolved = "gemini-3.5-flash-low"
            logger.info(f"[LLMRouter] Routed simple query (length={len(prompt_lower)}) to: {resolved}")
            return resolved
            
        # Rule 2: Basic date/time queries
        if "date" in prompt_lower or "time" in prompt_lower or "today" in prompt_lower:
            resolved = "gemini-3.5-flash-low"
            logger.info(f"[LLMRouter] Routed time/date query to: {resolved}")
            return resolved
            
        # Rule 3: Technical keywords (data analysis, coding, web search) indicate complex tasks
        complex_keywords = [
            "analyze", "analytics", "sql", "chart", "database", "graph", "plot",
            "write code", "refactor", "bug", "error", "debug", "explain", "how to",
            "architecture", "design", "system", "compare", "versus", "vs", "summarize",
            "web search", "search the web", "tavily"
        ]
        
        if any(kw in prompt_lower for kw in complex_keywords) or len(prompt_lower) > 100:
            resolved = "gemini-3.1-pro-low"
            logger.info(f"[LLMRouter] Routed complex/analytical query to: {resolved}")
            return resolved
            
        # Default: Route to a balanced model (Gemini 1.5 Flash / 2.5 Flash equivalent)
        resolved = "gemini-3.5-flash-medium"
        logger.info(f"[LLMRouter] Routed standard query to default: {resolved}")
        return resolved
