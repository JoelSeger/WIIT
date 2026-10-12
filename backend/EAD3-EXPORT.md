# WIIT – migrations 006–007 + EAD3 export

Builds on migrations 001–005 (13 tables) that are already in the repo.
007 combines the generic tree model with Lilas' archive model.

## Files (paths as in the WIIT repo)

| File (inside `backend/`) | In the repo | What it does |
|---|---|---|
| `migrations/20261011000006_proposal_gaps.js` | same | Node validity, description, MAU Arkiv link; agency/language/license on structures |
| `migrations/20261011000007_archives_and_creators.js` | same | Combined model: arkivbildare, arkiv, archive ↔ structure links, three structure types |
| `seeds/01_demo.js` | same (replaces the old one) | Demo data for the combined model |
| `src/ead/xml.js` | same | Tiny XML writer with escaping |
| `src/ead/loadStructure.js` | same | Reads one tree + its archive from the DB in 6 queries |
| `src/ead/buildEad3.js` | same | Nested object → EAD3 XML (pure function, no DB) |
| `src/ead/exportRoute.js` | same | Express route + logging in `transfer_jobs` |
| `test/ead-export.test.js` | same | Runs the real seed + export against an in-memory SQLite DB |

## Run

```bash
npx knex migrate:latest      # runs 007 (006 is already applied)
npx knex seed:run            # WIPES and reloads demo data (dev only)
node test/ead-export.test.js
```

Validate against the official EAD3 schema (optional, needs `xmllint`):

```bash
curl -O https://raw.githubusercontent.com/SAA-SDT/EAD3/master/ead3.xsd
EAD3_XSD=./ead3.xsd node test/ead-export.test.js
```

Route (already wired in `server.js`):
- `GET /api/structures/:id/export/ead3` – public part, no login
- `GET /api/structures/:id/export/ead3?full=true` – everything, needs editor/admin

## Migration 007 – the combined model

| From Lilas' model | In WIIT |
|---|---|
| `archive_creators` (with `parent_id`) | `archive_creators` + `creator_type` (corporate/person/family) for EAD3/EAC-CPF |
| `archives` | `archives` + `reference_code` (arkivnummer), `is_published` |
| `archive_classification_structures` | `archive_structures` – works for every structure type, not only classification |
| `classification_structures` / `archive_series`+`archive_volumes` / `fe_structures` | one `structures` table with `structure_type` = `klassificering` / `arkivforteckning` / `forvaring` |
| `version`, `previous_name`, `previous_version` | `structures.version` + `previous_structure_id` (a real link to the replaced structure) |
| `previous_designation` | `nodes.previous_reference_code` |
| `classification_nodes`, `fe_structure_units`, `storage_units`, series, volumes | all in `nodes`; the level is a row in `node_types` |
| `archive_series.location` (text) | `node_relations` "förvaras i" → a real link into the Förvaring tree |

Kept from the generic model: client-managed node types and fields, cross-tree relations,
delete protection, publishing + `is_public` (OSL), AD-group roles, change log, versions, transfer log.

Note: 007 renames the old structure type `struktur` to `klassificering` (existing rows are updated).

## EAD3 mapping

| WIIT | EAD3 |
|---|---|
| Archive linked to the structure | `<archdesc level="fonds">`, top nodes in `<dsc>` as nested `<c>` |
| Arkivbildare | `<did><origination><corpname|persname|famname><part>` + `<bioghist>` |
| No archive, one root node | `<archdesc level="…">` from the root |
| No archive, several root nodes | `<archdesc level="collection">` named after the structure |
| `structures.version` | `<editionstmt><edition>` |
| `node_types.ead_level` / `ead_otherlevel` | `@level` / `@otherlevel` |
| `reference_code` / `previous_reference_code` | `<unitid>` / `<unitid localtype="tidigare_beteckning">` |
| `title` | `<unittitle>` |
| `valid_from` / `valid_to`, archive years | `<unitdatestructured>` |
| `description` | `<scopecontent>` |
| `portal_url` | `<dao>` (link to MAU Arkiv) |
| Property `ead_element = 'did/unitdate'` etc. | inside `<did>` |
| Property `ead_element = 'appraisal'` (gallring) etc. | block element with `<head>` + `<p>` |
| Property without / unknown `ead_element` | `<odd>` – never silently dropped |
| Relation `ead_element = 'physloc'` (förvaras i) | `<did><physloc>` |
| Relation `ead_element = 'odd'` (redovisas under) | `<odd>` with the target's code |
| Other relations | `<relatedmaterial>` |

`@localtype` carries the WIIT key/code so the EAD3 import can map elements back
(round trip). EAD3 does not allow `@localtype` on `<unitdate>` – map that one by element name.

## Public vs full export

The public export hides: unpublished nodes (and their whole branch), `is_public = 0`
fields, storage locations in unpublished trees, unpublished archives and arkivbildare.
An unpublished structure returns 404 (same message as "does not exist").

## Tested

- 6 test exports validate against EAD3 1.1.1 (`ead3.xsd` from SAA-SDT).
- The demo seed runs twice in a row (clears in the right order).
- Route: 200 public, 401 full without login, 200 full with login, 404 missing, 400 bad id.
- Migrations 006–007 checked via generated MSSQL; 006 run against SQL Server, 007 not yet.

## Open questions

See the group doc "Kombinerad datamodell för WIIT".
