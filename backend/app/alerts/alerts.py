"""
RiskGuardian Alert System
backend/app/alerts/alerts.py

Handles Telegram, Email alerts based on plan.
Uses requests (not httpx) for Windows compatibility.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from enum import Enum

logger = logging.getLogger(__name__)

# ── Alert Types ────────────────────────────────────────────
class AlertType(str, Enum):
    # Risk events
    KILL_SWITCH_FIRED        = "kill_switch_fired"
    DAILY_LOSS_WARNING_50    = "daily_loss_warning_50"
    DAILY_LOSS_WARNING_80    = "daily_loss_warning_80"
    DAILY_LOSS_LIMIT_HIT     = "daily_loss_limit_hit"
    DRAWDOWN_WARNING_80      = "drawdown_warning_80"
    DRAWDOWN_LIMIT_HIT       = "drawdown_limit_hit"
    CONSECUTIVE_LOSS_LOCK    = "consecutive_loss_lock"
    REVENGE_TRADE_DETECTED   = "revenge_trade_detected"
    # Trade events (Pro+)
    TRADE_OPENED             = "trade_opened"
    TRADE_CLOSED             = "trade_closed"
    DAILY_SUMMARY            = "daily_summary"
    WEEKLY_DIGEST            = "weekly_digest"
    WIN_STREAK               = "win_streak"
    # Prop firm (Pro+)
    PROP_FIRM_WARNING        = "prop_firm_warning"
    PROP_FIRM_DANGER         = "prop_firm_danger"
    # Positive
    EQUITY_HIGH              = "equity_high"
    # System
    TRIAL_STARTED            = "trial_started"
    TRIAL_EXPIRING           = "trial_expiring"
    TRIAL_EXPIRED            = "trial_expired"

# ── Plan → allowed channels ────────────────────────────────
PLAN_CHANNELS = {
    "free":       ["email"],
    "starter":    ["email"],
    "pro":        ["email", "telegram"],
    "enterprise": ["email", "telegram", "webhook"],
}

# ── Which alerts fire on which plan ────────────────────────
PLAN_ALERTS = {
    "free": [
        AlertType.KILL_SWITCH_FIRED,
        AlertType.DAILY_LOSS_WARNING_80,
        AlertType.DAILY_LOSS_LIMIT_HIT,
        AlertType.DRAWDOWN_WARNING_80,
        AlertType.DRAWDOWN_LIMIT_HIT,
        AlertType.CONSECUTIVE_LOSS_LOCK,
    ],
    "starter": [
        AlertType.KILL_SWITCH_FIRED,
        AlertType.DAILY_LOSS_WARNING_50,
        AlertType.DAILY_LOSS_WARNING_80,
        AlertType.DAILY_LOSS_LIMIT_HIT,
        AlertType.DRAWDOWN_WARNING_80,
        AlertType.DRAWDOWN_LIMIT_HIT,
        AlertType.CONSECUTIVE_LOSS_LOCK,
    ],
    "pro": [
        AlertType.KILL_SWITCH_FIRED,
        AlertType.DAILY_LOSS_WARNING_50,
        AlertType.DAILY_LOSS_WARNING_80,
        AlertType.DAILY_LOSS_LIMIT_HIT,
        AlertType.DRAWDOWN_WARNING_80,
        AlertType.DRAWDOWN_LIMIT_HIT,
        AlertType.CONSECUTIVE_LOSS_LOCK,
        AlertType.REVENGE_TRADE_DETECTED,
        AlertType.TRADE_OPENED,
        AlertType.TRADE_CLOSED,
        AlertType.DAILY_SUMMARY,
        AlertType.WEEKLY_DIGEST,
        AlertType.WIN_STREAK,
        AlertType.PROP_FIRM_WARNING,
        AlertType.PROP_FIRM_DANGER,
        AlertType.EQUITY_HIGH,
    ],
    "enterprise": "__all__",
}

# ── Telegram message templates ─────────────────────────────
def build_telegram_message(alert_type: AlertType, data: dict) -> str:
    account = data.get("account_name", "Your Account")

    templates = {
        AlertType.KILL_SWITCH_FIRED: f"""🔴 <b>KILL SWITCH ACTIVATED</b>

Account: <b>{account}</b>
Reason: {data.get('reason', 'Daily loss limit reached')}
Loss today: <b>-${data.get('loss', 0):.2f}</b> / ${data.get('limit', 0):.2f} limit

Trading is <b>BLOCKED</b> until {data.get('reset_time', 'tomorrow 00:00 UTC')}.
Stay disciplined. The market will be here tomorrow. 💪

