"""
weekly_report.py — Weekly Behavior Report Delivery
====================================================
Sends a weekly trading behavior summary every Sunday at 8:00 PM (local time).

Supports:
  - Telegram bot (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in .env)
  - Email via SMTP (REPORT_EMAIL_TO + SMTP_* in .env)
  - Both simultaneously

Setup:
  pip install apscheduler python-telegram-bot httpx

.env variables needed:
  TELEGRAM_BOT_TOKEN=your_bot_token_here
  TELEGRAM_CHAT_ID=your_chat_id_here           (get via @userinfobot)
  REPORT_EMAIL_TO=trader@example.com
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=yourapp@gmail.com
  SMTP_PASSWORD=your_app_password

Endpoints:
  POST /api/v1/report/send-now     — manual trigger (test)
  GET  /api/v1/report/status       — scheduler status + last sent time
  POST /api/v1/report/schedule     — configure schedule
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os
import asyncio
import logging
from typing import Optional

from app.database.database import get_db
from app.models.journal import JournalEntry
from app.middleware.plan_gating import require_plan

router  = APIRouter()
logger  = logging.getLogger(__name__)

# ── Runtime state ──────────────────────────────────────────────────────────────
_scheduler_state = {
    "enabled":       False,
    "last_sent_at":  None,
    "last_status":   "not_sent",
    "send_day":      "sunday",    # day of week
    "send_hour":     20,          # 8 PM
    "send_minute":   0,
    "channels":      ["telegram", "email"],  # which to send to
}

# ── Helpers ────────────────────────────────────────────────────────────────────

def _pnl(t) -> float:
    v = t.profit_loss if t.profit_loss is not None else (t.result or 0)
    return float(v or 0)

def _build_report_data(db: Session, days: int = 7) -> dict:
    """Build the weekly report payload from the last N days of trades."""
    cutoff = datetime.utcnow() - timedelta(days=days)

    trades = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.symbol != "RISK_LOCK",
            JournalEntry.date >= cutoff,
        )
        .order_by(JournalEntry.date.asc())
        .all()
    )

    lock_events = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.symbol == "RISK_LOCK",
            JournalEntry.date >= cutoff,
        )
        .count()
    )

    total  = len(trades)
    wins   = [t for t in trades if _pnl(t) > 0]
    losses = [t for t in trades if _pnl(t) < 0]
    total_pnl   = sum(_pnl(t) for t in trades)
    win_rate    = round(len(wins) / total * 100, 1) if total > 0 else 0
    avg_win     = round(sum(_pnl(t) for t in wins)   / len(wins),   2) if wins   else 0
    avg_loss    = round(sum(_pnl(t) for t in losses) / len(losses), 2) if losses else 0
    expectancy  = round((win_rate/100 * avg_win) + ((1 - win_rate/100) * avg_loss), 2)

    # Best/worst days
    day_pnl: dict[str, float] = {}
    for t in trades:
        day = str(t.entry_date or t.date)[:10]
        day_pnl[day] = day_pnl.get(day, 0) + _pnl(t)

    best_day  = max(day_pnl.items(), key=lambda x: x[1])  if day_pnl else None
    worst_day = min(day_pnl.items(), key=lambda x: x[1])  if day_pnl else None

    # Revenge trading detection (simplified)
    revenge_count = 0
    from statistics import mean as _mean
    lots = [float(t.lot_size or t.volume or 0) for t in trades if (t.lot_size or t.volume)]
    avg_lot = _mean(lots) if lots else 0
    for i in range(1, len(trades)):
        prev, curr = trades[i-1], trades[i]
        if _pnl(prev) < 0:
            curr_lot = float(curr.lot_size or curr.volume or 0)
            if curr_lot >= avg_lot * 1.5 and avg_lot > 0:
                prev_dt = prev.entry_date or prev.date
                curr_dt = curr.entry_date or curr.date
                if prev_dt and curr_dt:
                    gap = (curr_dt - prev_dt).total_seconds() / 60
                    if 0 < gap <= 60:
                        revenge_count += 1

    # Emotion breakdown
    emotion_counts: dict[str, int] = {}
    for t in trades:
        em = (t.emotional_state or t.emotion or "Unknown").title()
        emotion_counts[em] = emotion_counts.get(em, 0) + 1
    top_emotion = max(emotion_counts.items(), key=lambda x: x[1])[0] if emotion_counts else "N/A"

    # Discipline score
    score = 100
    score -= min(revenge_count * 5, 30)
    score -= min(lock_events * 5, 20)
    score = max(0, score)

    # Symbol breakdown
    sym_pnl: dict[str, float] = {}
    for t in trades:
        sym = (t.symbol or "?").upper()
        sym_pnl[sym] = sym_pnl.get(sym, 0) + _pnl(t)
    top_symbols = sorted(sym_pnl.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "period_days":    days,
        "period_label":   f"Last {days} days",
        "generated_at":   datetime.utcnow().isoformat(),
        "total_trades":   total,
        "wins":           len(wins),
        "losses":         len(losses),
        "win_rate":       win_rate,
        "total_pnl":      round(total_pnl, 2),
        "avg_win":        avg_win,
        "avg_loss":       avg_loss,
        "expectancy":     expectancy,
        "lock_events":    lock_events,
        "revenge_count":  revenge_count,
        "top_emotion":    top_emotion,
        "discipline_score": score,
        "best_day":       {"date": best_day[0],  "pnl": round(best_day[1], 2)}  if best_day  else None,
        "worst_day":      {"date": worst_day[0], "pnl": round(worst_day[1], 2)} if worst_day else None,
        "top_symbols":    [{"symbol": s, "pnl": round(p, 2)} for s, p in top_symbols],
        "emotion_counts": emotion_counts,
    }


def _format_telegram(data: dict) -> str:
    """Format report as Telegram markdown message."""
    pnl      = data["total_pnl"]
    pnl_str  = f"+${pnl:.2f}" if pnl >= 0 else f"-${abs(pnl):.2f}"
    pnl_emoji = "📈" if pnl >= 0 else "📉"
    score    = data["discipline_score"]
    score_emoji = "🟢" if score >= 75 else "🟡" if score >= 50 else "🔴"
    wr       = data["win_rate"]
    wr_emoji = "✅" if wr >= 55 else "⚠️" if wr >= 45 else "🔴"

    lines = [
        f"🗓 *RiskGuardian — Weekly Report*",
        f"_{data['period_label']}_",
        "",
        f"{pnl_emoji} *P&L:* `{pnl_str}`",
        f"{wr_emoji} *Win Rate:* `{wr}%` ({data['wins']}W / {data['losses']}L from {data['total_trades']} trades)",
        f"📊 *Avg Win:* `${data['avg_win']}` | *Avg Loss:* `${data['avg_loss']}`",
        f"🎯 *Expectancy:* `${data['expectancy']}/trade`",
        "",
        f"{score_emoji} *Discipline Score:* `{score}/100`",
    ]

    if data["revenge_count"] > 0:
        lines.append(f"😤 *Revenge Trades:* `{data['revenge_count']}` detected")
    if data["lock_events"] > 0:
        lines.append(f"🔒 *Risk Locks:* `{data['lock_events']}` triggered")

    if data["best_day"]:
        lines.append(f"🏆 *Best Day:* `{data['best_day']['date']}` (+${data['best_day']['pnl']})")
    if data["worst_day"]:
        lines.append(f"💔 *Worst Day:* `{data['worst_day']['date']}` (${data['worst_day']['pnl']})")

    if data["top_symbols"]:
        lines.append("")
        lines.append("📋 *Top Symbols:*")
        for sym in data["top_symbols"][:3]:
            arrow = "▲" if sym["pnl"] >= 0 else "▼"
            lines.append(f"  {arrow} `{sym['symbol']}`: ${sym['pnl']}")

    if data["top_emotion"] and data["top_emotion"] != "N/A":
        lines.append("")
        lines.append(f"🧠 *Dominant Emotion:* `{data['top_emotion']}`")

    # Coaching message
    lines.append("")
    if score >= 80 and pnl >= 0:
        lines.append("✨ _Excellent week — strong discipline and positive P&L. Keep the process going._")
    elif score >= 60:
        lines.append("💡 _Solid week. Focus on eliminating the revenge trades to push your score higher._")
    elif data["revenge_count"] > 2:
        lines.append("⚠️ _Your biggest risk this week was emotional trading. Consider a 30-min cooldown rule after any loss._")
    else:
        lines.append("🔄 _Tough week — review your setup criteria and ensure your RR stays above 1:1._")

    lines.append("")
    lines.append("_Sent by RiskGuardian · riskguardian.io_")
    return "\n".join(lines)


def _format_email_html(data: dict) -> tuple[str, str]:
    """Returns (subject, html_body)."""
    pnl      = data["total_pnl"]
    pnl_str  = f"+${pnl:.2f}" if pnl >= 0 else f"-${abs(pnl):.2f}"
    pnl_color = "#22c55e" if pnl >= 0 else "#ef4444"
    score    = data["discipline_score"]
    score_color = "#22c55e" if score >= 75 else "#f59e0b" if score >= 50 else "#ef4444"
    week_range = data["period_label"]

    subject = f"RiskGuardian Weekly Report — {pnl_str} | {data['win_rate']}% Win Rate"

    rows = ""
    for sym in data["top_symbols"]:
        color = "#22c55e" if sym["pnl"] >= 0 else "#ef4444"
        rows += f'<tr><td style="padding:6px 12px;border-bottom:1px solid #1e2a3a;">{sym["symbol"]}</td><td style="padding:6px 12px;border-bottom:1px solid #1e2a3a;color:{color};font-weight:700;">${sym["pnl"]}</td></tr>'

    html = f"""
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0b1120;font-family:'Segoe UI',Arial,sans-serif;color:white;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">

  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="font-size:26px;font-weight:800;margin:0;background:linear-gradient(90deg,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">
      RiskGuardian</h1>
    <p style="color:rgba(255,255,255,0.4);margin:4px 0 0;">Weekly Performance Report · {week_range}</p>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;text-align:center;">
      <p style="font-size:11px;color:rgba(255,255,255,0.4);margin:0 0 4px;text-transform:uppercase;letter-spacing:.1em">Net P&L</p>
      <p style="font-size:32px;font-weight:800;color:{pnl_color};margin:0;font-family:monospace">{pnl_str}</p>
    </div>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:20px;text-align:center;">
      <p style="font-size:11px;color:rgba(255,255,255,0.4);margin:0 0 4px;text-transform:uppercase;letter-spacing:.1em">Win Rate</p>
      <p style="font-size:32px;font-weight:800;color:white;margin:0;font-family:monospace">{data["win_rate"]}%</p>
      <p style="font-size:12px;color:rgba(255,255,255,0.35);margin:4px 0 0">{data["wins"]}W / {data["losses"]}L · {data["total_trades"]} trades</p>
    </div>
  </div>

  <div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.25);border-radius:16px;padding:20px;margin-bottom:24px;">
    <p style="font-size:13px;color:rgba(255,255,255,0.5);margin:0 0 8px;text-transform:uppercase;letter-spacing:.1em">Discipline Score</p>
    <div style="display:flex;align-items:center;gap:16px;">
      <p style="font-size:42px;font-weight:900;color:{score_color};margin:0;font-family:monospace">{score}</p>
      <div style="flex:1;">
        <div style="height:8px;background:rgba(255,255,255,0.07);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:{score}%;background:{score_color};border-radius:4px;"></div>
        </div>
        <p style="font-size:12px;color:rgba(255,255,255,0.35);margin:4px 0 0">
          {"✅ Great discipline this week" if score >= 75 else "⚠️ Some patterns to address" if score >= 50 else "🔴 Critical: Review your risk rules"}
        </p>
      </div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;margin-bottom:24px;">
    <thead><tr style="background:rgba(255,255,255,0.05);">
      <th style="padding:10px 12px;text-align:left;font-size:11px;color:rgba(255,255,255,0.4);font-weight:700;text-transform:uppercase">Metric</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;color:rgba(255,255,255,0.4);font-weight:700;text-transform:uppercase">Value</th>
    </tr></thead>
    <tbody>
      <tr><td style="padding:8px 12px;border-bottom:1px solid #1e2a3a;color:rgba(255,255,255,0.7)">Avg Win</td><td style="padding:8px 12px;border-bottom:1px solid #1e2a3a;text-align:right;color:#22c55e;font-weight:700">+${data["avg_win"]}</td></tr>
      <tr><td style="padding:8px 12px;border-bottom:1px solid #1e2a3a;color:rgba(255,255,255,0.7)">Avg Loss</td><td style="padding:8px 12px;border-bottom:1px solid #1e2a3a;text-align:right;color:#ef4444;font-weight:700">${data["avg_loss"]}</td></tr>
      <tr><td style="padding:8px 12px;border-bottom:1px solid #1e2a3a;color:rgba(255,255,255,0.7)">Expectancy</td><td style="padding:8px 12px;border-bottom:1px solid #1e2a3a;text-align:right;font-weight:700;color:{"#22c55e" if data["expectancy"] >= 0 else "#ef4444"}">${data["expectancy"]}/trade</td></tr>
      <tr><td style="padding:8px 12px;border-bottom:1px solid #1e2a3a;color:rgba(255,255,255,0.7)">Risk Locks</td><td style="padding:8px 12px;border-bottom:1px solid #1e2a3a;text-align:right;font-weight:700;color:{"#22c55e" if data["lock_events"] == 0 else "#f97316"}">{data["lock_events"]} triggered</td></tr>
      <tr><td style="padding:8px 12px;color:rgba(255,255,255,0.7)">Revenge Trades</td><td style="padding:8px 12px;text-align:right;font-weight:700;color:{"#22c55e" if data["revenge_count"] == 0 else "#ef4444"}">{data["revenge_count"]} detected</td></tr>
    </tbody>
  </table>

  {"<table style='width:100%;border-collapse:collapse;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;margin-bottom:24px;'><thead><tr style='background:rgba(255,255,255,0.05);'><th style='padding:10px 12px;text-align:left;font-size:11px;color:rgba(255,255,255,0.4);font-weight:700;text-transform:uppercase'>Symbol</th><th style='padding:10px 12px;text-align:right;font-size:11px;color:rgba(255,255,255,0.4);font-weight:700;text-transform:uppercase'>P&L</th></tr></thead><tbody>" + rows + "</tbody></table>" if rows else ""}

  <div style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.2);border-radius:12px;padding:16px;margin-bottom:24px;">
    <p style="font-size:13px;color:#38bdf8;font-weight:700;margin:0 0 6px">💡 Weekly Insight</p>
    <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0;line-height:1.7">
    {"Excellent week — discipline score above 75 and positive P&L shows your process is working. Stay consistent." if score >= 75 and pnl >= 0 else
     "You had a positive P&L but discipline needs improvement. Focus on eliminating revenge trades." if pnl >= 0 else
     "Tough week — review your setups and ensure RR stays above 1:1. Your discipline score shows room to improve."}
    </p>
  </div>

  <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.2);margin:0">
    Sent by RiskGuardian · <a href="https://riskguardian.io" style="color:rgba(168,85,247,0.6)">riskguardian.io</a>
  </p>
