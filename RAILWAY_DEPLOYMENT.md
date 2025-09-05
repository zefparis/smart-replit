# Railway Deployment Guide - SmartLinksPilot

## 🚀 Déploiement Railway - Guide Complet

### 1. Préparation du Code

#### ✅ Patches Appliqués
- Scripts `package.json` corrigés pour Railway
- Plugins Replit supprimés du `vite.config.ts`
- Path statique corrigé dans `server/vite.ts`
- `.gitignore` complété avec variables d'env et logs
- `cross-env` ajouté pour compatibilité Windows/Linux

#### 📦 Installation des Dépendances
```bash
npm install cross-env
```

### 2. Variables d'Environnement Railway

#### 🔧 Configuration Requise
Configurez ces variables dans Railway Dashboard :

```env
# Database (Railway PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database

# Server
NODE_ENV=production
PORT=5000

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o

# Payment Providers
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_ENV=live

# AliExpress API
ALIEXPRESS_APP_KEY=your-aliexpress-app-key
ALIEXPRESS_APP_SECRET=your-aliexpress-app-secret
ALIEXPRESS_CALLBACK_URL=https://your-app.railway.app/aliexpress/callback

# Amazon Affiliate
AMAZON_EMAIL=your-amazon-email@example.com
AMAZON_PASSWORD=your-amazon-password

# IAS Blockchain
IAS_REWARD_PER_CLICK=0.25
IAS_MAX_CLICKS_PER_IP_HOUR=10
IAS_CONTRACT_ADDRESS=0x123...abcd
IAS_DISTRIBUTOR_ADDRESS=0x456...efgh
IAS_NETWORK_NAME=mainnet
IAS_RPC_URL=https://mainnet.infura.io/v3/your-infura-key
WALLET_PRIVATE_KEY=0x123...your-wallet-private-key

# Session
SESSION_SECRET=your-very-long-random-session-secret-here
```

### 3. Commandes de Build/Deploy

#### 🔨 Build Local (Test)
```bash
npm run build
npm start
```

#### 🚀 Deploy Railway
1. **Connecter le repo** : Railway détecte automatiquement `railway.json`
2. **Variables d'env** : Configurer dans Railway Dashboard
3. **Deploy** : Railway exécute `npm run build` puis `npm start`

### 4. Structure Post-Build

```
dist/
├── public/          # Frontend buildé (Vite)
│   ├── index.html
│   ├── assets/
│   └── ...
└── server/
    └── index.js     # Backend compilé (esbuild)
```

### 5. Healthcheck & Monitoring

- **Healthcheck** : `GET /healthz` (configuré dans `railway.json`)
- **Logs** : Accessible via Railway Dashboard
- **Restart** : Auto-restart configuré sur échec

### 6. Post-Deploy Checklist

#### ✅ Vérifications
- [ ] App accessible sur `https://your-app.railway.app`
- [ ] Healthcheck répond `200 OK` sur `/healthz`
- [ ] Frontend sert correctement (React app)
- [ ] API endpoints fonctionnels (`/api/*`)
- [ ] Database connectée
- [ ] Variables d'env chargées

#### 🔧 Debug
```bash
# Logs Railway
railway logs

# Test local
npm run build && npm start
curl http://localhost:5000/healthz
```

### 7. Sécurité

#### 🔒 Variables Sensibles
- Toutes les clés API dans Railway env vars
- Pas de secrets dans le code source
- `.env*` dans `.gitignore`
- HTTPS forcé en production

### 8. Optimisations

#### ⚡ Performance
- Build optimisé avec esbuild + Vite
- Static files servies par Express
- Gzip compression automatique
- CDN Railway pour assets statiques

---

## 🚨 Troubleshooting

### Build Errors
```bash
# Si erreur de build
npm run build:client  # Test frontend
npm run build:server  # Test backend
```

### Runtime Errors
- Vérifier variables d'env dans Railway Dashboard
- Consulter logs Railway
- Tester healthcheck endpoint

### Database Issues
- Vérifier `DATABASE_URL` format
- Tester connexion avec `npm run db:push`
