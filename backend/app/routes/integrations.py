"""
Integrations Backend — Google Sheets, Discord, TradingView

Routes:
  GET    /api/v1/integrations/                  → list all integration configs
  POST   /api/v1/integrations/discord/setup     → save Discord webhook URL
  DELETE /api/v1/integrations/discord           → remove Discord
  POST   /api/v1/integrations/discord/test      → send test message
  POST   /api/v1/integrations/discord/alert     → send risk alert (called internally)

  POST   /api/v1/integrations/sheets/setup      → save Google Sheets credentials
  POST   /api/v1/integrations/sheets/export     → export trade history to sheet
  GET    /api/v1/integrations/sheets/status     → last export info
  DELETE /api/v1/integrations/sheets            → remove Sheets config

  POST   /api/v1/integrations/tradingview/setup → save TradingView secret token
  POST   /api/v1/integrations/tradingview/alert → receive alert FROM TradingView (public)
  GET    /api/v1/integrations/tradingview/alerts → list received alerts
  DELETE /api/v1/integrations/tradingview       → remove TradingView config
"""
import httpx
import json
import gspread
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from app.database.database import Base, get_db
from app.routes.auth_multi import get_current_user
from app.models.user import User
from pydantic import BaseModel
from oauth2client.service_account import ServiceAccountCredentials

logger = logging.getLogger(__name__)
router = APIRouter()

