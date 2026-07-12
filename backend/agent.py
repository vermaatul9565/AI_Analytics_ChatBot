import os
import sys
import logging
from typing import Annotated, TypedDict, List, Dict, Any, Optional
from dotenv import load_dotenv
import httpx

from langchain_core.messages import BaseMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END
from langchain_core.runnables import RunnableConfig
from langgraph.graph.message import add_messages
from langchain_core.tools import tool
from langgraph.prebuilt import ToolNode

# Ensure the backend directory is in the import path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from llm.factory.factory import LLMFactory
from llm.registry.model_registry import ModelRegistry, ModelMetadata
from llm.router.routing_engine import RoutingEngine, ModelHealthManager

logger = logging.getLogger("uvicorn")

# Load environment variables using absolute path
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

# Define the state structure.
# Annotating with add_messages ensures that new messages are appended to the history.
class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    intent: Optional[str]
    complexity: Optional[str]
    required_capabilities: Optional[List[str]]
    routing_metadata: Optional[Dict[str, Any]]
    plan: Optional[str]
    routed_model: Optional[str]

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

# Node 1: Request Analysis and Dynamic Routing
async def analyze_request_node(state: State, config: RunnableConfig):
    # Extract the last user prompt
    user_prompt = ""
    for msg in reversed(state["messages"]):
        if msg.type in ["human", "user"]:
            user_prompt = msg.content
            break
            
    if not user_prompt:
        user_prompt = "Hello"

    configurable = config.get("configurable", {})
    user_preference = configurable.get("model")

    # If the user forced a specific model, resolve it, otherwise run RoutingEngine
    if user_preference and user_preference != "auto":
        meta = ModelRegistry.get_model(user_preference)
        if meta:
            model_meta = meta
        else:
            # Fallback mock metadata for user-specified models not in registry
            model_meta = ModelMetadata(
                id=user_preference,
                provider=configurable.get("provider", "google"),
                model_name=user_preference,
                context_window=200000,
                supports_vision=True,
                supports_reasoning=False,
                supports_tool_calling=True,
                supports_json_mode=True,
                supports_streaming=True,
                input_token_cost_per_million=0.0,
                output_token_cost_per_million=0.0,
                latency_estimate_seconds=1.0,
                reliability_score=1.0,
                max_output_tokens=4096,
                quality_score=1.0,
                preferred_categories=[]
            )
        routing_metadata = {
            "analysis": {
                "intent": "general_qa",
                "complexity": "simple",
                "required_capabilities": [],
                "reason": "Forced user preference"
            },
            "selected_score": 1.0,
            "all_scores": {model_meta.id: 1.0},
            "scores_breakdown": {},
            "sorted_candidates": [model_meta.id]
        }
    else:
        model_meta, routing_metadata = RoutingEngine.route_request(user_prompt)

    return {
        "intent": routing_metadata["analysis"]["intent"],
        "complexity": routing_metadata["analysis"]["complexity"],
        "required_capabilities": routing_metadata["analysis"]["required_capabilities"],
        "routing_metadata": routing_metadata,
        "routed_model": model_meta.id,
        "plan": None  # Reset plan for new turn
    }

# Node 2: Planning (Only executed for Complex tasks)
async def planning_node(state: State, config: RunnableConfig):
    user_prompt = ""
    for msg in reversed(state["messages"]):
        if msg.type in ["human", "user"]:
            user_prompt = msg.content
            break
            
    if not user_prompt:
        return {"plan": None}

    # Vetted, healthy, and cheap models to use as planning candidates
    planner_candidates = ["gemini-3.5-flash", "groq-llama-3.1-8b", "gemini-3.1-flash-lite"]
    
    prompt = (
        "You are an expert orchestrator. Create a brief, bulleted action plan to solve this request. "
        "Identify what tools (like web search) or reasoning steps are needed. Keep it under 4 bullets.\n\n"
        f"User Request: {user_prompt}"
    )

    plan_content = None
    last_error = None
    
    for model_id in planner_candidates:
        if not ModelHealthManager.is_healthy(model_id):
            continue
            
        logger.info(f"[PlanningNode] Attempting plan generation with '{model_id}'")
        try:
            meta = ModelRegistry.get_model(model_id)
            if not meta or not RoutingEngine.is_provider_available(meta.provider):
                continue
                
            llm = LLMFactory.get_chat_model(
                provider_name=meta.provider,
                model_name=meta.model_name,
                temperature=0.2
            )
            
            from langchain_core.messages import HumanMessage
            response = None
            async for chunk in llm.astream([HumanMessage(content=prompt)], config):
                if response is None:
                    response = chunk
                else:
                    response += chunk
            
            plan_content = response.content
            break
        except Exception as e:
            logger.warning(f"[PlanningNode] Plan generation failed with '{model_id}': {e}")
            ModelHealthManager.mark_unhealthy(model_id)
            last_error = e

    if not plan_content:
        logger.error(f"[PlanningNode] All planner models failed. Fallback to basic plan. Last error: {last_error}")
        plan_content = "1. Analyze user prompt.\n2. Execute web search if required.\n3. Synthesize response."

    return {"plan": plan_content}

