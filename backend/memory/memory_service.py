import os
import json
import logging
import datetime
from database.connection import SessionLocal
from database.models import UserMemory, UserSetting, UserEpisode, UserProcedure, ChatMessage
from langchain_core.messages import HumanMessage
from llm.factory.factory import LLMFactory
import google.generativeai as genai

logger = logging.getLogger("uvicorn")

# ─── Embedding Utility ───────────────────────────────────────────────────────

def generate_embedding(text: str) -> list[float]:
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    genai.configure(api_key=api_key, transport="rest")
    result = genai.embed_content(
        model="models/gemini-embedding-001",
        content=text,
        task_type="retrieval_document",
        output_dimensionality=768
    )
    return result['embedding']

def _call_extraction_llm(prompt: str) -> str:
    """Shared helper to call the lightweight extraction LLM."""
    llm = LLMFactory.get_chat_model(
        provider_name="google",
        model_name="gemini-3.1-flash-lite",
        temperature=0.0
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    content = response.content.strip()
    
    # Clean markdown formatting if present
    if content.startswith("```"):
        lines = content.splitlines()
        if len(lines) > 2:
            if lines[0].startswith("```json") or lines[0].startswith("```"):
                content = "\n".join(lines[1:-1])
            else:
                content = "\n".join(lines)
    return content.strip()

# ─── Retrieval Functions ─────────────────────────────────────────────────────

def retrieve_relevant_memories(db_session, user_id: str, query: str, limit: int = 5) -> list[str]:
    """Retrieve semantically relevant flat facts from user_memories (legacy + supplement)."""
    if not user_id:
        return []
    try:
        query_vector = generate_embedding(query)
        memories = db_session.query(UserMemory)\
            .filter(UserMemory.user_id == user_id)\
            .order_by(UserMemory.embedding.cosine_distance(query_vector))\
            .limit(limit)\
            .all()
        return [m.content for m in memories]
    except Exception as e:
        logger.error(f"[MemoryService] Error retrieving memories for {user_id}: {e}", exc_info=True)
        return []

def retrieve_user_profile(db_session, user_id: str) -> dict:
    """Retrieve the structured Wiki Memory profile for a user."""
    if not user_id:
        return {}
    try:
        settings = db_session.query(UserSetting).filter(UserSetting.user_id == user_id).first()
        if settings and settings.profile:
            return settings.profile
    except Exception as e:
        logger.error(f"[MemoryService] Error retrieving profile for {user_id}: {e}", exc_info=True)
    return {}

def retrieve_relevant_episodes(db_session, user_id: str, query: str, limit: int = 3) -> list[str]:
    """Retrieve semantically relevant episodic memories (past thread summaries)."""
    if not user_id:
        return []
    try:
        query_vector = generate_embedding(query)
        episodes = db_session.query(UserEpisode)\
            .filter(UserEpisode.user_id == user_id)\
            .order_by(UserEpisode.embedding.cosine_distance(query_vector))\
            .limit(limit)\
            .all()
        return [e.summary for e in episodes]
    except Exception as e:
        logger.error(f"[MemoryService] Error retrieving episodes for {user_id}: {e}", exc_info=True)
        return []

def retrieve_user_procedures(db_session, user_id: str, query: str, limit: int = 5) -> list[str]:
    """Retrieve relevant procedural memory rules."""
    if not user_id:
        return []
    try:
        query_vector = generate_embedding(query)
        procedures = db_session.query(UserProcedure)\
            .filter(UserProcedure.user_id == user_id)\
            .order_by(UserProcedure.embedding.cosine_distance(query_vector))\
            .limit(limit)\
            .all()
        return [p.rule for p in procedures]
    except Exception as e:
        logger.error(f"[MemoryService] Error retrieving procedures for {user_id}: {e}", exc_info=True)
        return []

# ─── Phase 1: Structured Profile Extraction ──────────────────────────────────

def extract_and_update_profile(user_id: str, user_message: str, assistant_response: str):
    """
    Wiki Memory Phase 1: Extract facts and merge them into a structured profile.
    Also maintains the legacy user_memories table for vector-based retrieval.
    """
    if not user_id:
        return
        
    logger.info(f"[WikiMemory] Starting profile extraction for user: {user_id}")
    
    db = SessionLocal()
    try:
        # Get the current profile
        settings = db.query(UserSetting).filter(UserSetting.user_id == user_id).first()
        current_profile = settings.profile if settings and settings.profile else {}
        
        prompt = (
            "You are an expert user profile compiler for a Wiki Memory system.\n"
            "Analyze the conversation below and update the user's structured profile.\n\n"
            "CURRENT PROFILE:\n"
            f"{json.dumps(current_profile, indent=2) if current_profile else '{}'}\n\n"
            "CONVERSATION:\n"
            f"User: {user_message}\n"
            f"Assistant: {assistant_response}\n\n"
            "INSTRUCTIONS:\n"
            "1. Extract any NEW permanent facts about the user (name, preferences, interests, background).\n"
            "2. MERGE them into the existing profile. If a fact contradicts an existing one, UPDATE it.\n"
            "3. Organize into these categories: identity, preferences, interests, background, communication_style.\n"
            "4. If no new facts are found, return the profile UNCHANGED.\n"
            "5. DO NOT extract transient states, conversation metadata, or greetings.\n\n"
            "Return ONLY a valid JSON object. No explanation, no markdown."
        )
        
        content = _call_extraction_llm(prompt)
        
        try:
            updated_profile = json.loads(content)
            if not isinstance(updated_profile, dict):
                logger.warning(f"[WikiMemory] Profile extraction returned non-dict: {content}")
                return
        except json.JSONDecodeError:
            logger.warning(f"[WikiMemory] Profile extraction returned invalid JSON: {content}")
            return
            
        # Check if profile actually changed
        if updated_profile == current_profile:
            logger.info(f"[WikiMemory] No profile changes for user: {user_id}")
            return
            
        # Save updated profile
        if settings:
            settings.profile = updated_profile
        else:
            settings = UserSetting(user_id=user_id, profile=updated_profile)
            db.add(settings)
            
        db.commit()
        logger.info(f"[WikiMemory] Updated profile for user {user_id}: {json.dumps(updated_profile)}")
        
        # Also maintain legacy user_memories for vector-based retrieval
        _sync_flat_memories(db, user_id, updated_profile)
        
    except Exception as e:
        logger.error(f"[WikiMemory] Error in profile extraction: {e}", exc_info=True)
    finally:
        db.close()

def _sync_flat_memories(db, user_id: str, profile: dict):
    """Convert structured profile entries into flat user_memories for vector search."""
    facts = _flatten_profile(profile)
    
    for fact in facts:
        fact = fact.strip()
        if not fact:
            continue
            
        vector = generate_embedding(fact)
        
        # Check for similar existing memory
        similar_mem = db.query(UserMemory)\
            .filter(UserMemory.user_id == user_id)\
            .order_by(UserMemory.embedding.cosine_distance(vector))\
            .first()
            
        if similar_mem:
            from sqlalchemy import select
            stmt = select(UserMemory.embedding.cosine_distance(vector)).where(UserMemory.id == similar_mem.id)
            dist = db.execute(stmt).scalar()
            if dist is not None and dist < 0.15:
                if similar_mem.content.strip().lower() == fact.lower():
                    continue  # Identical — skip
                else:
                    # Update existing
                    similar_mem.content = fact
                    similar_mem.embedding = vector
                    continue
        
        new_memory = UserMemory(user_id=user_id, content=fact, embedding=vector)
        db.add(new_memory)
    
    db.commit()

def _flatten_profile(profile: dict, prefix: str = "") -> list[str]:
    """Convert a structured profile dict into a list of fact strings."""
    facts = []
    for key, value in profile.items():
        label = key.replace("_", " ").title()
        if isinstance(value, dict):
            for sub_key, sub_value in value.items():
                sub_label = sub_key.replace("_", " ").title()
                if isinstance(sub_value, list):
                    facts.append(f"User {sub_label}: {', '.join(str(v) for v in sub_value)}")
                elif sub_value:
                    facts.append(f"User {sub_label} is {sub_value}")
        elif isinstance(value, list):
            if value:
                facts.append(f"User {label}: {', '.join(str(v) for v in value)}")
        elif value:
            facts.append(f"User {label} is {value}")
    return facts

# ─── Phase 2: Episodic Memory ────────────────────────────────────────────────

def extract_episode_summary(user_id: str, thread_id: str):
    """
    Wiki Memory Phase 2: Summarize a completed conversation thread into an episode.
    Called when a thread has enough messages to be worth summarizing.
    """
    if not user_id or not thread_id:
        return
    
    db = SessionLocal()
    try:
        # Check if episode already exists for this thread
        existing = db.query(UserEpisode).filter(
            UserEpisode.user_id == user_id,
            UserEpisode.thread_id == thread_id
        ).first()
        
        if existing:
            logger.info(f"[WikiMemory] Episode already exists for thread {thread_id}")
            return
        
        # Get thread messages
        messages = db.query(ChatMessage)\
            .filter(ChatMessage.thread_id == thread_id)\
            .order_by(ChatMessage.created_at.asc())\
            .all()
        
        if len(messages) < 4:  # Need at least 2 exchanges (4 messages) to summarize
            return
        
        # Build conversation text (truncate to last 20 messages to save tokens)
        conversation = ""
        for msg in messages[-20:]:
            role = "User" if msg.role == "user" else "Assistant"
            content_preview = msg.content[:500] if msg.content else ""
            conversation += f"{role}: {content_preview}\n"
        
        prompt = (
            "You are a conversation summarizer for a Wiki Memory system.\n"
            "Summarize the following conversation into a concise 1-3 sentence episode.\n"
            "Focus on: what was discussed, what was accomplished, and any key decisions.\n"
            "Include the date context if available.\n\n"
            f"Conversation ({len(messages)} messages):\n{conversation}\n\n"
            "Return ONLY the summary text. No quotes, no labels."
        )
        
        summary = _call_extraction_llm(prompt)
        
        if not summary or len(summary) < 10:
            logger.warning(f"[WikiMemory] Episode summary too short for thread {thread_id}: {summary}")
            return
        
        # Generate embedding for the summary
        vector = generate_embedding(summary)
        
        episode = UserEpisode(
            user_id=user_id,
            thread_id=thread_id,
            summary=summary,
            embedding=vector
        )
        db.add(episode)
        db.commit()
        logger.info(f"[WikiMemory] Saved episode for thread {thread_id}: {summary[:80]}...")
        
    except Exception as e:
        logger.error(f"[WikiMemory] Error extracting episode: {e}", exc_info=True)
    finally:
        db.close()

# ─── Phase 3: Procedural Memory ──────────────────────────────────────────────

def extract_procedures(user_id: str, user_message: str, assistant_response: str, thread_id: str = None):
    """
    Wiki Memory Phase 3: Extract behavioral preferences and rules from conversations.
    Looks for patterns like "I prefer...", "Always...", "Don't...", feedback on style, etc.
    """
    if not user_id:
        return
    
    prompt = (
        "You are a behavioral pattern analyzer for a Wiki Memory system.\n"
        "Analyze the conversation below for any user preferences about HOW the assistant should behave.\n\n"
        "Examples of procedural rules:\n"
        '- "User prefers code with detailed comments"\n'
        '- "User wants concise answers, not lengthy explanations"\n'
        '- "User prefers Python examples over JavaScript"\n'
        '- "When showing commands, explain what each flag does"\n\n'
        "DO NOT extract:\n"
        "- Facts about the user (that's semantic memory)\n"
        "- What was discussed (that's episodic memory)\n"
        "- General conversation content\n\n"
        f"User: {user_message}\n"
        f"Assistant: {assistant_response}\n\n"
        'Return a JSON list of behavioral rule strings. Example: ["rule 1", "rule 2"]\n'
        "If no behavioral rules are found, return []."
    )
    
    try:
        content = _call_extraction_llm(prompt)
        rules = json.loads(content)
        
        if not isinstance(rules, list) or not rules:
            return
        
        logger.info(f"[WikiMemory] Extracted procedures: {rules}")
        
        db = SessionLocal()
        try:
            for rule in rules:
                rule = rule.strip()
                if not rule or len(rule) < 10:
                    continue
                
                vector = generate_embedding(rule)
                
                # Check for similar existing procedure
                similar = db.query(UserProcedure)\
                    .filter(UserProcedure.user_id == user_id)\
                    .order_by(UserProcedure.embedding.cosine_distance(vector))\
                    .first()
                
                if similar:
                    from sqlalchemy import select
                    stmt = select(UserProcedure.embedding.cosine_distance(vector)).where(UserProcedure.id == similar.id)
                    dist = db.execute(stmt).scalar()
                    if dist is not None and dist < 0.15:
                        if similar.rule.strip().lower() != rule.lower():
                            logger.info(f"[WikiMemory] Updating procedure: '{similar.rule}' → '{rule}'")
                            similar.rule = rule
                            similar.embedding = vector
                        continue
                
                new_proc = UserProcedure(
                    user_id=user_id,
                    rule=rule,
                    source_thread_id=thread_id,
                    embedding=vector
                )
                db.add(new_proc)
            
            db.commit()
            logger.info(f"[WikiMemory] Saved procedures for user: {user_id}")
        finally:
            db.close()
            
    except json.JSONDecodeError:
        logger.debug(f"[WikiMemory] No procedures extracted (invalid JSON)")
    except Exception as e:
        logger.error(f"[WikiMemory] Error extracting procedures: {e}", exc_info=True)

# ─── Combined Extraction Entry Point ─────────────────────────────────────────

def extract_and_save_memories(user_id: str, user_message: str, assistant_response: str, thread_id: str = None):
    """
    Main entry point for the Wiki Memory system.
    Runs all three memory extraction phases:
      1. Structured Profile (semantic facts)
      2. Episodic Memory (thread summaries) — only when enough messages exist
      3. Procedural Memory (behavioral rules)
    """
    if not user_id:
        return
    
    # Phase 1: Extract and merge into structured profile
    extract_and_update_profile(user_id, user_message, assistant_response)
    
    # Phase 2: Episode summary (only if we have a thread_id)
    if thread_id:
        extract_episode_summary(user_id, thread_id)
    
    # Phase 3: Procedural rules extraction
    extract_procedures(user_id, user_message, assistant_response, thread_id)
