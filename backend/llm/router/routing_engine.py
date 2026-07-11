import json
import logging
import os
import re
import time
from typing import Dict, List, Any, Optional, Tuple

from llm.registry.model_registry import ModelRegistry, ModelMetadata
from llm.factory.factory import LLMFactory

logger = logging.getLogger("uvicorn")

class ModelHealthManager:
    """Manages transient health/unhealthy status of models with a time-to-live (TTL)."""
    _unhealthy_models: Dict[str, float] = {}  # model_id -> expiry_timestamp

    @classmethod
    def mark_unhealthy(cls, model_id: str, duration_seconds: int = 300):
        """Mark a model as unhealthy for a duration (default 5 minutes)."""
        expiry = time.time() + duration_seconds
        cls._unhealthy_models[model_id] = expiry
        logger.warning(f"[ModelHealthManager] Model '{model_id}' marked UNHEALTHY until {time.strftime('%H:%M:%S', time.localtime(expiry))}")

    @classmethod
    def is_healthy(cls, model_id: str) -> bool:
        """Check if a model is currently healthy."""
        expiry = cls._unhealthy_models.get(model_id)
        if expiry:
            if time.time() < expiry:
                return False
            # Clean up expired entry
            cls._unhealthy_models.pop(model_id, None)
        return True


