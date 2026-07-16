import json
import logging
import os
import time
from datetime import datetime
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage
from sqlalchemy.orm import Session

# Ensure backend path is configured
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agent import graph
from llm.registry.model_registry import ModelRegistry
from database.connection import init_db, get_db
from database.models import User, UserSetting, ChatThread, ChatMessage, UserMemory, UserEpisode, UserProcedure
from memory.memory_service import extract_and_save_memories, retrieve_relevant_memories, generate_embedding

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

@app.on_event("startup")
def startup_event():
    init_db()

# Pydantic schemas
class AuthRequest(BaseModel):
    username: str

class UserAdminCreate(BaseModel):
    username: str
    role: str = "user"

class UserCreate(BaseModel):
    id: str
    username: str

class UserSettingsUpdate(BaseModel):
    theme: str | None = None
    preferred_model: str | None = None
    system_instructions: str | None = None

class MemoryCreate(BaseModel):
    content: str

class ChatRequest(BaseModel):
    message: str
    thread_id: str
    user_id: str | None = None
    provider: str | None = None
    model: str | None = None
    attached_context: str | None = None

# Background task to save messages to DB and extract memories
def save_chat_and_extract_memory(user_id: str | None, thread_id: str, user_message: str, assistant_response: str, plan: str, reasoning: str, routing: dict, metrics: dict):
    from database.connection import SessionLocal
    
    if not user_id:
        logger.warning("[Background] No user_id provided. Skipping database save & extraction.")
        return
        
    db = SessionLocal()
    try:
        # Check if thread exists, create if not
        thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
        if not thread:
            # Generate simple title
            title = user_message[:30] + "..." if len(user_message) > 30 else user_message
            thread = ChatThread(id=thread_id, user_id=user_id, title=title)
            db.add(thread)
            db.commit()
            
        # Save Human message
        human_msg = ChatMessage(
            thread_id=thread_id,
            role="user",
            content=user_message
        )
        db.add(human_msg)
        
        # Save Assistant message
        assistant_msg = ChatMessage(
            thread_id=thread_id,
            role="assistant",
            content=assistant_response,
            plan=plan if plan else None,
            reasoning=reasoning if reasoning else None,
            routing=routing,
            metrics=metrics
        )
        db.add(assistant_msg)
        db.commit()
        logger.info(f"[Background] Saved chat turn in database for thread '{thread_id}'")
        
    except Exception as e:
        logger.error(f"[Background] Error saving chat turn: {e}", exc_info=True)
    finally:
        db.close()
        
    # Extract memory (Wiki Memory system - all 3 phases)
    extract_and_save_memories(user_id, user_message, assistant_response, thread_id=thread_id)

# --- Database API Routes ---

@app.post("/api/auth/login")
def login(req: AuthRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/api/auth/signup")
def signup(req: AuthRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    import random
    import string
    new_id = "user-" + ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))
    
    # Auto-assign admin if it's the very first user
    user_count = db.query(User).count()
    role = "admin" if user_count == 0 else "user"
    
    new_user = User(id=new_id, username=req.username, role=role)
    db.add(new_user)
    
    default_settings = UserSetting(user_id=new_id, theme="system", preferred_model="auto", system_instructions="")
    db.add(default_settings)
    db.commit()
    return new_user

@app.get("/api/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return users

@app.post("/api/admin/users")
def create_user_admin(user_in: UserAdminCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
        
    import random
    import string
    new_id = "user-" + ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))
    
    new_user = User(id=new_id, username=user_in.username, role=user_in.role)
    db.add(new_user)
    
    default_settings = UserSetting(user_id=new_id, theme="system", preferred_model="auto", system_instructions="")
    db.add(default_settings)
    db.commit()
    return new_user

@app.get("/api/users/{user_id}/settings")
def get_user_settings(user_id: str, db: Session = Depends(get_db)):
    settings = db.query(UserSetting).filter(UserSetting.user_id == user_id).first()
    if not settings:
        settings = UserSetting(user_id=user_id, theme="system", preferred_model="auto", system_instructions="")
        db.add(settings)
        db.commit()
    return settings

