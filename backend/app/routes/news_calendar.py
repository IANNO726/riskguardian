"""
news_calendar.py — Economic News Calendar Service
==================================================
Scrapes ForexFactory (no API key needed) and caches results.
Provides endpoints used by both the Simulator and the main dashboard.

Endpoints:
  GET /api/v1/news/calendar          — this week's high-impact events
  GET /api/v1/news/upcoming          — next 24 hours, high-impact only
  GET /api/v1/news/check?symbol=EURUSD&time=2026-03-14T14:30:00  — is this trade in a news window?
"""

from fastapi import APIRouter, Depends
from datetime import datetime, timedelta, timezone
import httpx
import json
import re
from typing import Optional

from app.middleware.plan_gating import require_plan

router = APIRouter()

# ── In-memory cache (resets on restart, fine for a local app) ─────────────────
_cache: dict = {"events": [], "fetched_at": None}
_CACHE_TTL_MINUTES = 60   # refresh every hour

# ── Currency → pairs that are affected ────────────────────────────────────────
CURRENCY_PAIRS: dict[str, list[str]] = {
    "USD": ["EURUSD","GBPUSD","AUDUSD","NZDUSD","USDCAD","USDCHF","USDJPY",
            "EURJPY","GBPJPY","AUDJPY","NZDJPY","CADJPY","CHFJPY","XAUUSD"],
    "EUR": ["EURUSD","EURJPY","EURGBP","EURAUD","EURCAD","EURCHF","EURNZD"],
    "GBP": ["GBPUSD","GBPJPY","EURGBP","GBPAUD","GBPCAD","GBPCHF","GBPNZD"],
    "JPY": ["USDJPY","EURJPY","GBPJPY","AUDJPY","NZDJPY","CADJPY","CHFJPY"],
    "AUD": ["AUDUSD","AUDJPY","EURAUD","GBPAUD","AUDCAD","AUDCHF","AUDNZD"],
    "CAD": ["USDCAD","CADJPY","EURCAD","GBPCAD","AUDCAD","NZDCAD"],
    "CHF": ["USDCHF","CHFJPY","EURCHF","GBPCHF","AUDCHF","NZDCHF"],
    "NZD": ["NZDUSD","NZDJPY","EURNZD","GBPNZD","AUDNZD","NZDCAD","NZDCHF"],
}

# ── High-impact event keywords ─────────────────────────────────────────────────
HIGH_IMPACT_KEYWORDS = [
    "nfp", "non-farm", "payroll", "cpi", "inflation", "gdp", "fomc",
    "interest rate", "rate decision", "pmi", "ism", "employment",
    "retail sales", "trade balance", "pce", "jobless", "unemployment",
    "manufacturing", "boe", "ecb", "rba", "boc", "rbnz", "snb",
    "federal reserve", "fed chair", "speech", "press conference",
    "flash pmi", "services pmi",
]

def _is_high_impact(title: str) -> bool:
    t = title.lower()
    return any(k in t for k in HIGH_IMPACT_KEYWORDS)


def _parse_forexfactory_json(data: list) -> list:
    """Parse ForexFactory calendar JSON response into normalised event dicts."""
    events = []
    for item in data:
        try:
            title    = item.get("name", "") or item.get("title", "") or ""
            currency = (item.get("currency", "") or item.get("country", "") or "").upper()
            impact   = (item.get("impact", "") or item.get("importance", "") or "").lower()
            date_str = item.get("date", "") or item.get("datetime", "") or ""
            time_str = item.get("time", "") or ""

            # Try to parse datetime
            dt = None
            for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M",
                        "%m/%d/%Y %I:%M%p", "%Y-%m-%d"]:
                try:
                    raw = f"{date_str} {time_str}".strip() if time_str else date_str
                    dt = datetime.strptime(raw.replace("am","AM").replace("pm","PM"), fmt)
                    break
                except ValueError:
                    continue

            if not dt:
                continue

            # Determine affected pairs
            affected = CURRENCY_PAIRS.get(currency, [])

            is_high = (impact in ["high","red","3"]) or _is_high_impact(title)

            events.append({
                "id":           item.get("id", f"{currency}_{date_str}"),
                "title":        title,
                "currency":     currency,
                "impact":       "high" if impact in ["high","red","3"] else
                                "medium" if impact in ["medium","orange","2"] else "low",
                "datetime_utc": dt.strftime("%Y-%m-%dT%H:%M:00"),
                "affected_pairs": affected,
                "is_high_impact": is_high,
                "actual":       item.get("actual", ""),
                "forecast":     item.get("forecast", ""),
                "previous":     item.get("previous", ""),
            })
        except Exception:
            continue
    return events


async def _fetch_forexfactory() -> list:
    """Fetch ForexFactory calendar for this week. Returns list of event dicts."""
    now = datetime.utcnow()
    # ForexFactory week param: MMMMDD format or use the week endpoint
    url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
    fallback_url = "https://nfs.faireconomy.media/ff_calendar_nextweek.json"

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; RiskGuardian/1.0)",
        "Accept": "application/json",
    }

    all_events = []
    async with httpx.AsyncClient(timeout=15.0) as client:
        for url_to_try in [url, fallback_url]:
            try:
                resp = await client.get(url_to_try, headers=headers, follow_redirects=True)
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list) and len(data) > 0:
                        all_events.extend(_parse_forexfactory_json(data))
            except Exception:
                continue

    return all_events


