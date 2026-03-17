from notion_client import Client
from notion_client.errors import APIResponseError
import os
import logging

logger = logging.getLogger(__name__)

# ==========================
# CONFIG — reads from .env
# ==========================
NOTION_TOKEN   = os.getenv("NOTION_TOKEN", "")
DATABASE_ID    = os.getenv("NOTION_DATABASE_ID", "")

# Validate on startup so misconfiguration is caught immediately
_notion_enabled = False
notion = None

# ── Required columns: name → Notion property type ────────────────────────────
# These MUST exist in your Notion database with these exact names.
# If any are missing, _ensure_schema() will create them automatically.
REQUIRED_SCHEMA = {
    "Symbol":      "title",   # ← must be the title column
    "Trade ID":    "number",
    "Direction":   "select",
    "Entry Price": "number",
    "Exit Price":  "number",
    "Volume":      "number",
    "Result":      "number",
    "Emotion":     "select",
    "Strategy":    "select",
    "Notes":       "rich_text",
}

def _ensure_schema() -> bool:
    """
    Checks the Notion database schema and adds any missing columns automatically.
    Returns True if the schema is valid after the check.
    """
    try:
        db_meta = notion.databases.retrieve(database_id=DATABASE_ID)
        existing = set(db_meta.get("properties", {}).keys())
        missing  = {k: v for k, v in REQUIRED_SCHEMA.items() if k not in existing}

        if not missing:
            logger.info(f"✅ Notion schema OK — all {len(REQUIRED_SCHEMA)} columns present.")
            return True

        logger.warning(f"⚠️  Notion DB missing columns: {list(missing.keys())} — adding them now…")

        # Build the properties patch
        new_props = {}
        for col_name, col_type in missing.items():
            if col_type == "title":
                # Can't add a second title column — the existing title column
                # just needs to be renamed. We skip auto-add for title.
                logger.warning(
                    f"⚠️  Your Notion DB title column is not named 'Symbol'. "
                    f"Please rename it to 'Symbol' manually in Notion."
                )
                continue
            elif col_type == "number":
                new_props[col_name] = {"number": {"format": "number"}}
            elif col_type == "select":
                new_props[col_name] = {"select": {}}
            elif col_type == "rich_text":
                new_props[col_name] = {"rich_text": {}}

        if new_props:
            notion.databases.update(
                database_id=DATABASE_ID,
                properties=new_props,
            )
            logger.info(f"✅ Notion schema updated — added: {list(new_props.keys())}")

        return True

    except APIResponseError as e:
        err = str(e)
        if "404" in err or "Could not find" in err:
            logger.warning(
                f"⚠️  Notion database {DATABASE_ID} not found. "
                f"Open the database in Notion → Share → Invite → 'RiskGuardian Journal' → Edit access."
            )
        elif "401" in err or "Unauthorized" in err:
            logger.warning("⚠️  Notion token invalid. Check NOTION_TOKEN in .env.")
        else:
            logger.warning(f"⚠️  Notion schema check failed: {err[:200]}")
        return False
    except Exception as e:
        logger.warning(f"⚠️  Notion schema check error: {e}")
        return False


if not NOTION_TOKEN:
    logger.warning("⚠️  NOTION_TOKEN not set in .env — Notion integration disabled.")
elif not DATABASE_ID:
    logger.warning("⚠️  NOTION_DATABASE_ID not set in .env — Notion integration disabled.")
else:
    try:
        notion = Client(auth=NOTION_TOKEN)
        # Validate access AND auto-fix missing columns on startup
        _notion_enabled = _ensure_schema()
    except APIResponseError as e:
        if "401" in str(e) or "Unauthorized" in str(e):
            logger.warning("⚠️  Notion token invalid or expired. Check NOTION_TOKEN in .env.")
        else:
            logger.warning(f"⚠️  Notion startup error: {e}")
    except Exception as e:
        logger.warning(f"⚠️  Notion could not connect on startup: {e}")


