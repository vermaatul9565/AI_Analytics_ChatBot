from llm.interfaces.base_provider import BaseModelProvider
from langchain_core.language_models.chat_models import BaseChatModel

class AnthropicModelProvider(BaseModelProvider):
    """Anthropic model provider implementation."""
    
    def get_chat_model(self, model_name: str, temperature: float, **kwargs) -> BaseChatModel:
        try:
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(model=model_name, temperature=temperature, **kwargs)
        except ImportError:
            raise ImportError(
                "langchain-anthropic is required to use the anthropic provider. "
                "Install it using `pip install langchain-anthropic`"
            )

    def get_embedding_model(self, model_name: str, **kwargs):
        raise NotImplementedError("Embedding model not implemented for Anthropic provider yet.")

    def get_vision_model(self, model_name: str, **kwargs):
        raise NotImplementedError("Vision model not implemented for Anthropic provider yet.")
