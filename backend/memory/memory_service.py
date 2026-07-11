import os
import json
import logging
from database.connection import SessionLocal
from database.models import UserMemory
from langchain_core.messages import HumanMessage
from llm.factory.factory import LLMFactory
import google.generativeai as genai

logger = logging.getLogger("uvicorn")

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

def retrieve_relevant_memories(db_session, user_id: str, query: str, limit: int = 5) -> list[str]:
    if not user_id:
        return []
    try:
        query_vector = generate_embedding(query)
        # Search the user_memories table for semantic matches using cosine distance
        memories = db_session.query(UserMemory)\
            .filter(UserMemory.user_id == user_id)\
            .order_by(UserMemory.embedding.cosine_distance(query_vector))\
            .limit(limit)\
            .all()
        return [m.content for m in memories]
    except Exception as e:
        logger.error(f"[MemoryService] Error retrieving memories for {user_id}: {e}", exc_info=True)
        return []

def extract_and_save_memories(user_id: str, user_message: str, assistant_response: str):
    if not user_id:
        return
        
    logger.info(f"[MemoryService] Starting memory extraction for user: {user_id}")
    
    prompt = (
        "You are an expert user memory compiler. Analyze the latest user prompt and assistant response "
        "to extract any permanent user facts, preferences, interests, or background details. "
        "Only extract long-term, useful facts (e.g. 'User name is Atul', 'User prefers Python over Java').\n"
        "DO NOT extract:\n"
        "- Transitive states ('User is asking a question', 'User is testing the chatbot')\n"
        "- Metadata about this specific conversation thread\n"
        "- Redundant facts already implied\n"
        "Format the output strictly as a JSON list of strings: [\"fact 1\", \"fact 2\"]. If no new long-term facts are discovered, output [].\n\n"
        f"User message: {user_message}\n"
        f"Assistant response: {assistant_response}\n"
    )
    
    try:
        # Call the model - gemini-3.1-flash-lite is fast and perfect for background processing
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
                # Strip leading and trailing backticks
                if lines[0].startswith("```json") or lines[0].startswith("```"):
                    content = "\n".join(lines[1:-1])
                else:
                    content = "\n".join(lines)
        content = content.strip()
        
        extracted_facts = json.loads(content)
        if not isinstance(extracted_facts, list):
            logger.warning(f"[MemoryService] Extracted facts not a list: {content}")
            return
            
        if not extracted_facts:
            logger.info(f"[MemoryService] No new facts extracted for user: {user_id}")
            return
            
        logger.info(f"[MemoryService] Extracted facts: {extracted_facts}")
        
        # Connect to DB and save facts
        db = SessionLocal()
        try:
            for fact in extracted_facts:
                fact = fact.strip()
                if not fact:
                    continue
                
                vector = generate_embedding(fact)
                
                # Check for highly similar facts to avoid redundancy (threshold: cosine distance < 0.15)
                similar_mem = db.query(UserMemory)\
                    .filter(UserMemory.user_id == user_id)\
                    .order_by(UserMemory.embedding.cosine_distance(vector))\
                    .first()
                    
                if similar_mem:
                    from sqlalchemy import select
                    stmt = select(UserMemory.embedding.cosine_distance(vector)).where(UserMemory.id == similar_mem.id)
                    dist = db.execute(stmt).scalar()
                    if dist is not None and dist < 0.15:
                        logger.info(f"[MemoryService] Skipping similar fact: '{fact}' (distance: {dist:.3f} to '{similar_mem.content}')")
                        continue
                
                new_memory = UserMemory(
                    user_id=user_id,
                    content=fact,
                    embedding=vector
                )
                db.add(new_memory)
            db.commit()
            logger.info(f"[MemoryService] Successfully saved new memories for user: {user_id}")
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"[MemoryService] Error extracting or saving memories: {e}", exc_info=True)
