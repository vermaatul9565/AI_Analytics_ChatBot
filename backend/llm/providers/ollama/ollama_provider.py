from llm.interfaces.base_provider import BaseModelProvider
from langchain_core.language_models.chat_models import BaseChatModel

class OllamaModelProvider(BaseModelProvider):
    """Ollama model provider implementation."""
    
    def get_chat_model(self, model_name: str, temperature: float, **kwargs) -> BaseChatModel:
        try:
            from langchain_community.chat_models import ChatOllama
            import os
            base_url = os.environ.get("OLLAMA_HOST") or os.environ.get("OLLAMA_BASE_URL") or "http://host.docker.internal:11434"
            return ChatOllama(base_url=base_url, model=model_name, temperature=temperature, **kwargs)
        except ImportError:
            raise ImportError(
                "langchain-community is required to use the ollama provider. "
                "Install it using `pip install langchain-community`"
            )

    def get_embedding_model(self, model_name: str, **kwargs):
        raise NotImplementedError("Embedding model not implemented for Ollama provider yet.")

    def get_vision_model(self, model_name: str, **kwargs):
        raise NotImplementedError("Vision model not implemented for Ollama provider yet.")
