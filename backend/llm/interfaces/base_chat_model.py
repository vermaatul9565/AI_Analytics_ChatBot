# pyrefly: ignore [missing-import]
from langchain_core.language_models.chat_models import BaseChatModel

class BaseChatModelInterface(BaseChatModel):
    """Base chat model interface that all concrete provider chat models inherit."""
    pass
