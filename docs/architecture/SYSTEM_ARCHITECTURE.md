# Risk Guardian Agent - System Architecture

## Overview

Risk Guardian Agent uses a modern, scalable microservices-inspired architecture with clear separation of concerns.

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  Browser (React Dashboard)  │  Telegram Bot  │  Mobile App       │
└──────────────┬──────────────────────────────┬────────────────────┘
               │                              │
        ┌──────▼──────────────────────────────▼──────────┐
        │         API GATEWAY / LOAD BALANCER            │
        │  (CORS, Authentication, Rate Limiting)         │
        └──────┬──────────────────────────────┬──────────┘
               │                              │
    ┌──────────▼──────────┐          ┌────────▼────────────┐
    │   WebSocket Server  │          │  REST API Server    │
    │  (FastAPI Uvicorn)  │          │   (FastAPI)         │
    └──────────┬──────────┘          └────────┬────────────┘
               │                              │
        ┌──────▼──────────────────────────────▼──────────┐
        │         APPLICATION LOGIC LAYER                │
        ├──────────────────────────────────────────────────┤
        │  • Rule Engine (Core Risk Validation)           │
        │  • Pre-Trade Analysis                           │
        │  • Position Management                          │
        │  • Journal Automation                           │
        │  • Analytics & Reporting                        │
        └──────────┬──────────────────────────┬───────────┘
                   │                          │
        ┌──────────▼──────────┐      ┌────────▼────────────┐
        │   Alert Manager     │      │  Connector Module   │
        │ (Telegram, Email)   │      │ (MT4/MT5, Broker)   │
        └──────────┬──────────┘      └────────┬────────────┘
                   │                          │
        ┌──────────▼──────────────────────────▼──────────┐
        │              MESSAGE QUEUE                      │
        │         (RabbitMQ / Celery)                    │
        └──────────┬──────────────────────────┬──────────┘
                   │                          │
        ┌──────────▼──────────┐      ┌────────▼────────────┐
        │   Task Workers      │      │  Background Jobs    │
        │  (Celery Workers)   │      │  (Price Updates)    │
        └──────────┬──────────┘      └────────┬────────────┘
                   │                          │
        ┌──────────▼──────────────────────────▼──────────┐
        │              DATA LAYER                         │
        ├──────────────────────────────────────────────────┤
        │  PostgreSQL    │    Redis Cache    │   S3       │
        │  (Persistent)  │    (Hot Data)     │  (Logs)    │
        └────────────────────────────────────────────────┘
```

## Components Overview

### 1. **Frontend Layer** (React 18 + TypeScript)

**Responsibilities**:
- Real-time trading dashboard
- Account monitoring
- Trade validation pre-alerts
- Journal management
- Analytics visualization
- Settings configuration

**Key Features**:
- WebSocket real-time updates
- Responsive Material-UI design
- State management with Redux/Zustand
- TradingView charts integration

### 2. **API Gateway**

**Responsibilities**:
- CORS handling
- JWT authentication
- Rate limiting (100 req/min per user)
- Request logging & monitoring
- SSL/TLS termination

**Tech**: Nginx or AWS API Gateway

### 3. **FastAPI Application Server**

**Components**:

#### Rule Engine Core
```
TradeValidator
├── DailyLossLimitRule
├── MaxDrawdownRule
├── RiskRewardRatioRule
├── LotSizeCalculator
└── ConsecutiveLossRule
```

**Responsibilities**:
- Pre-trade validation
- Real-time position monitoring
- Rule breach detection
- Lot size recommendations

#### Account Manager
- MT4/MT5 connection management
- Account balance tracking
- Position synchronization
- Equity monitoring

#### Position Manager
- Open position tracking
- Floating P&L calculation
- Risk exposure monitoring
- Position history

#### Trade Journal
- Auto-populated entries
- Manual notes
- Performance ratings
- Statistical analysis

#### Alert System
- Telegram notifications
- Email alerts
- SMS notifications (optional)
- Webhook integration

### 4. **Message Queue** (RabbitMQ + Celery)

**Use Cases**:
- Async trade processing
- Alert dispatching
- Background calculations
- Email/Telegram sending
- Data aggregation

**Workers**:
- Alert Worker
- Price Update Worker
- Report Generation Worker
- Cleanup Worker

### 5. **Database Layer**

#### PostgreSQL (Primary)
**Tables**:
```
users                    -- Trader accounts
accounts                 -- MT4/MT5 accounts
trading_rules           -- Risk rules per account
positions               -- Real-time positions
trades                  -- Closed trades (history)
journal_entries         -- Trading journal
alerts_log              -- Alert history
events                  -- System events
```

#### Redis (Cache)
- Session storage
- Real-time position cache
- Rate limit counters
- Celery result backend
- Streaming data cache

#### S3 (Logs & Backups)
- Application logs
- Database backups
- User uploads (screenshots, PDFs)
- Archive old records

## Data Flow Patterns

### Pattern 1: Trade Pre-Validation

```
User Action:
"I want to enter EURUSD"
    ↓
