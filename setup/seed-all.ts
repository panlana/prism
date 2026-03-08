import { seedDemoData } from "./seed-demo.js";
import { seedReferenceData } from "./seed-reference.js";
import { seedContextBlocks } from "./seed-context-blocks.js";
import { disconnectPrisma } from "./seed-utils.js";

async function main() {
  await seedReferenceData();
  await seedContextBlocks();
  await seedDemoData();
}

main()
  .then(async () => {
    await disconnectPrisma();
    console.log("Seeded PRISM reference and demo data.");
  })
  .catch(async (error) => {
    console.error("Seeding failed", error);
    await disconnectPrisma();
    process.exit(1);
  });