@app.put("/api/users/{user_id}/settings")
def update_user_settings(user_id: str, settings_in: UserSettingsUpdate, db: Session = Depends(get_db)):
    settings = db.query(UserSetting).filter(UserSetting.user_id == user_id).first()
    if not settings:
        settings = UserSetting(user_id=user_id, theme="system", preferred_model="auto", system_instructions="")
        db.add(settings)
        
    if settings_in.theme is not None:
        settings.theme = settings_in.theme
    if settings_in.preferred_model is not None:
        settings.preferred_model = settings_in.preferred_model
    if settings_in.system_instructions is not None:
        settings.system_instructions = settings_in.system_instructions
        
    db.commit()
    db.refresh(settings)
    return settings

@app.get("/api/users/{user_id}/memories")
def get_user_memories(user_id: str, db: Session = Depends(get_db)):
    memories = db.query(UserMemory).filter(UserMemory.user_id == user_id).order_by(UserMemory.created_at.desc()).all()
    # Return serializable records
    return [{"id": m.id, "content": m.content, "created_at": m.created_at} for m in memories]

@app.get("/api/users/{user_id}/profile")
def get_user_profile(user_id: str, db: Session = Depends(get_db)):
    """Get structured Wiki Memory profile for a user."""
    settings = db.query(UserSetting).filter(UserSetting.user_id == user_id).first()
    if not settings or not settings.profile:
        return {}
    return settings.profile

@app.get("/api/users/{user_id}/episodes")
def get_user_episodes(user_id: str, db: Session = Depends(get_db)):
    """Get episodic memories (thread summaries) for a user."""
    episodes = db.query(UserEpisode).filter(UserEpisode.user_id == user_id).order_by(UserEpisode.created_at.desc()).all()
    return [{"id": e.id, "thread_id": e.thread_id, "summary": e.summary, "created_at": e.created_at} for e in episodes]

@app.get("/api/users/{user_id}/procedures")
def get_user_procedures(user_id: str, db: Session = Depends(get_db)):
    """Get procedural memory rules for a user."""
    procedures = db.query(UserProcedure).filter(UserProcedure.user_id == user_id).order_by(UserProcedure.created_at.desc()).all()
    return [{"id": p.id, "rule": p.rule, "source_thread_id": p.source_thread_id, "created_at": p.created_at} for p in procedures]

