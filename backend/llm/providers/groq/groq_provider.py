from llm.interfaces.base_provider import BaseModelProvider
from langchain_core.language_models.chat_models import BaseChatModel

class GroqModelProvider(BaseModelProvider):
    """Groq model provider implementation."""
    
    def get_chat_model(self, model_name: str, temperature: float, **kwargs) -> BaseChatModel:
        try:
            from langchain_groq import ChatGroq
            return ChatGroq(model_name=model_name, temperature=temperature, **kwargs)
        except ImportError:
            raise ImportError(
                "langchain-groq is required to use the groq provider. "
                "Install it using `pip install langchain-groq`"
            )

    def get_embedding_model(self, model_name: str, **kwargs):
        raise NotImplementedError("Embedding model not implemented for Groq provider yet.")

    def get_vision_model(self, model_name: str, **kwargs):
        raise NotImplementedError("Vision model not implemented for Groq provider yet.")
