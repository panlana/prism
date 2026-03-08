/**
 * Ad-hoc database query helper.
 *
 * Usage:
 *   npx tsx scripts/query.ts <model> [where-json]
 *
 * Examples:
 *   npx tsx scripts/query.ts CoverageDefinition
 *   npx tsx scripts/query.ts CoverageDefinition '{"kind":"EXCLUSION"}'
 *   npx tsx scripts/query.ts OfferingFormSection '{"sectionType":"definition"}' --select id,title,sectionType
 *   npx tsx scripts/query.ts CarrierPolicyOffering --include forms
 *   npx tsx scripts/query.ts CoverageDefinition --count
 *   npx tsx scripts/query.ts CoverageDefinition '{"kind":"COVERAGE"}' --first
 *   npx tsx scripts/query.ts --raw 'SELECT DISTINCT "sectionType" FROM "OfferingFormSection"'
 *   npx tsx scripts/query.ts CoverageDefinition --take 5
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function printHelp() {
  console.log(`
Usage: npx tsx scripts/query.ts <model> [where-json] [flags]

Flags:
  --select field1,field2    Select specific fields
  --include rel1,rel2       Include relations
  --take N                  Limit results
  --skip N                  Skip results
  --orderBy field:dir       Order by field (e.g. name:asc, createdAt:desc)
  --count                   Return count instead of rows
  --first                   Return first match only
  --raw 'SQL'               Run raw SQL instead (no model needed)

Examples:
  npx tsx scripts/query.ts CoverageDefinition
  npx tsx scripts/query.ts CoverageDefinition '{"kind":"EXCLUSION"}'
  npx tsx scripts/query.ts OfferingFormSection --select id,title,sectionType --take 10
  npx tsx scripts/query.ts --raw 'SELECT COUNT(*) FROM "CoverageDefinition"'
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  // Raw SQL mode
  const rawIdx = args.indexOf("--raw");
  if (rawIdx !== -1) {
    const sql = args[rawIdx + 1];
    if (!sql) {
      console.error("--raw requires a SQL string");
      process.exit(1);
    }
    const result = await prisma.$queryRawUnsafe(sql);
    console.log(JSON.stringify(result, replacer, 2));
    return;
  }

  const modelName = args[0]!;

  // Prisma client uses camelCase delegate names
  const delegateKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const delegate = (prisma as Record<string, unknown>)[delegateKey];
  if (!delegate || typeof delegate !== "object") {
    console.error(`Unknown model: ${modelName}`);
    console.error(
      "Available models:",
      Object.keys(prisma)
        .filter((k) => !k.startsWith("$") && !k.startsWith("_"))
        .join(", ")
    );
    process.exit(1);
  }

  // Parse where clause (positional JSON arg)
  let where: Record<string, unknown> | undefined;
  if (args[1] && !args[1]!.startsWith("--")) {
    try {
      where = JSON.parse(args[1]!) as Record<string, unknown>;
    } catch {
      console.error(`Invalid JSON for where clause: ${args[1]}`);
      process.exit(1);
    }
  }

  // Parse flags
  const query: Record<string, unknown> = {};
  if (where) query.where = where;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;
    const next = args[i + 1];

    if (arg === "--select" && next) {
      const fields: Record<string, boolean> = {};
      for (const f of next.split(",")) fields[f.trim()] = true;
      query.select = fields;
      i++;
    } else if (arg === "--include" && next) {
      const rels: Record<string, boolean> = {};
      for (const r of next.split(",")) rels[r.trim()] = true;
      query.include = rels;
      i++;
    } else if (arg === "--take" && next) {
      query.take = parseInt(next, 10);
      i++;
    } else if (arg === "--skip" && next) {
      query.skip = parseInt(next, 10);
      i++;
    } else if (arg === "--orderBy" && next) {
      const [field, dir] = next.split(":");
      query.orderBy = { [field!]: dir ?? "asc" };
      i++;
    }
  }

  const isCount = args.includes("--count");
  const isFirst = args.includes("--first");

  let result: unknown;
  if (isCount) {
    result = await (delegate as any).count(where ? { where } : undefined);
  } else if (isFirst) {
    result = await (delegate as any).findFirst(query);
  } else {
    result = await (delegate as any).findMany(query);
  }

  if (isCount) {
    console.log(result);
  } else if (Array.isArray(result)) {
    console.log(`${result.length} row(s)\n`);
    console.log(JSON.stringify(result, replacer, 2));
  } else {
    console.log(JSON.stringify(result, replacer, 2));
  }
}

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
