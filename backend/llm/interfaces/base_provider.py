from abc import ABC, abstractmethod
from langchain_core.language_models.chat_models import BaseChatModel

class BaseModelProvider(ABC):
    """Abstract Base Class for LLM providers."""
    
    @abstractmethod
    def get_chat_model(self, model_name: str, temperature: float, **kwargs) -> BaseChatModel:
        """Return an initialized chat model."""
        pass

    @abstractmethod
    def get_embedding_model(self, model_name: str, **kwargs):
        """Return an initialized embedding model."""
        pass

    @abstractmethod
    def get_vision_model(self, model_name: str, **kwargs):
        """Return an initialized vision model."""
        pass
