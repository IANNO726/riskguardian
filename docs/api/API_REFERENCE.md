# API Reference - Risk Guardian Agent

## Base URL
```
http://localhost:8000
```

## Authentication
All endpoints except `/auth/login` and `/auth/register` require JWT Bearer token.

```bash
Authorization: Bearer <your_jwt_token>
```

## Response Formats

### Success Response (200, 201)
```json
{
  "status": "success",
  "data": {...},
  "message": "Operation completed successfully"
}
```

### Error Response (400, 401, 403, 500)
```json
{
  "status": "error",
  "error_code": "RULE_BREACH",
  "message": "Daily loss limit exceeded",
  "details": {...}
}
```

---

## Endpoints

### Authentication

#### Login
```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "trader@example.com",
  "password": "securepassword"
}

Response 200:
{
  "access_token": "eyJ0eXA...",
  "refresh_token": "eyJ0eXA...",
  "user": {
    "id": "user123",
    "email": "trader@example.com",
    "username": "trader"
  }
}
```

#### Register
```
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "trader@example.com",
  "password": "securepassword",
  "username": "trader"
}

Response 201:
{
  "id": "user123",
  "email": "trader@example.com",
  "username": "trader"
}
```

---

### Accounts

#### Get All Accounts
```
GET /api/v1/accounts
Authorization: Bearer <token>

Response 200:
{
  "accounts": [
    {
      "id": "acc123",
      "broker": "IC Markets",
      "account_number": "123456",
      "account_type": "Live",
      "currency": "USD",
      "balance": 10000,
      "equity": 9800,
      "credit": 0,
      "margin_level": 98.5,
      "free_margin": 5000
    }
  ]
}
```

#### Create/Connect Account
```
POST /api/v1/accounts
Authorization: Bearer <token>
Content-Type: application/json

{
  "broker": "IC Markets",
  "account_number": "123456",
  "password": "account_password",
  "server": "icmarketsd.com"
}

Response 201:
{
  "id": "acc123",
  "broker": "IC Markets",
  "status": "connected"
}
```

#### Get Account Status
```
GET /api/v1/accounts/{account_id}/status
Authorization: Bearer <token>

Response 200:
{
  "account_id": "acc123",
  "timestamp": "2024-02-07T14:30:00Z",
  "balance": 10000,
  "equity": 9800,
  "margin_level": 98.5,
  "free_margin": 5000,
  "daily_pnl": -200,
  "daily_pnl_percent": -2.0,
  "peak_balance": 10500,
  "current_drawdown": 700,
  "drawdown_percent": 6.7,
  "open_positions_count": 3,
  "total_exposed_risk": 0.05
}
```

---

### Risk Analysis

#### Pre-Trade Validation
```
POST /api/v1/risk/pre-trade
Authorization: Bearer <token>
Content-Type: application/json

{
  "account_id": "acc123",
  "symbol": "EURUSD",
  "entry_price": 1.0850,
  "stop_loss": 1.0800,
  "take_profit": 1.1000,
  "lot_size": 1.0
}

Response 200:
{
  "is_allowed": true,
  "overall_status": "PASS",
  "rules_passed": [
    {
      "rule_type": "min_rr_ratio",
      "status": "pass",
      "message": "RR Ratio OK: 2.5:1 >= 2:1",
      "percentage_of_threshold": 125
    }
  ],
  "rules_warned": [
    {
      "rule_type": "daily_loss_limit",
      "status": "warning",
      "message": "Approaching daily loss limit: $200 / $250",
      "percentage_of_threshold": 80,
      "recommended_action": "CAUTION - You are near daily loss limit"
    }
  ],
  "rules_breached": [],
  "recommended_max_lot_size": 0.75,
  "recommended_action": "⚠️ CAUTION - 1 rule(s) triggered warnings"
}
```

#### Get Current Risk Status
```
GET /api/v1/risk/current-status
Authorization: Bearer <token>

Response 200:
{
  "account_id": "acc123",
  "timestamp": "2024-02-07T14:30:00Z",
  "daily_loss": 200,
  "daily_loss_limit": 250,
  "daily_loss_percent": 80,
  "current_drawdown": 500,
  "max_drawdown_limit": 500,
  "drawdown_percent": 100,
  "status": "CRITICAL",
  "alerts": [
    {
      "type": "warning",
      "rule": "max_drawdown",
      "message": "Maximum drawdown limit reached"
    }
  ]
}
```

---

### Positions

#### Get Open Positions
```
GET /api/v1/positions
Authorization: Bearer <token>

Response 200:
{
  "positions": [
    {
      "ticket": 123456,
      "symbol": "EURUSD",
      "type": "BUY",
      "volume": 1.0,
      "open_price": 1.0850,
      "current_price": 1.0860,
      "stop_loss": 1.0800,
      "take_profit": 1.1000,
      "pnl": 100,
      "pnl_percent": 0.92,
      "open_time": "2024-02-07T10:30:00Z",
      "exposure_percent": 5.2
    }
  ]
}
```

