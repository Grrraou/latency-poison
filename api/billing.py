# Billing plan limits: config_keys, requests_per_month. Trial = 1 day.
from datetime import datetime
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import text

PLAN_LIMITS = {
    "free": {"config_keys": 2, "requests_per_month": 500},
    "trial": {"config_keys": 10, "requests_per_month": 50000},
    "starter": {"config_keys": 10, "requests_per_month": 50000},
    "pro": {"config_keys": 50, "requests_per_month": 500000},
}


def get_effective_plan(user: Any) -> str:
    if getattr(user, "plan", None) == "trial" and getattr(user, "trial_ends_at", None):
        if user.trial_ends_at < datetime.utcnow():
            return "free"
    return getattr(user, "plan", None) or "free"


def get_requests_this_month(db: Session, owner_id: int) -> int:
    first_day = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    try:
        r = db.execute(
            text(
                "SELECT COUNT(*) FROM usage_log u "
                "INNER JOIN config_api_keys c ON c.id = u.config_api_key_id AND c.owner_id = :oid "
                "WHERE u.requested_at >= :fd"
            ),
            {"oid": owner_id, "fd": first_day},
        ).fetchone()
        return int(r[0]) if r and r[0] is not None else 0
    except Exception:
        return 0


def get_keys_limit(plan: str) -> int:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["config_keys"]


def get_requests_limit(plan: str) -> int:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["requests_per_month"]
