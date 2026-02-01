# Latency Poison

A chaos proxy for testing API latency and failures. **One config key → one target URL.** Call the proxy with your API key in the path; it forwards to that URL with chaos applied.

## Quick start

```bash
make init    # Create .env from template
make build   # Build images
make dev     # Start services
```

- **App:** http://localhost:3000  
- **Proxy:** http://localhost:8080  

## Using the proxy

1. **Sign in** at http://localhost:3000 and open **Configs**.
2. **Create a config key** and set its **target URL** (e.g. `https://api.github.com`) and chaos (fail rate, latency).
3. **Call the proxy** with your API key in the path:

```bash
# Forwards to target URL with chaos applied
curl "http://localhost:8080/your_api_key"

# Path is appended to target URL: /your_api_key/users -> target_url + /users
curl "http://localhost:8080/your_api_key/users"
```

Example: if your key’s target URL is `https://api.github.com` and fail rate is 10%, then `http://localhost:8080/lp_xxx/users` forwards to `https://api.github.com/users` with 10% chance of failure.

## Defaults

- **User:** `admin` / `admin123`
- **Config API key:** `lp_default_admin_key_change_in_production` (set `DEFAULT_API_KEY` in `.env` to change)

## Commands

- `make dev` — Start all services  
- `make stop` — Stop  
- `make help` — List commands  

## Stripe webhook (Docker)

Pour que les abonnements mettent à jour le plan en base, Stripe envoie des webhooks à ton API.

**En local (app dans Docker)**  
1. Démarre le stack : `make dev` (ou `docker-compose up -d`).  
2. Premier usage seulement : `make stripe-login` (ouvre le navigateur pour te connecter à Stripe).  
3. Dans un autre terminal : `make stripe-listen` (relaye les webhooks vers le container API).  
4. Copie le **Signing secret** (`whsec_...`) affiché dans ton `.env` :  
   `STRIPE_WEBHOOK_SECRET=whsec_xxxxx`  
5. Redémarre l’API : `docker-compose restart api`  

**En production**  
1. Stripe Dashboard → Developers → Webhooks → Add endpoint.  
2. URL : `https://ton-api.com/api/billing/webhook`  
3. Événements : `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.  
4. Récupère le **Signing secret** et mets-le dans les variables d’environnement du container (ex. `STRIPE_WEBHOOK_SECRET`).  

Le container `api` lit déjà `STRIPE_WEBHOOK_SECRET` depuis le `.env` (voir `docker-compose.yml`).

Do not use in production. Development and testing only.