async def _get_cached_events(force_refresh: bool = False) -> list:
    """Return cached events, fetching fresh data if cache is stale."""
    now = datetime.utcnow()
    cache_age_minutes = 9999

    if _cache["fetched_at"]:
        age = now - _cache["fetched_at"]
        cache_age_minutes = age.total_seconds() / 60

    if force_refresh or cache_age_minutes > _CACHE_TTL_MINUTES or not _cache["events"]:
        try:
            fresh = await _fetch_forexfactory()
            if fresh:
                _cache["events"] = fresh
                _cache["fetched_at"] = now
        except Exception:
            pass  # Keep stale cache if fetch fails

    return _cache["events"]


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/calendar")
async def get_calendar(
    impact: Optional[str] = None,    # "high" | "medium" | "low" | None = all
    currency: Optional[str] = None,  # e.g. "USD"
    days: int = 7,                   # how many days ahead
    _=Depends(require_plan("pro")),
):
    """
    Returns economic events for the next N days.
    Optional filters: impact level, currency.
    """
    events = await _get_cached_events()

    now     = datetime.utcnow()
    cutoff  = now + timedelta(days=days)

    filtered = []
    for ev in events:
        try:
            ev_dt = datetime.strptime(ev["datetime_utc"], "%Y-%m-%dT%H:%M:%S")
        except ValueError:
            try:
                ev_dt = datetime.strptime(ev["datetime_utc"], "%Y-%m-%dT%H:%M:00")
            except ValueError:
                continue

        if not (now - timedelta(hours=1) <= ev_dt <= cutoff):
            continue
        if impact and ev.get("impact") != impact:
            continue
        if currency and ev.get("currency") != currency.upper():
            continue

        filtered.append(ev)

    # Sort by datetime
    filtered.sort(key=lambda x: x["datetime_utc"])

    return {
        "events":      filtered,
        "count":       len(filtered),
        "cached_at":   _cache["fetched_at"].isoformat() if _cache["fetched_at"] else None,
        "source":      "ForexFactory (faireconomy.media)",
    }


@router.get("/upcoming")
async def get_upcoming(
    hours: int = 24,
    high_only: bool = True,
    _=Depends(require_plan("pro")),
):
    """
    Returns events in the next N hours. Defaults to high-impact only.
    Used by the Simulator to warn before entering a trade.
    """
    events = await _get_cached_events()

    now    = datetime.utcnow()
    window = now + timedelta(hours=hours)

    upcoming = []
    for ev in events:
        try:
            ev_dt = datetime.strptime(ev["datetime_utc"][:16], "%Y-%m-%dT%H:%M")
        except ValueError:
            continue

        if now <= ev_dt <= window:
            if high_only and not ev.get("is_high_impact"):
                continue
            mins_away = int((ev_dt - now).total_seconds() / 60)
            upcoming.append({**ev, "minutes_away": mins_away})

    upcoming.sort(key=lambda x: x["datetime_utc"])
    return {"events": upcoming, "count": len(upcoming)}


@router.get("/check")
async def check_news_window(
    symbol: str,
    trade_time: Optional[str] = None,   # ISO datetime, defaults to now
    window_minutes: int = 2,             # default FTMO window
    _=Depends(require_plan("pro")),
):
    """
    Check if a trade on `symbol` at `trade_time` falls within a news window.
    Returns: { in_window: bool, nearest_event: {...} | null, minutes_to_event: int | null }
    """
    events   = await _get_cached_events()
    sym_clean = symbol.upper().replace("/", "")

    if trade_time:
        try:
            trade_dt = datetime.fromisoformat(trade_time.replace("Z", ""))
        except ValueError:
            trade_dt = datetime.utcnow()
    else:
        trade_dt = datetime.utcnow()

    nearest_event = None
    nearest_diff  = None

    for ev in events:
        if not ev.get("is_high_impact"):
            continue

        # Check if this event affects the symbol
        affected = ev.get("affected_pairs", [])
        if sym_clean not in [p.upper().replace("/", "") for p in affected]:
            continue

        try:
            ev_dt = datetime.strptime(ev["datetime_utc"][:16], "%Y-%m-%dT%H:%M")
        except ValueError:
            continue

        diff_mins = (trade_dt - ev_dt).total_seconds() / 60
        abs_diff  = abs(diff_mins)

        if abs_diff <= window_minutes * 3:  # show within 3x the window
            if nearest_diff is None or abs_diff < nearest_diff:
                nearest_event = ev
                nearest_diff  = abs_diff

    in_window = nearest_diff is not None and nearest_diff <= window_minutes

    return {
        "in_window":      in_window,
        "nearest_event":  nearest_event,
        "minutes_diff":   round(nearest_diff, 1) if nearest_diff is not None else None,
        "window_minutes": window_minutes,
        "symbol":         sym_clean,
        "checked_at":     trade_dt.isoformat(),
    }


@router.post("/refresh")
async def refresh_calendar(_=Depends(require_plan("pro"))):
    """Force-refresh the news cache."""
    events = await _get_cached_events(force_refresh=True)
    return {
        "message":     "Calendar refreshed",
        "event_count": len(events),
        "fetched_at":  _cache["fetched_at"].isoformat() if _cache["fetched_at"] else None,
    }


