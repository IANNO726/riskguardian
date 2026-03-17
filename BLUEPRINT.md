# Risk Guardian Agent - Professional Blueprint

## Executive Summary

**Risk Guardian Agent** is an AI-powered risk management system designed for proprietary trading firms and brokers. It automates trade risk evaluation, enforces predefined rules, and prevents catastrophic losses through intelligent alerts and automated trade management.

---

## 🎯 Core Objectives

| Objective | Description |
|-----------|-------------|
| **Prevent Losses** | Block trades that violate risk rules before execution |
| **Enforce Discipline** | Ensure every trade follows firm rules (Max DD, Daily Loss, RR ratio) |
| **Real-time Monitoring** | Track floating drawdown and alert on breaches |
| **Automated Compliance** | Auto-close positions, adjust stops, update journal |
| **Behavioral Coaching** | Learn trading patterns and provide personalized feedback |

---

## 📊 What This Agent Does

### **Before Trade**
- ✅ Calculates maximum allowed lot size based on account equity and risk rules
- ✅ Checks daily loss rules (has trader already hit daily loss limit?)
- ✅ Confirms Risk:Reward ratio (minimum 1:2)
- ✅ Warns or blocks bad entries (account status, rule violations)
- ✅ Pre-trade risk assessment

### **During Trade**
- 📊 Tracks floating drawdown in real-time
- ⚠️ Auto-closes trades if rules are about to breach
- 🎯 Adjusts stop loss to breakeven automatically
- 🔔 Sends alerts on drawdown milestones (20%, 50%, 80%)
- 💾 Streams live P&L metrics

### **After Trade**
- 📝 Updates trading journal automatically
- 📋 Reviews rule compliance
- 📈 Calculates trade statistics and metrics
- 🎓 Gives feedback like a coach (what went wrong, how to improve)
- 🤖 Learns from trade patterns for Phase 3

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                 RISK GUARDIAN AGENT                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Frontend   │  │  Backend API │  │  Rule Engine │   │
│  │  Dashboard   │  │   (FastAPI)  │  │   (Core)     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│         ▲                  ▼                    ▼          │
│         │         ┌────────────────┐                      │
│         │         │   Database     │                      │
│         │         │   (PostgreSQL) │                      │
│         │         └────────────────┘                      │
│         │                  ▼                              │
│  ┌────────────────────────────────────┐                  │
│  │      Connectors & Integrations     │                  │
│  ├────────────────────────────────────┤                  │
│  │ • MT4/MT5 API                      │                  │
│  │ • Telegram/WhatsApp Bot            │                  │
│  │ • Email Notifications              │                  │
│  │ • WebSocket Real-time Streaming    │                  │
│  └────────────────────────────────────┘                  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### **Backend**
- **Framework**: FastAPI (Python 3.9+)
- **Real-time**: WebSocket for live streaming
- **Database**: PostgreSQL + Redis cache
- **API**: RESTful + GraphQL
- **Queue**: Celery + RabbitMQ (for async tasks)

### **Frontend**
- **Framework**: React 18 + TypeScript
- **UI Library**: Material-UI / Tailwind CSS
- **Charts**: TradingView Lightweight Charts
- **State**: Redux Toolkit
- **Real-time**: Socket.io

### **Connectors**
- **MT4/MT5**: Python-MT5 library + WebSocket bridge
- **Alerts**: python-telegram-bot, selenium (for WhatsApp)
- **Email**: SendGrid or Twilio SendGrid

### **DevOps**
- **Containerization**: Docker + Docker Compose
- **Cloud**: AWS/Azure/GCP (recommended: AWS EC2 + RDS)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack or CloudWatch

---

## 📋 Development Phases

### **Phase 1: Alerts Only (Foundation)**
**Timeline**: Weeks 1-4 | **Risk**: Low | **Complexity**: Medium

**Deliverables**:
- Basic MT4/MT5 connection
- Rule engine core (daily loss, max DD, RR ratio)
- Pre-trade alerts (Telegram, email)
- Real-time position monitoring
- Simple web dashboard

**Features**:
```python
✓ Connect to MT4/MT5
✓ Read account balance, equity, open positions
✓ Calculate max lot size
✓ Check daily loss limit
✓ Validate RR ratio
✓ Send alerts (no blocking trades)
✓ Log all decisions
```

**Output**: Alert-only system with notification infrastructure ready

---

### **Phase 2: Automation & Intelligence (Growth)**
**Timeline**: Weeks 5-8 | **Risk**: Medium | **Complexity**: High

**Deliverables**:
- Auto-closing mechanism
- Dynamic stop loss adjustment
- Auto lot size calculation
- Advanced metrics dashboard
- Trade journal automation
- Email/Telegram bot commands

**Features**:
```python
✓ Auto-close positions on rule breach
✓ Automatically adjust SL to breakeven
✓ Calculate lot size dynamically
✓ Auto-update trading journal
✓ Advanced notifications with recommendations
✓ Multiple account support
✓ Custom rule configuration per user
```

**Output**: Fully automated system with intelligent trade management

---

