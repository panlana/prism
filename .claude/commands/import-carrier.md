# Import Carrier Forms

Import insurance carrier policy forms into the PRISM database.

## Arguments

The user should provide:
- **Carrier name** (e.g., "Travelers", "State Farm")
- **State** (e.g., "VA")
- **Policy type** (e.g., "Homeowners", "Personal Auto")
- **Source PDF directory** — path to the folder containing the PDFs. If the carrier splits base policy and endorsement PDFs into separate subdirectories, note which is which.

## Steps

### 1. Extract text from PDFs

Run the Python extraction script:

```
cd docs/Prism && python3 extract_forms.py \
  --input-dir <path-to-all-pdfs> \
  --output-dir ./extracted/<carrier-slug>/<state-lower>/<lob-lower> \
  --carrier "<Carrier Name>" \
  --state "<STATE>" \
  --lob "<Line of Business>"
```

If PDFs are in separate directories (e.g., Policy/ and Coverages/), create a temp directory with symlinks to all PDFs first:

```
mkdir -p /tmp/<carrier>-combined
ln -sf <policy-dir>/*.pdf /tmp/<carrier>-combined/
ln -sf <endorsements-dir>/*.pdf /tmp/<carrier>-combined/
```

Then point `--input-dir` at the combined directory.

### 2. Import into database

Run the import script from `server/`:

```
cd server && npx tsx scripts/import-carrier-forms.ts \
  --extracted-dir ../docs/Prism/extracted/<carrier-slug>/<state-lower>/<lob-lower> \
  --carrier "<Carrier Name>" \
  --carrier-slug <carrier-slug> \
  --state <STATE> \
  --policy-type <POLICY_TYPE_CODE> \
  --policy-dir <Policy-subfolder-name> \
  --endorsement-dir <Coverages-subfolder-name>
```

The `--policy-dir` and `--endorsement-dir` flags tell the script which original source folder contained base policy vs endorsement PDFs, so it can classify them correctly. If all PDFs were in one folder, omit these flags and the script will use heuristics.

The `--policy-type` must match the code in the database (e.g., `HOMEOWNERS`, `PERSONAL_AUTO`).

Use `--dry-run` first to verify parsing before committing to the database.

### 3. Verify

After import, verify the data looks correct:

```
npx tsx scripts/query.ts --raw "SELECT f.title, f.\"formCode\", f.kind, f.\"isBasePolicy\" FROM \"OfferingForm\" f JOIN \"CarrierPolicyOffering\" o ON f.\"offeringId\"=o.id JOIN \"Carrier\" c ON o.\"carrierId\"=c.id WHERE c.slug='<carrier-slug>' ORDER BY f.\"isBasePolicy\" DESC, f.title"
```

Check that:
- Base policy forms are correctly classified
- Titles make sense (fix any that are too long)
- Endorsements have coverage mappings

### 4. Review coverage mappings

The import script auto-creates new CoverageDefinition records for endorsement types not yet in the canonical library. Review the unmatched endorsements and new definitions to ensure they're categorized properly. Add categories via the Coverage Library UI or directly in the DB.

## Notes

- The extraction script requires `pdfplumber` (`pip3 install pdfplumber`)
- The import script creates the Carrier and CarrierPolicyOffering if they don't exist
- Section chunking is heuristic-based (ALL-CAPS headers). For complex forms, sections may need manual adjustment via the Staff UI
- Coverage mapping uses regex title matching. New patterns can be added to the `CANONICAL_PATTERNS` array in `import-carrier-forms.ts`
- The Signature Page form type is intentionally unmatched — it's not a coverage