Frontend Submits:
- Symbol, Entry, SL, TP, Lot Size
    ↓
API Endpoint: POST /api/v1/risk/pre-trade
    ↓
Rule Engine Evaluates:
1. Check daily loss limit
2. Check max drawdown
3. Check RR ratio
4. Calculate max lot size
5. Check account balance
    ↓
Response Generated:
{
  "is_allowed": true,
  "warnings": [...],
  "recommended_max_lot": 0.5,
  "rr_ratio": 2.5,
  "daily_loss_remaining": $500
}
    ↓
Frontend Displays:
Alert with recommendation
```

### Pattern 2: Continuous Position Monitoring

```
MT4/MT5 Position Update
    ↓
WebSocket Event Triggered
    ↓
Rule Engine:
- Calculate floating P&L
- Check drawdown
- Check daily loss impact
    ↓
If Rule Triggered:
- Create alert
- Send notification (Telegram, Email)
- Log to database
    ↓
Dashboard Updated Real-time
```

### Pattern 3: Async Alert Dispatch

```
Rule Breach Detected
    ↓
Alert Event Created
    ↓
Pushed to Message Queue
    ↓
Worker Processes:
- Format message
- Send Telegram
- Send Email
- Log result
    ↓
Alert Marked as "Delivered"
```

## API Versioning Strategy

```
/api/v1/
├── /auth/                    # Authentication
├── /accounts/                # Account management
├── /risk/                    # Risk validation
├── /positions/               # Position management
├── /trades/                  # Trade history
├── /rules/                   # Rule configuration
├── /alerts/                  # Alert management
└── /journal/                 # Trading journal
```

## Security Architecture

```
Request Flow:
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTPS/WSS
       ↓
┌──────────────────┐
│  API Gateway     │
│ (Rate Limiting)  │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  Authentication  │
│  (JWT Validation)│
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  Authorization   │
│  (Role-based)    │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  Application     │
│  Logic           │
└──────────────────┘
```

**Security Measures**:
- JWT tokens with 30-min expiration
- Refresh tokens with 7-day expiration
- Password hashing (bcrypt)
- API key encryption
- HTTPS/WSS enforcement
- Input validation & sanitization
- SQL injection prevention
- CSRF protection
- Rate limiting
- Audit logging

## Scalability Considerations

### Horizontal Scaling

**Frontend**: 
- Served via CDN (CloudFront)
- Multiple S3 origins

**API Server**:
- Load balanced across multiple instances
- Auto-scaling based on CPU/memory

**Workers**:
- Scale based on queue depth
- Min 2, Max 10 instances

**Database**:
- Read replicas for analytics
- Connection pooling
- Query optimization

### Caching Strategy

1. **User Sessions** (Redis, 30 min TTL)
2. **Account Data** (Redis, 1 min TTL)
3. **Position Cache** (Redis, 5 sec TTL)
4. **Rule Config** (Redis, 1 hour TTL)
5. **Static Assets** (CDN, 1 day TTL)

## Monitoring & Observability

**Metrics Collection**:
- Prometheus scrapes `/metrics` endpoint
- Custom metrics for:
  - Trade validation latency
  - Alert delivery time
  - Queue depth
  - Error rates

**Logging**:
- Structured JSON logging
- Centralized logging (ELK or CloudWatch)
- Levels: DEBUG, INFO, WARNING, ERROR

**Tracing**:
- Request ID propagation
- Correlation across services
- Performance profiling

**Alerting**:
- API response time anomalies
- Error rate thresholds
- Database connection issues
- Queue backlog warnings

## Disaster Recovery

**Backup Strategy**:
- Daily database backups → S3
- Point-in-time recovery (7 days)
- Cross-region replication

**High Availability**:
- Multi-AZ deployment
- Database failover (RDS)
- Redis cluster mode
- Load balancer health checks

**Recovery Time Objectives (RTO)**:
- API Server: 5 minutes
- Database: 15 minutes
- Full system: 30 minutes

## Performance Targets

| Operation | Target | Current |
|-----------|--------|---------|
| Pre-trade validation | < 100ms | TBD |
| Position sync | < 500ms | TBD |
| Alert delivery | < 2s | TBD |
| Dashboard load | < 2s | TBD |
| API response | < 200ms | TBD |

---

**Last Updated**: February 2026  
**Architecture Version**: 1.0
