import { Router } from 'express';
import { OrderStatus, SurveyScore } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './prisma';
import { requireN8nApiKey } from './auth';
import { haversineKm, pointInPolygon } from './coverage';

export const api = Router();

api.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'workflow-carwash' });
});

api.get('/public/config', (_req, res) => {
  res.json({
    whatsappStartUrl: process.env.WHATSAPP_START_URL || null,
    publicBaseUrl: process.env.PUBLIC_BASE_URL || null,
  });
});

api.use('/v1', requireN8nApiKey);

api.get('/v1/services', async (_req, res) => {
  const services = await prisma.service.findMany({
    where: { active: true },
    orderBy: { priceCents: 'asc' },
  });
  res.json(services);
});

const createOrderSchema = z.object({
  waPhone: z.string().min(8),
  displayName: z.string().optional(),
});

api.post('/v1/orders', async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const customer = await prisma.customer.upsert({
    where: { waPhone: parsed.data.waPhone },
    create: {
      waPhone: parsed.data.waPhone,
      displayName: parsed.data.displayName,
    },
    update: {
      displayName: parsed.data.displayName ?? undefined,
    },
  });

  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      status: OrderStatus.NEW,
      events: {
        create: { type: 'order.created', payload: { waPhone: customer.waPhone } },
      },
    },
    include: { customer: true, service: true },
  });

  const base = process.env.PUBLIC_BASE_URL || '';
  return res.status(201).json({
    ...order,
    locateUrl: `${base}/locate/${order.publicToken}`,
  });
});

api.get('/v1/orders/:id', async (req, res) => {
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: req.params.id }, { publicToken: req.params.id }],
    },
    include: {
      customer: true,
      service: true,
      washer: true,
      media: true,
      survey: true,
      events: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const base = process.env.PUBLIC_BASE_URL || '';
  return res.json({ ...order, locateUrl: `${base}/locate/${order.publicToken}` });
});

const patchOrderSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  serviceCode: z.string().optional(),
  coverageOk: z.boolean().optional(),
  paymentAccepted: z.boolean().optional(),
  plateLast3: z.string().min(3).max(3).optional(),
  carBrand: z.string().optional(),
  carModel: z.string().optional(),
  carYear: z.number().int().min(1980).max(2100).optional(),
  carColor: z.string().optional(),
  carConfirmed: z.boolean().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  locationAddress: z.string().optional(),
  stripeSessionId: z.string().optional(),
  stripePaymentId: z.string().optional(),
  washerId: z.string().optional(),
  notes: z.string().optional(),
  eventType: z.string().optional(),
  eventPayload: z.record(z.any()).optional(),
});

api.patch('/v1/orders/:id', async (req, res) => {
  const parsed = patchOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const existing = await prisma.order.findFirst({
    where: { OR: [{ id: req.params.id }, { publicToken: req.params.id }] },
  });
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  let serviceId = existing.serviceId;
  if (parsed.data.serviceCode) {
    const service = await prisma.service.findUnique({ where: { code: parsed.data.serviceCode } });
    if (!service) return res.status(400).json({ error: 'Invalid serviceCode' });
    serviceId = service.id;
  }

  const data: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.status !== undefined) data.status = d.status;
  if (serviceId) data.serviceId = serviceId;
  if (d.coverageOk !== undefined) data.coverageOk = d.coverageOk;
  if (d.paymentAccepted !== undefined) data.paymentAccepted = d.paymentAccepted;
  if (d.plateLast3 !== undefined) data.plateLast3 = d.plateLast3;
  if (d.carBrand !== undefined) data.carBrand = d.carBrand;
  if (d.carModel !== undefined) data.carModel = d.carModel;
  if (d.carYear !== undefined) data.carYear = d.carYear;
  if (d.carColor !== undefined) data.carColor = d.carColor;
  if (d.carConfirmed !== undefined) data.carConfirmed = d.carConfirmed;
  if (d.lat !== undefined) data.lat = d.lat;
  if (d.lng !== undefined) data.lng = d.lng;
  if (d.locationAddress !== undefined) data.locationAddress = d.locationAddress;
  if (d.stripeSessionId !== undefined) data.stripeSessionId = d.stripeSessionId;
  if (d.stripePaymentId !== undefined) data.stripePaymentId = d.stripePaymentId;
  if (d.washerId !== undefined) data.washerId = d.washerId;
  if (d.notes !== undefined) data.notes = d.notes;

  if (d.status === OrderStatus.PAID) data.paidAt = new Date();
  if (d.status === OrderStatus.ASSIGNED) data.assignedAt = new Date();
  if (d.status === OrderStatus.FOUND) data.foundAt = new Date();
  if (d.status === OrderStatus.WASHING) data.washingAt = new Date();
  if (d.status === OrderStatus.DONE) data.doneAt = new Date();
  if (d.status === OrderStatus.LOCATION_SET) {
    // keep
  }

  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      ...data,
      events: d.eventType
        ? {
            create: {
              type: d.eventType,
              payload: d.eventPayload ?? {},
            },
          }
        : undefined,
    },
    include: { customer: true, service: true, washer: true, media: true },
  });

  return res.json(order);
});

