import os
from llm.registry.registry import ProviderRegistry
from llm.interfaces.base_provider import BaseModelProvider
from langchain_core.language_models.chat_models import BaseChatModel

class LLMFactory:
    """Factory to instantiate LLM providers and models dynamically from environment/config."""
    
    UNIFIED_MODEL_MAP = {
        "gemini-3.1-flash-lite": {"provider": "google", "model": "gemini-3.1-flash-lite"},
        "gemini-3.5-flash": {"provider": "google", "model": "gemini-3.5-flash"},
        "gemini-3.5-flash-high": {"provider": "google", "model": "gemini-3.5-flash"},
        "gemini-3.1-pro-preview": {"provider": "google", "model": "gemini-3.1-pro-preview"},
        "gemini-3.1-pro-preview-high": {"provider": "google", "model": "gemini-3.1-pro-preview"},
        "claude-sonnet-4.6": {"provider": "anthropic", "model": "claude-3-5-sonnet-20241022"},
        "claude-sonnet-4.7": {"provider": "anthropic", "model": "claude-3-5-sonnet-20241022"},
        "claude-opus-4.6": {"provider": "anthropic", "model": "claude-3-opus-20240229"},
        "claude-opus-4.7": {"provider": "anthropic", "model": "claude-3-opus-20240229"},
        "claude-opus-4.8": {"provider": "anthropic", "model": "claude-3-opus-20240229"},
        "claude-fable-5": {"provider": "anthropic", "model": "claude-3-5-sonnet-20241022"},
        "gpt-4.6-omni": {"provider": "openai", "model": "gpt-4o"},
        "gpt-5.5-omni": {"provider": "openai", "model": "gpt-4o"},
        "gpt-5.6-omni": {"provider": "openai", "model": "gpt-4o"},
        "groq-llama-3.3-70b": {"provider": "groq", "model": "llama-3.3-70b-versatile"},
        "groq-llama-3.1-8b": {"provider": "groq", "model": "llama-3.1-8b-instant"},
        "ollama-qwen2.5-coder-14b": {"provider": "ollama", "model": "qwen2.5-coder:14b"},
        "ollama-gemma4-e4b": {"provider": "ollama", "model": "gemma4:e4b"},
    }
    
    @staticmethod
    def get_provider(provider_name: str = None) -> BaseModelProvider:
        # Import providers package to trigger self-registration
        import llm.providers
        
        if not provider_name:
            provider_name = os.environ.get("LLM_PROVIDER", "google")
        provider_cls = ProviderRegistry.get_provider_class(provider_name)
        return provider_cls()

    @staticmethod
    def get_chat_model(
        provider_name: str = None,
        model_name: str = None,
        temperature: float = None,
        **kwargs
    ) -> BaseChatModel:
        # Resolve model name from env if not explicitly passed
        if not model_name:
            model_name = os.environ.get("LLM_MODEL")
            
        # Translate unified models to concrete provider and model strings
        if model_name in LLMFactory.UNIFIED_MODEL_MAP:
            mapping = LLMFactory.UNIFIED_MODEL_MAP[model_name]
            provider_name = mapping["provider"]
            model_name = mapping["model"]
            
        provider = LLMFactory.get_provider(provider_name)
        
        if not model_name:
            p_name = provider_name or os.environ.get("LLM_PROVIDER", "google")
            if p_name.lower() == "google":
                model_name = "gemini-3.1-flash-lite"
            else:
                model_name = "default-model"
                    
        if temperature is None:
            try:
                temperature = float(os.environ.get("LLM_TEMPERATURE", "0.7"))
            except ValueError:
                temperature = 0.7
                
        return provider.get_chat_model(model_name=model_name, temperature=temperature, **kwargs)
