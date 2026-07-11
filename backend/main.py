import json
import logging
import os
import time
from datetime import datetime
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from agent import graph
from llm.registry.model_registry import ModelRegistry

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")

app = FastAPI(title="LangGraph Chatbot Backend")

# Enable CORS to allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    thread_id: str
    provider: str | None = None
    model: str | None = None

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    async def event_generator():
        start_time = time.time()
        current_complexity = "simple"
        routed_model_id = "gemini-3.5-flash"
        routing_metadata_dump = {}
        
        # Track tokens and costs
        token_usage_records = []
        accumulated_text = ""
        
        try:
            logger.info(f"[API] ChatRequest: message='{request.message}', model='{request.model}', provider='{request.provider}'")
            
            config = {
                "configurable": {
                    "thread_id": request.thread_id,
                    "provider": request.provider,
                    "model": request.model or "auto",
                }
            }
            
            # Use LangGraph astream_events to listen to execution steps
            async for event in graph.astream_events(
                {"messages": [HumanMessage(content=request.message)]},
                config,
                version="v2"
            ):
                # 1. Capture completion of nodes to track actual model and metadata
                if event["event"] == "on_chain_end":
                    output = event["data"].get("output", {})
                    if isinstance(output, dict) and "routed_model" in output and output["routed_model"]:
                        routed_model_id = output["routed_model"]
                    
                    if event["name"] == "analyze":
                        current_complexity = output.get("complexity", "simple")
                        routing_metadata_dump = output.get("routing_metadata", {})
                        # Stream routing explanation to frontend
                        yield f"data: {json.dumps({'type': 'routing_debug', 'content': output})}\n\n"

                # 2. Capture streaming tokens from LLMs
                elif event["event"] == "on_chat_model_stream":
                    node_name = event.get("metadata", {}).get("langgraph_node")
                    chunk = event["data"]["chunk"]
                    if hasattr(chunk, "content") and chunk.content:
                        content_chunk = chunk.content
                        accumulated_text += content_chunk
                        
                        # Determine event type based on node and complexity
                        if node_name == "planner":
                            yield f"data: {json.dumps({'type': 'plan_debug', 'content': content_chunk})}\n\n"
                        elif node_name == "agent":
                            if current_complexity == "complex":
                                yield f"data: {json.dumps({'type': 'reasoning_debug', 'content': content_chunk})}\n\n"
                            else:
                                yield f"data: {json.dumps({'type': 'token', 'content': content_chunk})}\n\n"
                        elif node_name == "synthesize":
                            yield f"data: {json.dumps({'type': 'token', 'content': content_chunk})}\n\n"
                            
                # 3. Capture token usage from model completions
                elif event["event"] == "on_chat_model_end":
                    node_name = event.get("metadata", {}).get("langgraph_node", "unknown")
                    output = event["data"].get("output", {})
                    
                    prompt_tokens = 0
                    completion_tokens = 0
                    
                    if hasattr(output, "usage_metadata") and output.usage_metadata:
                        prompt_tokens = output.usage_metadata.get("input_tokens", 0)
                        completion_tokens = output.usage_metadata.get("output_tokens", 0)
                    elif hasattr(output, "response_metadata") and output.response_metadata:
                        token_usage = output.response_metadata.get("token_usage", {})
                        if token_usage:
                            prompt_tokens = token_usage.get("prompt_tokens", 0)
                            completion_tokens = token_usage.get("completion_tokens", 0)
                            
                    token_usage_records.append({
                        "node": node_name,
                        "prompt_tokens": prompt_tokens,
                        "completion_tokens": completion_tokens
                    })

            # End of stream metrics compilation
            end_time = time.time()
            latency = end_time - start_time
            
            # Aggregate tokens and calculate cost
            total_prompt_tokens = 0
            total_completion_tokens = 0
            calculated_cost = 0.0
            
            # Map nodes to registry models for cost calculation
            for record in token_usage_records:
                node = record["node"]
                p_tokens = record["prompt_tokens"]
                c_tokens = record["completion_tokens"]
                
                # If prompt/completion tokens are 0, estimate based on text length as a fallback
                if p_tokens == 0 and node == "agent":
                    p_tokens = len(request.message) // 4
                if c_tokens == 0 and node == "agent":
                    c_tokens = len(accumulated_text) // 4
                    
                total_prompt_tokens += p_tokens
                total_completion_tokens += c_tokens
                
                # Resolve model id for this node
                m_id = routed_model_id
                if node == "planner":
                    m_id = "gemini-3.5-flash"  # Fallback guess
                
                model_meta = ModelRegistry.get_model(m_id)
                if model_meta:
                    node_cost = (
                        (p_tokens * model_meta.input_token_cost_per_million / 1_000_000) +
                        (c_tokens * model_meta.output_token_cost_per_million / 1_000_000)
                    )
                    calculated_cost += node_cost
            
            # Write to observability log file
            log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
            os.makedirs(log_dir, exist_ok=True)
            log_file = os.path.join(log_dir, "observability.jsonl")
            
            log_entry = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "thread_id": request.thread_id,
                "message": request.message,
                "complexity": current_complexity,
                "selected_model": routed_model_id,
                "latency_seconds": round(latency, 3),
                "total_prompt_tokens": total_prompt_tokens,
                "total_completion_tokens": total_completion_tokens,
                "calculated_cost_usd": round(calculated_cost, 6),
                "routing_metadata": routing_metadata_dump,
                "token_usage_records": token_usage_records
            }
            
            with open(log_file, "a") as f:
                f.write(json.dumps(log_entry) + "\n")
                
            logger.info(f"[Observability] Logged request. Model: {routed_model_id} | Latency: {round(latency, 2)}s | Cost: ${round(calculated_cost, 6)}")
            
            # Stream dynamic metric stats to client
            metrics_payload = {
                "model": routed_model_id,
                "complexity": current_complexity,
                "latency": round(latency, 2),
                "tokens": total_prompt_tokens + total_completion_tokens,
                "cost": round(calculated_cost, 6)
            }
            yield f"data: {json.dumps({'type': 'metrics', 'content': metrics_payload})}\n\n"
            
            # Signal stream completion
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            logger.error(f"Error in chat stream: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/providers/availability")
async def get_providers_availability():
    return {
        "google": bool(os.environ.get("GOOGLE_API_KEY")),
        "openai": bool(os.environ.get("OPENAI_API_KEY")),
        "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "groq": bool(os.environ.get("GROQ_API_KEY")),
    }

