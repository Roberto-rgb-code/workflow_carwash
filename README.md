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

## Variables de entorno

Ver `.env.example` y la sección **Dónde poner las API keys** al final del deploy.
