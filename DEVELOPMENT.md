# Development Guide - Risk Guardian Agent

## Quick Start for Developers

### Prerequisites
- Python 3.9+
- Node.js 16+
- PostgreSQL 12+ (or Docker)
- Redis (or Docker)
- Git

### Initial Setup (5 minutes)

1. **Clone and enter directory**
```bash
git clone <repo>
cd risk-guardian-agent
```

2. **Copy environment file**
```bash
cp .env.example .env
```

3. **Option A: Use Docker (Recommended)**
```bash
docker-compose up -d
# Services ready in 30 seconds
```

4. **Option B: Local Setup**

**Backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Terminal 1: Start API
uvicorn app.main:app --reload
```

**Frontend**:
```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3000
```

---

## Project Structure Overview

```
backend/
├── app/
│   ├── core/               # Core business logic
│   │   ├── rule_engine.py  # Main risk validation
│   │   └── config.py       # Configuration
│   ├── modules/            # Feature modules
│   ├── connectors/         # External APIs (MT4/MT5)
│   ├── alerts/             # Notification system
│   ├── database/           # Database layer
│   └── main.py             # FastAPI app
├── tests/                  # Test files
└── requirements.txt

frontend/
├── src/
│   ├── components/         # React components
│   ├── pages/              # Page components
│   ├── services/           # API services
│   └── App.tsx             # Main component
└── package.json
```

---

## Common Development Tasks

### Running Tests

```bash
# Backend tests
cd backend
pytest tests/ -v

# Frontend tests
cd frontend
npm test
```

### Database Operations

```bash
# Run migrations
cd backend
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "Add new table"

# Rollback
alembic downgrade -1
```

### Code Quality

```bash
# Python linting
cd backend
flake8 app/
black app/
mypy app/

# Frontend linting
cd frontend
npm run lint
npm run format
```

### Hot Reload Development

```bash
# Both services support hot reload
# Make changes and they automatically recompile

# Backend: Uvicorn auto-reload
# Frontend: React auto-refresh
```

---

## API Development Workflow

### 1. Design the Endpoint

```python
# routes/accounts.py
from fastapi import APIRouter, Depends
from app.core.config import settings

router = APIRouter(prefix="/accounts", tags=["accounts"])

@router.get("/{account_id}")
async def get_account(account_id: str):
    """Get account details"""
    pass
```

### 2. Add to Main App

```python
# main.py
from app.routes.accounts import router as accounts_router

app.include_router(
    accounts_router,
    prefix="/api/v1"
)
```

### 3. Test Endpoint

```bash
# Manual test
curl http://localhost:8000/api/v1/accounts/123

# Using API docs
# Go to http://localhost:8000/docs
```

### 4. Add to Frontend

```typescript
// services/accountService.ts
export const getAccount = async (accountId: string) => {
  const response = await api.get(`/accounts/${accountId}`);
  return response.data;
};
```

---

## Database Schema Updates

### Add New Table

1. **Create SQLAlchemy Model**:
```python
# database/models.py
from sqlalchemy import Column, String, Float
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class NewTable(Base):
    __tablename__ = "new_table"
    
    id = Column(String, primary_key=True)
    name = Column(String, index=True)
    value = Column(Float)
```

2. **Create Migration**:
```bash
cd backend
alembic revision --autogenerate -m "Add new_table"
```

3. **Review and Run**:
```bash
alembic upgrade head
```

---

## Adding New Features

### Example: Add Custom Risk Rule

1. **Extend Rule Engine**:
```python
# core/rule_engine.py
def _check_custom_rule(self, request) -> RuleResult:
    """Check custom rule"""
    # Implement validation logic
    pass

# Add to validate_trade method
custom_result = self._check_custom_rule(request)
all_results.append(custom_result)
```

2. **Add API Endpoint**:
```python
# routes/risk.py
@router.post("/validate-custom")
async def validate_custom_rule(data: dict):
    rule_engine = RuleEngine()
    result = rule_engine._check_custom_rule(data)
    return result
```

3. **Update Frontend**:
```typescript
// services/riskService.ts
export const validateCustomRule = (data) => {
  return api.post('/risk/validate-custom', data);
};
```

4. **Add Tests**:
```python
# tests/test_rule_engine.py
def test_custom_rule():
    engine = RuleEngine()
    result = engine._check_custom_rule({...})
    assert result.status == RuleStatus.PASS
