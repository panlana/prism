import { prisma } from "./seed-utils.js";
async function main() {
  const carriers = await prisma.carrier.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } });
  for (const c of carriers) console.log(`${c.slug} -> ${c.name}`);
  const offerings = await prisma.carrierPolicyOffering.findMany({ include: { carrier: true, state: true, policyType: true } });
  console.log("\nOfferings:");
  for (const o of offerings) console.log(`  ${o.carrier.name} / ${o.state.code} / ${o.policyType.code} (hints: ${o.decExtractionHints ? 'YES' : 'no'})`);
  await prisma.$disconnect();
}
main();
