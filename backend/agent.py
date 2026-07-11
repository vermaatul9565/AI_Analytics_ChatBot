import os
import sys
from typing import Annotated, TypedDict
from dotenv import load_dotenv
import httpx

from langchain_core.messages import BaseMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END
from langchain_core.runnables import RunnableConfig
from langgraph.graph.message import add_messages
from langchain_core.tools import tool
from langgraph.prebuilt import ToolNode, tools_condition

# Ensure the backend directory is in the import path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from llm.factory.factory import LLMFactory

# Load environment variables using absolute path
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Define the state structure.
# Annotating with add_messages ensures that new messages are appended to the history.
class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

# Define the web search tool using Tavily API
@tool
def web_search(query: str) -> str:
    """Search the web for current or real-time information on a topic."""
    api_key = os.environ.get("TAVILY_API_KEY") or os.environ.get("TAVILTY_API_KEY")
    if not api_key:
        return "Tavily API key is not configured. Please add TAVILY_API_KEY to your environment."
    
    try:
        response = httpx.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": query,
                "search_depth": "basic",
                "max_results": 3
            },
            timeout=10.0
        )
        response.raise_for_status()
        results = response.json().get("results", [])
        if not results:
            return "No search results found."
        
        formatted = []
        for r in results:
            formatted.append(f"Title: {r['title']}\nURL: {r['url']}\nContent: {r['content']}\n")
        return "\n---\n".join(formatted)
    except Exception as e:
        return f"Error executing web search: {str(e)}"

# Define the node that calls the model
async def call_model(state: State, config: RunnableConfig):
    # Extract dynamic model/provider settings from graph config
    configurable = config.get("configurable", {})
    provider = configurable.get("provider")
    model = configurable.get("model")
    
    # Retrieve the model dynamically from the factory
    llm = LLMFactory.get_chat_model(
        provider_name=provider,
        model_name=model
    ).bind_tools([web_search])
    
    # We stream the LLM response to ensure stream events are emitted
    response = None
    async for chunk in llm.astream(state["messages"], config):
        if response is None:
            response = chunk
        else:
            response += chunk
    
    return {"messages": [response]}

# Create a graph builder
workflow = StateGraph(State)

# Define the nodes in our graph
workflow.add_node("agent", call_model)
workflow.add_node("tools", ToolNode([web_search]))

# Define the edges and routing logic
workflow.add_edge(START, "agent")
# Route to tools node if a tool call was requested, else route to END
workflow.add_conditional_edges("agent", tools_condition)
workflow.add_edge("tools", "agent")

# Configure the in-memory SQLite checkpointer for session state saving
memory = MemorySaver()

# Compile the workflow into a runnable graph
graph = workflow.compile(checkpointer=memory)