#### Close Position
```
POST /api/v1/positions/{ticket}/close
Authorization: Bearer <token>

Response 200:
{
  "ticket": 123456,
  "status": "closed",
  "close_price": 1.0860,
  "pnl": 100,
  "close_time": "2024-02-07T14:30:00Z"
}
```

---

### Trades (History)

#### Get Trade History
```
GET /api/v1/trades?start_date=2024-02-01&end_date=2024-02-07&limit=50
Authorization: Bearer <token>

Response 200:
{
  "trades": [
    {
      "id": "trade123",
      "symbol": "EURUSD",
      "type": "BUY",
      "entry_price": 1.0850,
      "exit_price": 1.0900,
      "lot_size": 1.0,
      "pnl": 500,
      "pnl_percent": 4.61,
      "duration_minutes": 85,
      "open_time": "2024-02-07T10:30:00Z",
      "close_time": "2024-02-07T11:55:00Z",
      "rr_ratio": 2.5,
      "rule_compliant": true
    }
  ],
  "total_count": 125,
  "statistics": {
    "win_rate": 62.5,
    "avg_win": 500,
    "avg_loss": -300,
    "profit_factor": 2.1
  }
}
```

---

### Trading Rules

#### Get Current Rules
```
GET /api/v1/rules
Authorization: Bearer <token>

Response 200:
{
  "rules": [
    {
      "id": "rule_daily_loss",
      "name": "Daily Loss Limit",
      "type": "daily_loss_limit",
      "threshold": 2.0,
      "unit": "percent",
      "severity": "critical",
      "enabled": true
    },
    {
      "id": "rule_max_dd",
      "name": "Maximum Drawdown",
      "type": "max_drawdown",
      "threshold": 5.0,
      "unit": "percent",
      "severity": "critical",
      "enabled": true
    }
  ]
}
```

#### Update Rule
```
PUT /api/v1/rules/{rule_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "threshold": 3.0,
  "enabled": true
}

Response 200:
{
  "id": "rule_daily_loss",
  "threshold": 3.0,
  "enabled": true,
  "updated_at": "2024-02-07T14:30:00Z"
}
```

---

### Alerts

#### Get Alert History
```
GET /api/v1/alerts?limit=20&status=unread
Authorization: Bearer <token>

Response 200:
{
  "alerts": [
    {
      "id": "alert123",
      "type": "warning",
      "rule": "daily_loss_limit",
      "message": "Approaching daily loss limit: $200 / $250",
      "severity": "critical",
      "read": false,
      "created_at": "2024-02-07T14:25:00Z"
    }
  ]
}
```

#### Mark Alert as Read
```
PUT /api/v1/alerts/{alert_id}/read
Authorization: Bearer <token>

Response 200:
{
  "id": "alert123",
  "read": true,
  "read_at": "2024-02-07T14:30:00Z"
}
```

---

### Trading Journal

#### Get Journal Entries
```
GET /api/v1/journal?date=2024-02-07
Authorization: Bearer <token>

Response 200:
{
  "date": "2024-02-07",
  "entries": [
    {
      "id": "entry123",
      "trade_id": "trade123",
      "symbol": "EURUSD",
      "notes": "Good setup, followed plan",
      "rating": 8,
      "emotions": ["confident", "disciplined"],
      "mistakes": [],
      "improvements": ["take profit a bit higher"],
      "created_at": "2024-02-07T12:00:00Z",
      "updated_at": "2024-02-07T12:05:00Z"
    }
  ],
  "summary": {
    "total_trades": 5,
    "winning_trades": 3,
    "losing_trades": 2,
    "avg_rating": 7.6,
    "daily_pnl": 850,
    "best_trade": 500,
    "worst_trade": -300
  }
}
```

#### Add Journal Entry
```
POST /api/v1/journal
Authorization: Bearer <token>
Content-Type: application/json

{
  "trade_id": "trade123",
  "notes": "Good setup, followed plan perfectly",
  "rating": 9,
  "emotions": ["confident", "disciplined"],
  "mistakes": [],
  "improvements": []
}

Response 201:
{
  "id": "entry123",
  "trade_id": "trade123",
  "created_at": "2024-02-07T12:00:00Z"
}
```

---

## Error Codes

| Code | HTTP | Description | Action |
|------|------|-------------|--------|
| UNAUTHORIZED | 401 | Invalid or expired token | Re-authenticate |
| FORBIDDEN | 403 | Insufficient permissions | Contact admin |
| NOT_FOUND | 404 | Resource not found | Check resource ID |
| VALIDATION_ERROR | 400 | Invalid input data | Review request parameters |
| RULE_BREACH | 400 | Trading rule violated | Review pre-trade validation |
| MT5_CONNECTION_ERROR | 503 | MT5 connection failed | Check connection settings |
| INSUFFICIENT_MARGIN | 400 | Not enough margin | Reduce lot size |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests | Wait and retry |

---

**API Version**: 1.0  
**Last Updated**: February 2026
