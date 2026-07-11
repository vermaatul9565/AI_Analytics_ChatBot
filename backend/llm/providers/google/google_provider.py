import os
from datetime import datetime
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, AIMessageChunk, SystemMessage
from langchain_core.outputs import ChatResult, ChatGeneration, ChatGenerationChunk
from llm.interfaces.base_provider import BaseModelProvider
from llm.interfaces.base_chat_model import BaseChatModelInterface

import google.generativeai as genai
from google.ai.generativelanguage_v1beta import Content, Part, FunctionCall, FunctionResponse
import logging

logger = logging.getLogger("uvicorn")

# Helper to convert LangChain messages to Gemini protobuf objects
def convert_messages_to_gemini(messages):
    gemini_contents = []
    
    for msg in messages:
        if isinstance(msg, HumanMessage):
            gemini_contents.append(
                Content(role="user", parts=[Part(text=msg.content)])
            )
        elif isinstance(msg, AIMessage):
            # If we have base64 serialized raw parts, restore them to preserve thought signatures
            raw_parts_b64 = msg.additional_kwargs.get("raw_parts")
            if raw_parts_b64:
                import base64
                parts = []
                for part_b64 in raw_parts_b64:
                    p = Part()
                    p._pb.ParseFromString(base64.b64decode(part_b64))
                    parts.append(p)
                gemini_contents.append(Content(role="model", parts=parts))
            else:
                parts = []
                if msg.content:
                    parts.append(Part(text=msg.content))
                
                # Map tool calls back
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    for tc in msg.tool_calls:
                        fc = FunctionCall(
                            name=tc["name"],
                            args=tc["args"]
                        )
                        part = Part(function_call=fc)
                        
                        # Restore thought signature to the Part!
                        thought_sig = msg.additional_kwargs.get("thought_signature")
                        if thought_sig:
                            part.thought_signature = thought_sig
                            
                        parts.append(part)
                
                gemini_contents.append(Content(role="model", parts=parts))
            
        elif isinstance(msg, ToolMessage):
            fr = FunctionResponse(
                name=msg.name,
                response={"result": msg.content}
            )
            gemini_contents.append(
                Content(role="user", parts=[Part(function_response=fr)])
            )
            
    return gemini_contents

# Helper to convert Gemini candidate content to LangChain message
def convert_gemini_to_message(candidate_content):
    import base64
    content = ""
    tool_calls = []
    additional_kwargs = {}
    
    # Base64 serialize raw parts to preserve unknown fields/thought signatures
    raw_parts = []
    for part in candidate_content.parts:
        part_bytes = part._pb.SerializeToString()
        raw_parts.append(base64.b64encode(part_bytes).decode("utf-8"))
        
        if part.text:
            content += part.text
        if part.function_call:
            # Extract thought_signature from the Part
            thought_sig = getattr(part, "thought_signature", None)
            if thought_sig:
                additional_kwargs["thought_signature"] = thought_sig
                
            args_dict = {k: v for k, v in part.function_call.args.items()}
            tool_calls.append({
                "name": part.function_call.name,
                "args": args_dict,
                "id": f"call_{part.function_call.name}",
                "type": "tool_call"
            })
            
    additional_kwargs["raw_parts"] = raw_parts
    ai_msg = AIMessage(content=content, additional_kwargs=additional_kwargs)
    if tool_calls:
        ai_msg.tool_calls = tool_calls
    return ai_msg

def format_tools_for_gemini(tools):
    if not tools:
        return None
        
    formatted_tools = []
    for tool_obj in tools:
        if hasattr(tool_obj, "func") and tool_obj.func:
            func = tool_obj.func
            # Preserve langchain metadata names and docs
            if hasattr(tool_obj, "name") and tool_obj.name:
                func.__name__ = tool_obj.name
            if hasattr(tool_obj, "description") and tool_obj.description:
                func.__doc__ = tool_obj.description
            formatted_tools.append(func)
        else:
            # Fallback wrapper for class-based tools
            def tool_wrapper(*args, **kwargs):
                return tool_obj._run(*args, **kwargs)
            tool_wrapper.__name__ = tool_obj.name
            tool_wrapper.__doc__ = tool_obj.description
            formatted_tools.append(tool_wrapper)
            
    return formatted_tools

