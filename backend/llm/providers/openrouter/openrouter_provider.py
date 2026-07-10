from llm.interfaces.base_provider import BaseModelProvider
from langchain_core.language_models.chat_models import BaseChatModel

class OpenRouterModelProvider(BaseModelProvider):
    """OpenRouter model provider implementation."""
    
    def get_chat_model(self, model_name: str, temperature: float, **kwargs) -> BaseChatModel:
        try:
            from langchain_openai import ChatOpenAI
            # OpenRouter is OpenAI-compatible; we just point the base_url
            return ChatOpenAI(
                model=model_name,
                temperature=temperature,
                openai_api_base="https://openrouter.ai/api/v1",
                **kwargs
            )
        except ImportError:
            raise ImportError(
                "langchain-openai is required to use the openrouter provider. "
                "Install it using `pip install langchain-openai`"
            )

    def get_embedding_model(self, model_name: str, **kwargs):
        raise NotImplementedError("Embedding model not implemented for OpenRouter provider yet.")

    def get_vision_model(self, model_name: str, **kwargs):
        raise NotImplementedError("Vision model not implemented for OpenRouter provider yet.")