class RoutingEngine:
    """Handles prompt classification, complexity scoring, capabilities detection, and dynamic LLM routing."""

    @staticmethod
    def is_provider_available(provider: str) -> bool:
        """Checks if the required environment variables / API keys exist for a provider."""
        provider_lower = provider.lower()
        if provider_lower == "google":
            key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        elif provider_lower == "openai":
            key = os.environ.get("OPENAI_API_KEY")
        elif provider_lower == "anthropic":
            key = os.environ.get("ANTHROPIC_API_KEY")
        elif provider_lower == "groq":
            key = os.environ.get("GROQ_API_KEY")
        elif provider_lower == "openrouter":
            key = os.environ.get("OPENROUTER_API_KEY")
        elif provider_lower == "ollama":
            # Ollama is local, assume available
            return True
        else:
            return False

        if not key:
            return False
        
        # Verify it's not a placeholder key
        key_stripped = key.strip()
        if not key_stripped or key_stripped.lower().startswith("your_") or "dummy" in key_stripped.lower():
            return False
        return True

    @classmethod
    def run_heuristic_classifier(cls, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Fast heuristic classifier to bypass LLM classification for simple queries.
        Returns analysis dictionary if match found, else None.
        """
        prompt_clean = prompt.lower().strip()

        # Rule 1: Very short prompts or greetings are simple Q&A
        greetings = {"hello", "hi", "hey", "how are you", "what is your name", "ping"}
        if len(prompt_clean) < 15 or prompt_clean in greetings:
            return {
                "intent": "general_qa",
                "complexity": "simple",
                "required_capabilities": [],
                "reason": "Heuristic match: Greeting or short query"
            }

        # Rule 2: Basic date/time queries
        if prompt_clean in {"date", "time", "what date is it", "what time is it", "today"}:
            return {
                "intent": "general_qa",
                "complexity": "simple",
                "required_capabilities": [],
                "reason": "Heuristic match: Simple date/time"
            }

        # Rule 3: Very simple math
        if re.match(r"^[\d\s\+\-\*\/\(\)\=\?]+$", prompt_clean) and len(prompt_clean) < 30:
            return {
                "intent": "general_qa",
                "complexity": "simple",
                "required_capabilities": [],
                "reason": "Heuristic match: Simple arithmetic"
            }

        return None

    @classmethod
    def run_llm_classifier(cls, prompt: str) -> Dict[str, Any]:
        """Runs a fast LLM call to classify intent, complexity, and capabilities."""
        # Find a fast, available model to perform the classification
        classifier_candidates = [
            "groq-llama-3.1-8b",
            "gemini-3.1-flash-lite",
            "gemini-3.5-flash"
        ]
        
        selected_model = None
        for candidate in classifier_candidates:
            metadata = ModelRegistry.get_model(candidate)
            if metadata and cls.is_provider_available(metadata.provider) and ModelHealthManager.is_healthy(candidate):
                selected_model = candidate
                break

        if not selected_model:
            # Default fallback if no keys configured or healthy
            logger.warning("[RoutingEngine] No healthy classifier candidates available. Falling back to heuristic classifier.")
            return cls.run_fallback_classifier(prompt)

        try:
            # Instantiate classifier model with 0 temperature and JSON/text constraints
            llm = LLMFactory.get_chat_model(
                provider_name=ModelRegistry.get_model(selected_model).provider,
                model_name=ModelRegistry.get_model(selected_model).model_name,
                temperature=0.0
            )
            
            system_instruction = (
                "You are an expert AI orchestrator. Analyze the user prompt and respond with a single JSON block. "
                "Do NOT wrap JSON in markdown backticks. Do NOT output any other text.\n\n"
                "JSON format:\n"
                "{\n"
                "  \"intent\": \"coding\" | \"debugging\" | \"general_qa\" | \"writing\" | \"research\" | \"summarization\" | \"image_analysis\" | \"data_engineering\" | \"sql_generation\" | \"architecture_design\" | \"agentic_workflow\" | \"tool_execution\",\n"
                "  \"complexity\": \"simple\" | \"medium\" | \"complex\",\n"
                "  \"required_capabilities\": List containing zero or more of: [\"coding\", \"vision\", \"long_context\", \"tool_calling\", \"web_search\", \"structured_json\", \"reasoning\", \"planning\", \"image_generation\", \"code_execution\", \"sql_generation\"]\n"
                "}"
            )
            
            messages = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": f"User Prompt: {prompt}"}
            ]
            
            # Simple invoke
            response = llm.invoke(messages)
            content = response.content.strip()
            
            # Clean potential markdown wrapping if the LLM ignored instructions
            if content.startswith("```"):
                content = re.sub(r"^```(?:json)?\n", "", content)
                content = re.sub(r"\n```$", "", content)
            
            data = json.loads(content)
            
            # Basic validation
            intent = data.get("intent", "general_qa")
            complexity = data.get("complexity", "medium")
            required_capabilities = data.get("required_capabilities", [])
            
            return {
                "intent": intent,
                "complexity": complexity,
                "required_capabilities": required_capabilities,
                "reason": f"Classified by {selected_model}"
            }
            
        except Exception as e:
            logger.error(f"[RoutingEngine] LLM Classification failed ({e}). Falling back to heuristics.")
            return cls.run_fallback_classifier(prompt)

    @classmethod
    def run_fallback_classifier(cls, prompt: str) -> Dict[str, Any]:
        """A robust keyword-based regex classifier as a safety fallback."""
        prompt_lower = prompt.lower().strip()
        
        # Detect intent and capabilities
        intent = "general_qa"
        capabilities = []
        
        # 1. Coding / Debugging
        if any(w in prompt_lower for w in ["write code", "code in", "python", "javascript", "typescript", "c++", "java", "html", "css", "api", "function"]):
            intent = "coding"
            capabilities.append("coding")
        if any(w in prompt_lower for w in ["bug", "error", "debug", "exception", "traceback", "crash", "fails", "doesn't work"]):
            intent = "debugging"
            capabilities.extend(["coding", "reasoning"])
            
        # 2. SQL / Database
        elif any(w in prompt_lower for w in ["sql", "database", "postgres", "mysql", "query", "tables", "join"]):
            intent = "sql_generation"
            capabilities.append("sql_generation")
            
        # 3. Web Search
        if any(w in prompt_lower for w in ["search", "google", "web search", "news", "current", "latest", "recent", "tavily"]):
            capabilities.append("web_search")
            if intent == "general_qa":
                intent = "research"

        # 4. Summarization / Writing
        if any(w in prompt_lower for w in ["summarize", "summary", "tl;dr", "tldr"]):
            intent = "summarization"
        elif any(w in prompt_lower for w in ["write an essay", "draft", "write a blog", "paragraph", "grammar"]):
            intent = "writing"

        # Determine complexity
        complexity = "medium"
        if len(prompt_lower) < 50:
            complexity = "simple"
        elif len(prompt_lower) > 300 or any(w in prompt_lower for w in ["architect", "system design", "refactor multiple", "complex", "optimize"]):
            complexity = "complex"
            capabilities.append("planning")

        return {
            "intent": intent,
            "complexity": complexity,
            "required_capabilities": list(set(capabilities)),
            "reason": "Fallback Keyword Heuristics"
        }

    @classmethod
    def route_request(cls, prompt: str, user_preference: Optional[str] = None) -> Tuple[ModelMetadata, Dict[str, Any]]:
        """
        Determines the optimal model for a prompt based on:
        1. Intent and required capabilities
        2. Policy weight criteria (quality, cost, latency, reliability)
        3. Model health and API key availability
        """
        # Step 1: Classify Prompt
        analysis = cls.run_heuristic_classifier(prompt)
        if not analysis:
            analysis = cls.run_llm_classifier(prompt)

        intent = analysis["intent"]
        complexity = analysis["complexity"]
        required_caps = analysis["required_capabilities"]

        # Step 2: Load weights policy from routing_config.json
        config_path = os.path.join(os.path.dirname(__file__), "routing_config.json")
        weights = {"quality": 0.40, "cost": 0.20, "latency": 0.20, "reliability": 0.20}
        pref = user_preference or "balanced"

        try:
            with open(config_path, "r") as f:
                config_data = json.load(f)
                presets = config_data.get("routing_policy", {}).get("presets", {})
                if pref in presets:
                    weights = presets[pref]
                else:
                    weights = config_data.get("routing_policy", {}).get("weights", weights)
        except Exception as e:
            logger.warning(f"[RoutingEngine] Failed to load routing_config.json ({e}). Using default balanced weights.")

        # Prioritize cost and latency/speed heavily for simple tasks
        if complexity == "simple":
            logger.info("[RoutingEngine] Simple task detected. Overriding weights to prioritize cost and latency/speed.")
            weights = {
                "quality": 0.0,
                "cost": 0.50,
                "latency": 0.40,
                "reliability": 0.10
            }

        # Step 3: Evaluate Candidates
        candidates = ModelRegistry.list_models()
        valid_candidates = []

        # Find max cost and max latency for normalization
        max_cost = max([m.input_token_cost_per_million + 3 * m.output_token_cost_per_million for m in candidates])
        max_latency = max([m.latency_estimate_seconds for m in candidates])

        for model in candidates:
            # Filter 3a: Check provider key
            if not cls.is_provider_available(model.provider):
                continue
            
            # Filter 3b: Check model health
            if not ModelHealthManager.is_healthy(model.id):
                continue

            # Filter 3c: Check capability matching (Hard constraints)
            incapable = False
            for cap in required_caps:
                if cap == "vision" and not model.supports_vision:
                    incapable = True
                elif cap == "tool_calling" and not model.supports_tool_calling:
                    incapable = True
                elif cap == "structured_json" and not model.supports_json_mode:
                    incapable = True
                elif cap == "streaming" and not model.supports_streaming:
                    incapable = True
            
            if incapable:
                continue

            # Step 4: Calculate Normalized Scores
            # Cost Score: 1.0 = Free/Cheap, 0.0 = Expensive
            model_cost = model.input_token_cost_per_million + 3 * model.output_token_cost_per_million
            cost_score = 1.0 - (model_cost / max_cost) if max_cost > 0 else 1.0

            # Latency Score: 1.0 = Fast, 0.0 = Slow
            latency_score = 1.0 - (model.latency_estimate_seconds / max_latency) if max_latency > 0 else 1.0

            # Quality Score & Category Match Bonus
            quality_score = model.quality_score
            if intent in model.preferred_categories:
                # Add a 10% preferred category match bonus, capping at 1.0
                quality_score = min(1.0, quality_score + 0.10)

            reliability_score = model.reliability_score

            # Total Weighted Score
            total_score = (
                weights.get("quality", 0.4) * quality_score +
                weights.get("cost", 0.2) * cost_score +
                weights.get("latency", 0.2) * latency_score +
                weights.get("reliability", 0.2) * reliability_score
            )

            valid_candidates.append((model, total_score, {
                "quality_score": round(quality_score, 2),
                "cost_score": round(cost_score, 2),
                "latency_score": round(latency_score, 2),
                "reliability_score": round(reliability_score, 2)
            }))

        if not valid_candidates:
            # Absolute fallback if no candidate satisfies constraints or has active keys
            # Use gemini-3.5-flash if available (default fallback)
            logger.critical("[RoutingEngine] NO VALID MODELS PASSED FILTERS! Defaulting to google/gemini-3.5-flash.")
            fallback_model = ModelRegistry.get_model("gemini-3.5-flash")
            return fallback_model, {
                "analysis": analysis,
                "weights": weights,
                "selected_score": 1.0,
                "all_scores": {"gemini-3.5-flash": 1.0},
                "scores_breakdown": {}
            }

        # Sort candidates by score descending
        valid_candidates.sort(key=lambda x: x[1], reverse=True)
        best_model, best_score, breakdown = valid_candidates[0]

        all_scores = {m[0].id: round(m[1], 3) for m in valid_candidates}
        
        routing_metadata = {
            "analysis": analysis,
            "weights": weights,
            "selected_score": round(best_score, 3),
            "all_scores": all_scores,
            "scores_breakdown": breakdown,
            "sorted_candidates": [m[0].id for m in valid_candidates]
        }

        logger.info(f"[RoutingEngine] Routed request to '{best_model.id}' (Score: {round(best_score, 3)}) | Intent: {intent} | Complexity: {complexity}")
        return best_model, routing_metadata