</div>
</body></html>"""
    return subject, html


async def _send_telegram(message: str) -> dict:
    """Send a Telegram message via bot API."""
    token   = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")

    if not token or not chat_id:
        return {"success": False, "error": "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set in .env"}

    import httpx
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id":    chat_id,
        "text":       message,
        "parse_mode": "Markdown",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            data = resp.json()
            if resp.status_code == 200 and data.get("ok"):
                return {"success": True, "message_id": data["result"]["message_id"]}
            else:
                return {"success": False, "error": data.get("description", "Unknown error")}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def _send_email(subject: str, html_body: str) -> dict:
    """Send HTML email via SMTP."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    to_addr   = os.environ.get("REPORT_EMAIL_TO", "")
    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASSWORD", "")

    if not to_addr or not smtp_user or not smtp_pass:
        return {"success": False, "error": "Email .env vars not configured (REPORT_EMAIL_TO, SMTP_USER, SMTP_PASSWORD)"}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = smtp_user
        msg["To"]      = to_addr
        msg.attach(MIMEText(html_body, "html"))

        loop = asyncio.get_event_loop()
        def _send():
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.ehlo()
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, to_addr, msg.as_string())
        await loop.run_in_executor(None, _send)
        return {"success": True, "to": to_addr}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def _send_weekly_report(db_session_factory) -> dict:
    """Build and send the weekly report to all configured channels."""
    db = next(db_session_factory())
    try:
        data = _build_report_data(db, days=7)
    finally:
        db.close()

    results = {}
    channels = _scheduler_state.get("channels", ["telegram", "email"])

    if "telegram" in channels:
        message = _format_telegram(data)
        results["telegram"] = await _send_telegram(message)

    if "email" in channels:
        subject, html = _format_email_html(data)
        results["email"] = await _send_email(subject, html)

    _scheduler_state["last_sent_at"]  = datetime.utcnow().isoformat()
    _scheduler_state["last_status"]   = "sent"
    _scheduler_state["last_report"]   = data

    return {"results": results, "report_data": data}


