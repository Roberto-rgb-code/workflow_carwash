# Car Wash Pro — piloto WhatsApp

API + Postgres + landing QR + mapa de ubicación para el flujo de lavado en calle (n8n + Twilio + Stripe).

## Qué incluye

- API REST para que **n8n** cree/actualice pedidos
- Postgres (Prisma)
- Landing `/` → WhatsApp
- Mapa interactivo `/locate/:token` para marcar el auto

## Endpoints clave (n8n)

Header: `x-api-key: $N8N_API_KEY`

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/health` | healthcheck |
| GET | `/v1/services` | catálogo |
| POST | `/v1/orders` | `{ waPhone, displayName? }` |
| GET | `/v1/orders/:id` | detalle (id o publicToken) |
| PATCH | `/v1/orders/:id` | actualizar datos/status |
| POST | `/v1/orders/:id/mark-paid` | confirmar Stripe |
| POST | `/v1/orders/:id/assign-nearest` | lavador más cerca |
| POST | `/v1/coverage/check` | `{ lat, lng }` |
| POST | `/v1/washers` | alta lavador |
| POST | `/public/orders/:token/location` | usado por el mapa |

`locateUrl` viene en la respuesta del pedido: `{PUBLIC_BASE_URL}/locate/{publicToken}`.

## Deploy

- Railway project: `workflow-carwash`
- Services: `api` + `Postgres`
- URL: https://api-production-675c4.up.railway.app
- Health: https://api-production-675c4.up.railway.app/health

## Dónde poner las API keys

### En Railway (servicio `api`)
Dashboard → proyecto `workflow-carwash` → servicio **api** → **Variables**  
o CLI: `railway variable set KEY=value --service api`

| Variable | Obligatorio | Notas |
|----------|-------------|--------|
| `DATABASE_URL` | Sí | Ya ligado a Postgres |
| `N8N_API_KEY` | Sí | Misma key que usarás en n8n (`x-api-key`) |
| `PUBLIC_BASE_URL` | Sí | URL pública de la API |
| `WHATSAPP_START_URL` | Sí | `https://wa.me/52TU_NUMERO?text=...` |
| `STRIPE_SECRET_KEY` | No aquí | Mejor en **n8n** |
| `TWILIO_*` | No aquí | Mejor en **n8n** |
| `OPENAI_API_KEY` | No aquí | Mejor en **n8n** (agente + imágenes) |

### En n8n / Automatización (credentials)

| Key | Dónde |
|-----|--------|
| Twilio Account SID / Auth Token / WhatsApp From | Credential Twilio en n8n |
| Stripe Secret + Webhook Secret | Credential Stripe; webhook → workflow n8n |
| OpenAI / LLM API key | Credential del AI Agent en n8n |
| `N8N_API_KEY` | Header `x-api-key` en HTTP Request nodes hacia esta API |
| URL API | `https://api-production-675c4.up.railway.app` |

Twilio webhook WhatsApp debe apuntar a tu **webhook de n8n**, no a esta API.
