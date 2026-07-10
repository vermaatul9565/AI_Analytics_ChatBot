import os
from llm.registry.registry import ProviderRegistry
from llm.interfaces.base_provider import BaseModelProvider
from langchain_core.language_models.chat_models import BaseChatModel

class LLMFactory:
    """Factory to instantiate LLM providers and models dynamically from environment/config."""
    
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
        provider = LLMFactory.get_provider(provider_name)
        
        if not model_name:
            model_name = os.environ.get("LLM_MODEL")
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
