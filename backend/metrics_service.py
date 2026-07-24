import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.models import LLMUsageLog, ChatThread, User
from llm.registry.model_registry import ModelRegistry

logger = logging.getLogger("uvicorn")

def get_timeframe_cutoff(timeframe: str) -> Optional[datetime]:
    now = datetime.utcnow()
    if timeframe == "today":
        return datetime(now.year, now.month, now.day)
    elif timeframe == "7d":
        return now - timedelta(days=7)
    elif timeframe == "30d":
        return now - timedelta(days=30)
    return None  # "all"

def record_usage_log(
    db: Session,
    user_id: Optional[str],
    thread_id: Optional[str],
    selected_model: str,
    complexity: str,
    prompt_tokens: int,
    completion_tokens: int,
    calculated_cost_usd: float,
    latency_seconds: float
) -> LLMUsageLog:
    """Record a single LLM request metrics entry into PostgreSQL."""
    try:
        if user_id:
            user_exists = db.query(User.id).filter(User.id == user_id).first()
            if not user_exists:
                user_id = None

        log_entry = LLMUsageLog(
            user_id=user_id,
            thread_id=thread_id,
            selected_model=selected_model,
            complexity=complexity or "simple",
            prompt_tokens=prompt_tokens or 0,
            completion_tokens=completion_tokens or 0,
            calculated_cost_usd=round(float(calculated_cost_usd or 0.0), 6),
            latency_seconds=round(float(latency_seconds or 0.0), 3),
            created_at=datetime.utcnow()
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry
    except Exception as e:
        db.rollback()
        logger.error(f"[MetricsService] Failed to record usage log: {e}", exc_info=True)
        return None

def backfill_metrics_from_jsonl(db: Session):
    """Backfill metrics from observability.jsonl into PostgreSQL if not already backfilled."""
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
    log_file = os.path.join(log_dir, "observability.jsonl")

    if not os.path.exists(log_file):
        logger.info("[MetricsService] No observability.jsonl found for backfill.")
        return

    try:
        existing_count = db.query(LLMUsageLog).count()
        
        # Read lines from jsonl
        lines = []
        with open(log_file, "r") as f:
            for line in f:
                if line.strip():
                    try:
                        lines.append(json.loads(line.strip()))
                    except Exception:
                        continue

        if not lines:
            return

        # If DB count matches or exceeds jsonl lines, skip backfill
        if existing_count >= len(lines):
            logger.info(f"[MetricsService] DB already has {existing_count} records. Skipping backfill.")
            return

        logger.info(f"[MetricsService] Backfilling {len(lines) - existing_count} entries from observability.jsonl to Postgres...")

        # Build thread_id -> user_id map from database for lookup
        threads = db.query(ChatThread.id, ChatThread.user_id).all()
        thread_user_map = {t.id: t.user_id for t in threads if t.user_id}
        
        # Get set of all existing valid user IDs in DB
        valid_user_ids = {u.id for u in db.query(User.id).all()}

        # Backfill missing entries
        entries_to_add = []
        for i, entry in enumerate(lines):
            if i < existing_count:
                continue  # Already inserted

            # Parse timestamp
            raw_ts = entry.get("timestamp")
            created_at = datetime.utcnow()
            if raw_ts:
                try:
                    ts_str = raw_ts.replace("Z", "+00:00")
                    created_at = datetime.fromisoformat(ts_str).replace(tzinfo=None)
                except Exception:
                    pass

            thread_id = entry.get("thread_id")
            resolved_user_id = entry.get("user_id") or thread_user_map.get(thread_id)
            if resolved_user_id not in valid_user_ids:
                resolved_user_id = None

            log_entry = LLMUsageLog(
                user_id=resolved_user_id,
                thread_id=thread_id,
                selected_model=entry.get("selected_model", "unknown"),
                complexity=entry.get("complexity", "simple"),
                prompt_tokens=entry.get("total_prompt_tokens", 0),
                completion_tokens=entry.get("total_completion_tokens", 0),
                calculated_cost_usd=round(float(entry.get("calculated_cost_usd", 0.0)), 6),
                latency_seconds=round(float(entry.get("latency_seconds", 0.0)), 3),
                created_at=created_at
            )
            entries_to_add.append(log_entry)

        if entries_to_add:
            db.bulk_save_objects(entries_to_add)
            db.commit()
            logger.info(f"[MetricsService] Successfully backfilled {len(entries_to_add)} records into Postgres.")
    except Exception as e:
        db.rollback()
        logger.error(f"[MetricsService] Error backfilling observability logs: {e}", exc_info=True)

def get_registered_models_dict() -> List[Dict[str, Any]]:
    """Get list of registered models with metadata for frontend consumption."""
    registered = ModelRegistry.list_models()
    return [
        {
            "id": m.id,
            "provider": m.provider,
            "model_name": m.model_name,
            "context_window": m.context_window,
            "quality_score": m.quality_score,
            "supports_vision": m.supports_vision,
            "supports_reasoning": m.supports_reasoning,
            "supports_tool_calling": m.supports_tool_calling,
            "preferred_categories": m.preferred_categories,
            "added_date": getattr(m, "added_date", "2026-06-01") or "2026-06-01",
            "input_cost_per_m": m.input_token_cost_per_million,
            "output_cost_per_m": m.output_token_cost_per_million
        }
        for m in registered
    ]

def parse_date_range(timeframe: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> tuple[Optional[datetime], Optional[datetime]]:
    if timeframe == "custom":
        start_dt = None
        end_dt = None
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace("Z", ""))
            except Exception:
                try:
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                except Exception:
                    pass
        if end_date:
            try:
                dt = datetime.fromisoformat(end_date.replace("Z", ""))
                end_dt = datetime(dt.year, dt.month, dt.day, 23, 59, 59, 999999)
            except Exception:
                try:
                    dt = datetime.strptime(end_date, "%Y-%m-%d")
                    end_dt = datetime(dt.year, dt.month, dt.day, 23, 59, 59, 999999)
                except Exception:
                    pass
        return start_dt, end_dt
    else:
        cutoff = get_timeframe_cutoff(timeframe)
        return cutoff, None

def get_user_usage_metrics(
    db: Session, 
    user_id: str, 
    timeframe: str = "all", 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """Retrieve usage metrics for a specific user."""
    start_dt, end_dt = parse_date_range(timeframe, start_date, end_date)
    query = db.query(LLMUsageLog).filter(LLMUsageLog.user_id == user_id)
    if start_dt:
        query = query.filter(LLMUsageLog.created_at >= start_dt)
    if end_dt:
        query = query.filter(LLMUsageLog.created_at <= end_dt)
        
    records: List[LLMUsageLog] = query.order_by(LLMUsageLog.created_at.desc()).all()

    total_cost = 0.0
    total_requests = len(records)
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_latency = 0.0

    complexity_summary: Dict[str, int] = {}
    model_metrics_map: Dict[str, Dict[str, Any]] = {}

    for r in records:
        total_cost += r.calculated_cost_usd
        total_prompt_tokens += r.prompt_tokens
        total_completion_tokens += r.completion_tokens
        total_latency += r.latency_seconds

        comp = r.complexity or "simple"
        complexity_summary[comp] = complexity_summary.get(comp, 0) + 1

        model_id = r.selected_model
        if model_id not in model_metrics_map:
            model_meta = ModelRegistry.get_model(model_id)
            model_metrics_map[model_id] = {
                "model_id": model_id,
                "model_name": model_meta.model_name if model_meta else model_id,
                "provider": model_meta.provider if model_meta else "custom",
                "total_requests": 0,
                "total_cost_usd": 0.0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "latency_sum": 0.0,
                "complexity_breakdown": {}
            }

        m_entry = model_metrics_map[model_id]
        m_entry["total_requests"] += 1
        m_entry["total_cost_usd"] += r.calculated_cost_usd
        m_entry["prompt_tokens"] += r.prompt_tokens
        m_entry["completion_tokens"] += r.completion_tokens
        m_entry["latency_sum"] += r.latency_seconds

        m_comp = m_entry["complexity_breakdown"]
        m_comp[comp] = m_comp.get(comp, 0) + 1

    # Round totals
    model_metrics_list = []
    for m_id, data in model_metrics_map.items():
        data["total_cost_usd"] = round(data["total_cost_usd"], 6)
        data["avg_latency"] = round(data["latency_sum"] / data["total_requests"], 2) if data["total_requests"] > 0 else 0
        del data["latency_sum"]
        model_metrics_list.append(data)

    model_metrics_list.sort(key=lambda x: x["total_cost_usd"], reverse=True)

    user_obj = db.query(User).filter(User.id == user_id).first()
    username = user_obj.username if user_obj else user_id

    return {
        "user_id": user_id,
        "username": username,
        "timeframe": timeframe,
        "start_date": start_date,
        "end_date": end_date,
        "summary": {
            "total_cost_usd": round(total_cost, 6),
            "total_requests": total_requests,
            "total_tokens": total_prompt_tokens + total_completion_tokens,
            "prompt_tokens": total_prompt_tokens,
            "completion_tokens": total_completion_tokens,
            "avg_latency_seconds": round(total_latency / total_requests, 2) if total_requests > 0 else 0.0
        },
        "complexity_summary": complexity_summary,
        "model_metrics": model_metrics_list,
        "registered_models": get_registered_models_dict()
    }

def get_admin_usage_metrics(
    db: Session, 
    timeframe: str = "all", 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """Retrieve system-wide usage metrics (Admin Level), including per user per model matrix."""
    start_dt, end_dt = parse_date_range(timeframe, start_date, end_date)
    query = db.query(LLMUsageLog)
    if start_dt:
        query = query.filter(LLMUsageLog.created_at >= start_dt)
    if end_dt:
        query = query.filter(LLMUsageLog.created_at <= end_dt)

    records: List[LLMUsageLog] = query.order_by(LLMUsageLog.created_at.desc()).all()

    # User lookup map
    users = db.query(User).all()
    user_map = {u.id: u.username for u in users}

    total_cost = 0.0
    total_requests = len(records)
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_latency = 0.0

    users_summary_map: Dict[str, Dict[str, Any]] = {}
    models_summary_map: Dict[str, Dict[str, Any]] = {}
    matrix_map: Dict[str, Dict[str, Any]] = {}  # key: (user_id, model_id)

    for r in records:
        u_id = r.user_id or "anonymous"
        u_name = user_map.get(u_id, u_id)
        m_id = r.selected_model
        comp = r.complexity or "simple"
        cost = r.calculated_cost_usd
        p_tok = r.prompt_tokens
        c_tok = r.completion_tokens
        lat = r.latency_seconds

        total_cost += cost
        total_prompt_tokens += p_tok
        total_completion_tokens += c_tok
        total_latency += lat

        # Per User summary
        if u_id not in users_summary_map:
            users_summary_map[u_id] = {
                "user_id": u_id,
                "username": u_name,
                "total_requests": 0,
                "total_cost_usd": 0.0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "complexity_breakdown": {}
            }
        u_sum = users_summary_map[u_id]
        u_sum["total_requests"] += 1
        u_sum["total_cost_usd"] += cost
        u_sum["prompt_tokens"] += p_tok
        u_sum["completion_tokens"] += c_tok
        u_sum["complexity_breakdown"][comp] = u_sum["complexity_breakdown"].get(comp, 0) + 1

        # Per Model summary
        if m_id not in models_summary_map:
            model_meta = ModelRegistry.get_model(m_id)
            models_summary_map[m_id] = {
                "model_id": m_id,
                "model_name": model_meta.model_name if model_meta else m_id,
                "provider": model_meta.provider if model_meta else "custom",
                "total_requests": 0,
                "total_cost_usd": 0.0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "complexity_breakdown": {}
            }
        m_sum = models_summary_map[m_id]
        m_sum["total_requests"] += 1
        m_sum["total_cost_usd"] += cost
        m_sum["prompt_tokens"] += p_tok
        m_sum["completion_tokens"] += c_tok
        m_sum["complexity_breakdown"][comp] = m_sum["complexity_breakdown"].get(comp, 0) + 1

        # Matrix key: (user_id, model_id)
        matrix_key = f"{u_id}::{m_id}"
        if matrix_key not in matrix_map:
            model_meta = ModelRegistry.get_model(m_id)
            matrix_map[matrix_key] = {
                "user_id": u_id,
                "username": u_name,
                "model_id": m_id,
                "model_name": model_meta.model_name if model_meta else m_id,
                "provider": model_meta.provider if model_meta else "custom",
                "total_requests": 0,
                "total_cost_usd": 0.0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "latency_sum": 0.0,
                "complexity_breakdown": {}
            }
        mat_entry = matrix_map[matrix_key]
        mat_entry["total_requests"] += 1
        mat_entry["total_cost_usd"] += cost
        mat_entry["prompt_tokens"] += p_tok
        mat_entry["completion_tokens"] += c_tok
        mat_entry["latency_sum"] += lat
        mat_entry["complexity_breakdown"][comp] = mat_entry["complexity_breakdown"].get(comp, 0) + 1

    # Format user_model_matrix list
    user_model_matrix = []
    for k, data in matrix_map.items():
        data["total_cost_usd"] = round(data["total_cost_usd"], 6)
        data["avg_latency"] = round(data["latency_sum"] / data["total_requests"], 2) if data["total_requests"] > 0 else 0
        del data["latency_sum"]
        user_model_matrix.append(data)

    user_model_matrix.sort(key=lambda x: x["total_cost_usd"], reverse=True)

    users_summary_list = []
    for u_id, data in users_summary_map.items():
        data["total_cost_usd"] = round(data["total_cost_usd"], 6)
        users_summary_list.append(data)
    users_summary_list.sort(key=lambda x: x["total_cost_usd"], reverse=True)

    models_summary_list = []
    for m_id, data in models_summary_map.items():
        data["total_cost_usd"] = round(data["total_cost_usd"], 6)
        models_summary_list.append(data)
    models_summary_list.sort(key=lambda x: x["total_cost_usd"], reverse=True)

    return {
        "timeframe": timeframe,
        "start_date": start_date,
        "end_date": end_date,
        "summary": {
            "total_cost_usd": round(total_cost, 6),
            "total_requests": total_requests,
            "total_tokens": total_prompt_tokens + total_completion_tokens,
            "prompt_tokens": total_prompt_tokens,
            "completion_tokens": total_completion_tokens,
            "total_users": len(users_summary_map),
            "total_models_used": len(models_summary_map),
            "avg_latency_seconds": round(total_latency / total_requests, 2) if total_requests > 0 else 0.0
        },
        "users_summary": users_summary_list,
        "models_summary": models_summary_list,
        "user_model_matrix": user_model_matrix,
        "registered_models": get_registered_models_dict()
    }