# ── APScheduler setup ──────────────────────────────────────────────────────────

def start_scheduler(db_session_factory):
    """
    Call this from main.py on startup to enable weekly reports.

    Example in main.py:
        from app.routes.weekly_report import start_scheduler
        from app.database.database import SessionLocal
        @app.on_event("startup")
        async def startup():
            start_scheduler(SessionLocal)
    """
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger

        scheduler = AsyncIOScheduler()

        day_map = {
            "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
            "friday": 4, "saturday": 5, "sunday": 6,
        }
        day_num = day_map.get(_scheduler_state["send_day"].lower(), 6)

        scheduler.add_job(
            func=lambda: asyncio.create_task(_send_weekly_report(db_session_factory)),
            trigger=CronTrigger(
                day_of_week=day_num,
                hour=_scheduler_state["send_hour"],
                minute=_scheduler_state["send_minute"],
            ),
            id="weekly_report",
            replace_existing=True,
        )
        scheduler.start()
        _scheduler_state["enabled"] = True
        logger.info(f"✅ Weekly report scheduler started — {_scheduler_state['send_day']} at {_scheduler_state['send_hour']:02d}:{_scheduler_state['send_minute']:02d}")
    except ImportError:
        logger.warning("⚠️  APScheduler not installed — weekly reports disabled. Run: pip install apscheduler")


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_report_status():
    return {
        "scheduler_enabled": _scheduler_state["enabled"],
        "send_day":          _scheduler_state["send_day"],
        "send_hour":         _scheduler_state["send_hour"],
        "send_minute":       _scheduler_state["send_minute"],
        "channels":          _scheduler_state["channels"],
        "last_sent_at":      _scheduler_state["last_sent_at"],
        "last_status":       _scheduler_state["last_status"],
        "telegram_configured": bool(os.environ.get("TELEGRAM_BOT_TOKEN") and os.environ.get("TELEGRAM_CHAT_ID")),
        "email_configured":    bool(os.environ.get("REPORT_EMAIL_TO") and os.environ.get("SMTP_USER")),
    }


