/**
 * Import extracted carrier form text into the database.
 *
 * Reads .txt files produced by extract_forms.py, parses metadata and sections,
 * creates Carrier → Offering → Forms → Sections, and maps endorsements to
 * canonical coverage definitions where possible.
 *
 * Usage:
 *   npx tsx scripts/import-carrier-forms.ts \
 *     --extracted-dir ../../docs/Prism/extracted/travelers/va/homeowners \
 *     --carrier "Travelers" --carrier-slug travelers \
 *     --state VA --policy-type homeowners \
 *     --policy-dir Policy --endorsement-dir Coverages
 *
 * The --policy-dir and --endorsement-dir flags reference the original source
 * folders so we can classify base policy vs endorsement. If omitted, the
 * script uses heuristics.
 */

import { PrismaClient, OfferingFormKind } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  return {
    extractedDir: get("--extracted-dir") ?? "",
    carrier: get("--carrier") ?? "",
    carrierSlug: get("--carrier-slug") ?? "",
    state: get("--state") ?? "",
    policyType: get("--policy-type") ?? "",
    policyDir: get("--policy-dir"),
    endorsementDir: get("--endorsement-dir"),
    policySrcDir: get("--policy-src-dir"),
    endorsementSrcDir: get("--endorsement-src-dir"),
    dryRun: args.includes("--dry-run"),
  };
}

// ---------------------------------------------------------------------------
// Text parsing helpers
// ---------------------------------------------------------------------------

interface ParsedFormMeta {
  filename: string;
  formCode: string;
  title: string;
  editionDate: string | null;
  kind: OfferingFormKind;
  isBasePolicy: boolean;
  fullText: string;
}

interface ParsedSection {
  sectionRef: string | null;
  title: string;
  sectionType: string;
  content: string;
  sortOrder: number;
  children: ParsedSection[];
}

/** Extract form code from first line, e.g. "HQ-P03 VA (04-23)" → "HQ-P03 VA 04 23" */
function parseFormCode(firstLine: string): string {
  // Normalize: remove dashes within code, clean up parens
  let code = firstLine.trim();
  // Extract edition date in parens
  code = code.replace(/\((\d{2})-(\d{2})\)/, "$1 $2");
  // Remove copyright lines
  if (code.includes("©")) return "";
  return code.trim();
}

/** Extract edition date from form code line, e.g. "(04-23)" → "2023-04" */
function parseEditionDate(firstLine: string): string | null {
  const match = firstLine.match(/\((\d{2})-(\d{2})\)/);
  if (!match) return null;
  const [, mm, yy] = match;
  const year = parseInt(yy!, 10);
  const fullYear = year >= 50 ? 1900 + year : 2000 + year;
  return `${fullYear}-${mm}`;
}

/** Extract title from lines 2+ (before "This Endorsement Changes" line) */
function parseTitle(lines: string[]): string {
  const titleLines: string[] = [];
  for (let i = 1; i < Math.min(lines.length, 8); i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    if (line.startsWith("This Endorsement Changes") || line.startsWith("This endorsement changes")) break;
    if (line.startsWith("©")) break;
    // Stop at content (mixed case long lines suggest we're past the title)
    if (line.length > 80 && /[a-z]/.test(line)) break;
    // Stop at numbered items or content patterns
    if (/^\d+\.\s/.test(line)) break;
    if (/^[a-z]\./.test(line)) break;
    titleLines.push(line);
    // For base policy forms, cap at 3 title lines max
    if (titleLines.length >= 3) break;
  }
  let title = titleLines.join(" — ") || "Untitled";
  // Clean common boilerplate from titles
  title = title
    .replace(/Page\s+\d+\s+of\s+\d+\s*/gi, "")
    .replace(/--\s*PLEASE READ THIS CAREFULLY\s*--/gi, "")
    .replace(/THIS ENDORSEMENT CHANGES THE POLICY\.\s*PLEASE READ IT CAREFULLY\.\s*/gi, "")
    .replace(/the policy\s*—?\s*/gi, "")
    .replace(/\s*—\s*—\s*/g, " — ")
    .replace(/^\s*—\s*/, "")
    .replace(/\s*—\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return title || "Untitled";
}

/** Classify section type from header text */
function classifySectionType(header: string): string {
  const h = header.toLowerCase();
  if (/\bdefinition/.test(h)) return "definitions";
  if (/\bexclusion/.test(h)) return "exclusion";
  if (/\bcondition/.test(h)) return "condition";
  if (/\bperil/.test(h)) return "peril";
  if (/\bdeductible/.test(h)) return "deductible";
  if (/\bagreement/.test(h)) return "agreement";
  if (/\badditional coverage/.test(h) || /\badditional protection/.test(h)) return "additional_coverage";
  if (/\bloss.?settlement/.test(h) || /\bloss.?payment/.test(h)) return "loss_settlement";
  if (/\bgeneral provision/.test(h)) return "general_provision";
  if (/\bschedule/.test(h)) return "schedule";
  if (/\bcoverage\b/.test(h)) return "coverage";
  if (/\bliability\b/.test(h)) return "coverage";
  if (/\bproperty coverage/.test(h)) return "coverage";
  return "other";
}

/** Check if a line is an ALL-CAPS section header */
function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 4) return false;
  // Must be mostly uppercase and not a footer/watermark
  if (/©/.test(trimmed)) return false;
  if (/^Page\s/.test(trimmed)) return false;
  // All caps or nearly all caps (allowing numbers, dashes, etc.)
  const letters = trimmed.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 3) return false;
  const uppers = letters.replace(/[^A-Z]/g, "").length;
  return uppers / letters.length > 0.85 && trimmed.length < 120;
}