— RiskGuardian""",

        AlertType.DAILY_LOSS_WARNING_50: f"""🟡 <b>50% Daily Limit Used</b>

Account: <b>{account}</b>
Used: <b>${data.get('loss', 0):.2f}</b> of ${data.get('limit', 0):.2f}
Remaining: <b>${data.get('remaining', 0):.2f}</b>

You're halfway there. Trade carefully.

— RiskGuardian""",

        AlertType.DAILY_LOSS_WARNING_80: f"""⚠️ <b>DANGER ZONE — 80% Warning</b>

Account: <b>{account}</b>
You've used <b>${data.get('loss', 0):.2f}</b> of your ${data.get('limit', 0):.2f} daily limit.
Only <b>${data.get('remaining', 0):.2f}</b> remaining.

One bad trade could trigger your kill switch.
Consider stopping for today. 🛑

— RiskGuardian""",

        AlertType.DAILY_LOSS_LIMIT_HIT: f"""🔴 <b>DAILY LOSS LIMIT REACHED</b>

Account: <b>{account}</b>
Total loss: <b>-${data.get('loss', 0):.2f}</b>
Limit was: ${data.get('limit', 0):.2f}

Kill switch armed. No more trades today. 🔒

— RiskGuardian""",

        AlertType.DRAWDOWN_WARNING_80: f"""⚠️ <b>Drawdown Warning — 80%</b>

Account: <b>{account}</b>
Current drawdown: <b>{data.get('drawdown_pct', 0):.1f}%</b>
Max allowed: {data.get('max_pct', 0):.1f}%
Remaining buffer: <b>${data.get('remaining', 0):.2f}</b>

Slow down — you're in the danger zone. 📉

— RiskGuardian""",

        AlertType.CONSECUTIVE_LOSS_LOCK: f"""🔄 <b>Consecutive Loss Cooldown</b>

Account: <b>{account}</b>
You've had <b>{data.get('losses', 3)} losses in a row.</b>

<b>{data.get('cooldown_mins', 30)}-minute cooldown activated.</b>
New trades blocked until {data.get('unlock_time', 'cooldown ends')}.

Step away. Come back fresh. 🧘

— RiskGuardian""",

        AlertType.REVENGE_TRADE_DETECTED: f"""😤 <b>Revenge Trade Detected</b>

Account: <b>{account}</b>
You lost {data.get('losses', 2)} trades in {data.get('minutes', 8)} minutes and opened another immediately.

<b>{data.get('cooldown_mins', 15)}-minute cooldown activated.</b>
Trades blocked until {data.get('unlock_time', 'cooldown ends')}.

Breathe. Protect your account. 🛡️

— RiskGuardian""",

        AlertType.TRADE_OPENED: f"""📈 <b>Trade Opened</b>

Account: <b>{account}</b>
Pair: <b>{data.get('symbol', 'N/A')}</b>
Direction: {data.get('direction', 'BUY')} | Lot: {data.get('lot', 0.1)}
Entry: {data.get('entry', 'N/A')}

Daily P&L so far: {'+' if data.get('daily_pnl',0)>=0 else ''}{data.get('daily_pnl', 0):.2f}
Daily limit used: {data.get('limit_pct', 0):.0f}%

— RiskGuardian""",

        AlertType.TRADE_CLOSED: f"""📊 <b>Trade Closed</b>

Account: <b>{account}</b>
Pair: <b>{data.get('symbol', 'N/A')}</b>
Result: <b>{'✅ +' if data.get('profit',0)>=0 else '❌ '}${abs(data.get('profit', 0)):.2f}</b>
Duration: {data.get('duration', 'N/A')}

Daily P&L: {'+'if data.get('daily_pnl',0)>=0 else ''}{data.get('daily_pnl', 0):.2f}
Daily limit used: {data.get('limit_pct', 0):.0f}%

— RiskGuardian""",

        AlertType.WIN_STREAK: f"""🔥 <b>Win Streak Alert!</b>

Account: <b>{account}</b>
You're on a <b>{data.get('streak', 3)}-win streak!</b>
Total gained: <b>+${data.get('total_gain', 0):.2f}</b>

You're on fire — but stay disciplined.
Don't let wins turn into overconfidence. 🎯

— RiskGuardian""",

        AlertType.PROP_FIRM_WARNING: f"""🏆 <b>{data.get('firm', 'Prop Firm')} Challenge — WARNING</b>

Account: <b>{account}</b>
You've used <b>{data.get('pct_used', 60):.0f}%</b> of your max daily loss.
Limit: ${data.get('limit', 500):.0f} | Used: ${data.get('used', 300):.0f} | Remaining: <b>${data.get('remaining', 200):.0f}</b>