### **Phase 3: AI Learning & Behavior Analysis (Excellence)**
**Timeline**: Weeks 9-12+ | **Risk**: High | **Complexity**: Very High

**Deliverables**:
- ML model for strategy analysis
- Emotional risk detection
- Pattern recognition
- Smart recommendations
- Self-learning rule adjustments
- Predictive alerts

**Features**:
```python
✓ Analyze trading patterns (win rate, avg RT, avg DD)
✓ Detect emotional trading (revenge trading, overleverage)
✓ Learn optimal lot sizes per strategy
✓ Predict drawdowns before they happen
✓ Recommend strategy switches
✓ Auto-adjust rules based on performance
```

**Output**: Intelligent AI coach that learns and improves trader performance

---

## 🔐 Rule Engine Specifications

### **Rule 1: Daily Loss Limit**
```yaml
Name: Daily Loss Limit
Trigger: Cumulative daily losses > threshold
Action: Block new trades, alert trader
Formula: (Opening Balance - Current Equity) / Opening Balance * 100 >= Daily Loss %
Default: 2% daily loss limit
Severity: Critical - Blocks all new trades
Database: Rules table with user customization
```

### **Rule 2: Maximum Drawdown**
```yaml
Name: Maximum Drawdown Limit
Trigger: Account equity falls below max DD threshold
Action: Close all positions, emergency alert
Formula: (Peak Balance - Current Equity) / Peak Balance * 100 >= Max DD %
Default: 5% max drawdown
Severity: Critical - Forces position closure
Database: Rules table with user customization
```

### **Rule 3: Risk:Reward Ratio**
```yaml
Name: Risk to Reward Ratio
Trigger: Entry setup doesn't meet minimum RR
Action: Warn trader, recommendation only (Phase 1), block (Phase 2)
Formula: Potential Reward / Risk >= Minimum Ratio
Default: 1:2 ratio minimum
Severity: Warning
Database: Rules table with user customization
```

### **Rule 4: Maximum Position Size**
```yaml
Name: Maximum Lot Size
Trigger: Requested lot size exceeds calculated maximum
Action: Limit lot size, alert trader
Formula: Max Lot = (Account Risk Amount) / (Entry Price - SL Price)
Account Risk Amount = Account Equity * Risk Per Trade %
Default: 1% risk per trade
Severity: Warning
Database: Dynamic calculation based on account equity
```

### **Rule 5: Consecutive Loss Limit**
```yaml
Name: Consecutive Losses
Trigger: Number of losing trades in a row exceeds threshold
Action: Alert, recommend break
Default: 3 consecutive losses
Severity: Advisory
Database: Trading history tracking
```

---

## 📱 Notification System Architecture

### **Telegram Integration**
```
User's MT4 Account
        ↓
Risk Guardian Agent
        ↓
Rule Evaluation
        ↓
Telegram Bot API
        ↓
User's Telegram Chat
```

**Message Types**:
1. **Pre-Trade Alert**: "Position size exceeds allowed amount. Max: 0.5 lots, You requested: 1.0 lots"
2. **Warning**: "⚠️ Account at 75% of max drawdown (3.75% / 5%)"
3. **Action Alert**: "🚨 Max DD breach imminent. Closing position at market price"
4. **Daily Summary**: "📊 Today: +$500 (0.5% of account), 5 trades, 60% win rate"
5. **Coaching**: "💡 You've had 3 losses in a row. Take a break and review"

### **Telegram Bot Commands**
```
/status - Get current account status
/rules - View current rules and limits
/journal - Get today's journal summary
/positions - List all open positions
/close [ticket] - Close specific position
/settings - Configure alert preferences
/help - Get help menu
```

---

## 💾 Database Schema (PostgreSQL)

### **Tables Overview**
```sql
-- Core Tables
users                          -- Trader accounts
accounts                       -- MT4/MT5 accounts
rules                          -- Risk rules per account
positions                      -- Real-time positions
trades                         -- Closed positions + history
journal_entries                -- Auto-generated journal
alerts                         -- Alert log
events                         -- System events

-- Analysis Tables
trade_statistics               -- Daily/weekly statistics
emotional_flags                -- Behavioral patterns
rule_violations                -- Rule breach history
ml_predictions                 -- AI predictions

-- Configuration Tables
notification_settings          -- Alert preferences
custom_rules                   -- User-defined rules
api_keys                       -- MT4/MT5 credentials
```

---

## 🎯 API Endpoints (Phase 1)

### **Authentication**
```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/register
```

### **Account Management**
```
GET    /api/v1/accounts
POST   /api/v1/accounts
GET    /api/v1/accounts/{id}
PUT    /api/v1/accounts/{id}
DELETE /api/v1/accounts/{id}
```

### **Risk Analysis**
```
POST   /api/v1/risk/pre-trade
POST   /api/v1/risk/validate-position
GET    /api/v1/risk/current-status
GET    /api/v1/risk/daily-metrics
```

### **Positions & Trades**
```
GET    /api/v1/positions
POST   /api/v1/positions/{id}/close
GET    /api/v1/trades
GET    /api/v1/trades/{id}
```

