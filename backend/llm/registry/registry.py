from typing import Dict, Type
from llm.interfaces.base_provider import BaseModelProvider

class ProviderRegistry:
    """Central registry for LLM providers."""
    
    _providers: Dict[str, Type[BaseModelProvider]] = {}

    @classmethod
    def register(cls, name: str, provider_cls: Type[BaseModelProvider]):
        """Register a new LLM provider class."""
        cls._providers[name.lower()] = provider_cls

    @classmethod
    def get_provider_class(cls, name: str) -> Type[BaseModelProvider]:
        """Look up a provider class by name."""
        provider_cls = cls._providers.get(name.lower())
        if not provider_cls:
            raise ValueError(
                f"LLM Provider '{name}' is not registered. Available providers: {list(cls._providers.keys())}"
            )
        return provider_cls