api.post('/v1/orders/:id/mark-paid', async (req, res) => {
  const body = z
    .object({
      stripeSessionId: z.string().optional(),
      stripePaymentId: z.string().optional(),
    })
    .safeParse(req.body || {});
  if (!body.success) return res.status(400).json(body.error.flatten());

  const existing = await prisma.order.findFirst({
    where: { OR: [{ id: req.params.id }, { publicToken: req.params.id }] },
  });
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      status: OrderStatus.PAID,
      paidAt: new Date(),
      stripeSessionId: body.data.stripeSessionId,
      stripePaymentId: body.data.stripePaymentId,
      events: {
        create: {
          type: 'payment.confirmed',
          payload: body.data,
        },
      },
    },
    include: { customer: true, service: true },
  });

  return res.json(order);
});

api.post('/v1/orders/:id/media', async (req, res) => {
  const body = z
    .object({
      kind: z.string(),
      url: z.string().url(),
      meta: z.record(z.any()).optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json(body.error.flatten());

  const existing = await prisma.order.findFirst({
    where: { OR: [{ id: req.params.id }, { publicToken: req.params.id }] },
  });
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  const media = await prisma.orderMedia.create({
    data: {
      orderId: existing.id,
      kind: body.data.kind,
      url: body.data.url,
      meta: body.data.meta,
    },
  });
  await prisma.orderEvent.create({
    data: {
      orderId: existing.id,
      type: 'media.added',
      payload: { kind: body.data.kind, url: body.data.url },
    },
  });
  return res.status(201).json(media);
});

api.post('/v1/orders/:id/survey', async (req, res) => {
  const body = z
    .object({
      score: z.nativeEnum(SurveyScore),
      comment: z.string().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json(body.error.flatten());

  const existing = await prisma.order.findFirst({
    where: { OR: [{ id: req.params.id }, { publicToken: req.params.id }] },
  });
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  const survey = await prisma.survey.upsert({
    where: { orderId: existing.id },
    create: {
      orderId: existing.id,
      score: body.data.score,
      comment: body.data.comment,
    },
    update: {
      score: body.data.score,
      comment: body.data.comment,
    },
  });

  await prisma.order.update({
    where: { id: existing.id },
    data: {
      status: OrderStatus.SURVEYED,
      events: {
        create: { type: 'survey.submitted', payload: body.data },
      },
    },
  });

  return res.json(survey);
});

api.post('/v1/coverage/check', async (req, res) => {
  const body = z
    .object({ lat: z.number(), lng: z.number() })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json(body.error.flatten());

  const zones = await prisma.coverageZone.findMany({ where: { active: true } });
  const matches = zones.filter((z) => {
    const polygon = z.polygon as number[][];
    return Array.isArray(polygon) && pointInPolygon(body.data, polygon);
  });

  return res.json({
    inCoverage: matches.length > 0,
    zones: matches.map((z) => ({ id: z.id, name: z.name })),
  });
});

api.post('/v1/washers', async (req, res) => {
  const body = z
    .object({
      name: z.string(),
      waPhone: z.string(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      active: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json(body.error.flatten());

  const washer = await prisma.washer.upsert({
    where: { waPhone: body.data.waPhone },
    create: body.data,
    update: {
      name: body.data.name,
      lat: body.data.lat,
      lng: body.data.lng,
      active: body.data.active ?? true,
    },
  });
  return res.status(201).json(washer);
});

api.get('/v1/washers', async (_req, res) => {
  const washers = await prisma.washer.findMany({ where: { active: true } });
  res.json(washers);
});

api.post('/v1/orders/:id/assign-nearest', async (req, res) => {
  const existing = await prisma.order.findFirst({
    where: { OR: [{ id: req.params.id }, { publicToken: req.params.id }] },
  });
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  if (existing.lat == null || existing.lng == null) {
    return res.status(400).json({ error: 'Order has no location' });
  }

  const washers = await prisma.washer.findMany({ where: { active: true } });
  if (washers.length === 0) return res.status(404).json({ error: 'No washers available' });

  const ranked = washers
    .map((w) => ({
      washer: w,
      distanceKm:
        w.lat != null && w.lng != null
          ? haversineKm({ lat: existing.lat!, lng: existing.lng! }, { lat: w.lat, lng: w.lng })
          : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const best = ranked[0];
  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      washerId: best.washer.id,
      status: OrderStatus.ASSIGNED,
      assignedAt: new Date(),
      events: {
        create: {
          type: 'washer.assigned',
          payload: {
            washerId: best.washer.id,
            distanceKm: Number.isFinite(best.distanceKm) ? best.distanceKm : null,
          },
        },
      },
    },
    include: { washer: true, customer: true, service: true },
  });

  return res.json({
    order,
    distanceKm: Number.isFinite(best.distanceKm) ? best.distanceKm : null,
  });
});

api.post('/v1/coverage-zones', async (req, res) => {
  const body = z
    .object({
      name: z.string(),
      polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
      active: z.boolean().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json(body.error.flatten());

  const zone = await prisma.coverageZone.create({
    data: {
      name: body.data.name,
      polygon: body.data.polygon,
      active: body.data.active ?? true,
    },
  });
  return res.status(201).json(zone);
});

/** Public endpoints for the map page (token-gated, no API key) */
api.get('/public/orders/:token', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { publicToken: req.params.token },
    select: {
      publicToken: true,
      status: true,
      lat: true,
      lng: true,
      locationAddress: true,
      plateLast3: true,
      carBrand: true,
      carModel: true,
      carColor: true,
    },
  });
  if (!order) return res.status(404).json({ error: 'Not found' });
  return res.json(order);
});

api.post('/public/orders/:token/location', async (req, res) => {
  const body = z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      locationAddress: z.string().optional(),
    })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json(body.error.flatten());

  const existing = await prisma.order.findUnique({
    where: { publicToken: req.params.token },
  });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const zones = await prisma.coverageZone.findMany({ where: { active: true } });
  const inCoverage = zones.some((z) =>
    pointInPolygon(body.data, z.polygon as number[][]),
  );

  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      lat: body.data.lat,
      lng: body.data.lng,
      locationAddress: body.data.locationAddress,
      coverageOk: inCoverage,
      status: OrderStatus.LOCATION_SET,
      events: {
        create: {
          type: 'location.set',
          payload: { ...body.data, inCoverage },
        },
      },
    },
    select: {
      publicToken: true,
      status: true,
      lat: true,
      lng: true,
      coverageOk: true,
    },
  });

  return res.json(order);
});
