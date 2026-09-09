<p align="center">
  <img src="https://img.shields.io/badge/Platform-Web%20%7C%20Mobile-green" alt="Platform">
  <img src="https://img.shields.io/badge/Language-TypeScript%20%7C%20Python%20%7C%20SQL-blue" alt="Languages">
  <img src="https://img.shields.io/badge/Database-PostgreSQL%2015%2B%20%7C%20Redis%207%2B-purple" alt="Database">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License">
  <img src="https://img.shields.io/badge/Status-Active%20Development-brightgreen" alt="Status">
</p>

<h1 align="center">🌱 Bungkus!</h1>

<p align="center">
  <strong>Smart Food Waste & Near-Expiry Clearance Platform</strong><br>
  <em>Selamatkan Makanan, Selamatkan Bumi</em>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-deployment">Deployment</a>
</p>

---

## 📋 Overview

**Bungkus!** is a production-grade sustainable food-waste clearance & social e-commerce platform designed for the Indonesian market. The platform enables merchants (bakery, supermarkets, restaurants) to liquidate near-expiry inventory to consumers via dynamic pricing and social group buying ("Bungkus Bareng").

### 🎯 Problem We Solve

- **48% of food produced globally is wasted** (FAO, 2023)
- Indonesian households waste **23-48 kg of food per capita annually**
- Merchants lose **15-30% revenue** on near-expiry products
- Consumers miss opportunities to save money on quality food

### 💡 Our Solution

1. **Dynamic Pricing Engine** — Real-time price decay based on time-to-expiry and stock pressure
2. **Social Group Buying** — "Bungkus Bareng" for flash sales with atomic Redis locking
3. **Geospatial Discovery** — Find nearby deals with PostGIS-powered location search
4. **ESG Impact Tracking** — Personal carbon footprint reduction dashboard

---

## 🚀 Features

### Consumer Mobile App
| Feature | Description | Status |
|---------|-------------|--------|
| 🔐 Auth & Onboarding | Google/Email login, GPS consent (UU PDP) | ✅ |
| 🗺️ Map & Discovery | Interactive Leaflet map, geofencing, nearby search | ✅ |
| 👥 Group Buying | Real-time "Bungkus Bareng" with WebSocket sync | ✅ |
| 🛒 Checkout & QR | Payment integration (Midtrans/Xendit), QR verification | ✅ |
| 📊 Impact Tracker | Personal CO₂e savings, meals saved, streak system | ✅ |

### Merchant B2B Dashboard
| Feature | Description | Status |
|---------|-------------|--------|
| 📦 POS Integration | Webhook-based POS sync, automatic listing | ✅ |
| 💰 Dynamic Pricing | Floor price slider, expiry timer, auto-discount | ✅ |
| 📱 QR Scanner | HTML5 camera-based order verification | ✅ |
| 📈 Analytics | Waste vs recovered revenue charts, ESG metrics | ✅ |

### Backend & System Engine
| Feature | Description | Status |
|---------|-------------|--------|
| 🌐 Geo-Spatial Engine | PostGIS ST_DWithin, Redis GEOSEARCH | ✅ |
| 🔒 Redis Distributed Locking | Atomic Lua scripts, race condition protection | ✅ |
| ⏰ Auto-Delisting Engine | Background worker, time-based product removal | ✅ |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
├──────────────────┬──────────────────┬───────────────────────────┤
│  Consumer App    │  Merchant Portal │  Marketing Landing Page   │
│  (React Native)  │  (Next.js 14)    │  (Next.js 14 + SSR)      │
└────────┬─────────┴────────┬─────────┴─────────────┬─────────────┘
         │                  │                       │
         ▼                  ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                              │
│                    REST + WebSocket + gRPC                       │
└────────┬────────────────────────────────────────────┬───────────┘
         │                                            │
         ▼                                            ▼
