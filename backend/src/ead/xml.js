/**
 * Tiny XML writer – enough for EAD3, no dependencies.
 *
 *   el('unittitle', {}, 'Fakturor')                 → <unittitle>Fakturor</unittitle>
 *   el('c', { level: 'series' }, [el(...), el(...)]) → nested, indented
 *   el('dao', { href: '…' })                         → <dao href="…"/>
 *
 * null / undefined / false children and attributes are skipped, so callers can write
 * `cond && el(...)` without if-statements.
 */

function escapeText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // XML 1.0 forbids most control characters – drop them instead of producing invalid XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function escapeAttr(s) {
  return escapeText(s).replace(/"/g, '&quot;');
}

function el(name, attrs = {}, content = null) {
  return { name, attrs, content };
}

function render(node, depth = 0) {
  const pad = '  '.repeat(depth);
  const attrs = Object.entries(node.attrs || {})
    .filter(([, v]) => v !== null && v !== undefined && v !== false && v !== '')
    .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
    .join('');

  const content = node.content;
  if (content === null || content === undefined || (Array.isArray(content) && content.filter(Boolean).length === 0)) {
    return `${pad}<${node.name}${attrs}/>`;
  }
  if (!Array.isArray(content)) {
    return `${pad}<${node.name}${attrs}>${escapeText(content)}</${node.name}>`;
  }
  const inner = content.filter(Boolean).map((c) => render(c, depth + 1)).join('\n');
  return `${pad}<${node.name}${attrs}>\n${inner}\n${pad}</${node.name}>`;
}

/** Valid xml:id / @id values must be NCNames (start with a letter or _, no spaces or colons). */
function isNcName(s) {
  return typeof s === 'string' && /^[A-Za-z_][A-Za-z0-9._-]*$/.test(s);
}

module.exports = { el, render, escapeText, escapeAttr, isNcName };
