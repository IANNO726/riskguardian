# Deployment Guide - Risk Guardian Agent

## Development Environment Setup

### Prerequisites
- Python 3.9+
- Node.js 16+
- PostgreSQL 12+
- Redis 6+
- MT4/MT5 installed (for testing)
- Git

### Local Development Setup

1. **Clone Repository**
```bash
git clone https://github.com/yourusername/risk-guardian-agent.git
cd risk-guardian-agent
```

2. **Backend Setup**
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

3. **Create Environment File**
```bash
cp ../.env.example ../.env
# Edit .env with your settings
```

4. **Initialize Database**
```bash
alembic upgrade head
```

5. **Run Backend**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

6. **Frontend Setup** (New terminal)
```bash
cd frontend
npm install
npm start
```

7. **Access Application**
- Frontend: http://localhost:3000
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

---

## Docker Development

```bash
# Run all services
docker-compose up -d

# Check logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

**Services**:
- Backend: http://localhost:8000
- Frontend: http://localhost:3000
- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090

---

## Production Deployment - AWS

### Architecture
```
Domain (Cloudflare) 
  ↓
AWS EC2 (FastAPI)
  ↓
RDS PostgreSQL (Primary + Standby)
  ↓
ElastiCache Redis
  ↓
CloudFront + S3 (Frontend)
```

### Step 1: Prepare AWS Environment

**Create VPC**:
- VPC with public/private subnets
- Security groups for each service

**RDS PostgreSQL**:
```bash
# Instance: db.t3.medium
# Storage: 100 GB
# Backup retention: 7 days
# Multi-AZ: Yes
```

**ElastiCache Redis**:
```bash
# Instance: cache.t3.micro
# Engine: Redis 7.x
# Nodes: 2 (with failover)
```

### Step 2: Deploy Backend to EC2

**SSH into EC2**:
```bash
ssh -i key.pem ubuntu@your-ec2-ip
```

**Install Dependencies**:
```bash
sudo apt update
sudo apt install -y python3.11 python3-pip
sudo apt install -y postgresql-client redis-tools

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

**Deploy Application**:
```bash
git clone https://github.com/yourusername/risk-guardian-agent.git
cd risk-guardian-agent/backend

# Create production .env
cat > .env << EOF
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/risk_guardian
REDIS_URL=redis://elasticache-endpoint:6379/0
ENVIRONMENT=production
DEBUG=False
JWT_SECRET_KEY=your_production_secret_key
# ... other settings
EOF

# Build and run
sudo docker build -t rga-backend .
sudo docker run -d -p 80:8000 \
  --env-file .env \
  --name rga-backend \
  rga-backend
```

**Use Gunicorn with Nginx**:

```bash
# Install Gunicorn
pip install gunicorn

# Create systemd service
sudo nano /etc/systemd/system/rga.service
```

**rga.service**:
```ini
[Unit]
Description=Risk Guardian Agent API
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/risk-guardian-agent/backend
ExecStart=/home/ubuntu/risk-guardian-agent/backend/venv/bin/gunicorn \
    -w 4 \
    -b 127.0.0.1:8000 \
    app.main:app

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Start Service**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable rga
sudo systemctl start rga
sudo systemctl status rga
```

### Step 3: Configure Nginx Reverse Proxy

**Install Nginx**:
```bash
sudo apt install -y nginx
```

**Create Nginx Config**:
```bash
sudo nano /etc/nginx/sites-available/rga
```

**Config**:
```nginx
upstream rga_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # SSL - uncomment after getting certificate
    # listen 443 ssl http2;
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    # Proxy settings
    location / {
        proxy_pass http://rga_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Static files cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
```

**Enable Site**:
```bash
sudo ln -s /etc/nginx/sites-available/rga /etc/nginx/sites-enabled/rga
sudo nginx -t
sudo systemctl restart nginx
```

### Step 4: SSL Certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com
```

### Step 5: Deploy Frontend to CloudFront + S3

```bash
# Build frontend
cd frontend
npm run build

# Create S3 bucket
aws s3 mb s3://rga-frontend-prod --region us-east-1

# Upload build files
aws s3 sync build/ s3://rga-frontend-prod/ --delete

# Create CloudFront distribution
# Origin: S3 bucket
# Cache: 1 day
# Compression: Enabled
```

### Step 6: Set Up Monitoring

**CloudWatch Dashboards**:
```bash
# Monitor metrics:
# - CPU usage
# - Memory usage
# - Network I/O
# - RDS connections
# - Application errors
```

**Set Up Alarms**:
```bash
# High CPU (> 80%)
# High memory (> 85%)
# RDS storage (> 80%)
# Application errors (> 5/min)
# API latency (> 1000ms)
```

### Step 7: Database Backup Strategy

**Automated Backups**:
```bash
# AWS RDS automatic backups (daily)
# Retention: 7 days

# Manual snapshots (weekly)
aws rds create-db-snapshot \
  --db-instance-identifier risk-guardian \
  --db-snapshot-identifier risk-guardian-$(date +%Y%m%d)
```

### Step 8: CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Build and push Docker image
      run: |
        docker build -t rga-backend:latest ./backend
        # Push to ECR or DockerHub
    
    - name: Deploy to EC2
      run: |
        # SSH to EC2 and pull latest image
        ssh -i ${{ secrets.EC2_KEY }} ubuntu@${{ secrets.EC2_IP }} \
          'cd /home/ubuntu/risk-guardian-agent && \
           git pull origin main && \
           docker pull rga-backend:latest && \
           docker-compose up -d'
```

---

## Health Checks

### Frontend Health
```bash
curl http://localhost:3000
# Should return HTML
```

### API Health
```bash
curl http://localhost:8000/health
# Response:
# {"status": "healthy", "version": "1.0.0"}
```

### Database Health
```bash
psql -h localhost -U rga_user -d risk_guardian -c "SELECT 1"
```

### Redis Health
```bash
redis-cli ping
# Response: PONG
```

---

## Scaling Considerations

### Horizontal Scaling
1. Load balance API servers (2-4 instances)
2. RDS read replicas for analytics queries
3. Redis cluster for session management
4. CDN for frontend delivery

### Vertical Scaling
1. Increase EC2 instance type (t3.medium → t3.large)
2. Increase RDS instance (db.t3.medium → db.t3.large)
3. Increase Redis instance (cache.t3.micro → cache.t3.small)

### Performance Optimization
1. Enable query caching in Redis
2. Index frequently used columns in PostgreSQL
3. Compress API responses (gzip)
4. Use CloudFront for static assets
5. Set up database connection pooling (PgBouncer)

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
sudo journalctl -u rga -f

# Check port 8000
sudo lsof -i :8000

# Check database connection
psql -h rds-endpoint -U rga_user -d risk_guardian
```

### High API latency
```bash
# Check slow queries
SELECT query, mean_time FROM pg_stat_statements 
  ORDER BY mean_time DESC LIMIT 10;

# Check Redis usage
redis-cli INFO memory
```

### Database connection errors
```bash
# Check RDS security group
# Check connection limit
SHOW max_connections;

# Monitor connections
SELECT count(*) FROM pg_stat_activity;
```

---

## Maintenance Schedule

| Task | Frequency | Command |
|------|-----------|---------|
| Database backup | Daily | Automated by RDS |
| Log rotation | Daily | Automated by OS |
| Security updates | Weekly | `apt update && apt upgrade` |
| Performance review | Weekly | Check CloudWatch dashboard |
| Unused index removal | Monthly | Run maintenance scripts |
| Database optimization | Monthly | VACUUM, ANALYZE |

---

**Last Updated**: February 2026  
**Production Ready**: Yes
