import { prisma } from './prisma';

/** Default pilot zone: small box around Guadalajara Centro (replace for real pilot). */
const DEFAULT_ZONE = {
  name: 'Piloto ZMG Centro',
  polygon: [
    [-103.365, 20.665],
    [-103.33, 20.665],
    [-103.33, 20.69],
    [-103.365, 20.69],
    [-103.365, 20.665],
  ],
};

export async function ensureSeedData() {
  const services = [
    {
      code: 'basic',
      name: 'Lavado básico',
      description: 'Exterior rápido en calle',
      priceCents: 19900,
    },
    {
      code: 'premium',
      name: 'Lavado premium',
      description: 'Exterior + interiores básicos',
      priceCents: 29900,
    },
    {
      code: 'detail',
      name: 'Detail express',
      description: 'Lavado + aspirado + silicón',
      priceCents: 39900,
    },
  ];

  for (const s of services) {
    await prisma.service.upsert({
      where: { code: s.code },
      create: s,
      update: {
        name: s.name,
        description: s.description,
        priceCents: s.priceCents,
        active: true,
      },
    });
  }

  const zones = await prisma.coverageZone.count();
  if (zones === 0) {
    await prisma.coverageZone.create({
      data: {
        name: DEFAULT_ZONE.name,
        polygon: DEFAULT_ZONE.polygon,
        active: true,
      },
    });
  }
}
