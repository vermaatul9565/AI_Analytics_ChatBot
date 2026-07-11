from typing import Dict, List, Optional
from pydantic import BaseModel

class ModelMetadata(BaseModel):
    id: str
    provider: str
    model_name: str
    context_window: int
    supports_vision: bool
    supports_reasoning: bool
    supports_tool_calling: bool
    supports_json_mode: bool
    supports_streaming: bool
    input_token_cost_per_million: float
    output_token_cost_per_million: float
    latency_estimate_seconds: float
    reliability_score: float  # Scale of 0.0 to 1.0
    max_output_tokens: int
    quality_score: float  # Scale of 0.0 to 1.0 (relative reasoning capacity)
    preferred_categories: List[str]

class ModelRegistry:
    _models: Dict[str, ModelMetadata] = {
        "gemini-3.5-flash-low": ModelMetadata(
            id="gemini-3.5-flash-low",
            provider="google",
            model_name="gemini-1.5-flash-8b",
            context_window=1000000,
            supports_vision=True,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=0.0375,
            output_token_cost_per_million=0.15,
            latency_estimate_seconds=0.4,
            reliability_score=0.97,
            max_output_tokens=8192,
            quality_score=0.45,
            preferred_categories=["general_qa", "summarization", "writing"]
        ),
        "gemini-3.5-flash-medium": ModelMetadata(
            id="gemini-3.5-flash-medium",
            provider="google",
            model_name="gemini-2.5-flash",
            context_window=1000000,
            supports_vision=True,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=0.075,
            output_token_cost_per_million=0.30,
            latency_estimate_seconds=0.6,
            reliability_score=0.98,
            max_output_tokens=8192,
            quality_score=0.75,
            preferred_categories=["general_qa", "summarization", "writing", "tool_execution"]
        ),
        "gemini-3.5-flash-high": ModelMetadata(
            id="gemini-3.5-flash-high",
            provider="google",
            model_name="gemini-2.5-pro",
            context_window=2000000,
            supports_vision=True,
            supports_reasoning=True,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=1.25,
            output_token_cost_per_million=5.00,
            latency_estimate_seconds=1.8,
            reliability_score=0.96,
            max_output_tokens=8192,
            quality_score=0.93,
            preferred_categories=["coding", "debugging", "data_engineering", "sql_generation", "architecture_design", "reasoning"]
        ),
        "gemini-3.1-pro-low": ModelMetadata(
            id="gemini-3.1-pro-low",
            provider="google",
            model_name="gemini-1.5-pro",
            context_window=2000000,
            supports_vision=True,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=1.25,
            output_token_cost_per_million=5.00,
            latency_estimate_seconds=1.5,
            reliability_score=0.96,
            max_output_tokens=8192,
            quality_score=0.88,
            preferred_categories=["coding", "debugging", "data_engineering", "sql_generation", "architecture_design"]
        ),
        "gemini-3.1-pro-high": ModelMetadata(
            id="gemini-3.1-pro-high",
            provider="google",
            model_name="gemini-2.5-pro",
            context_window=2000000,
            supports_vision=True,
            supports_reasoning=True,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=1.25,
            output_token_cost_per_million=5.00,
            latency_estimate_seconds=1.8,
            reliability_score=0.96,
            max_output_tokens=8192,
            quality_score=0.93,
            preferred_categories=["coding", "debugging", "data_engineering", "sql_generation", "architecture_design", "reasoning"]
        ),
        "claude-sonnet-4.6": ModelMetadata(
            id="claude-sonnet-4.6",
            provider="anthropic",
            model_name="claude-3-5-sonnet-20241022",
            context_window=200000,
            supports_vision=True,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=3.00,
            output_token_cost_per_million=15.00,
            latency_estimate_seconds=1.4,
            reliability_score=0.99,
            max_output_tokens=8192,
            quality_score=0.95,
            preferred_categories=["coding", "debugging", "writing", "research", "architecture_design", "agentic_workflow", "tool_execution"]
        ),
        "claude-sonnet-4.7": ModelMetadata(
            id="claude-sonnet-4.7",
            provider="anthropic",
            model_name="claude-3-5-sonnet-20241022",
            context_window=200000,
            supports_vision=True,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=3.00,
            output_token_cost_per_million=15.00,
            latency_estimate_seconds=1.4,
            reliability_score=0.99,
            max_output_tokens=8192,
            quality_score=0.95,
            preferred_categories=["coding", "debugging", "writing", "research", "architecture_design", "agentic_workflow"]
        ),
        "claude-opus-4.6": ModelMetadata(
            id="claude-opus-4.6",
            provider="anthropic",
            model_name="claude-3-opus-20240229",
            context_window=200000,
            supports_vision=True,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=15.00,
            output_token_cost_per_million=75.00,
            latency_estimate_seconds=3.0,
            reliability_score=0.97,
            max_output_tokens=4096,
            quality_score=0.96,
            preferred_categories=["research", "writing", "reasoning"]
        ),
        "claude-opus-4.7": ModelMetadata(
            id="claude-opus-4.7",
            provider="anthropic",
            model_name="claude-3-opus-20240229",
            context_window=200000,
            supports_vision=True,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=15.00,
            output_token_cost_per_million=75.00,
            latency_estimate_seconds=3.0,
            reliability_score=0.97,
            max_output_tokens=4096,
            quality_score=0.96,
            preferred_categories=["research", "writing", "reasoning"]
        ),
        "claude-opus-4.8": ModelMetadata(
            id="claude-opus-4.8",
            provider="anthropic",
            model_name="claude-3-opus-20240229",
            context_window=200000,
            supports_vision=True,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=15.00,
            output_token_cost_per_million=75.00,
            latency_estimate_seconds=3.0,
            reliability_score=0.97,
            max_output_tokens=4096,
            quality_score=0.96,
            preferred_categories=["research", "writing", "reasoning"]
        ),
        "claude-fable-5": ModelMetadata(
            id="claude-fable-5",
            provider="anthropic",
            model_name="claude-3-5-sonnet-20241022",
            context_window=200000,
            supports_vision=True,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=3.00,
            output_token_cost_per_million=15.00,
            latency_estimate_seconds=1.4,
            reliability_score=0.99,
            max_output_tokens=8192,
            quality_score=0.95,
            preferred_categories=["coding", "debugging", "writing", "research", "architecture_design", "agentic_workflow"]
        ),
        "gpt-4.6-omni": ModelMetadata(
            id="gpt-4.6-omni",
            provider="openai",
            model_name="gpt-4o",
            context_window=128000,
            supports_vision=True,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=2.50,
            output_token_cost_per_million=10.00,
            latency_estimate_seconds=1.2,
            reliability_score=0.98,
            max_output_tokens=4096,
            quality_score=0.92,
            preferred_categories=["coding", "debugging", "general_qa", "summarization", "writing", "tool_execution"]
        ),
        "gpt-5.5-omni": ModelMetadata(
            id="gpt-5.5-omni",
            provider="openai",
            model_name="gpt-4o",
            context_window=128000,
            supports_vision=True,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=2.50,
            output_token_cost_per_million=10.00,
            latency_estimate_seconds=1.2,
            reliability_score=0.98,
            max_output_tokens=4096,
            quality_score=0.92,
            preferred_categories=["coding", "debugging", "general_qa", "summarization", "writing"]
        ),
        "gpt-5.6-omni": ModelMetadata(
            id="gpt-5.6-omni",
            provider="openai",
            model_name="gpt-4o",
            context_window=128000,
            supports_vision=True,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=2.50,
            output_token_cost_per_million=10.00,
            latency_estimate_seconds=1.2,
            reliability_score=0.98,
            max_output_tokens=4096,
            quality_score=0.92,
            preferred_categories=["coding", "debugging", "general_qa", "summarization", "writing"]
        ),
        "groq-llama-3.3-70b": ModelMetadata(
            id="groq-llama-3.3-70b",
            provider="groq",
            model_name="llama-3.3-70b-versatile",
            context_window=128000,
            supports_vision=False,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=0.59,
            output_token_cost_per_million=0.79,
            latency_estimate_seconds=0.3,
            reliability_score=0.99,
            max_output_tokens=4096,
            quality_score=0.82,
            preferred_categories=["coding", "debugging", "general_qa", "summarization", "tool_execution"]
        ),
        "groq-llama-3.1-8b": ModelMetadata(
            id="groq-llama-3.1-8b",
            provider="groq",
            model_name="llama-3.1-8b-instant",
            context_window=128000,
            supports_vision=False,
            supports_reasoning=False,
            supports_tool_calling=True,
            supports_json_mode=True,
            supports_streaming=True,
            input_token_cost_per_million=0.05,
            output_token_cost_per_million=0.08,
            latency_estimate_seconds=0.15,
            reliability_score=0.99,
            max_output_tokens=4096,
            quality_score=0.45,
            preferred_categories=["general_qa", "summarization", "writing"]
        ),
    }

    @classmethod
    def get_model(cls, model_id: str) -> Optional[ModelMetadata]:
        return cls._models.get(model_id)

    @classmethod
    def list_models(cls) -> List[ModelMetadata]:
        return list(cls._models.values())
