# Risk Guardian Agent

A professional-grade AI-powered risk management system for proprietary trading firms and brokers. Automates trade validation, enforces risk rules, prevents losses, and coaches traders with real-time insights.

## 🎯 Features

### Phase 1: Alerts & Monitoring (Current)
- ✅ Real-time position monitoring
- ✅ Pre-trade risk validation
- ✅ Daily loss tracking
- ✅ Maximum drawdown alerts
- ✅ Risk:Reward ratio validation
- ✅ Telegram notifications
- ✅ Email alerts
- ✅ Web dashboard
- ✅ Trading journal automation

### Phase 2: Automation (In Development)
- 🔄 Auto-close positions on rule breach
- 🎯 Auto stop-loss adjustment
- 📊 Dynamic lot size calculation
- 🤖 Intelligent recommendations
- 📈 Advanced analytics

### Phase 3: AI Learning (Planned)
- 🧠 Trading pattern analysis
- 😤 Emotional risk detection
- 📚 Strategy learning
- 🎓 Personalized coaching

## 📊 Quick Start

### Prerequisites
- Python 3.9+
- PostgreSQL 12+
- Redis 6+
- Node.js 16+
- MT4/MT5 installed and running

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/risk-guardian-agent.git
cd risk-guardian-agent
```

2. **Backend Setup**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your settings (MT4/MT5 credentials, Telegram token, etc.)
```

4. **Database Setup**
```bash
cd backend
alembic upgrade head  # Run migrations
```

5. **Start Backend**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

6. **Frontend Setup**
```bash
cd frontend
npm install
npm start
```

7. **Access Dashboard**
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs

## 🐳 Docker Deployment

```bash
docker-compose up -d
```

This will start:
- FastAPI Backend (port 8000)
- React Frontend (port 3000)
- PostgreSQL (port 5432)
- Redis (port 6379)

## 📱 Telegram Integration

1. Create a Telegram bot via @BotFather
2. Get your chat ID
3. Add to .env:
```env
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_CHAT_ID=your_chat_id
```

## 🔑 API Documentation

Full API documentation available at: `/docs` (Swagger UI)

### Key Endpoints

**Pre-Trade Risk Validation**
```
POST /api/v1/risk/pre-trade
{
  "symbol": "EURUSD",
  "entry_price": 1.0850,
  "stop_loss": 1.0800,
  "take_profit": 1.1000,
  "lot_size": 1.0
}
```

**Get Account Status**
```
GET /api/v1/accounts/{account_id}/status
```

**Manual Journal Entry**
```
POST /api/v1/journal
{
  "trade_id": "EURUSD_2024",
  "notes": "Trade setup was clean, followed plan",
  "rating": 8
}
```

## 🏗️ Project Structure

```
RiskGuardianAgent/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── core/              # Core business logic
│   │   │   ├── rule_engine.py
│   │   │   ├── risk_calculator.py
│   │   │   └── compliance.py
│   │   ├── modules/           # Feature modules
│   │   │   ├── accounts.py
│   │   │   ├── positions.py
│   │   │   ├── trades.py
│   │   │   ├── journal.py
│   │   │   └── analytics.py
│   │   ├── connectors/        # External integrations
│   │   │   ├── mt4_mt5.py
│   │   │   └── broker_api.py
│   │   ├── alerts/            # Notification system
│   │   │   ├── telegram.py
│   │   │   ├── email.py
│   │   │   └── alert_manager.py
│   │   ├── database/          # Database models
│   │   │   ├── models.py
│   │   │   └── schemas.py
│   │   ├── routes/            # API endpoints
│   │   └── main.py            # App entry point
│   ├── tests/                 # Unit & integration tests
│   └── requirements.txt        # Dependencies
│
├── frontend/                   # React dashboard
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API services
│   │   ├── hooks/             # Custom hooks
│   │   ├── utils/             # Utility functions
│   │   └── App.tsx            # Main app
│   ├── public/
│   └── package.json
│
├── docs/                      # Documentation
│   ├── architecture/          # Architecture docs
│   ├── api/                   # API reference
│   └── deployment/            # Deployment guides
│
├── config/                    # Configuration files
├── scripts/                   # Utility scripts
├── docker-compose.yml         # Docker services
├── BLUEPRINT.md               # Full project blueprint
└── README.md                  # This file
```

## 📚 Documentation

- [Full Blueprint](./BLUEPRINT.md) - Comprehensive project documentation
- [Architecture](./docs/architecture/) - System design and decisions
- [API Documentation](./docs/api/) - Endpoint reference
- [Deployment Guide](./docs/deployment/) - Production deployment

## 🔒 Security

- JWT-based authentication
- Encrypted credentials storage
- API rate limiting
- Input validation
- HTTPS/SSL support
- Secure environment variables
- NO hardcoded secrets

**Important**: Never commit `.env` files or API keys to version control.

## 🧪 Testing

```bash
cd backend
pytest tests/                    # Run all tests
pytest tests/ -v               # Verbose output
pytest tests/ --cov            # With coverage report
```

## 📊 Monitoring

- Prometheus metrics at: `/metrics`
- Grafana dashboard: http://localhost:3001
- Health check: `/health`

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/new-feature`
2. Commit changes: `git commit -am 'Add feature'`
3. Push to branch: `git push origin feature/new-feature`
4. Submit a Pull Request

## 🐛 Known Issues

- MT4 connection requires terminal to be running
- Telegram notifications require active bot token
- High-frequency updates may impact dashboard responsiveness

## 🔮 Roadmap

- [ ] Phase 2: Auto-closing and lot size optimization
- [ ] Phase 3: ML-based strategy learning
- [ ] Multi-broker support
- [ ] Paper trading mode
- [ ] Voice alerts
- [ ] Mobile app

## 📞 Support

For issues, feature requests, or questions:
1. Check [Issues](https://github.com/yourusername/risk-guardian-agent/issues)
2. Create a new issue with detailed information
3. Contact: support@riskguardian.dev

## ⚖️ Legal & Disclaimer

This system is provided as-is for educational and professional trading purposes. 

**IMPORTANT**: 
- Always test thoroughly in a paper trading environment first
- Use at your own risk
- This is NOT financial advice
- Comply with your broker's terms and regulations
- Risk management is YOUR responsibility

## 📄 License

MIT License - see LICENSE file for details

## 🌟 Acknowledgments

Built with:
- FastAPI & Uvicorn
- React & Material-UI
- MetaTrader5 Python Library
- PostgreSQL & Redis

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Status**: Phase 1 Development

**Made with ❤️ for traders who believe in discipline**