Challenge phase: <b>{data.get('phase', 'Phase 1')}</b>
RiskGuardian kill switch is armed. 🛡️

— RiskGuardian""",

        AlertType.PROP_FIRM_DANGER: f"""🚨 <b>{data.get('firm', 'Prop Firm')} DANGER — Stop Trading NOW</b>

Account: <b>{account}</b>
<b>You are 1 bad trade away from failing your challenge.</b>

Used: ${data.get('used', 450):.0f} / ${data.get('limit', 500):.0f}
Remaining: <b>ONLY ${data.get('remaining', 50):.0f}</b>

Trading <b>SUSPENDED</b> to protect your challenge. 🔴

— RiskGuardian""",

        AlertType.DAILY_SUMMARY: f"""📅 <b>Daily Summary</b>

Account: <b>{account}</b>
Date: {data.get('date', datetime.now().strftime('%d %b %Y'))}

Trades: {data.get('total_trades', 0)} | Wins: {data.get('wins', 0)} | Losses: {data.get('losses', 0)}
Win Rate: <b>{data.get('win_rate', 0):.0f}%</b>
Net P&L: <b>{'+'if data.get('net_pnl',0)>=0 else ''}${data.get('net_pnl', 0):.2f}</b>

Best trade: +${data.get('best_trade', 0):.2f}
Worst trade: -${data.get('worst_trade', 0):.2f}

{data.get('message', 'Keep building the discipline. 💪')}

— RiskGuardian""",

        AlertType.EQUITY_HIGH: f"""🎉 <b>New Account High!</b>

Account: <b>{account}</b>
New equity high: <b>${data.get('equity', 0):,.2f}</b>
Up <b>{data.get('growth_pct', 0):.1f}%</b> this month

Excellent work. Stay disciplined and protect these gains. 🏆

— RiskGuardian""",
    }
    return templates.get(alert_type, f"RiskGuardian Alert: {alert_type.value}")


# ── Core dispatcher ────────────────────────────────────────
class AlertDispatcher:
    def __init__(self, bot_token: str, email_sender=None):
        self.bot_token    = bot_token
        self.email_sender = email_sender

    def user_can_receive(self, plan: str, alert_type: AlertType) -> bool:
        allowed = PLAN_ALERTS.get(plan, [])
        if allowed == "__all__":
            return True
        return alert_type in allowed

    async def send_telegram(self, chat_id: str, message: str) -> bool:
        """
        Uses requests (not httpx) via run_in_executor for Windows compatibility.
        httpx has SSL timeout issues on Windows — requests works reliably.
        """
        try:
            import requests as _requests
            url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(None, lambda: _requests.post(
                url,
                json={
                    "chat_id":                  chat_id,
                    "text":                     message,
                    "parse_mode":               "HTML",
                    "disable_web_page_preview": True,
                },
                timeout=20,
            ))
            if resp.status_code == 200:
                logger.info(f"✅ Telegram sent to {chat_id}")
                return True
            else:
                logger.error(f"Telegram error {resp.status_code}: {resp.text}")
                return False
        except Exception as e:
            logger.error(f"Telegram exception: {e}")
            return False

    async def send_webhook(self, webhook_url: str, payload: dict) -> bool:
        """Uses requests via run_in_executor for consistency."""
        try:
            import requests as _requests
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(None, lambda: _requests.post(
                webhook_url, json=payload, timeout=10
            ))
            return resp.status_code < 300
        except Exception as e:
            logger.error(f"Webhook error: {e}")
            return False

    async def dispatch(
        self,
        alert_type: AlertType,
        data: dict,
        plan: str,
        telegram_chat_id: Optional[str] = None,
        email: Optional[str] = None,
        webhook_url: Optional[str] = None,
    ):
        """Main entry point — call this everywhere in your app."""
        if not self.user_can_receive(plan, alert_type):
            logger.info(f"Alert {alert_type} blocked — plan {plan} doesn't include it")
            return

        channels = PLAN_CHANNELS.get(plan, ["email"])
        message  = build_telegram_message(alert_type, data)

        tasks = []

        # Telegram
        if "telegram" in channels and telegram_chat_id:
            tasks.append(self.send_telegram(telegram_chat_id, message))

        # Webhook (Enterprise)
        if "webhook" in channels and webhook_url:
            tasks.append(self.send_webhook(webhook_url, {
                "event":     alert_type.value,
                "account":   data.get("account_name"),
                "data":      data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }))

        # Email
        if "email" in channels and email and self.email_sender:
            tasks.append(self.email_sender(email, alert_type, data))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)


# ── Singleton (import this everywhere) ────────────────────
import os
dispatcher = AlertDispatcher(
    bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
)
