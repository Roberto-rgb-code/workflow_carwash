# Importar workflow n8n — Car Wash Pro

Archivo: [`n8n/carwash-whatsapp-piloto.json`](../n8n/carwash-whatsapp-piloto.json)

## 1. Importar
1. n8n → **Workflows** → **Import from File**
2. Selecciona `carwash-whatsapp-piloto.json`
3. No actives todavía

## 2. Credentials a crear en n8n

| Nombre sugerido | Tipo | Valor |
|-----------------|------|--------|
| **CarWash API** | Header Auth | Name: `x-api-key` · Value: `N8N_API_KEY` de Railway (servicio `api`) |
| **OpenAI** | OpenAI | Tu API key |
| **Twilio Basic** | Basic Auth | User: Account SID · Password: Auth Token |
| **Stripe Secret** | Header Auth | Name: `Authorization` · Value: `Bearer sk_test_...` |

Luego, en cada nodo HTTP que falle por credential, elige la credential correcta.

## 3. Editar nodos Config
Nodos **Config WA** y **Config Stripe**:
- `API_BASE` = `https://api-production-675c4.up.railway.app`
- `TWILIO_FROM` = `whatsapp:+TU_NUMERO_TWILIO`
- `TWILIO_ACCOUNT_SID` = `ACxxxx...`

## 4. Activar y copiar webhooks
Activa el workflow. Copia:

| Webhook path | Uso |
|--------------|-----|
| `.../webhook/carwash-whatsapp` | Twilio → WhatsApp sandbox/número → When a message comes in |
| `.../webhook/carwash-stripe` | Stripe → Events: `checkout.session.completed` |

## 5. Probar
1. Actualiza `WHATSAPP_START_URL` en Railway
2. Alta de 1 lavador (API):

```bash
curl -X POST https://api-production-675c4.up.railway.app/v1/washers \
  -H "x-api-key: TU_N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Juan","waPhone":"+5215550009999","lat":20.68,"lng":-103.35}'
```

3. Escribe al WhatsApp del negocio y sigue el flujo

## Qué hace el workflow
- Recibe mensaje Twilio → crea/retoma pedido en la API
- OpenAI actúa como agente (JSON de respuesta + patch/actions)
- Actualiza pedido, genera imagen del auto, crea Checkout Stripe, encuesta
- Webhook Stripe → marca pagado → asigna lavador → avisa cliente y lavador