# ═══════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════
class IntegrationConfig(Base):
    __tablename__ = "integration_configs"
    id            = Column(Integer, primary_key=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    service       = Column(String, nullable=False)  # discord | sheets | tradingview
    config_json   = Column(Text, default="{}")      # JSON blob per service
    is_active     = Column(Boolean, default=True)
    connected_at  = Column(DateTime, default=datetime.utcnow)
    last_used     = Column(DateTime, nullable=True)

class TradingViewAlert(Base):
    __tablename__ = "tradingview_alerts"
    id            = Column(Integer, primary_key=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    ticker        = Column(String, nullable=True)
    action        = Column(String, nullable=True)   # buy | sell | alert
    price         = Column(Float, nullable=True)
    message       = Column(Text, nullable=True)
    raw_payload   = Column(Text, nullable=True)
    received_at   = Column(DateTime, default=datetime.utcnow)

class SheetsExportLog(Base):
    __tablename__ = "sheets_export_logs"
    id            = Column(Integer, primary_key=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    sheet_name    = Column(String)
    rows_exported = Column(Integer, default=0)
    exported_at   = Column(DateTime, default=datetime.utcnow)
    success       = Column(Boolean, default=True)
    error         = Column(Text, nullable=True)

# ═══════════════════════════════════════════════════════════
# SCHEMAS
# ═══════════════════════════════════════════════════════════
class DiscordSetup(BaseModel):
    webhook_url: str
    username:    str = "RiskGuardian"
    alert_on:    list = ["rule.triggered", "cooldown.started", "risk.limit_hit"]

class SheetsSetup(BaseModel):
    spreadsheet_url:  str          # Google Sheets URL
    sheet_name:       str = "Trades"
    service_account:  dict         # Service account JSON from Google Cloud

class TradingViewSetup(BaseModel):
    secret_token: str              # User-defined secret to verify requests

class AlertRequest(BaseModel):
    title:   str = "Risk Alert"
    message: str
    color:   int = 0xFF4444       # Red by default
    fields:  list = []

# ═══════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════
def check_enterprise(user: User):
    plan = (getattr(user, "plan", "free") or "free").lower().strip()
    if plan != "enterprise":
        raise HTTPException(status_code=403, detail="Custom Integrations require Enterprise plan")

def get_config(user_id: int, service: str, db: Session) -> Optional[dict]:
    cfg = db.query(IntegrationConfig).filter(
        IntegrationConfig.user_id == user_id,
        IntegrationConfig.service == service,
        IntegrationConfig.is_active == True
    ).first()
    if not cfg:
        return None
    try:
        return json.loads(cfg.config_json)
    except:
        return None

def save_config(user_id: int, service: str, data: dict, db: Session):
    cfg = db.query(IntegrationConfig).filter(
        IntegrationConfig.user_id == user_id,
        IntegrationConfig.service == service
    ).first()
    if cfg:
        cfg.config_json = json.dumps(data)
        cfg.is_active   = True
        cfg.connected_at = datetime.utcnow()
    else:
        cfg = IntegrationConfig(user_id=user_id, service=service, config_json=json.dumps(data))
        db.add(cfg)
    db.commit()

# ═══════════════════════════════════════════════════════════
# GENERAL
# ═══════════════════════════════════════════════════════════
@router.get("/")
def list_integrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    configs = db.query(IntegrationConfig).filter(
        IntegrationConfig.user_id  == current_user.id,
        IntegrationConfig.is_active == True
    ).all()
    connected = {c.service: True for c in configs}
    return {
        "discord":     {"connected": connected.get("discord", False)},
        "sheets":      {"connected": connected.get("sheets", False)},
        "tradingview": {"connected": connected.get("tradingview", False)},
    }

# ═══════════════════════════════════════════════════════════
# DISCORD
# ═══════════════════════════════════════════════════════════
@router.post("/discord/setup")
async def setup_discord(
    req: DiscordSetup,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    if "discord.com/api/webhooks" not in req.webhook_url:
        raise HTTPException(status_code=400, detail="Invalid Discord webhook URL. Get it from: Discord Channel → Edit → Integrations → Webhooks")

    # Test the webhook
    payload = {
        "username": req.username,
        "embeds": [{
            "title": "✅ RiskGuardian Connected!",
            "description": "Discord alerts are now active. You'll receive risk alerts, rule triggers, and cooldown notifications here.",
            "color": 0x22C55E,
            "footer": {"text": "RiskGuardian Enterprise"},
            "timestamp": datetime.utcnow().isoformat()
        }]
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(req.webhook_url, json=payload)
        if r.status_code not in (200, 204):
            raise HTTPException(status_code=400, detail=f"Discord rejected webhook: {r.status_code}. Check the URL.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not reach Discord: {str(e)}")

    save_config(current_user.id, "discord", {
        "webhook_url": req.webhook_url,
        "username":    req.username,
        "alert_on":    req.alert_on,
    }, db)
    return {"success": True, "message": "Discord connected! Check your channel for the test message."}


@router.post("/discord/test")
async def test_discord(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cfg = get_config(current_user.id, "discord", db)
    if not cfg:
        raise HTTPException(status_code=404, detail="Discord not configured")
    payload = {
        "username": cfg.get("username", "RiskGuardian"),
        "embeds": [{
            "title": "🔔 Test Alert",
            "description": "This is a test alert from RiskGuardian. Your Discord integration is working correctly!",
            "color": 0x38BDF8,
            "fields": [
                {"name": "Account", "value": "DERIV-6009324", "inline": True},
                {"name": "Time",    "value": datetime.utcnow().strftime("%H:%M UTC"), "inline": True},
            ],
            "footer": {"text": "RiskGuardian Enterprise"},
            "timestamp": datetime.utcnow().isoformat()
        }]
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(cfg["webhook_url"], json=payload)
        return {"success": r.status_code in (200, 204), "status_code": r.status_code}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/discord/alert")
async def send_discord_alert(
    req: AlertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Internal endpoint — called when risk rules fire or cooldown starts."""
    cfg = get_config(current_user.id, "discord", db)
    if not cfg:
        return {"skipped": True, "reason": "Discord not configured"}

    embed = {
        "title":       req.title,
        "description": req.message,
        "color":       req.color,
        "footer":      {"text": "RiskGuardian Enterprise"},
        "timestamp":   datetime.utcnow().isoformat()
    }
    if req.fields:
        embed["fields"] = req.fields

    payload = {"username": cfg.get("username", "RiskGuardian"), "embeds": [embed]}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(cfg["webhook_url"], json=payload)
        cfg_record = db.query(IntegrationConfig).filter(
            IntegrationConfig.user_id == current_user.id,
            IntegrationConfig.service == "discord"
        ).first()
        if cfg_record:
            cfg_record.last_used = datetime.utcnow()
            db.commit()
        return {"success": r.status_code in (200, 204)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.delete("/discord")
def remove_discord(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cfg = db.query(IntegrationConfig).filter(
        IntegrationConfig.user_id == current_user.id,
        IntegrationConfig.service == "discord"
    ).first()
    if cfg:
        cfg.is_active = False
        db.commit()
    return {"success": True}


# ═══════════════════════════════════════════════════════════
# GOOGLE SHEETS
# ═══════════════════════════════════════════════════════════
@router.post("/sheets/setup")
def setup_sheets(
    req: SheetsSetup,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    # Validate service account JSON has required fields
    required = ["client_email", "private_key", "type"]
    missing = [f for f in required if f not in req.service_account]
    if missing:
        raise HTTPException(status_code=400, detail=f"Service account JSON missing fields: {missing}")
    if req.service_account.get("type") != "service_account":
        raise HTTPException(status_code=400, detail="Must be a service_account type JSON")

    # Extract spreadsheet ID from URL
    url = req.spreadsheet_url
    if "/spreadsheets/d/" not in url:
        raise HTTPException(status_code=400, detail="Invalid Google Sheets URL")
    sheet_id = url.split("/spreadsheets/d/")[1].split("/")[0]

    save_config(current_user.id, "sheets", {
        "spreadsheet_id":  sheet_id,
        "spreadsheet_url": req.spreadsheet_url,
        "sheet_name":      req.sheet_name,
        "service_account": req.service_account,
        "client_email":    req.service_account.get("client_email"),
    }, db)
    return {
        "success": True,
        "sheet_id": sheet_id,
        "message": f"Google Sheets configured! Make sure to share the sheet with: {req.service_account.get('client_email')}",
        "share_with": req.service_account.get("client_email"),
    }


@router.post("/sheets/export")
def export_to_sheets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    cfg = get_config(current_user.id, "sheets", db)
    if not cfg:
        raise HTTPException(status_code=404, detail="Google Sheets not configured")

    try:
        scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
        creds = ServiceAccountCredentials.from_json_keyfile_dict(cfg["service_account"], scope)
        gc    = gspread.authorize(creds)
        sh    = gc.open_by_key(cfg["spreadsheet_id"])

        try:
            worksheet = sh.worksheet(cfg["sheet_name"])
        except:
            worksheet = sh.add_worksheet(title=cfg["sheet_name"], rows=1000, cols=20)

        # Fetch trade history from the trades table
        from app.routes.trades import Trade as TradeModel
        trades = db.query(TradeModel).filter(
            TradeModel.user_id == current_user.id
        ).order_by(TradeModel.close_time.desc()).limit(500).all()

        headers = ["#", "Symbol", "Type", "Open Time", "Close Time", "Open Price",
                   "Close Price", "Volume", "Profit", "Commission", "Comment"]
        rows    = [headers]
        for i, t in enumerate(trades, 1):
            rows.append([
                i,
                getattr(t, 'symbol', ''),
                getattr(t, 'trade_type', getattr(t, 'type', '')),
                str(getattr(t, 'open_time', '')),
                str(getattr(t, 'close_time', '')),
                getattr(t, 'open_price', 0),
                getattr(t, 'close_price', 0),
                getattr(t, 'volume', 0),
                getattr(t, 'profit', getattr(t, 'pnl', 0)),
                getattr(t, 'commission', 0),
                getattr(t, 'comment', ''),
            ])

        worksheet.clear()
        worksheet.update('A1', rows)

        # Style header row
        worksheet.format('A1:K1', {
            "backgroundColor": {"red": 0.11, "green": 0.14, "blue": 0.24},
            "textFormat": {"bold": True, "foregroundColor": {"red": 0.22, "green": 0.77, "blue": 0.94}},
        })

        log = SheetsExportLog(user_id=current_user.id, sheet_name=cfg["sheet_name"],
                              rows_exported=len(trades), success=True)
        db.add(log)
        cfg_record = db.query(IntegrationConfig).filter(
            IntegrationConfig.user_id == current_user.id,
            IntegrationConfig.service == "sheets"
        ).first()
        if cfg_record:
            cfg_record.last_used = datetime.utcnow()
        db.commit()

        return {
            "success":       True,
            "rows_exported": len(trades),
            "sheet_url":     cfg["spreadsheet_url"],
            "message":       f"Exported {len(trades)} trades to Google Sheets",
        }
    except Exception as e:
        log = SheetsExportLog(user_id=current_user.id, sheet_name=cfg.get("sheet_name",""),
                              rows_exported=0, success=False, error=str(e))
        db.add(log)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/sheets/status")
def sheets_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cfg = get_config(current_user.id, "sheets", db)
    last = db.query(SheetsExportLog).filter(
        SheetsExportLog.user_id == current_user.id
    ).order_by(SheetsExportLog.exported_at.desc()).first()
    return {
        "connected":     cfg is not None,
        "sheet_url":     cfg.get("spreadsheet_url") if cfg else None,
        "share_email":   cfg.get("client_email") if cfg else None,
        "last_export":   last.exported_at.isoformat() if last else None,
        "last_rows":     last.rows_exported if last else 0,
        "last_success":  last.success if last else None,
    }


@router.delete("/sheets")
def remove_sheets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cfg = db.query(IntegrationConfig).filter(
        IntegrationConfig.user_id == current_user.id,
        IntegrationConfig.service == "sheets"
    ).first()
    if cfg:
        cfg.is_active = False
        db.commit()
    return {"success": True}


# ═══════════════════════════════════════════════════════════
# TRADINGVIEW
# ═══════════════════════════════════════════════════════════
@router.post("/tradingview/setup")
def setup_tradingview(
    req: TradingViewSetup,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_enterprise(current_user)
    if len(req.secret_token) < 8:
        raise HTTPException(status_code=400, detail="Secret token must be at least 8 characters")

    save_config(current_user.id, "tradingview", {
        "secret_token": req.secret_token,
        "user_id":      current_user.id,
    }, db)

    webhook_url = f"http://192.168.43.131:8000/api/v1/integrations/tradingview/alert?token={req.secret_token}&uid={current_user.id}"
    return {
        "success":     True,
        "webhook_url": webhook_url,
        "message":     "Use this URL in your TradingView Pine Script alert webhook",
        "pine_example": f'alert("{{\\"ticker\\": \\"{{{{ticker}}}}\\"', 
    }


@router.post("/tradingview/alert")
async def receive_tradingview_alert(
    request: Request,
    token: str,
    uid: int,
    db: Session = Depends(get_db)
):
    """
    Public endpoint — called BY TradingView when a Pine Script alert fires.
    No auth required, but validated by secret token.
    """
    # Validate token
    cfg = db.query(IntegrationConfig).filter(
        IntegrationConfig.user_id == uid,
        IntegrationConfig.service == "tradingview",
        IntegrationConfig.is_active == True
    ).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="TradingView not configured for this user")

    config = json.loads(cfg.config_json)
    if config.get("secret_token") != token:
        raise HTTPException(status_code=403, detail="Invalid token")

    # Parse body — TradingView sends JSON or plain text
    try:
        body = await request.json()
    except:
        body_text = await request.body()
        try:
            body = json.loads(body_text.decode())
        except:
            body = {"message": body_text.decode()}

    alert = TradingViewAlert(
        user_id     = uid,
        ticker      = body.get("ticker", body.get("symbol", "")),
        action      = body.get("action", body.get("side", "alert")).lower(),
        price       = float(body.get("price", body.get("close", 0)) or 0),
        message     = body.get("message", body.get("text", str(body))),
        raw_payload = json.dumps(body),
    )
    db.add(alert)
    cfg.last_used = datetime.utcnow()
    db.commit()

    # Forward to Discord if connected
    discord_cfg = get_config(uid, "discord", db)
    if discord_cfg:
        action_emoji = "🟢" if alert.action == "buy" else "🔴" if alert.action == "sell" else "🔔"
        embed_payload = {
            "username": discord_cfg.get("username", "RiskGuardian"),
            "embeds": [{
                "title":       f"{action_emoji} TradingView Alert: {alert.ticker}",
                "description": alert.message,
                "color":       0x22C55E if alert.action == "buy" else 0xEF4444 if alert.action == "sell" else 0x38BDF8,
                "fields": [
                    {"name": "Action", "value": (alert.action or "").upper(), "inline": True},
                    {"name": "Price",  "value": str(alert.price), "inline": True},
                ],
                "footer":    {"text": "TradingView → RiskGuardian"},
                "timestamp": datetime.utcnow().isoformat()
            }]
        }
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(discord_cfg["webhook_url"], json=embed_payload)
        except:
            pass

    logger.info(f"TradingView alert received for user {uid}: {alert.ticker} {alert.action} @ {alert.price}")
    return {"received": True, "ticker": alert.ticker, "action": alert.action}


@router.get("/tradingview/alerts")
def get_tradingview_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    alerts = db.query(TradingViewAlert).filter(
        TradingViewAlert.user_id == current_user.id
    ).order_by(TradingViewAlert.received_at.desc()).limit(50).all()
    return {"alerts": [
        {"ticker": a.ticker, "action": a.action, "price": a.price,
         "message": a.message, "received_at": a.received_at.isoformat()}
        for a in alerts
    ]}


@router.delete("/tradingview")
def remove_tradingview(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cfg = db.query(IntegrationConfig).filter(
        IntegrationConfig.user_id == current_user.id,
        IntegrationConfig.service == "tradingview"
    ).first()
    if cfg:
        cfg.is_active = False
        db.commit()
    return {"success": True}