# Node 3: LLM Execution Node (handles tool loop + fallback retries)
async def call_model_node(state: State, config: RunnableConfig):
    plan = state.get("plan")
    routed_model = state.get("routed_model", "gemini-3.5-flash")
    complexity = state.get("complexity", "simple")

    import datetime
    current_time_str = datetime.datetime.now().strftime("%A, %B %d, %Y, %I:%M %p")
    
    # Load Wiki Memory (profile, episodes, procedures) & settings
    configurable = config.get("configurable", {})
    user_id = configurable.get("user_id")
    custom_instructions = ""
    wiki_memory_str = ""
    
    if user_id:
        from database.connection import SessionLocal
        from database.models import UserSetting
        from memory.memory_service import (
            retrieve_relevant_memories, retrieve_user_profile,
            retrieve_relevant_episodes, retrieve_user_procedures
        )
        
        db = SessionLocal()
        try:
            settings = db.query(UserSetting).filter(UserSetting.user_id == user_id).first()
            if settings and settings.system_instructions:
                custom_instructions = settings.system_instructions
                
            user_prompt = ""
            for msg in reversed(state["messages"]):
                if msg.type in ["human", "user"]:
                    user_prompt = msg.content
                    break
            
            # Phase 1: Structured profile
            import json as _json
            profile = retrieve_user_profile(db, user_id)
            if profile:
                wiki_memory_str += "[User Profile]\n"
                for category, data in profile.items():
                    label = category.replace('_', ' ').title()
                    if isinstance(data, dict):
                        for k, v in data.items():
                            wiki_memory_str += f"- {k.replace('_', ' ').title()}: {v}\n"
                    elif isinstance(data, list):
                        wiki_memory_str += f"- {label}: {', '.join(str(v) for v in data)}\n"
                    elif data:
                        wiki_memory_str += f"- {label}: {data}\n"
            
            if user_prompt:
                # Phase 1 supplement: flat semantic memories
                memories = retrieve_relevant_memories(db, user_id, user_prompt, limit=5)
                if memories:
                    if not wiki_memory_str:
                        wiki_memory_str += "[User Facts]\n"
                    for m in memories:
                        # Avoid duplicating profile entries
                        if m.lower() not in wiki_memory_str.lower():
                            wiki_memory_str += f"- {m}\n"
                
                # Phase 2: Episodic memories (past conversations)
                episodes = retrieve_relevant_episodes(db, user_id, user_prompt, limit=3)
                if episodes:
                    wiki_memory_str += "\n[Relevant Past Conversations]\n"
                    for ep in episodes:
                        wiki_memory_str += f"- {ep}\n"
                
                # Phase 3: Procedural rules
                procedures = retrieve_user_procedures(db, user_id, user_prompt, limit=5)
                if procedures:
                    wiki_memory_str += "\n[User's Behavioral Preferences]\n"
                    for rule in procedures:
                        wiki_memory_str += f"- {rule}\n"
                        
        except Exception as db_err:
            logger.error(f"[AgentNode] Error loading context from DB: {db_err}", exc_info=True)
        finally:
            db.close()
            
    # Set up system instructions
    system_instruction = f"You are a helpful AI assistant. The current date and time is {current_time_str}."
    if custom_instructions:
        system_instruction += f"\n\n[User Custom Instructions]\n{custom_instructions}"
    if wiki_memory_str:
        system_instruction += f"\n\n[Wiki Memory — What You Know About This User]\n{wiki_memory_str}\nUse this knowledge to personalize your response where appropriate. Do not repeat facts unless the user asks."
    if plan:
        system_instruction += f"\n\n[Execution Plan]\nFollow this plan to answer the query:\n{plan}"

    # Get sorted candidates from routing metadata
    candidates = []
    if state.get("routing_metadata"):
        candidates = state["routing_metadata"].get("sorted_candidates", [])
    if not candidates:
        candidates = [routed_model]

    last_error = None
    success = False
    response = None
    final_model_used = routed_model

    for model_id in candidates:
        if not ModelHealthManager.is_healthy(model_id):
            continue

        try:
            meta = ModelRegistry.get_model(model_id)
            if not meta:
                continue

            logger.info(f"[AgentNode] Executing with '{model_id}' (Provider: {meta.provider})")
            
            llm = LLMFactory.get_chat_model(
                provider_name=meta.provider,
                model_name=meta.model_name,
                temperature=0.7
            )
            
            # Bind tools if supported
            if meta.supports_tool_calling:
                llm = llm.bind_tools([web_search])
            
            # Prepend system instruction to conversation history
            messages = [SystemMessage(content=system_instruction)] + list(state["messages"])
            
            # Stream events
            response = None
            async for chunk in llm.astream(messages, config):
                if response is None:
                    response = chunk
                else:
                    response += chunk

            success = True
            final_model_used = model_id
            break

        except Exception as e:
            logger.error(f"[AgentNode] Failed execution with '{model_id}': {e}", exc_info=True)
            ModelHealthManager.mark_unhealthy(model_id)
            last_error = e

    if not success:
        raise last_error or Exception("All candidate models failed execution in agent node.")

    return {"messages": [response], "routed_model": final_model_used}