/** Parse sections from form text */
function parseSections(text: string): ParsedSection[] {
  const lines = text.split("\n");
  const sections: ParsedSection[] = [];
  let currentHeader = "";
  let currentContent: string[] = [];
  let order = 0;

  // Skip first few lines (form code, title, "This Endorsement Changes...")
  let startLine = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i]!.trim();
    if (line.startsWith("This Endorsement Changes") || line.startsWith("This endorsement changes")) {
      startLine = i + 1;
      break;
    }
  }
  if (startLine === 0) {
    // For base policy forms, skip after title
    startLine = 2;
  }

  function flushSection() {
    if (currentHeader || currentContent.length > 0) {
      const content = currentContent.join("\n").trim();
      if (content || currentHeader) {
        order++;
        sections.push({
          sectionRef: null,
          title: currentHeader || `Section ${order}`,
          sectionType: classifySectionType(currentHeader),
          content,
          sortOrder: order,
          children: [],
        });
      }
    }
    currentContent = [];
  }

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Skip page footers
    if (/^HQ-?\w+\s+\w+\s+\(\d{2}-\d{2}\)\s+Page/.test(trimmed)) continue;
    if (/^©\s*\d{4}/.test(trimmed)) continue;
    if (/^Includes copyrighted material/.test(trimmed)) continue;
    if (trimmed === "") {
      currentContent.push("");
      continue;
    }

    if (isSectionHeader(trimmed) && trimmed.length > 5) {
      // Check if next line is also a header (multi-line header)
      const nextLine = lines[i + 1]?.trim() ?? "";
      if (isSectionHeader(nextLine) && nextLine.length > 5 &&
          !nextLine.startsWith("This Endorsement")) {
        flushSection();
        currentHeader = `${trimmed} — ${nextLine}`;
        i++; // skip next line
        continue;
      }
      flushSection();
      currentHeader = trimmed;
      continue;
    }

    currentContent.push(line);
  }

  flushSection();

  // If no sections were found, create a single section with all content
  if (sections.length === 0 && text.trim().length > 0) {
    const contentStart = lines.slice(startLine).join("\n").trim();
    if (contentStart) {
      sections.push({
        sectionRef: null,
        title: "Full Content",
        sectionType: "other",
        content: contentStart,
        sortOrder: 1,
        children: [],
      });
    }
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Canonical coverage matching
// ---------------------------------------------------------------------------

interface CoverageMatch {
  code: string;
  name: string;
  confidence: "high" | "medium" | "low";
}

const CANONICAL_PATTERNS: Array<{ pattern: RegExp; code: string; name: string }> = [
  { pattern: /water\s*back.?up|sump/i, code: "water_backup", name: "Water Backup & Sump Discharge" },
  { pattern: /earthquake\b.*loss\s*assess/i, code: "earthquake_loss_assessment", name: "Earthquake Loss Assessment" },
  { pattern: /earthquake/i, code: "earthquake", name: "Earthquake Coverage" },
  { pattern: /equipment\s*breakdown/i, code: "equipment_breakdown", name: "Equipment Breakdown Coverage" },
  { pattern: /identity\s*theft|identity\s*fraud/i, code: "identity_theft", name: "Identity Theft Expense Coverage" },
  { pattern: /personal\s*injury/i, code: "personal_injury", name: "Personal Injury Coverage" },
  { pattern: /ordinance\s*(or|&)\s*law/i, code: "ordinance_or_law", name: "Ordinance or Law Coverage" },
  { pattern: /replacement\s*cost.*(content|personal\s*property|belonging)/i, code: "replacement_cost_contents", name: "Replacement Cost — Personal Property" },
  { pattern: /brand\s*new\s*belonging/i, code: "replacement_cost_contents", name: "Replacement Cost — Personal Property" },
  { pattern: /extended\s*dwelling|dwelling\s*replacement\s*cost\s*200/i, code: "extended_dwelling_replacement", name: "Extended Dwelling Replacement Cost" },
  { pattern: /better\s*roof|roof\s*replacement/i, code: "better_roof_replacement", name: "Better Roof Replacement" },
  { pattern: /windstorm|hail\s*deductible/i, code: "windstorm_hail_deductible", name: "Windstorm or Hail Deductible" },
  { pattern: /home\s*protection\s*program/i, code: "home_protection_program", name: "Home Protection Program" },
  { pattern: /protection\s*boost/i, code: "protection_boost", name: "Protection Boost" },
  { pattern: /green\s*home/i, code: "green_home", name: "Green Home Coverage" },
  { pattern: /cyber\s*protection|data\s*protection/i, code: "cyber_protection", name: "Cyber Protection Package" },
  { pattern: /home\s*business/i, code: "home_business", name: "Home Business Coverage" },
  { pattern: /special\s*personal\s*property/i, code: "special_personal_property", name: "Special Personal Property Coverage" },
  { pattern: /service\s*line/i, code: "service_line", name: "Service Line Coverage" },
  { pattern: /animal\s*liability/i, code: "animal_liability", name: "Animal Liability Coverage" },
  { pattern: /assisted\s*living/i, code: "assisted_living", name: "Assisted Living Care Coverage" },
  { pattern: /scheduled\s*personal\s*property/i, code: "scheduled_personal_property", name: "Scheduled Personal Property" },
  { pattern: /loss\s*assess/i, code: "loss_assessment", name: "Loss Assessment Coverage" },
  { pattern: /mold/i, code: "mold", name: "Mold Coverage" },
  { pattern: /valuable\s*items/i, code: "valuable_items_plus", name: "Valuable Items Plus" },
  { pattern: /golf\s*cart/i, code: "golf_cart", name: "Golf Cart Coverage" },
  { pattern: /incidental\s*occupanc/i, code: "permitted_incidental_occupancies", name: "Permitted Incidental Occupancies" },
  { pattern: /unit.?owner/i, code: "unit_owners", name: "Unit-Owners Coverage" },
  { pattern: /inflation\s*protection|inflation\s*guard/i, code: "inflation_protection", name: "Inflation Protection" },
  { pattern: /personal\s*property\s*replacement\s*cost/i, code: "replacement_cost_contents", name: "Replacement Cost — Personal Property" },
  { pattern: /additional\s*replacement\s*cost\s*protection/i, code: "extended_dwelling_replacement", name: "Extended Dwelling Replacement Cost" },
  { pattern: /business\s*pursuits/i, code: "business_pursuits", name: "Business Pursuits Coverage" },
  { pattern: /dwelling\s*under\s*construction/i, code: "dwelling_under_construction", name: "Dwelling Under Construction Coverage" },
  { pattern: /hidden\s*water.*seepage|water.*seepage.*leakage/i, code: "hidden_water_seepage", name: "Hidden Water or Steam Seepage Coverage" },
  { pattern: /special\s*provisions/i, code: "special_provisions_va", name: "Special Provisions — Virginia" },
  { pattern: /other\s*members.*household/i, code: "other_household_members", name: "Other Household Members Coverage" },
  { pattern: /refrigerated\s*property/i, code: "refrigerated_property", name: "Refrigerated Property Coverage" },
  { pattern: /trust\s*coverage/i, code: "trust_coverage", name: "Trust Coverage" },
  { pattern: /matching.*roof\s*surfacing/i, code: "matching_roof", name: "Matching of Undamaged Roof Surfacing" },
  { pattern: /matching.*siding/i, code: "matching_siding", name: "Matching of Undamaged Siding" },
  { pattern: /functional\s*replacement\s*cost/i, code: "functional_replacement_cost", name: "Functional Replacement Cost Loss Settlement" },
  { pattern: /lock\s*replacement/i, code: "lock_replacement", name: "Lock Replacement Coverage" },
  { pattern: /reward\s*coverage/i, code: "reward_coverage", name: "Reward Coverage" },
  { pattern: /business\s*records.*data/i, code: "business_records", name: "Business Records and Data Replacement" },
  { pattern: /land\s*stabilization/i, code: "land_stabilization", name: "Land Stabilization Coverage" },
  { pattern: /buried\s*utility/i, code: "buried_utility_lines", name: "Buried Utility Lines Coverage" },
  { pattern: /home.?sharing\s*host/i, code: "home_sharing", name: "Home-Sharing Host Activities Coverage" },
  { pattern: /decreasing\s*deductible/i, code: "decreasing_deductible", name: "Decreasing Deductible" },
  { pattern: /home\s*settlement\s*benefit/i, code: "home_settlement_benefit", name: "Home Settlement Benefit" },
  { pattern: /snowmobile/i, code: "snowmobile", name: "Owned Snowmobile Coverage" },
  { pattern: /specific\s*structures\s*away/i, code: "specific_structures_away", name: "Specific Structures Away from Residence" },
  { pattern: /additional\s*interests/i, code: "additional_interests", name: "Additional Interests Coverage" },
  { pattern: /building\s*additions.*alterations/i, code: "building_additions_alterations", name: "Building Additions and Alterations Coverage" },
  { pattern: /personal\s*property\s*at\s*other\s*residences/i, code: "personal_property_other_residence", name: "Personal Property at Other Residences — Increased Limit" },
  { pattern: /additional\s*benefits/i, code: "additional_benefits", name: "Additional Benefits" },
  { pattern: /incidental\s*farming|incidental\s*farm\s*coverage/i, code: "incidental_farming_liability", name: "Incidental Farming Personal Liability" },
  { pattern: /sinkhole\s*collapse/i, code: "sinkhole_collapse", name: "Sinkhole Collapse Coverage" },
  { pattern: /structures\s*rented\s*to\s*others/i, code: "structures_rented_to_others", name: "Structures Rented to Others" },
  { pattern: /watercraft\s*liability/i, code: "watercraft_liability", name: "Watercraft Liability" },
  { pattern: /additional\s*insured.*watercraft/i, code: "additional_insured_watercraft", name: "Additional Insured — Watercraft" },
  { pattern: /additional\s*insured/i, code: "additional_insured", name: "Additional Insured" },
  { pattern: /additional\s*residence\s*rented/i, code: "additional_residence_rented", name: "Additional Residence Rented to Others" },
  { pattern: /other\s*structures\s*off\s*premises/i, code: "other_structures_off_premises", name: "Other Structures Off Premises" },
  { pattern: /other\s*structures.*additional\s*limit/i, code: "other_structures_additional", name: "Other Structures — Additional Limit" },
  { pattern: /guaranteed\s*home\s*replacement/i, code: "guaranteed_home_replacement", name: "Guaranteed Home Replacement Cost" },
  { pattern: /increased\s*cost/i, code: "increased_cost", name: "Increased Cost Endorsement" },
  { pattern: /homeowners\s*plus/i, code: "homeowners_plus", name: "Homeowners Plus" },
  { pattern: /personal\s*property\s*loss\s*settlement/i, code: "replacement_cost_contents", name: "Replacement Cost — Personal Property" },
  { pattern: /incidental\s*business/i, code: "incidental_business", name: "Incidental Business Coverage" },
  { pattern: /inland\s*flood/i, code: "inland_flood", name: "Inland Flood Coverage" },
  { pattern: /interior\s*matching/i, code: "interior_matching", name: "Interior Matching Protection" },
  { pattern: /undamaged\s*siding\s*or\s*roofing/i, code: "matching_siding_roofing", name: "Undamaged Siding or Roofing" },
  { pattern: /contractor.?s\s*interest/i, code: "contractors_interest", name: "Contractor's Interest" },
  { pattern: /residence\s*held\s*in\s*trust/i, code: "trust_coverage", name: "Trust Coverage" },
  { pattern: /limited\s*liability\s*company/i, code: "llc_coverage", name: "Limited Liability Company Coverage" },
  { pattern: /limited\s*personal\s*property.*newly\s*acquired/i, code: "limited_pp_new_residence", name: "Limited Personal Property — Newly Acquired Residence" },
  { pattern: /sexual\s*molestation\s*exclusion/i, code: "sexual_molestation_exclusion", name: "Sexual Molestation Exclusion" },
  { pattern: /controlled\s*substance\s*exclusion/i, code: "controlled_substance_exclusion", name: "Controlled Substance Exclusion" },
  { pattern: /beauty\s*parlor|barber\s*shop/i, code: "beauty_barber_liability", name: "Beauty Parlor and Barber Shop Liability" },
  { pattern: /teachers.*professional\s*liability|school\s*administrators/i, code: "teachers_professional_liability", name: "Teachers Professional Liability" },
  { pattern: /medical.*dental.*veterinarian|business\s*personal\s*property/i, code: "medical_dental_vet_property", name: "Medical/Dental/Veterinarian Business Property" },
  { pattern: /policy\s*cancellation|nonrenewal/i, code: "cancellation_nonrenewal", name: "Policy Cancellation and Nonrenewal" },
  { pattern: /central\s*station.*alarm/i, code: "alarm_system", name: "Central Station Alarm System" },
  { pattern: /amendment\s*of\s*deductible/i, code: "deductible_amendment", name: "Amendment of Deductible" },
  { pattern: /adjusted\s*value\s*provision/i, code: "adjusted_value", name: "Adjusted Value Provision" },
  { pattern: /what\s*to\s*do\s*in\s*case\s*of\s*loss/i, code: "loss_notice_amendment", name: "What To Do In Case of Loss" },
  { pattern: /identity\s*recovery|id\s*theft/i, code: "identity_theft", name: "Identity Theft Expense Coverage" },
  { pattern: /hurricane\s*deductible/i, code: "hurricane_deductible", name: "Hurricane Deductible" },
  { pattern: /cosmetic\s*damage\s*exclusion/i, code: "cosmetic_damage_exclusion", name: "Cosmetic Damage Exclusion" },
  { pattern: /roof\s*surfac/i, code: "roof_surface_amendment", name: "Roof Surface Amendment" },
  { pattern: /water\s*damage.*sewer|sewer.*drain/i, code: "water_backup", name: "Water Backup & Sump Discharge" },
  { pattern: /protective\s*device/i, code: "protective_devices", name: "Protective Devices" },
  { pattern: /replacement\s*cost\s*terms|replacement\s*value\s*loss\s*settlement/i, code: "replacement_cost_contents", name: "Replacement Cost — Personal Property" },
  { pattern: /expanded\s*replacement\s*cost/i, code: "extended_dwelling_replacement", name: "Extended Dwelling Replacement Cost" },
  { pattern: /repair\s*cost\s*terms/i, code: "repair_cost", name: "Repair Cost Terms" },
  { pattern: /collision\s*or\s*upset/i, code: "collision_upset", name: "Collision or Upset" },
  { pattern: /secured\s*party/i, code: "secured_party_interest", name: "Secured Party's Interest" },
  { pattern: /farm\s*liability/i, code: "farm_liability", name: "Farm Liability Coverage" },
  { pattern: /farm\s*vehicle\s*extension/i, code: "farm_vehicle_extension", name: "Farm Vehicle Extension" },
  { pattern: /farmette/i, code: "farmette", name: "Farmette Endorsement" },
  { pattern: /employer.?s\s*liability/i, code: "employers_liability", name: "Employer's Liability" },
  { pattern: /incidental\s*property\s*coverage/i, code: "incidental_property_higher_limits", name: "Incidental Property Coverages — Higher Limits" },
  { pattern: /office.*professional.*school|studio\s*occupancy/i, code: "office_professional_occupancy", name: "Office/Professional/School Occupancy" },
  { pattern: /pollution\s*liability\s*exclusion/i, code: "pollution_exclusion", name: "Pollution Liability Exclusion" },
  { pattern: /related\s*private\s*structures/i, code: "other_structures_additional", name: "Other Structures — Additional Limit" },
  { pattern: /additional\s*residential\s*premises\s*rented/i, code: "additional_residence_rented", name: "Additional Residence Rented to Others" },
  { pattern: /business\s*activities/i, code: "incidental_business", name: "Incidental Business Coverage" },
  { pattern: /watercraft\b/i, code: "watercraft_liability", name: "Watercraft Liability" },
  { pattern: /consent\s*to\s*move/i, code: "consent_to_move", name: "Consent to Move Mobile Home" },
  { pattern: /golf\s*cart/i, code: "golf_cart", name: "Golf Cart Coverage" },
  { pattern: /augusta\s*advantage/i, code: "carrier_advantage_bundle", name: "Carrier Advantage Bundle" },
  { pattern: /amendatory\s*endorsement/i, code: "amendatory", name: "Amendatory Endorsement" },
  { pattern: /special\s*endorsement/i, code: "special_endorsement", name: "Special Endorsement" },
  { pattern: /enhanced\s*replacement\s*cost/i, code: "extended_dwelling_replacement", name: "Extended Dwelling Replacement Cost" },
  { pattern: /guaranteed\s*replacement\s*cost/i, code: "guaranteed_home_replacement", name: "Guaranteed Home Replacement Cost" },
  { pattern: /water\s*damage\s*coverage/i, code: "water_backup", name: "Water Backup & Sump Discharge" },
  { pattern: /named\s*storm.*deductible/i, code: "named_storm_deductible", name: "Named Storm Deductible" },
  { pattern: /canine\s*liability\s*exclusion/i, code: "canine_exclusion", name: "Canine Liability Exclusion" },
  { pattern: /personal\s*articles/i, code: "scheduled_personal_property", name: "Scheduled Personal Property" },
  { pattern: /preferred\s*primary\s*flood|excess\s*flood/i, code: "flood", name: "Flood Coverage" },
  { pattern: /course\s*of\s*construction/i, code: "dwelling_under_construction", name: "Dwelling Under Construction Coverage" },
  { pattern: /rental\s*property\s*coverage/i, code: "structures_rented_to_others", name: "Structures Rented to Others" },
  { pattern: /homeowner\s*plus/i, code: "homeowners_plus", name: "Homeowners Plus" },
  { pattern: /increased\s*assessments/i, code: "loss_assessment", name: "Loss Assessment Coverage" },
  { pattern: /farmer\s*personal\s*liability/i, code: "farm_liability", name: "Farm Liability Coverage" },
  { pattern: /residential\s*business/i, code: "incidental_business", name: "Incidental Business Coverage" },
  { pattern: /farm\s*structures\s*property/i, code: "farm_structures", name: "Farm Structures Property" },
  { pattern: /cosmetology\s*or\s*barber/i, code: "beauty_barber_liability", name: "Beauty Parlor and Barber Shop Liability" },
  { pattern: /accounts\s*receivable/i, code: "accounts_receivable", name: "Accounts Receivable Coverage" },
  { pattern: /landlord.?s\s*furnishings/i, code: "landlord_furnishings", name: "Landlord's Furnishings Coverage" },
  { pattern: /landslide/i, code: "landslide", name: "Landslide Coverage" },
  { pattern: /fine\s*art/i, code: "fine_arts", name: "Fine Arts Coverage" },
  { pattern: /libel.*slander/i, code: "personal_injury", name: "Personal Injury Coverage" },
  { pattern: /large\s*loss\s*deductible\s*waiver/i, code: "deductible_waiver", name: "Large Loss Deductible Waiver" },
  { pattern: /deletion\s*of.*replacement/i, code: "replacement_cost_deletion", name: "Deletion of Replacement Cost" },
  { pattern: /additional\s*dwelling.*rented|additional\s*dwelling.*liability/i, code: "additional_residence_rented", name: "Additional Residence Rented to Others" },
  { pattern: /additional\s*dwelling.*owner\s*occupied/i, code: "additional_dwelling_owner", name: "Additional Dwelling — Owner Occupied" },
  { pattern: /residence\s*premises\s*endorsement.*family/i, code: "multi_family_dwelling", name: "Multi-Family Dwelling" },
  { pattern: /limitation.*business\s*premises/i, code: "business_premises_limitation", name: "Limitation of Coverage to Business Premises" },
  { pattern: /products.?completed\s*operations/i, code: "products_completed_ops_exclusion", name: "Products-Completed Operations Exclusion" },
  { pattern: /other\s*structures.*specific\s*coverage/i, code: "other_structures_additional", name: "Other Structures — Additional Limit" },
  { pattern: /specific\s*structures.*away/i, code: "specific_structures_away", name: "Specific Structures Away from Residence" },
  { pattern: /additional\s*interest\b/i, code: "additional_interests", name: "Additional Interests Coverage" },
  { pattern: /mechanical\s*breakdown/i, code: "equipment_breakdown", name: "Equipment Breakdown Coverage" },
  { pattern: /premises\s*alarm|alarm.*fire/i, code: "alarm_system", name: "Central Station Alarm System" },
  { pattern: /specified\s*additional\s*amount/i, code: "increased_cost", name: "Increased Cost Endorsement" },
  { pattern: /insurance\s*to\s*value/i, code: "insurance_to_value", name: "Insurance to Value Requirement" },
  { pattern: /specific\s*other\s*structures/i, code: "other_structures_additional", name: "Other Structures — Additional Limit" },
  { pattern: /increased\s*special\s*limits/i, code: "special_personal_property", name: "Special Personal Property Coverage" },
  { pattern: /personal\s*cyber/i, code: "cyber_protection", name: "Cyber Protection Package" },
];

function matchCanonicalCoverage(title: string): CoverageMatch | null {
  for (const { pattern, code, name } of CANONICAL_PATTERNS) {
    if (pattern.test(title)) {
      return { code, name, confidence: "high" };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Source folder classification
// ---------------------------------------------------------------------------

function classifyFormKind(
  filename: string,
  fullText: string,
  policyFiles: Set<string>,
  endorsementFiles: Set<string>
): { kind: OfferingFormKind; isBasePolicy: boolean } {
  // Check source folder classification (normalized: no extension, lowercase)
  const normalized = filename.replace(/\.[^.]+$/, "").toLowerCase();
  if (policyFiles.has(normalized)) {
    return { kind: "BASE_POLICY" as OfferingFormKind, isBasePolicy: true };
  }
  if (endorsementFiles.has(normalized)) {
    return { kind: "ENDORSEMENT" as OfferingFormKind, isBasePolicy: false };
  }

  // Heuristic fallback
  const lower = fullText.substring(0, 2000).toLowerCase();
  if (/table of contents|this is your/.test(lower)) {
    return { kind: "BASE_POLICY" as OfferingFormKind, isBasePolicy: true };
  }
  if (/this endorsement changes/i.test(lower)) {
    return { kind: "ENDORSEMENT" as OfferingFormKind, isBasePolicy: false };
  }
  return { kind: "OTHER" as OfferingFormKind, isBasePolicy: false };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  if (!opts.extractedDir || !opts.carrier || !opts.state || !opts.policyType) {
    console.error("Required: --extracted-dir, --carrier, --carrier-slug, --state, --policy-type");
    process.exit(1);
  }

  const extractedDir = path.resolve(opts.extractedDir);
  if (!fs.existsSync(extractedDir)) {
    console.error(`Directory not found: ${extractedDir}`);
    process.exit(1);
  }

  // Build source folder file sets for classification
  const policyFiles = new Set<string>();
  const endorsementFiles = new Set<string>();

  // Resolve source directories — prefer explicit --policy-src-dir, fallback to inferred
  let policyPath: string | null = null;
  let endorsementPath: string | null = null;

  if (opts.policySrcDir) {
    policyPath = path.resolve(opts.policySrcDir);
    endorsementPath = opts.endorsementSrcDir ? path.resolve(opts.endorsementSrcDir) : null;
  } else if (opts.policyDir) {
    const baseDocs = extractedDir.replace(/\/extracted\/.*/, "");
    const carrierDir = `${baseDocs}/${opts.carrier.toLowerCase()}/${opts.state}/` +
      `${opts.policyType.charAt(0).toUpperCase() + opts.policyType.slice(1)}`;
    policyPath = `${carrierDir}/${opts.policyDir}`;
    endorsementPath = opts.endorsementDir ? `${carrierDir}/${opts.endorsementDir}` : null;
  }

  /** Normalize filename for comparison: strip extension, lowercase */
  const normalizeFn = (f: string) => f.replace(/\.[^.]+$/, "").toLowerCase();

  if (policyPath && fs.existsSync(policyPath)) {
    for (const f of fs.readdirSync(policyPath)) policyFiles.add(normalizeFn(f));
  }
  if (endorsementPath && fs.existsSync(endorsementPath)) {
    for (const f of fs.readdirSync(endorsementPath)) endorsementFiles.add(normalizeFn(f));
  }

  console.log(`Policy source files: ${policyFiles.size}, Endorsement source files: ${endorsementFiles.size}`);

  // Read manifest
  const manifestPath = path.join(extractedDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("manifest.json not found in extracted dir");
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as {
    forms: Array<{ filename: string; text_file: string; form_type_guess: string }>;
  };

  // Parse all forms
  const parsedForms: ParsedFormMeta[] = [];
  for (const entry of manifest.forms) {
    const textPath = path.join(extractedDir, entry.text_file);
    if (!fs.existsSync(textPath)) {
      console.warn(`  Skipping missing file: ${entry.text_file}`);
      continue;
    }
    const fullText = fs.readFileSync(textPath, "utf-8");
    const lines = fullText.split("\n");
    const firstLine = lines[0] ?? "";

    const formCode = parseFormCode(firstLine);
    const title = parseTitle(lines);
    const editionDate = parseEditionDate(firstLine);
    const { kind, isBasePolicy } = classifyFormKind(
      entry.text_file, fullText, policyFiles, endorsementFiles
    );

    parsedForms.push({
      filename: entry.text_file,
      formCode,
      title,
      editionDate,
      kind,
      isBasePolicy,
      fullText,
    });
  }

  console.log(`Parsed ${parsedForms.length} forms`);
  console.log(`  Base policies: ${parsedForms.filter(f => f.isBasePolicy).length}`);
  console.log(`  Endorsements: ${parsedForms.filter(f => f.kind === "ENDORSEMENT").length}`);
  console.log(`  Other: ${parsedForms.filter(f => f.kind === "OTHER").length}`);

  // Write metadata.json
  const metadataPath = path.join(extractedDir, "metadata.json");
  const metadataJson = parsedForms.map(f => ({
    filename: f.filename,
    form_code: f.formCode,
    title: f.title,
    form_type: f.kind === "BASE_POLICY" ? "base_policy" : f.kind === "ENDORSEMENT" ? "endorsement" : "other",
    edition_date: f.editionDate,
  }));
  fs.writeFileSync(metadataPath, JSON.stringify(metadataJson, null, 2));
  console.log(`Wrote metadata.json`);

  // Parse sections for all forms
  const allSections: Map<string, ParsedSection[]> = new Map();
  const sectionsDir = path.join(extractedDir, "sections");
  fs.mkdirSync(sectionsDir, { recursive: true });

  for (const form of parsedForms) {
    const sections = parseSections(form.fullText);
    allSections.set(form.filename, sections);

    // Write section JSON
    const sectionFile = path.join(sectionsDir, form.filename.replace(/\.txt$/, ".json"));
    fs.writeFileSync(sectionFile, JSON.stringify({
      form_filename: form.filename,
      sections: sections.map(s => ({
        section_ref: s.sectionRef,
        title: s.title,
        section_type: s.sectionType,
        sort_order: s.sortOrder,
        content: s.content.substring(0, 500) + (s.content.length > 500 ? "..." : ""),
      })),
    }, null, 2));
  }
  console.log(`Wrote ${allSections.size} section files`);

  // Write canonical_suggestions.json
  const canonicalSuggestions = parsedForms
    .filter(f => f.kind === "ENDORSEMENT")
    .map(f => {
      const match = matchCanonicalCoverage(f.title);
      return {
        endorsement_filename: f.filename,
        suggested_canonical_code: match?.code ?? null,
        suggested_canonical_name: match?.name ?? null,
        confidence: match?.confidence ?? "low",
        title: f.title,
      };
    });
  fs.writeFileSync(
    path.join(extractedDir, "canonical_suggestions.json"),
    JSON.stringify(canonicalSuggestions, null, 2)
  );
  console.log(`Wrote canonical_suggestions.json`);

  if (opts.dryRun) {
    console.log("\n--dry-run: Skipping database import.");
    console.log("\nCanonical matches:");
    for (const s of canonicalSuggestions) {
      console.log(`  ${s.confidence.padEnd(6)} ${(s.suggested_canonical_code ?? "???").padEnd(35)} ← ${s.title}`);
    }
    return;
  }

  // ---------------------------------------------------------------------------
  // Database import
  // ---------------------------------------------------------------------------

  // Ensure carrier exists
  const carrier = await prisma.carrier.upsert({
    where: { slug: opts.carrierSlug },
    update: { name: opts.carrier },
    create: { slug: opts.carrierSlug, name: opts.carrier },
  });
  console.log(`Carrier: ${carrier.name} (${carrier.id})`);

  // Ensure state
  const state = await prisma.state.findUnique({ where: { code: opts.state } });
  if (!state) {
    console.error(`State not found: ${opts.state}`);
    process.exit(1);
  }

  // Ensure policy type
  const policyType = await prisma.policyType.findFirst({
    where: { code: opts.policyType },
  });
  if (!policyType) {
    console.error(`Policy type not found: ${opts.policyType}`);
    process.exit(1);
  }

  // Ensure offering
  const offering = await prisma.carrierPolicyOffering.upsert({
    where: {
      carrierId_stateId_policyTypeId: {
        carrierId: carrier.id,
        stateId: state.id,
        policyTypeId: policyType.id,
      },
    },
    update: {},
    create: {
      carrierId: carrier.id,
      stateId: state.id,
      policyTypeId: policyType.id,
    },
  });
  console.log(`Offering: ${offering.id}`);

  // Import forms + sections
  let formsCreated = 0;
  let sectionsCreated = 0;
  let mappingsCreated = 0;

  for (const form of parsedForms) {
    const dbForm = await prisma.offeringForm.upsert({
      where: {
        offeringId_title: {
          offeringId: offering.id,
          title: form.title,
        },
      },
      update: {
        formCode: form.formCode || undefined,
        formNumber: form.filename.replace(/\.txt$/, ""),
        editionDate: form.editionDate,
        kind: form.kind,
        isBasePolicy: form.isBasePolicy,
        sourceFilename: form.filename.replace(/\.txt$/, ".pdf"),
        extractedText: form.fullText,
      },
      create: {
        offeringId: offering.id,
        title: form.title,
        formCode: form.formCode || undefined,
        formNumber: form.filename.replace(/\.txt$/, ""),
        editionDate: form.editionDate,
        kind: form.kind,
        isBasePolicy: form.isBasePolicy,
        sourceFilename: form.filename.replace(/\.txt$/, ".pdf"),
        extractedText: form.fullText,
      },
    });
    formsCreated++;

    // Import sections
    const sections = allSections.get(form.filename) ?? [];
    // Delete existing sections for this form (re-import)
    await prisma.offeringFormSection.deleteMany({
      where: { offeringFormId: dbForm.id },
    });

    for (const section of sections) {
      await prisma.offeringFormSection.create({
        data: {
          offeringFormId: dbForm.id,
          sectionRef: section.sectionRef,
          title: section.title,
          sectionType: section.sectionType,
          content: section.content,
          sortOrder: section.sortOrder,
        },
      });
      sectionsCreated++;
    }

    // Coverage mapping for endorsements
    if (form.kind === "ENDORSEMENT") {
      const match = matchCanonicalCoverage(form.title);
      if (match) {
        const coverageDef = await prisma.coverageDefinition.findFirst({
          where: { code: match.code },
        });
        if (coverageDef) {
          await prisma.formCoverageMapping.upsert({
            where: {
              offeringFormId_coverageDefinitionId: {
                offeringFormId: dbForm.id,
                coverageDefinitionId: coverageDef.id,
              },
            },
            update: {},
            create: {
              offeringFormId: dbForm.id,
              coverageDefinitionId: coverageDef.id,
            },
          });
          mappingsCreated++;
        } else {
          // Create new coverage definition if it doesn't exist
          const newDef = await prisma.coverageDefinition.create({
            data: {
              code: match.code,
              name: match.name,
              kind: "COVERAGE",
              policyTypeId: policyType.id,
              isCommonlyRecommended: false,
            },
          });
          await prisma.formCoverageMapping.create({
            data: {
              offeringFormId: dbForm.id,
              coverageDefinitionId: newDef.id,
            },
          });
          mappingsCreated++;
          console.log(`  Created new coverage definition: ${match.name} (${match.code})`);
        }
      }
    }
  }

  console.log(`\nImport complete:`);
  console.log(`  Forms: ${formsCreated}`);
  console.log(`  Sections: ${sectionsCreated}`);
  console.log(`  Coverage mappings: ${mappingsCreated}`);

  // Summary of unmatched endorsements
  const unmatched = canonicalSuggestions.filter(s => !s.suggested_canonical_code);
  if (unmatched.length > 0) {
    console.log(`\n  Unmatched endorsements (${unmatched.length}):`);
    for (const u of unmatched) {
      console.log(`    - ${u.title}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