@app.delete("/api/memories/{memory_id}")
def delete_user_memory(memory_id: int, db: Session = Depends(get_db)):
    memory = db.query(UserMemory).filter(UserMemory.id == memory_id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    db.delete(memory)
    db.commit()
    return {"status": "success"}

@app.delete("/api/episodes/{episode_id}")
def delete_episode(episode_id: int, db: Session = Depends(get_db)):
    episode = db.query(UserEpisode).filter(UserEpisode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    db.delete(episode)
    db.commit()
    return {"status": "success"}

@app.delete("/api/procedures/{procedure_id}")
def delete_procedure(procedure_id: int, db: Session = Depends(get_db)):
    procedure = db.query(UserProcedure).filter(UserProcedure.id == procedure_id).first()
    if not procedure:
        raise HTTPException(status_code=404, detail="Procedure not found")
    db.delete(procedure)
    db.commit()
    return {"status": "success"}

@app.get("/api/users/{user_id}/threads")
def list_user_threads(user_id: str, db: Session = Depends(get_db)):
    threads = db.query(ChatThread).filter(ChatThread.user_id == user_id).order_by(ChatThread.created_at.desc()).all()
    return threads

@app.get("/api/threads/{thread_id}/messages")
def get_thread_messages(thread_id: str, db: Session = Depends(get_db)):
    messages = db.query(ChatMessage).filter(ChatMessage.thread_id == thread_id).order_by(ChatMessage.created_at.asc()).all()
    return messages

# --- Chat Endpoint ---

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest, background_tasks: BackgroundTasks):
    async def event_generator():
        from database.connection import SessionLocal
        db = SessionLocal()
        start_time = time.time()
        current_complexity = "simple"
        routed_model_id = "gemini-3.5-flash"
        routing_metadata_dump = {}
        
        # Track tokens and costs
        token_usage_records = []
        accumulated_text = ""
        accumulated_plan = ""
        accumulated_reasoning = ""
        
        try:
            logger.info(f"[API] ChatRequest: message='{request.message}', user_id='{request.user_id}', thread_id='{request.thread_id}', model='{request.model}', provider='{request.provider}'")
            
            # Resolve preferred model from user settings if 'auto' or not passed
            resolved_model = request.model
            if not resolved_model or resolved_model == "auto":
                if request.user_id:
                    settings = db.query(UserSetting).filter(UserSetting.user_id == request.user_id).first()
                    if settings:
                        resolved_model = settings.preferred_model or "auto"
            
            config = {
                "configurable": {
                    "thread_id": request.thread_id,
                    "user_id": request.user_id,
                    "provider": request.provider,
                    "model": resolved_model or "auto",
                }
            }
            
            # Hydrate checkpointer if empty
            try:
                state = await graph.aget_state(config)
                if not state.values or not state.values.get("messages"):
                    logger.info(f"[Hydration] Hydrating LangGraph checkpointer for thread '{request.thread_id}'")
                    db_messages = db.query(ChatMessage).filter(ChatMessage.thread_id == request.thread_id).order_by(ChatMessage.created_at.asc()).all()
                    if db_messages:
                        lc_messages = []
                        for m in db_messages:
                            if m.role == "user":
                                lc_messages.append(HumanMessage(content=m.content))
                            elif m.role == "assistant":
                                lc_messages.append(AIMessage(
                                    content=m.content,
                                    additional_kwargs={
                                        "plan": m.plan,
                                        "reasoning": m.reasoning,
                                        "routing": m.routing,
                                        "metrics": m.metrics
                                    }
                                ))
                        await graph.aupdate_state(config, {"messages": lc_messages})
            except Exception as hyd_err:
                logger.error(f"[Hydration] Hydration failed: {hyd_err}", exc_info=True)
            
            full_user_content = request.message
            if getattr(request, "attached_context", None):
                full_user_content = f"<details>\n<summary>📎 Attached Document</summary>\n\n{request.attached_context}\n</details>\n\n{request.message}"

            # Use LangGraph astream_events to listen to execution steps
            async for event in graph.astream_events(
                {"messages": [HumanMessage(content=full_user_content)]},
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
                        routing_metadata_dump = {
                            "intent": output.get("intent", "general"),
                            "complexity": current_complexity,
                            "routed_model": routed_model_id
                        }
                        # Stream routing explanation to frontend
                        yield f"data: {json.dumps({'type': 'routing_debug', 'content': output})}\n\n"

                # 2. Capture streaming tokens from LLMs
                elif event["event"] == "on_chat_model_stream":
                    node_name = event.get("metadata", {}).get("langgraph_node")
                    chunk = event["data"]["chunk"]
                    if hasattr(chunk, "content") and chunk.content:
                        content_chunk = chunk.content
                        
                        # Determine event type based on node and complexity
                        if node_name == "planner":
                            accumulated_plan += content_chunk
                            yield f"data: {json.dumps({'type': 'plan_debug', 'content': content_chunk})}\n\n"
                        elif node_name == "agent":
                            if current_complexity == "complex":
                                accumulated_reasoning += content_chunk
                                yield f"data: {json.dumps({'type': 'reasoning_debug', 'content': content_chunk})}\n\n"
                            else:
                                accumulated_text += content_chunk
                                yield f"data: {json.dumps({'type': 'token', 'content': content_chunk})}\n\n"
                        elif node_name == "synthesize":
                            accumulated_text += content_chunk
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
            
            # Dispatch background task to save messages and extract memory
            background_tasks.add_task(
                save_chat_and_extract_memory,
                request.user_id,
                request.thread_id,
                full_user_content,
                accumulated_text,
                accumulated_plan,
                accumulated_reasoning,
                routing_metadata_dump,
                metrics_payload
            )
            
            # Signal stream completion
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            
        except Exception as e:
            logger.error(f"Error in chat stream: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        finally:
            db.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/providers/availability")
async def get_providers_availability():
    # Check if local Ollama is running
    ollama_host = os.environ.get("OLLAMA_HOST") or os.environ.get("OLLAMA_BASE_URL") or "http://host.docker.internal:11434"
    try:
        import httpx
        res = httpx.get(f"{ollama_host}/api/tags", timeout=1.0)
        ollama_available = res.status_code == 200
    except Exception:
        ollama_available = False

    return {
        "google": bool(os.environ.get("GOOGLE_API_KEY")),
        "openai": bool(os.environ.get("OPENAI_API_KEY")),
        "anthropic": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "groq": bool(os.environ.get("GROQ_API_KEY")),
        "ollama": ollama_available,
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
            model_name = "gemini-3.5-flash"
            try:
                model = genai.GenerativeModel(model_name)
                prompt = "Please accurately transcribe this audio. Output only the exact spoken text from the audio, without any additional conversational text or formatting."
                
                audio_part = {
                    "mime_type": mime_type,
                    "data": audio_content
                }
                
                response = model.generate_content([prompt, audio_part])
                text = response.text
            except Exception as first_err:
                logger.warning(f"[API] Transcribing with {model_name} failed. Falling back to gemini-3.1-flash-lite. Error: {first_err}")
                model_name = "gemini-3.1-flash-lite"
                model = genai.GenerativeModel(model_name)
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

@app.post("/api/upload-file")
async def upload_file_endpoint(file: UploadFile = File(...)):
    logger.info(f"[API] Upload file request: filename={file.filename}, type={file.content_type}")
    
    try:
        content = await file.read()
        mime_type = file.content_type or "application/octet-stream"
        
        # 1. PDF Handling
        if file.filename.lower().endswith('.pdf'):
            from pypdf import PdfReader
            from io import BytesIO
            
            pdf = PdfReader(BytesIO(content))
            extracted_text = ""
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text:
                    extracted_text += f"\n--- Page {i+1} ---\n{text}\n"
                    
            if not extracted_text.strip():
                raise HTTPException(status_code=400, detail="No readable text found in the PDF.")
                
            logger.info(f"[API] PDF extracted successfully: {len(extracted_text)} characters")
            return {"filename": file.filename, "content": extracted_text.strip()}
            
        # 2. Image, Audio, Video Handling via Gemini Flash
        elif mime_type.startswith("image/") or mime_type.startswith("video/") or mime_type.startswith("audio/"):
            google_api_key = os.environ.get("GOOGLE_API_KEY")
            if not google_api_key:
                raise HTTPException(status_code=500, detail="GOOGLE_API_KEY is not configured for multimodal extraction.")
                
            import google.generativeai as genai
            genai.configure(api_key=google_api_key)
            model = genai.GenerativeModel("gemini-3.5-flash")
            
            if mime_type.startswith("image/"):
                prompt = "Please analyze this image in extreme detail. Describe all objects, people, colors, layout, and context. Extract and transcribe any readable text (OCR) exactly as it appears."
            elif mime_type.startswith("video/"):
                prompt = "Please provide a detailed description of the visual actions in this video, and include a full transcript of any spoken words or significant audio events."
            else:
                prompt = "Please provide a full, accurate transcript of this audio file. Output only the spoken words or key audio events."
                
            file_part = {
                "mime_type": mime_type,
                "data": content
            }
            
            logger.info(f"[API] Sending {mime_type} to Gemini for extraction...")
            response = model.generate_content([prompt, file_part])
            
            extracted_text = response.text
            if not extracted_text:
                raise HTTPException(status_code=400, detail="Could not extract information from the file.")
                
            logger.info(f"[API] Multimodal extraction successful: {len(extracted_text)} characters")
            return {"filename": file.filename, "content": f"[Extracted from {file.filename}]\n\n{extracted_text.strip()}"}
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {mime_type}")
            
    except Exception as e:
        logger.error(f"[API] File upload/extraction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"File extraction failed: {str(e)}")
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