@router.post("/send-now")
async def send_report_now(
    db: Session = Depends(get_db),
    _=Depends(require_plan("pro")),
):
    """Manually trigger the weekly report immediately (for testing)."""
    data = _build_report_data(db, days=7)
    results = {}

    channels = _scheduler_state.get("channels", ["telegram", "email"])

    if "telegram" in channels:
        message = _format_telegram(data)
        results["telegram"] = await _send_telegram(message)

    if "email" in channels:
        subject, html = _format_email_html(data)
        results["email"] = await _send_email(subject, html)

    _scheduler_state["last_sent_at"] = datetime.utcnow().isoformat()
    _scheduler_state["last_status"]  = "sent_manual"

    return {
        "message":     "Report sent",
        "results":     results,
        "report_data": data,
    }


@router.post("/configure")
async def configure_report(
    config: dict,
    _=Depends(require_plan("growth")),
):
    """
    Configure the report schedule and channels.
    Body: { "send_day": "sunday", "send_hour": 20, "channels": ["telegram","email"] }
    """
    valid_days = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]

    if "send_day" in config:
        if config["send_day"].lower() not in valid_days:
            raise HTTPException(400, f"send_day must be one of: {valid_days}")
        _scheduler_state["send_day"] = config["send_day"].lower()

    if "send_hour" in config:
        h = int(config["send_hour"])
        if not (0 <= h <= 23):
            raise HTTPException(400, "send_hour must be 0-23")
        _scheduler_state["send_hour"] = h

    if "channels" in config:
        valid_channels = {"telegram", "email"}
        channels = [c for c in config["channels"] if c in valid_channels]
        if not channels:
            raise HTTPException(400, "channels must include 'telegram' and/or 'email'")
        _scheduler_state["channels"] = channels

    return {"message": "Configuration updated", "config": _scheduler_state}


@router.get("/preview")
async def preview_report(
    db: Session = Depends(get_db),
    _=Depends(require_plan("pro")),
):
    """Preview the report data without sending (JSON only)."""
    data = _build_report_data(db, days=7)
    tg_message = _format_telegram(data)
    subject, _ = _format_email_html(data)
    return {
        "report_data":    data,
        "telegram_preview": tg_message,
        "email_subject":  subject,
    }


