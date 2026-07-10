from llm.interfaces.base_provider import BaseModelProvider
from langchain_core.language_models.chat_models import BaseChatModel

class OpenAIModelProvider(BaseModelProvider):
    """OpenAI model provider implementation."""
    
    def get_chat_model(self, model_name: str, temperature: float, **kwargs) -> BaseChatModel:
        try:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(model=model_name, temperature=temperature, **kwargs)
        except ImportError:
            raise ImportError(
                "langchain-openai is required to use the openai provider. "
                "Install it using `pip install langchain-openai`"
            )

    def get_embedding_model(self, model_name: str, **kwargs):
        raise NotImplementedError("Embedding model not implemented for OpenAI provider yet.")

    def get_vision_model(self, model_name: str, **kwargs):
        raise NotImplementedError("Vision model not implemented for OpenAI provider yet.")
