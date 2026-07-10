from abc import ABC, abstractmethod

class BaseVisionModelInterface(ABC):
    """Abstract base class for all vision/multimodal models."""
    
    @abstractmethod
    def analyze_image(self, image_data: bytes, prompt: str) -> str:
        """Analyze an image with a textual prompt."""
        pass
