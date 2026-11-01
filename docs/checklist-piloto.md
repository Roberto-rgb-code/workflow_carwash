# Resumen — qué falta de tu lado

Antes de generar e importar el workflow de n8n, completa esto:

## 1. Twilio WhatsApp
- Número de WhatsApp (From)
- Account SID
- Auth Token

## 2. OpenAI
- API key (para el agente de IA en n8n)

## 3. Stripe (modo test)
- Secret key
- Webhook secret (se configura después, al conectar el workflow)

## 4. Railway
Actualizar `WHATSAPP_START_URL` con tu `wa.me` real:

```bash
railway variable set 'WHATSAPP_START_URL=https://wa.me/52TU_NUMERO?text=Hola%20quiero%20lavado%20Car%20Wash%20Pro' --service api
```

Proyecto: `workflow-carwash` → servicio `api` → Variables.

## 5. 1 lavador (piloto)
- Nombre
- WhatsApp
- Ubicación aproximada (lat/lng o colonia)

## 6. Zona / precios
Solo si **no** te sirven los de prueba:

**Zona** = área del piloto donde sí dan el servicio (hoy: caja de prueba en GDL Centro).

**Precios actuales de ejemplo:**
- Básico — $199 MXN
- Premium — $299 MXN
- Detail — $399 MXN

Si te sirven, no hagas nada. Si quieres otros, avisa.

---

## Ya listo (no hace falta tocarlo)
- API + Postgres en Railway: https://api-production-675c4.up.railway.app
- `N8N_API_KEY` y `DATABASE_URL` en variables del servicio `api`
- Repo: https://github.com/Roberto-rgb-code/workflow_carwash

## Workflow n8n (ya generado)
- JSON: `n8n/carwash-whatsapp-piloto.json`
- Guía de import: [`docs/n8n-import.md`](./n8n-import.md)

Cuando tengas las keys, importa el JSON y conecta credentials (no hace falta regenerarlo).