### **Rules**
```
GET    /api/v1/rules
PUT    /api/v1/rules/{id}
POST   /api/v1/rules/validate
```

### **Alerts**
```
GET    /api/v1/alerts
GET    /api/v1/alerts/{id}
PUT    /api/v1/alerts/{id}/read
```

### **Journal**
```
GET    /api/v1/journal
GET    /api/v1/journal/{date}
GET    /api/v1/journal/statistics
```

---

## 🖥️ Dashboard Features

### **Live Monitoring Tab**
- Real-time account balance and equity
- Open positions with P&L and drawdown
- Daily loss tracker (visual gauge)
- Current drawdown vs. max DD
- Upcoming alerts and warnings

### **Analytics Tab**
- Win rate, average win/loss
- Risk/reward analysis
- Daily/weekly/monthly P&L
- Drawdown history chart
- Trading hours analysis

### **Journal Tab**
- Auto-populated trade entries
- Manual notes and screenshots
- Daily summary and feedback
- Trade rating (1-10)
- Pattern identification

### **Rules Tab**
- Current rules display
- Custom rule configuration
- Test rule scenarios
- Rule violation history
- Rule effectiveness analysis

### **Settings Tab**
- Account connection management
- Alert preferences customization
- Notification channels (Telegram, Email, SMS)
- Risk parameters adjustment
- Timezone and display settings

---

## 🔧 Configuration Files

### **environment.env**
```env
# Database
DATABASE_URL=postgresql://user:password@localhost/risk_guardian
REDIS_URL=redis://localhost:6379/0

# MT4/MT5
MT5_ACCOUNT_LOGIN=123456
MT5_ACCOUNT_PASSWORD=****
MT5_ACCOUNT_SERVER=broker-mt5.com

# Telegram
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_CHAT_ID=your_chat_id

# API Keys
JWT_SECRET_KEY=your-secret-key-here
API_KEY=your-api-key

# Settings
LOG_LEVEL=INFO
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1
```

### **rules.yaml**
```yaml
default_rules:
  daily_loss_limit: 2%
  max_drawdown: 5%
  min_rr_ratio: 1:2
  risk_per_trade: 1%
  consecutive_loss_limit: 3

alert_thresholds:
  drawdown_warning: 3%
  drawdown_critical: 4%
  daily_loss_warning: 1.5%
```

---

## 🚀 Deployment & Hosting

### **Development**
- Local: Docker Compose (all services)
- Testing: GitHub Actions

### **Production** (Recommended)
- **Compute**: AWS EC2 (t3.medium or larger)
- **Database**: AWS RDS PostgreSQL
- **Cache**: AWS ElastiCache (Redis)
- **Storage**: AWS S3 (for logs, backups)
- **Queue**: AWS SQS or RabbitMQ
- **CDN**: CloudFront for frontend
- **Monitoring**: CloudWatch + Datadog
- **CI/CD**: GitHub Actions → AWS CodeDeploy

### **Cost Estimate (AWS)**
- EC2: $30-50/month
- RDS: $50-100/month
- ElastiCache: $20-30/month
- S3 + Bandwidth: $10-20/month
- **Total**: ~$110-200/month

---

## 🔒 Security Considerations

✅ **Implemented**:
- JWT authentication
- Encrypted password storage (bcrypt)
- HTTPS/SSL encryption
- API rate limiting
- Input validation & sanitization
- CSRF protection
- SQL injection prevention
- Environmental variable protection

⚡ **To Implement Later**:
- Two-factor authentication
- Audit logging
- IP whitelisting
- Encryption at rest (database)
- DDoS protection
- Penetration testing

---

## 📈 Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Pre-trade analysis | < 100ms | TBD |
| Position update | < 50ms | TBD |
| Alert delivery | < 1s | TBD |
| Dashboard load | < 2s | TBD |
| API response | < 200ms | TBD |
| Uptime | 99.9% | TBD |

---

## 📅 Project Timeline

| Phase | Duration | Team | Status |
|-------|----------|------|--------|
| Phase 1 (Alerts) | 4 weeks | 1-2 devs | Planning |
| Phase 2 (Automation) | 4 weeks | 2-3 devs | Not started |
| Phase 3 (AI Learning) | 4+ weeks | 3-4 devs | Not started |

---

## 🎓 Learning Resources

- MT5 Python: https://github.com/khulnasoft-lab/OANDA-v20
- FastAPI: https://fastapi.tiangolo.com
- React: https://react.dev
- PostgreSQL: https://www.postgresql.org/docs

---

## 📞 Support & Contribution

This is a **proprietary trading system**. Use responsibly and in compliance with your broker's terms.

**Recommendations for Advancement**:
1. Add ML-based anomaly detection for unusual positions
2. Implement voice alerts for critical breaches
3. Build multi-broker support
4. Add paper trading simulation mode
5. Create risk optimization engine
6. Build community leaderboard (optional)
7. Implement blockchain for trade verification

---

**Version**: 1.0  
**Last Updated**: February 2026  
**Status**: Blueprint Complete ✅