```

---

## Debugging Tips

### Backend Debugging

```python
# Add print statements
print(f"Debug: {variable}")

# Use FastAPI logger
import logging
logger = logging.getLogger(__name__)
logger.info("Info message")
logger.debug("Debug message")

# Use Python debugger
import pdb; pdb.set_trace()

# Or use VS Code debugger
# Create .vscode/launch.json
```

**.vscode/launch.json**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: FastAPI",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["app.main:app", "--reload"],
      "jinja": true,
      "justMyCode": true
    }
  ]
}
```

### Frontend Debugging

```typescript
// Console logs
console.log('Debug:', variable);
console.table(arrayData);

// React DevTools
// Install React DevTools browser extension

// Debugger statement
debugger;
```

---

## Environment Variables

### Development (.env)
```env
ENVIRONMENT=development
DEBUG=True
DATABASE_URL=postgresql://user:pass@localhost/risk_guardian
```

### Testing (.env.test)
```env
ENVIRONMENT=testing
DEBUG=True
DATABASE_URL=postgresql://user:pass@localhost/risk_guardian_test
```

### Production (.env.production)
```env
ENVIRONMENT=production
DEBUG=False
DATABASE_URL=postgresql://user:pass@prod-rds:5432/risk_guardian
```

---

## Performance Profiling

### Backend

```python
# Profile endpoints
# Install: pip install py-spy

# Sample application
py-spy record -o profile.svg -- uvicorn app.main:app

# Or use slower import detection
python -X importtime -m uvicorn app.main:app 2>&1 | head -20
```

### Frontend

```bash
# React Profiler
# In DevTools > Profiler tab

# Bundle analysis
npm run build
npm install -g serve
serve -s build
```

---

## Git Workflow

### Branch Strategy
```bash
# Feature branch
git checkout -b feature/new-feature
git commit -m "feat: add new feature"
git push origin feature/new-feature
# Create Pull Request

# Hotfix
git checkout -b hotfix/fix-issue
git commit -m "fix: resolve critical issue"
```

### Commit Messages
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `test:` - Test addition/updates
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `chore:` - Maintenance

---

## Docker Development

### Build Custom Image
```bash
# Backend
docker build -t rga-backend:dev ./backend

# Frontend
docker build -t rga-frontend:dev ./frontend

# Run
docker run -p 8000:8000 rga-backend:dev
docker run -p 3000:3000 rga-frontend:dev
```

### Docker Compose Development

```yaml
# Override for development
version: '3.8'
services:
  backend:
    build: ./backend
    volumes:
      - ./backend:/app  # Hot reload
    environment:
      - DEBUG=True
```

---

## Performance Benchmarks

### Target Metrics
- Pre-trade validation: < 100ms
- API response: < 200ms
- Database queries: < 50ms
- Frontend load: < 2s

### Measure Performance
```bash
# Backend
ab -n 100 -c 10 http://localhost:8000/health

# Frontend
lighthouse --view http://localhost:3000
```

---

## Common Issues & Solutions

### Issue: Database connection refused
**Solution**:
```bash
# Check PostgreSQL running
psql -h localhost -U rga_user
# If not running, start it:
pg_ctl start
```

### Issue: Frontend can't reach backend
**Solution**:
```bash
# Check CORS settings in .env
ALLOWED_ORIGINS=http://localhost:3000
# Check backend running
curl http://localhost:8000/health
```

### Issue: Redis connection error
**Solution**:
```bash
# Check redis running
redis-cli ping
# If not: docker run -d -p 6379:6379 redis:latest
```

---

## Code Review Checklist

- [ ] Code follows PEP 8 (Python) / ESLint (JS)
- [ ] All tests pass
- [ ] No console logs/debug code
- [ ] Documentation updated
- [ ] Database schema changes have migrations
- [ ] Error handling implemented
- [ ] Security considerations reviewed

---

## Resources

- [FastAPI Docs](https://fastapi.tiangolo.com)
- [React Docs](https://react.dev)
- [PostgreSQL Docs](https://www.postgresql.org/docs)
- [SQLAlchemy Docs](https://docs.sqlalchemy.org)
- [Docker Docs](https://docs.docker.com)

---

**Last Updated**: February 2026  
**Maintainer**: Development Team