# ==========================
# HELPERS
# ==========================
def _safe_number(val) -> float | None:
    """Return a float or None — Notion rejects non-numeric values."""
    try:
        if val is None:
            return None
        f = float(val)
        return f if f == f else None  # reject NaN
    except (TypeError, ValueError):
        return None


def _safe_text(val) -> str:
    """Return a non-empty string or empty string."""
    return str(val).strip() if val is not None else ""


def _safe_select(val) -> dict | None:
    """Return a select object only if the value is a non-empty string."""
    s = _safe_text(val)
    return {"name": s[:100]} if s else None  # Notion select names max 100 chars


# ==========================
# CREATE TRADE PAGE
# ==========================
def create_trade_page(trade) -> str | None:
    """
    Creates a page in the Notion trading journal database.
    Returns the page URL on success, None on failure.
    """
    if not _notion_enabled or notion is None:
        return None

    # Build properties dict — only include fields with actual values
    # to avoid Notion rejecting None in required-type fields
    properties: dict = {}

    # Title field (every Notion DB needs one — use Symbol as the title)
    symbol_text = _safe_text(getattr(trade, "symbol", ""))
    properties["Symbol"] = {
        "title": [{"text": {"content": symbol_text or "Unknown"}}]
    }

    ticket = _safe_number(getattr(trade, "ticket", None))
    if ticket is not None:
        properties["Trade ID"] = {"number": ticket}

    direction = _safe_select(getattr(trade, "direction", None) or getattr(trade, "trade_direction", None))
    if direction:
        properties["Direction"] = {"select": direction}

    entry_price = _safe_number(getattr(trade, "entry_price", None))
    if entry_price is not None:
        properties["Entry Price"] = {"number": entry_price}

    exit_price = _safe_number(
        getattr(trade, "exit_price", None) or getattr(trade, "close_price", None)
    )
    if exit_price is not None:
        properties["Exit Price"] = {"number": exit_price}

    volume = _safe_number(
        getattr(trade, "lot_size", None) or getattr(trade, "volume", None)
    )
    if volume is not None:
        properties["Volume"] = {"number": volume}

    result = _safe_number(
        getattr(trade, "profit_loss", None) or getattr(trade, "result", None)
    )
    if result is not None:
        properties["Result"] = {"number": result}

    emotion = _safe_select(
        getattr(trade, "emotional_state", None) or getattr(trade, "emotion", None)
    )
    if emotion:
        properties["Emotion"] = {"select": emotion}
    else:
        properties["Emotion"] = {"select": {"name": "Neutral"}}

    strategy = _safe_select(getattr(trade, "strategy_used", None))
    if strategy:
        properties["Strategy"] = {"select": strategy}

    notes_text = _safe_text(getattr(trade, "notes", ""))
    if notes_text:
        properties["Notes"] = {
            "rich_text": [{"text": {"content": notes_text[:2000]}}]  # Notion 2000 char limit
        }

    try:
        response = notion.pages.create(
            parent={"database_id": DATABASE_ID},
            properties=properties,
        )
        url = response.get("url", "")
        logger.info(f"✅ Notion page created: {url}")
        return url

    except APIResponseError as e:
        err = str(e)
        if "404" in err or "Could not find" in err:
            logger.warning(
                "⚠️  Notion 404 — database not shared with integration. "
                "Go to Notion → open database → Share → Invite 'RiskGuardian Journal'."
            )
        elif "validation_error" in err or "400" in err:
            logger.error(
                f"❌ Notion property mismatch — a column name in notion_service.py "
                f"doesn't match your actual database columns. Check Symbol/Direction/etc. Error: {err[:200]}"
            )
        else:
            logger.error(f"❌ Notion API error: {err[:200]}")
        return None

    except Exception as e:
        logger.error(f"❌ Notion unexpected error: {e}")
        return None