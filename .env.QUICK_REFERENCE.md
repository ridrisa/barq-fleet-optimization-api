# Environment Variables - Quick Reference Card

**BARQ Fleet Management**

---

## 🚀 Quick Setup (New Developer)

```bash
# 1. Copy templates
cp .env.example .env.local
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local

# 2. Edit .env.local files with your credentials

# 3. Start services
npm run dev
```

---

## 📁 File Structure

```
✅ Tracked in Git          🔒 Never commit (in .gitignore)

.env.example             → .env.local
backend/.env.example     → backend/.env.local
frontend/.env.example    → frontend/.env.local
```

---

## 🔑 Essential Variables

### Backend (.env.local)

```bash
# Database
DB_HOST=localhost
DB_USER=barq_user
DB_PASSWORD=your_password

# JWT (generate: openssl rand -base64 64)
JWT_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# AI (get from https://console.groq.com/keys)
GROQ_API_KEY=gsk_xxx
```

### Frontend (.env.local)

```bash
# API
NEXT_PUBLIC_API_URL=http://localhost:3003

# Mapbox (get from https://account.mapbox.com/)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.xxx
```

---

## 🔒 Security Checklist

- [ ] Never commit .env.local
- [ ] Use strong secrets in production (64+ chars)
- [ ] Rotate credentials every 90 days
- [ ] Store production secrets in Secret Manager
- [ ] Verify: `git check-ignore .env.local` ✅

---

## 🏭 Production (Cloud Run)

```bash
# Store secrets
gcloud secrets create JWT_SECRET --data-file=-

# Deploy with secrets
gcloud run deploy route-opt-backend \
  --set-secrets JWT_SECRET=JWT_SECRET:latest
```

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| DB connection failed | Check DB_HOST, DB_USER, DB_PASSWORD |
| JWT error | Generate JWT_SECRET with `openssl rand -base64 64` |
| CORS error | Set CORS_ORIGIN=http://localhost:3001 |
| Map not loading | Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN |

---

## 📚 Full Documentation

See [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)