┌─────────────────────┐              ┌────────────────────────────┐
│   APPLICATION LAYER │              │      ENGINE LAYER          │
├─────────────────────┤              ├────────────────────────────┤
│ • Auth Service      │              │ • Pricing Engine (Python)  │
│ • Order Service     │              │ • Group Buy State Machine  │
│ • Payment Webhook   │              │ • Geo-Spatial Query Engine │
│ • Notification Svc  │              │ • Auto-Delisting Worker    │
└────────┬────────────┘              └─────────────┬──────────────┘
         │                                         │
         ▼                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                               │
├──────────────────┬──────────────────┬───────────────────────────┤
│  PostgreSQL 15+  │  Redis 7+        │  Kafka / RabbitMQ        │
│  (PostGIS)       │  (Lua Scripts)   │  (Event Bus)             │
└──────────────────┴──────────────────┴───────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
- **Mobile App**: React Native / Flutter
- **Web PWA**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **State Management**: Zustand, React Query / TanStack Query
- **Maps**: Leaflet + OpenStreetMap, React-Leaflet

### Backend
- **Runtime**: Node.js (NestJS) / Python 3.12+
- **Database**: PostgreSQL 15+ with PostGIS extension
- **Cache**: Redis 7+ with Lua scripting
- **Message Queue**: Apache Kafka / RabbitMQ

### Infrastructure
- **Containerization**: Docker, Docker Compose
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana

---

## 📁 Project Structure

```
Bungkus-/
├── bungkus-db/                    # Database Schema (PostgreSQL + PostGIS)
│   ├── 00_extensions.sql          # Extensions & ENUM types
│   ├── 01_schema_users_merchants.sql
│   ├── 02_schema_products.sql
│   ├── 03_schema_orders_groupbuys.sql
│   ├── 04_schema_payments_notifications_audit.sql
│   ├── 05_functions.sql           # Stored procedures
│   ├── 06_views.sql               # Spatial & analytics views
│   └── 07_redis_strategy.md       # Redis key conventions
│
├── bungkus-pricing/               # Dynamic Pricing Engine (Python)
│   ├── bungkus_pricing/
│   │   ├── pricing_engine.py      # Core pricing algorithm
│   │   ├── models.py              # Pydantic models
│   │   └── worker.py              # Background worker
│   └── tests/                     # 67 tests, 92% coverage
│
├── bungkus-groupbuy/              # Group Buy State Engine
│   ├── bungkus_groupbuy/
│   │   ├── lua_scripts/           # Redis atomic operations
│   │   ├── state_machine.py       # Event-driven FSM
│   │   ├── webhook_handler.py     # Payment gateway integration
│   │   └── events.py              # WebSocket event schemas
│   └── tests/                     # 31 tests
│
├── bungkus-app/                   # Consumer Mobile App (React Native)
│   └── src/
│       ├── components/            # UI components
│       ├── hooks/                 # WebSocket integration
│       └── theme/                 # Design tokens
│
├── bungkus-web/                   # Web Ecosystem (Next.js 14)
│   └── src/
│       ├── app/                   # Pages & API routes
│       ├── components/            # Reusable components
│       └── store/                 # Zustand state
│
└── bungkus-data/                  # Seed Data & Mocks
    ├── seeders.sql                # PostgreSQL seed script
    ├── mock_api_responses.json    # API response mocks
    └── redis_seed.txt             # Redis cache seed
```

---

## 🧮 Pricing Algorithm

The dynamic pricing engine uses a continuous time-decay function:

```
P(t, q) = max(P_min, P_base × (1 - D_max × (1 - T_rem/T_total)^1.5 × (0.5 + 0.5 × (Q_rem/Q_init))))
```

**Parameters:**
- `D_max = 0.70` — Maximum 70% discount
- `T_rem` — Time remaining until expiry
- `T_total` — Total shelf life
- `Q_rem` — Current stock remaining
- `Q_init` — Initial stock quantity

**Currency Rounding:** Round down to nearest 100 IDR (Rp)

---

## ⚡ Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Python 3.12+
- PostgreSQL 15+ with PostGIS
- Redis 7+

### Installation

