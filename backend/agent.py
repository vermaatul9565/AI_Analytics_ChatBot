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
from llm.router.router import LLMRouter

# Load environment variables using absolute path
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

# Define the state structure.
# Annotating with add_messages ensures that new messages are appended to the history.
class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

# Define the web search tool using Tavily API
@tool
def web_search(query: str) -> str:
    """Executes a real-time web search for the query using the Tavily Search API. Useful to answer current/news events."""
    try:
        tavily_api_key = os.environ.get("TAVILY_API_KEY")
        if not tavily_api_key:
            return "Error: TAVILY_API_KEY is not set in environment."
            
        with httpx.Client(timeout=15.0) as client:
            response = client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": tavily_api_key,
                    "query": query,
                    "search_depth": "basic",
                    "max_results": 3,
                }
            )
            response.raise_for_status()
            data = response.json()
            results = data.get("results", [])
            
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
    
    # If Auto mode is selected, route semantically based on query content
    if model == "auto":
        # Extract the last user message prompt
        user_prompt = ""
        for msg in reversed(state["messages"]):
            if msg.type in ["human", "user"]:
                user_prompt = msg.content
                break
        
        # If we found a user prompt, route it semantically
        if user_prompt:
            model = LLMRouter.route_query(user_prompt)
            provider = None # Factory will look up provider from model map
        else:
            model = "gemini-3.5-flash-medium" # Default fallback
            
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
