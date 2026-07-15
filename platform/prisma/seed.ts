import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.pricingTier.count({ where: { companyId: null } });
  if (existing > 0) {
    console.log("Grille tarifaire par défaut déjà initialisée, rien à faire.");
    return;
  }

  await prisma.pricingTier.createMany({
    data: [
      { minVolume: 1, maxVolume: 20, unitPriceCents: 500 },
      { minVolume: 21, maxVolume: 50, unitPriceCents: 400 },
      { minVolume: 51, maxVolume: 150, unitPriceCents: 300 },
      { minVolume: 151, maxVolume: null, unitPriceCents: 200 },
    ],
  });

  console.log("Grille tarifaire par défaut créée.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
