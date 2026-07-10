from abc import ABC, abstractmethod

class BaseEmbeddingModelInterface(ABC):
    """Abstract base class for all embedding models."""
    
    @abstractmethod
    def embed_query(self, text: str) -> list[float]:
        """Embed a single query string."""
        pass
        
    @abstractmethod
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of document strings."""
        pass
