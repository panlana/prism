import { prisma } from "../lib/db.js";
import { chatCompletion, type ContentPart } from "./gateway.js";

// ---------------------------------------------------------------------------
// Standardized extraction schema
// ---------------------------------------------------------------------------

export interface DecPageExtraction {
  carrierName: string | null;
  policyNumber: string | null;
  namedInsureds: string[];
  effectiveDate: string | null; // YYYY-MM-DD
  expirationDate: string | null; // YYYY-MM-DD
  premium: string | null; // numeric string
  deductible: string | null; // numeric string
  policyFormCode: string | null; // e.g. "HO-3", "FORM 3"
  mailingAddress: {
    name: string | null;
    street: string | null;
    city: string | null;
    stateCode: string | null;
    postalCode: string | null;
  } | null;
  propertyAddress: {
    street: string | null;
    city: string | null;
    stateCode: string | null;
    postalCode: string | null;
    county: string | null;
  } | null;
  coverages: DecCoverageItem[];
  forms: string[];
  agentName: string | null;
  agencyName: string | null;
  mortgagee: string | null;
  rawNotes: string | null; // anything the AI thinks is notable but doesn't fit above
}

export interface DecCoverageItem {
  label: string;
  limit: string | null;
  premium: string | null;
  deductible: string | null;
}

// ---------------------------------------------------------------------------
// Extraction options
// ---------------------------------------------------------------------------

export interface ExtractionOptions {
  /** Base64-encoded page images (data URI or raw base64) */
  pageImages: string[];
  /** Carrier name if known (used to look up hints) */
  carrierName?: string | undefined;
  /** State code if known */
  stateCode?: string | undefined;
  /** Policy type code if known (e.g. HOMEOWNERS) */
  policyTypeCode?: string | undefined;
  /** Explicit hints override (skips DB lookup) */
  hints?: string | undefined;
  /** Usage tracking context */
  agencyId?: string | undefined;
  userId?: string | undefined;
}

// ---------------------------------------------------------------------------
// Hint lookup
// ---------------------------------------------------------------------------

async function lookupHints(
  carrierName?: string,
  stateCode?: string,
  policyTypeCode?: string,
): Promise<string | null> {
  if (!carrierName) return null;

  // Find carrier by name or slug
  const carrier = await prisma.carrier.findFirst({
    where: {
      OR: [
        { name: { contains: carrierName, mode: "insensitive" } },
        { slug: { contains: carrierName.toLowerCase().replace(/\s+/g, "-") } },
      ],
    },
  });
  if (!carrier) return null;

  // Build filter for offering
  const where: Record<string, unknown> = {
    carrierId: carrier.id,
    decExtractionHints: { not: null },
  };

  if (stateCode) {
    const state = await prisma.state.findUnique({ where: { code: stateCode } });
    if (state) where.stateId = state.id;
  }

  if (policyTypeCode) {
    const policyType = await prisma.policyType.findUnique({ where: { code: policyTypeCode } });
    if (policyType) where.policyTypeId = policyType.id;
  }

  const offering = await prisma.carrierPolicyOffering.findFirst({ where });

  return offering?.decExtractionHints ?? null;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function buildExtractionPrompt(hints: string | null): string {
  const sections: string[] = [
    `You are an insurance declaration page data extractor. You will be given one or more page images from an insurance declaration page (dec page). Extract all structured data you can find into the JSON format specified below.`,
    "",
    "## Output Format",
    "Return ONLY a valid JSON object matching this schema — no markdown fences, no commentary:",
    "",
    JSON.stringify(
      {
        carrierName: "string | null",
        policyNumber: "string | null",
        namedInsureds: ["string"],
        effectiveDate: "YYYY-MM-DD | null",
        expirationDate: "YYYY-MM-DD | null",
        premium: "numeric string | null",
        deductible: "numeric string | null",
        policyFormCode: "string | null (e.g. HO-3, DP-3, HO-6)",
        mailingAddress: {
          name: "string | null",
          street: "string | null",
          city: "string | null",
          stateCode: "string | null",
          postalCode: "string | null",
        },
        propertyAddress: {
          street: "string | null",
          city: "string | null",
          stateCode: "string | null",
          postalCode: "string | null",
          county: "string | null",
        },
        coverages: [
          {
            label: "string",
            limit: "string | null",
            premium: "string | null",
            deductible: "string | null",
          },
        ],
        forms: ["string — form number and edition, e.g. 'HO 00 03 05 11'"],
        agentName: "string | null",
        agencyName: "string | null",
        mortgagee: "string | null",
        rawNotes: "string | null",
      },
      null,
      2,
    ),
    "",
    "## Rules",
    "- Extract ALL named insureds, even if there are multiple.",
    "- For dates, convert to YYYY-MM-DD format regardless of input format.",
    "- For premium and deductible, provide the numeric value without $ or commas.",
    "- For coverages, include every line item you can find (Coverage A, B, C, D, E, F, etc.).",
    "- For forms, include every form number listed on the dec page.",
    "- If the mailing address and property address are the same, still populate both.",
    "- If a field is not present or unreadable, use null.",
    "- The policyFormCode should identify the base policy form (e.g. HO-3 Special, HO-5 Comprehensive). Look for references to 'Policy Form', 'Form', or standard ISO form numbers.",
    "- Do NOT include any text before or after the JSON object.",
  ];

  if (hints) {
    sections.push(
      "",
      "## Carrier-Specific Guidance",
      hints,
    );
  }

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Main extraction function
// ---------------------------------------------------------------------------

export async function extractDeclarationPage(
  options: ExtractionOptions,
): Promise<DecPageExtraction> {
  if (options.pageImages.length === 0) {
    throw new Error("At least one page image is required.");
  }

  // Look up carrier-specific hints
  const hints =
    options.hints ??
    (await lookupHints(options.carrierName, options.stateCode, options.policyTypeCode));

  const systemPrompt = buildExtractionPrompt(hints);

  // Build content parts: text instruction + page images
  const contentParts: ContentPart[] = [
    {
      type: "text",
      text: "Extract all data from the following insurance declaration page image(s).",
    },
  ];

  for (const pageImage of options.pageImages) {
    let imageUrl = pageImage;
    // If raw base64 without data URI prefix, add one (assume PNG)
    if (!imageUrl.startsWith("data:")) {
      imageUrl = `data:image/png;base64,${imageUrl}`;
    }

    contentParts.push({
      type: "image_url",
      image_url: { url: imageUrl, detail: "high" },
    });
  }

  const result = await chatCompletion({
    model: "anthropic/claude-sonnet-4-20250514",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contentParts },
    ],
    temperature: 0.1,
    maxTokens: 4096,
    usageContext: {
      operation: "dec_extraction",
      surface: "extraction_pipeline",
      agencyId: options.agencyId,
      userId: options.userId,
    },
  });

  // Parse the JSON response
  let parsed: DecPageExtraction;
  try {
    // Strip any markdown code fences the model might add despite instructions
    let text = result.content.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    parsed = JSON.parse(text) as DecPageExtraction;
  } catch {
    throw new Error(
      `Failed to parse extraction result as JSON. Raw response: ${result.content.slice(0, 500)}`,
    );
  }

  // Normalize: ensure arrays exist
  parsed.namedInsureds = parsed.namedInsureds ?? [];
  parsed.coverages = parsed.coverages ?? [];
  parsed.forms = parsed.forms ?? [];

  return parsed;
}
