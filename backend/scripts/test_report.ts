/* Naming convention for tests : _testID_testName
 * ID will be the corresponding ID in verification doc
 * Ex: Full test name="_TC001_foo"  reports show → name="foo" id="TC001"
 */
import {
    existsSync,
    readFileSync,
    writeFileSync,
    appendFileSync,
    copyFileSync,
    readdirSync,
    statSync,
    unlinkSync,
} from 'fs';

const reportsDir = 'src/unit_tests/reports';
const path = `${reportsDir}/junit.xml`;
const summaryLatest = `${reportsDir}/test-summary.md`;
const archiveMaxAgeDays = 120;

if (!existsSync(path)) {
    console.error(`⚠️  ${path} not found — skipping summary.`);
    process.exit(0);
}

let xml = readFileSync(path, 'utf8');

xml = xml.replace(
    /\bname="([^"]+)"/g,
    (fullMatch: string, fullName: string) => {
        const m = fullName.match(/^(.*?\s)?_([^_\s]+)_(.+)$/);
        if (!m) return fullMatch;
        const describePrefix = m[1] ?? '';
        return `name="${describePrefix}${m[3]}" id="${m[2]}"`;
    },
);

writeFileSync(path, xml);

// The timestamp is shared by both archive files so that they line up
const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19); // "2026-11-09_14-30-45"

const archiveXml = `${reportsDir}/junit-${ts}.xml`;
copyFileSync(path, archiveXml);
console.log(`📦 Archived report: ${archiveXml}`);

//Build the summary table from the XML
const testcases = [...xml.matchAll(
    /<testcase\s+([^>]+?)\s*(?:\/>|>([\s\S]*?)<\/testcase>)/g,
)];

let md = '## 🧪 Test Results\n\n';
md += '| ID | Test | Status |\n';
md += '|----|------|--------|\n';

for (const [, attrs, body = ''] of testcases) {
    const id   = (attrs.match(/\bid="([^"]*)"/)   || [])[1] || '—';
    const name = (attrs.match(/\bname="([^"]*)"/) || [])[1] || 'unknown';
    const failed = body.includes('<failure') || body.includes('<error');
    md += `| ${id} | ${name} | ${failed ? '❌ Failed' : '✅ Passed'} |\n`;
}

writeFileSync(summaryLatest, md);
const archiveMd = `${reportsDir}/test-summary-${ts}.md`;
writeFileSync(archiveMd, md);
console.log(`📝 Saved summary: ${summaryLatest}`);
console.log(`📝 Archived summary: ${archiveMd}`);

//To prune archived files older than archiveMaxAgeDays
const cutoff = Date.now() - archiveMaxAgeDays * 24 * 60 * 60 * 1000;
for (const f of readdirSync(reportsDir)) {
    const isArchive =
        (f.startsWith('junit-') && f.endsWith('.xml')) ||
        (f.startsWith('test-summary-') && f.endsWith('.md'));
    if (!isArchive) continue;
    const full = `${reportsDir}/${f}`;
    if (statSync(full).mtimeMs < cutoff) {
        unlinkSync(full);
        console.log(`🗑️  Pruned old report: ${full}`);
    }
}

//To console (visible locally) and append to Job Summary (visible in CI)
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}