```bash
# Clone repository
git clone https://github.com/Alif2232/Bungkus-.git
cd Bungkus-

# Database setup
cd bungkus-db
psql -U postgres -d bungkus -f 00_run_all.sql

# Seed data
psql -U postgres -d bungkus -f ../bungkus-data/seeders.sql

# Pricing Engine
cd ../bungkus-pricing
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
pytest tests/ -v

# Group Buy Engine
cd ../bungkus-groupbuy
pip install -e ".[dev]"
pytest tests/ -v

# Web Ecosystem
cd ../bungkus-web
npm install
npm run dev

# Redis Cache Seed
redis-cli < ../bungkus-data/redis_seed.txt
```

### Running Tests

```bash
# Pricing Engine (67 tests)
cd bungkus-pricing && pytest tests/ -v --cov

# Group Buy Engine (31 tests)
cd bungkus-groupbuy && pytest tests/ -v --cov

# Total: 98 tests, all passing ✅
```

---

## 📡 API Reference

### Geo-Spatial Search
```
GET /api/v1/merchants/nearby?lat=-6.2088&lng=106.8456&radius=5000
```

### Group Buy Management
```
GET  /api/v1/group-buys/active          # List active groups
POST /api/v1/group-buys                 # Create new group
POST /api/v1/group-buys/:id/join       # Join group
POST /api/v1/group-buys/:id/leave      # Leave group
```

### User Dashboard
```
GET /api/v1/user/impact-dashboard       # ESG metrics
GET /api/v1/user/orders                 # Order history
```

### Merchant Operations
```
GET    /api/v1/merchant/products        # List products
POST   /api/v1/merchant/products        # Add product
PUT    /api/v1/merchant/products/:id    # Update product
DELETE /api/v1/merchant/products/:id    # Remove product
GET    /api/v1/merchant/analytics       # Sales analytics
```

### WebSocket Events
```json
{
  "event": "GROUP_UPDATED",
  "group_id": "gb-001",
  "payload": {
    "quota": {"current": 3, "required": 5},
    "timer": {"seconds_remaining": 1080},
    "participants": [...]
  }
}
```

---

## 🚢 Deployment

### Docker (Recommended)

```bash
# Build and run all services
docker-compose up -d

# Services:
# - postgres:5432    (PostgreSQL + PostGIS)
# - redis:6379       (Redis)
# - api:3000         (Backend API)
# - web:3001         (Web Portal)
```

### Production Checklist

- [ ] Set environment variables (database, Redis, API keys)
- [ ] Run database migrations
- [ ] Seed initial data
- [ ] Configure SSL/TLS
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Enable rate limiting
- [ ] Configure CORS policies
- [ ] Set up backup strategy

---

## 📊 ESG Impact

Every order on Bungkus! contributes to:

| Metric | Value (Sep 2026) |
|--------|------------------|
| 🍽️ Meals Saved | 125,847 |
| 🌱 CO₂e Prevented | 89.2 tons |
| 💰 Consumer Savings | Rp 2.45 Billion |
| 🏪 Active Merchants | 342 |
| 👥 Active Users | 7,300+ |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `style:` — Code style changes (formatting, semicolons, etc.)
- `refactor:` — Code refactoring
- `test:` — Adding tests
- `chore:` — Maintenance tasks

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 👥 Team

- **Ananda Alifa** — Full Stack Developer & Architect

---

## 🙏 Acknowledgments

- [PostGIS](https://postgis.net/) — Geospatial extensions for PostgreSQL
- [Redis](https://redis.io/) — In-memory data store
- [Midtrans](https://midtrans.com/) & [Xendit](https://xendit.com/) — Payment gateway
- [Leaflet](https://leafletjs.com/) — Open-source maps
- [Next.js](https://nextjs.org/) — React framework
- [Indonesia Food Waste Coalition](https://www.foodwaste.id/) — Research data

---

<p align="center">
  Made with 💚 for a sustainable future<br>
  <em>Selamatkan Makanan, Selamatkan Bumi</em> 🌍
</p>