class GoogleThoughtChatModel(BaseChatModelInterface):
    """Google Gemini custom chat model that handles thought_signatures."""
    model_name: str = "gemini-3.1-flash-lite"
    temperature: float = 0.7
    
    @property
    def _llm_type(self) -> str:
        return "google-thought-chat-model"
        
    def bind_tools(self, tools, **kwargs):
        from langchain_core.runnables import RunnableBinding
        return RunnableBinding(
            bound=self,
            kwargs={"tools": tools},
            config={}
        )
        
    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        # Extract system instruction if passed as SystemMessage
        system_msgs = [m for m in messages if isinstance(m, SystemMessage)]
        if system_msgs:
            system_instruction = system_msgs[0].content
            filtered_messages = [m for m in messages if not isinstance(m, SystemMessage)]
        else:
            current_date = datetime.now().strftime("%A, %B %d, %Y")
            system_instruction = f"You are a helpful AI assistant. The current date is {current_date}."
            filtered_messages = messages

        gemini_contents = convert_messages_to_gemini(filtered_messages)
        genai.configure(api_key=os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"), transport="rest")
        model = genai.GenerativeModel(self.model_name, system_instruction=system_instruction)
        
        tools = format_tools_for_gemini(kwargs.get("tools", None))
        response = model.generate_content(
            contents=gemini_contents,
            generation_config={"temperature": self.temperature},
            tools=tools
        )
        
        ai_msg = convert_gemini_to_message(response.candidates[0].content)
        return ChatResult(generations=[ChatGeneration(message=ai_msg)])
        
    async def _astream(self, messages, stop=None, run_manager=None, **kwargs):
        # Extract system instruction if passed as SystemMessage
        system_msgs = [m for m in messages if isinstance(m, SystemMessage)]
        if system_msgs:
            system_instruction = system_msgs[0].content
            filtered_messages = [m for m in messages if not isinstance(m, SystemMessage)]
        else:
            current_date = datetime.now().strftime("%A, %B %d, %Y")
            system_instruction = f"You are a helpful AI assistant. The current date is {current_date}."
            filtered_messages = messages

        gemini_contents = convert_messages_to_gemini(filtered_messages)
        logger.info(f"[GoogleProvider] Converted messages: {gemini_contents}")
        genai.configure(api_key=os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"), transport="rest")
        model = genai.GenerativeModel(self.model_name, system_instruction=system_instruction)
        
        tools = format_tools_for_gemini(kwargs.get("tools", None))
        response_stream = model.generate_content(
            contents=gemini_contents,
            generation_config={"temperature": self.temperature},
            tools=tools,
            stream=True
        )
        
        for chunk in response_stream:
            if chunk.candidates and chunk.candidates[0].content:
                candidate_content = chunk.candidates[0].content
                content_text = ""
                tool_calls = []
                additional_kwargs = {}
                
                for part in candidate_content.parts:
                    if part.text:
                        content_text += part.text
                    if part.function_call:
                        thought_sig = getattr(part, "thought_signature", None)
                        if thought_sig:
                            additional_kwargs["thought_signature"] = thought_sig
                        
                        args_dict = {k: v for k, v in part.function_call.args.items()}
                        tool_calls.append({
                            "name": part.function_call.name,
                            "args": args_dict,
                            "id": f"call_{part.function_call.name}",
                            "type": "tool_call"
                        })
                
                chunk_msg = AIMessageChunk(
                    content=content_text,
                    additional_kwargs=additional_kwargs,
                    tool_calls=tool_calls
                )
                yield ChatGenerationChunk(message=chunk_msg)

class GoogleModelProvider(BaseModelProvider):
    """Google Gemini model provider implementation."""
    
    def get_chat_model(self, model_name: str, temperature: float, **kwargs) -> BaseChatModelInterface:
        return GoogleThoughtChatModel(model_name=model_name, temperature=temperature, **kwargs)

    def get_embedding_model(self, model_name: str = "text-embedding-004", **kwargs):
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        return GoogleGenerativeAIEmbeddings(model=model_name, google_api_key=api_key)

    def get_vision_model(self, model_name: str, **kwargs):
        raise NotImplementedError("Vision model not implemented for Google provider yet.")