# Node 4: Synthesis Node (Only executed for Complex tasks after tools finish)
async def synthesize_response_node(state: State, config: RunnableConfig):
    routed_model = state.get("routed_model", "gemini-3.5-flash-high")
    plan = state.get("plan")

    synthesis_model = routed_model
    # For complex task synthesis, upgrade to a frontier model if possible
    if state.get("complexity") == "complex":
        for candidate in ["claude-sonnet-4.6", "gemini-3.5-flash-high", "gpt-4.6-omni"]:
            if RoutingEngine.is_provider_available(ModelRegistry.get_model(candidate).provider) and ModelHealthManager.is_healthy(candidate):
                synthesis_model = candidate
                break

    # Load Wiki Memory & settings
    configurable = config.get("configurable", {})
    user_id = configurable.get("user_id")
    custom_instructions = ""
    wiki_memory_str = ""
    
    if user_id:
        from database.connection import SessionLocal
        from database.models import UserSetting
        from memory.memory_service import (
            retrieve_relevant_memories, retrieve_user_profile,
            retrieve_relevant_episodes, retrieve_user_procedures
        )
        
        db = SessionLocal()
        try:
            settings = db.query(UserSetting).filter(UserSetting.user_id == user_id).first()
            if settings and settings.system_instructions:
                custom_instructions = settings.system_instructions
                
            user_prompt = ""
            for msg in reversed(state["messages"]):
                if msg.type in ["human", "user"]:
                    user_prompt = msg.content
                    break
            
            import json as _json
            profile = retrieve_user_profile(db, user_id)
            if profile:
                wiki_memory_str += "[User Profile]\n"
                for category, data in profile.items():
                    label = category.replace('_', ' ').title()
                    if isinstance(data, dict):
                        for k, v in data.items():
                            wiki_memory_str += f"- {k.replace('_', ' ').title()}: {v}\n"
                    elif isinstance(data, list):
                        wiki_memory_str += f"- {label}: {', '.join(str(v) for v in data)}\n"
                    elif data:
                        wiki_memory_str += f"- {label}: {data}\n"
            
            if user_prompt:
                memories = retrieve_relevant_memories(db, user_id, user_prompt, limit=5)
                if memories:
                    if not wiki_memory_str:
                        wiki_memory_str += "[User Facts]\n"
                    for m in memories:
                        if m.lower() not in wiki_memory_str.lower():
                            wiki_memory_str += f"- {m}\n"
                            
                episodes = retrieve_relevant_episodes(db, user_id, user_prompt, limit=3)
                if episodes:
                    wiki_memory_str += "\n[Relevant Past Conversations]\n"
                    for ep in episodes:
                        wiki_memory_str += f"- {ep}\n"
                        
                procedures = retrieve_user_procedures(db, user_id, user_prompt, limit=5)
                if procedures:
                    wiki_memory_str += "\n[User's Behavioral Preferences]\n"
                    for rule in procedures:
                        wiki_memory_str += f"- {rule}\n"
                        
        except Exception as db_err:
            logger.error(f"[SynthesisNode] Error loading context from DB: {db_err}", exc_info=True)
        finally:
            db.close()

    logger.info(f"[SynthesisNode] Compiling final response using model '{synthesis_model}'")
    try:
        meta = ModelRegistry.get_model(synthesis_model)
        llm = LLMFactory.get_chat_model(
            provider_name=meta.provider,
            model_name=meta.model_name,
            temperature=0.5
        )

        import datetime
        current_time_str = datetime.datetime.now().strftime("%A, %B %d, %Y, %I:%M %p")
        system_prompt = (
            f"You are a master synthesis assistant. The current date and time is {current_time_str}. Review the entire conversation history, "
            "the original plan, and tool search results, and generate a polished, highly comprehensive "
            "final response. Organize it clearly using markdown headers, bullet points, and clean structures."
        )
        if custom_instructions:
            system_prompt += f"\n\n[User Custom Instructions]\n{custom_instructions}"
        if wiki_memory_str:
            system_prompt += f"\n\n[Wiki Memory — What You Know About This User]\n{wiki_memory_str}\nUse this knowledge to personalize your response where appropriate."
        if plan:
            system_prompt += f"\n\nPlan was: {plan}"

        messages = [SystemMessage(content=system_prompt)] + list(state["messages"])

        response = None
        async for chunk in llm.astream(messages, config):
            if response is None:
                response = chunk
            else:
                response += chunk

        return {"messages": [response]}
    except Exception as e:
        logger.error(f"[SynthesisNode] Synthesis failed ({e}). Returning last message directly.")
        # Fallback: return the last message as is
        return {"messages": []}



