from app.services.notion_service import create_trade_page
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
from collections import defaultdict
from statistics import mean, stdev
from app.services.mt5_wrapper import get_mt5`nmt5 = get_mt5()
import shutil
import os
import logging
import threading
import concurrent.futures

from app.database.database import get_db
from app.models.journal import JournalEntry
from app.middleware.plan_gating import check_journal_limit
from app.routes.auth_multi import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helper: serialize one JournalEntry → dict the frontend expects
# ─────────────────────────────────────────────────────────────────────────────
def _serialize(trade: JournalEntry) -> dict:
    entry_dt = trade.entry_date or trade.date
    exit_dt  = trade.exit_date

    def dt_iso(dt) -> str | None:
        if dt is None:
            return None
        if isinstance(dt, datetime):
            return dt.isoformat()
        s = str(dt).strip()
        if not s or s in ("None", "null", ""):
            return None
        return s

    entry_price = trade.entry_price
    exit_price  = trade.exit_price  or trade.close_price
    stop_loss   = trade.stop_loss
    take_profit = trade.take_profit
    profit_loss = trade.profit_loss if trade.profit_loss is not None else trade.result

    raw_dir = trade.trade_direction or trade.direction or ""
    direction = "BUY" if raw_dir.upper() in ("BUY", "BUY ", "B", "0", "LONG") else \
                "SELL" if raw_dir.upper() in ("SELL", "SELL ", "S", "1", "SHORT") else \
                raw_dir.upper() or None

    lot_size = trade.lot_size if trade.lot_size is not None else trade.volume

    return {
        "id":               trade.id,
        "trade_id":         trade.ticket,
        "entry_date":       dt_iso(entry_dt),
        "exit_date":        dt_iso(exit_dt),
        "symbol":           trade.symbol or "",
        "trade_direction":  direction,
        "entry_price":      float(entry_price)  if entry_price  is not None else None,
        "exit_price":       float(exit_price)   if exit_price   is not None else None,
        "stop_loss":        float(stop_loss)    if stop_loss    is not None else None,
        "take_profit":      float(take_profit)  if take_profit  is not None else None,
        "profit_loss":      float(profit_loss)  if profit_loss  is not None else None,
        "lot_size":         float(lot_size)     if lot_size     is not None else None,
        "emotional_state":  trade.emotional_state or trade.emotion or None,
        "strategy_used":    trade.strategy_used or None,
        "notes":            trade.notes or "",
        "lessons_learned":  trade.lessons_learned or None,
        "notion_link":      trade.notion_link or None,
        "ai_feedback":      trade.ai_feedback or None,
        "trade_outcome":    "win" if (profit_loss or 0) > 0 else "loss" if (profit_loss or 0) < 0 else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /  — main list endpoint
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/")
def get_journal(db: Session = Depends(get_db)):
    trades = db.query(JournalEntry).order_by(JournalEntry.date.desc()).all()
    return [_serialize(t) for t in trades]


# ─────────────────────────────────────────────────────────────────────────────
# GET /entries  — paginated entries endpoint (fixes 405 on GET /entries)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/entries")
def get_journal_entries(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    entries = (
        db.query(JournalEntry)
        .order_by(JournalEntry.date.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_serialize(e) for e in entries]


# ─────────────────────────────────────────────────────────────────────────────
# GET /trades  — legacy endpoint
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/trades")
def get_journal_trades(db: Session = Depends(get_db)):
    try:
        trades = db.query(JournalEntry).order_by(JournalEntry.date.desc()).limit(50).all()
        return {"trades": [_serialize(t) for t in trades]}
    except Exception as e:
        logger.error(f"Journal load error: {e}")
        return {"trades": []}


# ─────────────────────────────────────────────────────────────────────────────
# POST /  — create entry from frontend form
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/")
def create_journal_entry(
    data: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    check_journal_limit(current_user, db)

    def parse_dt(val) -> datetime | None:
        if not val:
            return None
        if isinstance(val, datetime):
            return val
        s = str(val).strip()
        if not s:
            return None
        for fmt in (
            "%Y-%m-%dT%H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y.%m.%d %H:%M:%S",
            "%Y.%m.%d %H:%M",
            "%Y.%m.%d",
        ):
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
        return None

    raw_dir = str(data.get("trade_direction") or "BUY").upper()

    trade = JournalEntry(
        date            = parse_dt(data.get("entry_date")) or datetime.utcnow(),
        entry_date      = parse_dt(data.get("entry_date")),
        exit_date       = parse_dt(data.get("exit_date")),
        symbol          = data.get("symbol") or "",
        direction       = raw_dir,
        trade_direction = raw_dir,
        entry_price     = data.get("entry_price"),
        close_price     = data.get("exit_price"),
        exit_price      = data.get("exit_price"),
        stop_loss       = data.get("stop_loss"),
        take_profit     = data.get("take_profit"),
        volume          = data.get("lot_size"),
        lot_size        = data.get("lot_size"),
        result          = data.get("profit_loss"),
        profit_loss     = data.get("profit_loss"),
        emotion         = data.get("emotional_state"),
        emotional_state = data.get("emotional_state"),
        strategy_used   = data.get("strategy_used"),
        notes           = data.get("notes") or "",
        lessons_learned = data.get("lessons_learned"),
        notion_link     = data.get("notion_link") or "",
        screenshots     = "",
    )

    db.add(trade)
    db.commit()
    db.refresh(trade)
    return _serialize(trade)


# ─────────────────────────────────────────────────────────────────────────────
# POST /add  — legacy add endpoint
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/add")
def add_trade(data: dict, db: Session = Depends(get_db)):
    trade = JournalEntry(
        ticket          = None,
        date            = datetime.utcnow(),
        symbol          = data.get("symbol"),
        direction       = data.get("direction"),
        trade_direction = data.get("direction"),
        entry_price     = data.get("entry_price"),
        close_price     = data.get("close_price"),
        exit_price      = data.get("close_price"),
        volume          = data.get("volume"),
        lot_size        = data.get("volume"),
        result          = data.get("result"),
        profit_loss     = data.get("result"),
        emotion         = data.get("emotion", "Neutral"),
        emotional_state = data.get("emotion", "Neutral"),
        discipline_score= data.get("discipline_score", 0),
        notes           = data.get("notes", ""),
        notion_link     = "",
        screenshots     = ""
    )
    db.add(trade)
    db.commit()
    db.refresh(trade)
    return _serialize(trade)


# ─────────────────────────────────────────────────────────────────────────────
# PUT /{id}  — update entry
# ─────────────────────────────────────────────────────────────────────────────
@router.put("/{trade_id}")
def update_trade(trade_id: int, data: dict, db: Session = Depends(get_db)):

    trade = db.query(JournalEntry).filter(JournalEntry.id == trade_id).first()
    if not trade:
        raise HTTPException(404, "Trade not found")

    def parse_dt(val) -> datetime | None:
        if not val:
            return None
        if isinstance(val, datetime):
            return val
        s = str(val).strip()
        for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y.%m.%d %H:%M:%S", "%Y.%m.%d"):
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
        return None

    if "entry_date" in data:
        dt = parse_dt(data["entry_date"])
        trade.entry_date = dt
        trade.date       = dt or trade.date
    if "exit_date"  in data: trade.exit_date       = parse_dt(data["exit_date"])
    if "symbol"     in data: trade.symbol          = data["symbol"]

    raw_dir = data.get("trade_direction") or data.get("direction")
    if raw_dir:
        trade.direction       = str(raw_dir).upper()
        trade.trade_direction = str(raw_dir).upper()

    if "entry_price"  in data: trade.entry_price     = data["entry_price"]
    if "exit_price"   in data:
        trade.exit_price  = data["exit_price"]
        trade.close_price = data["exit_price"]
    if "stop_loss"    in data: trade.stop_loss        = data["stop_loss"]
    if "take_profit"  in data: trade.take_profit      = data["take_profit"]
    if "lot_size"     in data:
        trade.lot_size = data["lot_size"]
        trade.volume   = data["lot_size"]
    if "profit_loss"  in data:
        trade.profit_loss = data["profit_loss"]
        trade.result      = data["profit_loss"]

    if "emotional_state" in data:
        trade.emotional_state = data["emotional_state"]
        trade.emotion         = data["emotional_state"]
    if "strategy_used"   in data: trade.strategy_used   = data["strategy_used"]
    if "notes"           in data: trade.notes           = data["notes"]
    if "lessons_learned" in data: trade.lessons_learned = data["lessons_learned"]
    if "notion_link"     in data: trade.notion_link     = data["notion_link"]

    db.commit()
    db.refresh(trade)
    return _serialize(trade)


# ─────────────────────────────────────────────────────────────────────────────
# DELETE /{id}
# ─────────────────────────────────────────────────────────────────────────────
@router.delete("/{trade_id}")
def delete_trade(trade_id: int, db: Session = Depends(get_db)):
    trade = db.query(JournalEntry).filter(JournalEntry.id == trade_id).first()
    if not trade:
        raise HTTPException(404, "Trade not found")
    db.delete(trade)
    db.commit()
    return {"message": "deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# GET /stats
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/stats")
def get_journal_stats(db: Session = Depends(get_db)):
    trades  = db.query(JournalEntry).all()
    total   = len(trades)
    wins    = [t for t in trades if (t.profit_loss or t.result or 0) > 0]
    winrate = (len(wins) / total * 100) if total else 0
    return {
        "total_trades":     total,
        "discipline_score": 80,
        "avg_rr":           2.0,
        "rule_breaks":      int(100 - winrate),
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /behavior-report  — Phase 4: AI Behavioral Detection
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/behavior-report")
def get_behavior_report(
    days: int | None = None,   # e.g. ?days=7 | ?days=30 | ?days=90 | omit = all time
    db: Session = Depends(get_db),
):
    """
    Analyses non-RISK_LOCK journal entries and returns:
      - discipline_score       (0–100)
      - revenge_trading        (bool + details)
      - overtrading            (bool + details)
      - failure_probability    (0.0–1.0 as a percentage string)
      - insight_bullets        (list[str] — human-readable summary lines)
    Pass ?days=N to restrict analysis to the last N calendar days.
    """
    from datetime import timedelta

    query = db.query(JournalEntry).filter(JournalEntry.symbol != "RISK_LOCK")

    if days and days > 0:
        # "7 Days" = trades from the start of (today - 6 days) onward.
        # i.e. today is day 1, so we go back (days - 1) full days.
        # This makes the behavior report match the journal card list exactly:
        # if the card list shows "No entries" for 7 days, the report shows 0 trades too.
        now        = datetime.utcnow()
        today_utc  = now.replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff_day = today_utc - timedelta(days=days - 1)
        query = query.filter(JournalEntry.date >= cutoff_day)

    trades = query.order_by(JournalEntry.date.asc()).all()

    if not trades:
        label = f"last {days} days" if days else "all time"
        return {
            "discipline_score":    100,
            "revenge_trading":     {"flagged": False, "instances": [], "count": 0},
            "overtrading":         {
                "flagged":      False,
                "peak_day":     None,
                "peak_count":   0,
                "avg_daily":    0,
                "flagged_days": [],          # ← was missing
            },
            "failure_probability":     "0%",
            "failure_probability_raw": 0,
            "insight_bullets":         [f"No trades in the {label}. Start journaling to unlock behavioral analysis."],
            "sample_size":             0,
            "emotional_losses":        0,
            "doc_ratio_pct":           0,
        }

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _pnl(t) -> float:
        v = t.profit_loss if t.profit_loss is not None else (t.result or 0)
        return float(v)

    def _lot(t) -> float:
        v = t.lot_size if t.lot_size is not None else (t.volume or 0)
        return float(v or 0)

    def _dt(t):
        return t.entry_date or t.date

    # ── 1. REVENGE TRADING DETECTION ─────────────────────────────────────────
    # Rule: a loss followed within 60 minutes by a trade whose lot size is
    # ≥ 1.5× the average lot size of the 5 preceding trades.
    revenge_instances = []
    lots = [_lot(t) for t in trades if _lot(t) > 0]
    avg_lot_global = mean(lots) if lots else 0.0

    for i in range(1, len(trades)):
        prev = trades[i - 1]
        curr = trades[i]

        if _pnl(prev) >= 0:
            continue  # previous trade must be a loss

        prev_dt = _dt(prev)
        curr_dt = _dt(curr)
        if prev_dt is None or curr_dt is None:
            continue

        gap_minutes = (curr_dt - prev_dt).total_seconds() / 60
        if gap_minutes < 0 or gap_minutes > 60:
            continue  # only flag within 60-minute window

        window = trades[max(0, i - 5): i]
        window_lots = [_lot(w) for w in window if _lot(w) > 0]
        ref_lot = mean(window_lots) if window_lots else avg_lot_global
        curr_lot = _lot(curr)

        if ref_lot > 0 and curr_lot >= ref_lot * 1.5:
            revenge_instances.append({
                "loss_trade_id":    prev.id,
                "revenge_trade_id": curr.id,
                "loss_pnl":         round(_pnl(prev), 2),
                "normal_lot":       round(ref_lot, 4),
                "revenge_lot":      round(curr_lot, 4),
                "gap_minutes":      round(gap_minutes, 1),
                "symbol":           curr.symbol or "?",
                "date":             str(_dt(curr))[:16],
            })

    revenge_flagged = len(revenge_instances) > 0

    # ── 2. OVERTRADING DETECTION ──────────────────────────────────────────────
    daily_counts: dict[str, int] = defaultdict(int)
    for t in trades:
        dt = _dt(t)
        if dt:
            day_key = str(dt)[:10]  # YYYY-MM-DD
            daily_counts[day_key] += 1

    counts = list(daily_counts.values())
    avg_daily = round(mean(counts), 2) if counts else 0
    threshold = 10
    if len(counts) >= 3:
        sd = stdev(counts) if len(counts) > 1 else 0
        threshold = max(threshold, round(avg_daily + 2 * sd))

    overtrading_days = {
        day: cnt for day, cnt in daily_counts.items() if cnt > threshold
    }
    peak_day   = max(daily_counts, key=daily_counts.get) if daily_counts else None
    peak_count = daily_counts[peak_day] if peak_day else 0
    overtrading_flagged = len(overtrading_days) > 0

    # ── 3. DISCIPLINE SCORE ────────────────────────────────────────────────────
    score = 100

    score -= min(len(revenge_instances) * 5, 30)
    score -= min(len(overtrading_days) * 10, 20)

    neg_emotions = {"anxious", "fearful", "greedy", "frustrated", "excited"}
    emotional_losses = [
        t for t in trades
        if _pnl(t) < 0 and (t.emotional_state or "").lower() in neg_emotions
    ]
    score -= min(len(emotional_losses) * 5, 15)

    documented = sum(
        1 for t in trades
        if (t.strategy_used or "") and (t.lessons_learned or "")
    )
    doc_ratio = documented / len(trades) if trades else 0
    score += round(doc_ratio * 5)

    score = max(0, min(100, score))

    # ── 4. FAILURE PROBABILITY ────────────────────────────────────────────────
    total = len(trades)
    wins  = [t for t in trades if _pnl(t) > 0]
    winrate = len(wins) / total if total else 0
    loss_rate = 1 - winrate

    revenge_score     = min(len(revenge_instances) / max(total * 0.1, 1), 1.0)
    overtrading_score = min(len(overtrading_days) / max(len(daily_counts) * 0.2, 1), 1.0)
    emotion_score     = min(len(emotional_losses) / max(total * 0.2, 1), 1.0)

    failure_prob = (
        revenge_score     * 0.35 +
        overtrading_score * 0.25 +
        loss_rate         * 0.25 +
        emotion_score     * 0.15
    )
    failure_prob = round(min(failure_prob * 100, 99), 1)

    # ── 5. INSIGHT BULLETS ────────────────────────────────────────────────────
    bullets = []

    if revenge_flagged:
        bullets.append(
            f"⚠️ Revenge trading detected in {len(revenge_instances)} instance(s) — "
            f"oversized lots placed within 60 min of a loss."
        )
    else:
        bullets.append("✅ No revenge trading patterns detected — great emotional control.")

    if overtrading_flagged:
        bullets.append(
            f"📊 Overtrading on {len(overtrading_days)} day(s) — "
            f"peak was {peak_count} trades on {peak_day} (avg {avg_daily}/day)."
        )
    else:
        bullets.append(f"✅ Trade frequency looks healthy — avg {avg_daily} trades/day.")

    if emotional_losses:
        bullets.append(
            f"😟 {len(emotional_losses)} loss(es) taken while in a negative emotional state. "
            "Consider a cooldown rule."
        )
    else:
        bullets.append("✅ Emotional state did not negatively impact trade outcomes.")

    doc_pct = round(doc_ratio * 100)
    if doc_pct >= 70:
        bullets.append(f"📚 {doc_pct}% of trades documented with strategy + lessons. Excellent journaling habit.")
    else:
        bullets.append(f"💡 Only {doc_pct}% of trades fully documented. Log strategy + lessons to improve your edge.")

    if failure_prob >= 60:
        bullets.append(f"🔴 Failure probability is HIGH ({failure_prob}%) — review your risk rules immediately.")
    elif failure_prob >= 35:
        bullets.append(f"🟡 Failure probability is MODERATE ({failure_prob}%) — addressable with discipline improvements.")
    else:
        bullets.append(f"🟢 Failure probability is LOW ({failure_prob}%) — keep following your process.")

    return {
        "discipline_score": score,
        "revenge_trading": {
            "flagged":   revenge_flagged,
            "count":     len(revenge_instances),
            "instances": revenge_instances[:10],
        },
        "overtrading": {
            "flagged":      overtrading_flagged,
            "peak_day":     peak_day,
            "peak_count":   peak_count,
            "avg_daily":    avg_daily,
            "flagged_days": list(overtrading_days.keys())[:10],
        },
        "failure_probability":     f"{failure_prob}%",
        "failure_probability_raw": failure_prob,
        "insight_bullets":         bullets,
        "sample_size":             total,
        "emotional_losses":        len(emotional_losses),
        "doc_ratio_pct":           doc_pct,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /sync-mt5
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/sync-mt5")
def sync_mt5_trades(db: Session = Depends(get_db)):

    if not mt5.initialize():
        return {"message": "MT5 not connected", "error": str(mt5.last_error())}

    utc_to   = datetime.now()
    utc_from = datetime(2000, 1, 1)

    all_deals = mt5.history_deals_get(utc_from, utc_to)
    deals     = all_deals

    if all_deals is None:
        return {"message": "MT5 error", "error": str(mt5.last_error())}

    # ── Build a map of entry AND exit prices keyed by position_id ────────────
    # entry_flag == 0  → position open deal  → gives us entry price & time
    # entry_flag == 1  → position close deal → gives us exit  price & time
    # entry_flag == 3  → partial/reverse close — also treated as exit
    position_price_map: dict[int, dict] = {}
    for d in all_deals:
        pid = getattr(d, "position_id", None)
        if pid is None:
            continue
        entry_flag = getattr(d, "entry", -1)
        if pid not in position_price_map:
            position_price_map[pid] = {
                "entry_price": None, "exit_price": None,
                "entry_time":  None, "exit_time":  None,
            }
        if entry_flag == 0:
            # Open deal — record entry price (only if not already set)
            if position_price_map[pid]["entry_price"] is None:
                position_price_map[pid]["entry_price"] = float(d.price) if d.price else None
            position_price_map[pid]["entry_time"] = (
                datetime.fromtimestamp(d.time) if d.time else None
            )
        elif entry_flag in (1, 3):
            # Close deal — record exit price (keep the last close if multiple partials)
            position_price_map[pid]["exit_price"] = float(d.price) if d.price else None
            position_price_map[pid]["exit_time"]  = (
                datetime.fromtimestamp(d.time) if d.time else None
            )

    def get_entry_price_from_order(position_id: int) -> float | None:
        """Fallback: read entry price from the order history."""
        try:
            orders = mt5.history_orders_get(position=position_id)
            if orders:
                for o in sorted(orders, key=lambda x: x.time_setup):
                    p = getattr(o, "price_open", None) or getattr(o, "price", None)
                    if p and float(p) != 0.0:
                        return float(p)
        except Exception:
            pass
        return None

    def get_exit_price_from_deals(position_id: int, current_ticket: int) -> float | None:
        """
        Fallback: scan all deals for this position and find the close deal
        that is NOT the entry deal — return its price.
        This correctly separates entry from exit even when deal.price looks the same.
        """
        try:
            close_deals = [
                d for d in all_deals
                if getattr(d, "position_id", None) == position_id
                and getattr(d, "entry", -1) in (1, 3)
                and d.ticket == current_ticket
            ]
            if close_deals:
                return float(close_deals[0].price)
        except Exception:
            pass
        return None

    def get_sl_tp_for_position(position_id: int):
        try:
            orders = mt5.history_orders_get(position=position_id)
            if orders:
                for o in orders:
                    sl = getattr(o, "sl", None)
                    tp = getattr(o, "tp", None)
                    if sl or tp:
                        return (
                            float(sl) if sl and float(sl) != 0.0 else None,
                            float(tp) if tp and float(tp) != 0.0 else None,
                        )
        except Exception:
            pass
        return None, None

    imported = 0

    for deal in deals:
        if deal.type > 1:
            continue

        entry_flag   = getattr(deal, "entry", -1)
        is_exit_deal = entry_flag in (1, 3)
        if not is_exit_deal:
            continue
        if deal.profit == 0:
            continue
        if abs(deal.profit) > 10000:
            continue

        existing = db.query(JournalEntry).filter(
            JournalEntry.ticket == deal.ticket
        ).first()
        if existing:
            continue

        position_id = getattr(deal, "position_id", None)
        pos_data    = position_price_map.get(position_id, {}) if position_id else {}

        # ── EXIT price: use the close deal's own price (deal.price for exit deals)
        # The current deal IS the close deal, so deal.price is the exit price.
        exit_price = float(deal.price) if deal.price else None

        # ── ENTRY price: read from position map (open deal) or order history
        entry_price = pos_data.get("entry_price")
        if entry_price is None and position_id:
            entry_price = get_entry_price_from_order(position_id)

        # ── Guard: if entry == exit (data quality issue), try fetching via deals scan
        if (
            entry_price is not None
            and exit_price is not None
            and abs(float(entry_price) - float(exit_price)) < 1e-9
            and position_id
        ):
            # They're identical — the entry price from pos_data was actually the
            # exit price stored under the wrong flag. Re-fetch via order history.
            fallback = get_entry_price_from_order(position_id)
            if fallback and abs(float(fallback) - float(exit_price)) > 1e-9:
                entry_price = fallback

        sl, tp = get_sl_tp_for_position(position_id) if position_id else (None, None)

        direction = "BUY" if deal.type == 0 else "SELL"
        deal_dt   = datetime.fromtimestamp(deal.time) if deal.time else datetime.now()
        # entry_time from the open deal; exit_time from the close deal (current deal)
        entry_dt  = pos_data.get("entry_time") or deal_dt
        exit_dt   = pos_data.get("exit_time")  or deal_dt
        symbol    = deal.symbol or ""

        # Final safety: never store identical entry and exit prices
        final_entry = float(entry_price) if entry_price else None
        final_exit  = float(exit_price)  if exit_price  else None
        if (
            final_entry is not None
            and final_exit is not None
            and abs(final_entry - final_exit) < 1e-9
        ):
            logger.warning(
                f"Position {position_id} ticket {deal.ticket}: "
                f"entry==exit=={final_entry}. Storing exit only; entry set to None."
            )
            final_entry = None  # better to show None than a wrong identical value

        trade = JournalEntry(
            ticket          = deal.ticket,
            date            = entry_dt,
            entry_date      = entry_dt,
            exit_date       = exit_dt,
            symbol          = symbol,
            direction       = direction,
            trade_direction = direction,
            entry_price     = final_entry,
            close_price     = final_exit,
            exit_price      = final_exit,
            stop_loss       = float(sl)          if sl          else None,
            take_profit     = float(tp)          if tp          else None,
            volume          = float(deal.volume) if deal.volume else None,
            lot_size        = float(deal.volume) if deal.volume else None,
            result          = float(deal.profit),
            profit_loss     = float(deal.profit),
            emotion         = "Neutral",
            emotional_state = "Neutral",
            discipline_score= 0,
            notes           = "Auto imported from MT5",
            notion_link     = "",
            screenshots     = "",
        )

        db.add(trade)
        db.commit()
        db.refresh(trade)

        # ── Notion: run in a background thread with a 8-second timeout ──────────
        # This ensures a slow/failing Notion API never blocks the MT5 import.
        def _push_to_notion(trade_id: int, notion_trade):
            try:
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                    future = ex.submit(create_trade_page, notion_trade)
                    notion_url = future.result(timeout=8)
                if notion_url:
                    # Re-fetch the trade from DB inside this thread to update it
                    from app.database.database import SessionLocal
                    _db = SessionLocal()
                    try:
                        _t = _db.query(JournalEntry).filter(JournalEntry.id == trade_id).first()
                        if _t:
                            _t.notion_link = notion_url
                            _db.commit()
                    finally:
                        _db.close()
                    logger.info(f"✅ Notion page created {notion_url}")
            except concurrent.futures.TimeoutError:
                logger.warning(f"⚠️  Notion timed out for trade {trade_id} — will retry on next sync")
            except Exception as e:
                err_str = str(e)
                if "404" in err_str or "Could not find database" in err_str:
                    logger.warning(
                        f"⚠️  Notion not connected — share your database with the "
                        f"'RiskGuardian Journal' integration. ({err_str[:80]})"
                    )
                else:
                    logger.error(f"❌ Notion error for trade {trade_id}: {e}")

        threading.Thread(target=_push_to_notion, args=(trade.id, trade), daemon=True).start()

        imported += 1

    logger.info(f"✅ Imported {imported} trades")
    return {
        "message":             "MT5 Sync complete",
        "new_trades_imported": imported,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /resync-mt5
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/resync-mt5")
def resync_mt5_trades(db: Session = Depends(get_db)):
    deleted = db.query(JournalEntry).filter(
        JournalEntry.notes == "Auto imported from MT5"
    ).delete(synchronize_session=False)
    db.commit()
    logger.info(f"🗑️  Cleared {deleted} auto-imported entries for resync")
    return sync_mt5_trades(db)


# ─────────────────────────────────────────────────────────────────────────────
# POST /upload/{id}  — screenshot upload
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/upload/{trade_id}")
def upload_screenshot(
    trade_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    folder = "uploads"
    os.makedirs(folder, exist_ok=True)
    path = f"{folder}/{file.filename}"
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    trade = db.query(JournalEntry).filter(JournalEntry.id == trade_id).first()
    if not trade:
        raise HTTPException(404, "Trade not found")

    trade.screenshots = (trade.screenshots + "," + path) if trade.screenshots else path
    db.commit()
    return {"message": "uploaded"}


# ═════════════════════════════════════════════════════════════════════════════
# RISK LOCK EVENT ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

def _map_reason_to_emotion(reason: str) -> str:
    """Map lock reason to the closest emotional state label."""
    mapping = {
        "revenge_trade":    "Frustrated",
        "revenge_detected": "Frustrated",
        "loss_limit":       "Anxious",
        "auto_loss_limit":  "Anxious",
        "manual":           "Neutral",
        "risk_lock":        "Disciplined",
    }
    return mapping.get(reason, "Neutral")


@router.post("/lock-event")
def log_lock_event(data: dict, db: Session = Depends(get_db)):
    reason           = data.get("reason", "manual")
    duration_minutes = int(data.get("duration_minutes", 60))
    triggered_by     = data.get("triggered_by", "button")
    daily_loss       = data.get("daily_loss_at_trigger", None)
    custom_notes     = data.get("notes", "")

    reason_labels = {
        "revenge_trade":    "😤 Revenge Trade Lock",
        "revenge_detected": "😤 Revenge Trade Lock",
        "loss_limit":       "📉 Loss Limit Hit",
        "manual":           "🧘 Manual Cooldown",
        "auto_loss_limit":  "🤖 Auto-Lock: Loss Limit",
        "risk_lock":        "🔒 Risk Lock",
    }
    reason_label = reason_labels.get(reason, f"🔒 {reason.replace('_', ' ').title()}")

    duration_str = f"{duration_minutes // 60}h" if duration_minutes >= 60 else f"{duration_minutes}m"

    notes_parts = [f"Risk Lock activated — {reason_label} for {duration_str}."]
    if triggered_by == "auto":
        notes_parts.append("Triggered automatically by the system.")
    if daily_loss is not None:
        notes_parts.append(f"Daily P&L at trigger: ${daily_loss:.2f}")
    if custom_notes:
        notes_parts.append(custom_notes)

    entry = JournalEntry(
        date            = datetime.utcnow(),
        entry_date      = datetime.utcnow(),
        symbol          = "RISK_LOCK",
        direction       = "LOCK",
        trade_direction = "LOCK",
        notes           = " ".join(notes_parts),
        lessons_learned = f"Reason: {reason_label} | Duration: {duration_str} | Triggered by: {triggered_by}",
        emotional_state = _map_reason_to_emotion(reason),
        emotion         = _map_reason_to_emotion(reason),
        profit_loss     = float(daily_loss) if daily_loss is not None else None,
        result          = float(daily_loss) if daily_loss is not None else None,
        ai_feedback     = f"LOCK_EVENT|{reason}|{duration_minutes}|{triggered_by}",
        notion_link     = "",
        screenshots     = "",
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)
    logger.info(f"📓 Lock event logged: {reason_label} for {duration_str}")
    return {"success": True, "id": entry.id, "message": f"Lock event logged: {reason_label}"}


@router.get("/lock-events")
def get_lock_events(db: Session = Depends(get_db)):
    events = (
        db.query(JournalEntry)
        .filter(JournalEntry.symbol == "RISK_LOCK")
        .order_by(JournalEntry.date.desc())
        .limit(50)
        .all()
    )
    return [_serialize(e) for e in events]
