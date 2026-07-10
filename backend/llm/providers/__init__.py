from llm.registry.registry import ProviderRegistry
from llm.providers.google.google_provider import GoogleModelProvider
from llm.providers.openai.openai_provider import OpenAIModelProvider
from llm.providers.anthropic.anthropic_provider import AnthropicModelProvider
from llm.providers.ollama.ollama_provider import OllamaModelProvider
from llm.providers.groq.groq_provider import GroqModelProvider
from llm.providers.openrouter.openrouter_provider import OpenRouterModelProvider

# Register all concrete providers with the central ProviderRegistry
ProviderRegistry.register("google", GoogleModelProvider)
ProviderRegistry.register("openai", OpenAIModelProvider)
ProviderRegistry.register("anthropic", AnthropicModelProvider)
ProviderRegistry.register("ollama", OllamaModelProvider)
ProviderRegistry.register("groq", GroqModelProvider)
ProviderRegistry.register("openrouter", OpenRouterModelProvider)