# Routing Condition Edges
def route_after_analysis(state: State):
    complexity = state.get("complexity", "simple")
    if complexity == "complex":
        return "plan"
    else:
        return "agent"

def route_after_agent(state: State):
    # If the last message has tool calls, execute tools
    messages = state.get("messages", [])
    if messages:
        last_msg = messages[-1]
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            return "tools"
            
    # No tool calls. For complex requests, run synthesis. Otherwise finish.
    complexity = state.get("complexity", "simple")
    if complexity == "complex":
        return "synthesize"
    else:
        return END


# Create the graph builder
workflow = StateGraph(State)

# Register the nodes
workflow.add_node("analyze", analyze_request_node)
workflow.add_node("planner", planning_node)
workflow.add_node("agent", call_model_node)
workflow.add_node("tools", ToolNode([web_search]))
workflow.add_node("synthesize", synthesize_response_node)

# Set up edges
workflow.add_edge(START, "analyze")

# Route conditionally after analysis
workflow.add_conditional_edges(
    "analyze",
    route_after_analysis,
    {
        "plan": "planner",
        "agent": "agent"
    }
)

# Plan flows into agent execution
workflow.add_edge("planner", "agent")

# Route conditionally after agent execution (tools vs synthesis vs END)
workflow.add_conditional_edges(
    "agent",
    route_after_agent,
    {
        "tools": "tools",
        "synthesize": "synthesize",
        END: END
    }
)

# Tools loop back to agent execution
workflow.add_edge("tools", "agent")

# Synthesis flows directly to END
workflow.add_edge("synthesize", END)

# Configure the in-memory SQLite checkpointer for session state saving
memory = MemorySaver()

# Compile the workflow into a runnable graph
graph = workflow.compile(checkpointer=memory)
