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
import { execSync } from 'child_process';

// Reads a value from git; returns '' if git is unavailable
const git = (args: string): string => {
    try {
        return execSync(`git ${args}`, { encoding: 'utf8' }).trim();
    } catch {
        return '';
    }
};

const reportsDir = 'src/unit_tests/reports';
const path = `${reportsDir}/junit.xml`;
const summaryLatest = `${reportsDir}/test-summary.md`;
const archiveMaxAgeDays = 120;

if (!existsSync(path)) {
    console.error(`⚠️  ${path} not found — skipping summary.`);
    process.exit(0);
}

// When jest wrote the XML (read before this script rewrites it)
const junitMtime = statSync(path).mtimeMs;
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
const iso = new Date().toISOString(); // "2026-11-09T21:34:39.123Z"
const ts = `${iso.slice(0, 10)}_${iso.slice(11, 13)}h${iso.slice(14, 16)}m${iso.slice(17, 19)}s`; // "2026-11-09_21h34m39s"

const archiveXml = `${reportsDir}/junit_${ts}.xml`;
copyFileSync(path, archiveXml);
console.log(`📦 Archived report: ${archiveXml}`);

//Build the summary table from the XML
const testcaseRe = /<testcase\s+([^>]+?)\s*(?:\/>|>([\s\S]*?)<\/testcase>)/g;

// Run info: in CI uses GitHub's variables, locally falls back to git
const branch = process.env.GITHUB_REF_NAME || git('rev-parse --abbrev-ref HEAD') || 'unknown';
const commitMsg = git('log -1 --format=%s') || 'unknown';
// For merges, detect the branch the changes came from
const mergedFrom =
    (commitMsg.match(/^Merge pull request #\d+ from [^/\s]+\/(\S+)/) ||
     commitMsg.match(/^Merge branch '([^']+)'/) ||
     commitMsg.match(/^Merge remote-tracking branch '(?:origin\/)?([^']+)'/) ||
     [])[1];
const escapeMd = (s: string) => s.replace(/[|`*_<>]/g, (c) => `\\${c}`);

let md = '## 🧪 Test Results\n\n';
md += `- **From Branch:** ${escapeMd(branch)}\n`;
if (mergedFrom) md += `- **Merged from:** ${escapeMd(mergedFrom)}\n`;
md += `- **Commit message:** ${escapeMd(commitMsg)}\n\n`;
md += '| ID | Test | Status |\n';
md += '|----|------|--------|\n';

// Line coverage per source file, read from coverage/lcov.info (written by `jest --coverage`).
// Skipped if the coverage is missing or not from this test run.
const lcovPath = 'coverage/lcov.info';
const coverageByClass = new Map<string, { hit: number; found: number }>();
if (existsSync(lcovPath) && Math.abs(statSync(lcovPath).mtimeMs - junitMtime) < 5 * 60 * 1000) {
    for (const record of readFileSync(lcovPath, 'utf8').split('end_of_record')) {
        const file = (record.match(/^SF:(.+)$/m) || [])[1];
        const found = Number((record.match(/^LF:(\d+)$/m) || [])[1]);
        const hit = Number((record.match(/^LH:(\d+)$/m) || [])[1]);
        if (!file || !found) continue;
        // "src\services\searchService.ts" → "searchservice"
        const cls = file.trim().split(/[\\/]/).pop()!.replace(/\.[jt]sx?$/, '').toLowerCase();
        coverageByClass.set(cls, { hit, found });
    }
}

// One block per test suite (= top-level describe, e.g. "SearchService"),
// followed by the coverage of the class with the same name
const suites = [...xml.matchAll(/<testsuite\s+([^>]*)>([\s\S]*?)<\/testsuite>/g)];
for (const [, suiteAttrs, suiteBody] of suites) {
    for (const [, attrs, body = ''] of suiteBody.matchAll(testcaseRe)) {
        const id   = (attrs.match(/\bid="([^"]*)"/)   || [])[1] || '—';
        const name = (attrs.match(/\bname="([^"]*)"/) || [])[1] || 'unknown';
        const failed = body.includes('<failure') || body.includes('<error');
        md += `| ${id} | ${name} | ${failed ? '❌ Failed' : '✅ Passed'} |\n`;
    }
    const suiteName = (suiteAttrs.match(/\bname="([^"]*)"/) || [])[1] || '';
    const cov = coverageByClass.get(suiteName.toLowerCase());
    if (cov) {
        const pct = ((cov.hit / cov.found) * 100).toFixed(1).replace(/\.0$/, '');
        md += `| | **${suiteName} coverage** | 📊 **${pct}%** (${cov.hit}/${cov.found} lines) |\n`;
    }
}

writeFileSync(summaryLatest, md);
const archiveMd = `${reportsDir}/test-summary_${ts}.md`;
writeFileSync(archiveMd, md);
console.log(`📝 Saved summary: ${summaryLatest}`);
console.log(`📝 Archived summary: ${archiveMd}`);

//To prune archived files older than archiveMaxAgeDays
const cutoff = Date.now() - archiveMaxAgeDays * 24 * 60 * 60 * 1000;
for (const f of readdirSync(reportsDir)) {
    const isArchive =
        (f.startsWith('junit_') && f.endsWith('.xml')) ||
        (f.startsWith('test-summary_') && f.endsWith('.md'));
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