@app.post("/api/transcribe")
async def transcribe_endpoint(file: UploadFile = File(...)):
    logger.info(f"[API] Transcribe request: filename={file.filename}, content_type={file.content_type}")
    
    google_api_key = os.environ.get("GOOGLE_API_KEY")
    if not google_api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY is not configured in the backend environment.")
        
    try:
        import google.generativeai as genai
        
        genai.configure(api_key=google_api_key)
        
        audio_content = await file.read()
        mime_type = file.content_type or "audio/webm"
        
        try:
            model = genai.GenerativeModel("gemini-3.5-flash")
            prompt = "Please accurately transcribe this audio. Output only the exact spoken text from the audio, without any additional conversational text or formatting."
            
            audio_part = {
                "mime_type": mime_type,
                "data": audio_content
            }
            
            response = model.generate_content([prompt, audio_part])
            text = response.text
            
            # Strip markdown if present
            if text.startswith("```"):
                text = text.split("\n", 1)[-1]
                text = text.rsplit("```", 1)[0]
            text = text.strip()
            
            logger.info(f"[API] Transcribe success: text='{text}'")
            return {"text": text}
            
        except Exception as api_err:
            logger.error(f"[API] Gemini transcription failed: {api_err}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(api_err)}")
            
    except Exception as e:
        logger.error(f"[API] Transcribe failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
