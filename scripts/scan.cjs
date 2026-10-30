'use strict';
const fs = require('node:fs');
const path = require('node:path');

const SKIP = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.next', 'coverage', 'vendor', 'target', '.venv', 'venv', '__pycache__', '.arara', '.work', 'upstream']);
const CODE = /\.(c|m)?(j|t)sx?$|\.(py|go|rs|java|kt|rb|php|cs|swift|vue|svelte)$/;
const DOC = /\.(md|mdx)$/;
const MAX_FILES = 20000;
const MAX_BYTES = 512 * 1024;

function listFiles(root) {
  const files = [];
  const walk = dir => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) return;
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!SKIP.has(entry.name) && !entry.name.startsWith('.')) walk(full); continue; }
      if (!CODE.test(entry.name) && !DOC.test(entry.name)) continue;
      try { if (fs.statSync(full).size <= MAX_BYTES) files.push(full); } catch {}
    }
  };
  walk(root);
  return files;
}

const SYMBOL_PATTERNS = [
  /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
  /^\s*(?:async\s+)?function\*?\s+([A-Za-z_$][\w$]*)/gm,
  /^\s*(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm,
  /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/gm,
  /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/gm,
  /^\s*(?:pub\s+)?(?:fn|struct|enum|trait)\s+([A-Za-z_]\w*)/gm,
  /^#{1,3}\s+(.+?)\s*$/gm,
];
const IMPORT_PATTERNS = [
  /\bimport\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g,
  /\bexport\s+[^'"]*?\sfrom\s+['"]([^'"]+)['"]/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  /^\s*from\s+([.\w]+)\s+import\b/gm,
  /^\s*import\s+([\w.]+)\s*$/gm,
  /\]\((\.{1,2}\/[^)#\s]+)/g,
];

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function parseFile(text, isDoc) {
  const symbols = [];
  const seen = new Set();
  for (const pattern of isDoc ? SYMBOL_PATTERNS.slice(-1) : SYMBOL_PATTERNS.slice(0, -1)) {
    for (const match of text.matchAll(pattern)) {
      const name = match[1].slice(0, 120);
      if (seen.has(name)) continue;
      seen.add(name);
      symbols.push({ name, line: lineOf(text, match.index), exported: /^\s*export\b/.test(match[0]) });
    }
  }
  const imports = new Set();
  for (const pattern of isDoc ? IMPORT_PATTERNS.slice(-1) : IMPORT_PATTERNS.slice(0, -1)) for (const match of text.matchAll(pattern)) imports.add(match[1]);
  return { symbols: symbols.slice(0, 200), imports: [...imports].slice(0, 200) };
}

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.vue', '.svelte', '.md', '/index.ts', '/index.tsx', '/index.js', '/__init__.py'];

function resolveImport(from, spec, known) {
  let base;
  if (spec.startsWith('.') && !spec.startsWith('..') && !spec.startsWith('./') && /^\.+\w/.test(spec)) {
    const dots = spec.match(/^\.+/)[0].length;
    base = path.join(path.dirname(from), ...Array(dots - 1).fill('..'), spec.slice(dots).replace(/\./g, '/'));
  } else if (spec.startsWith('.')) base = path.join(path.dirname(from), spec);
  else return null;
  const stripped = base.replace(/\.(js|mjs|cjs)$/, '');
  for (const candidate of [base, stripped]) for (const ext of EXTENSIONS) if (known.has(candidate + ext)) return candidate + ext;
  return null;
}

module.exports = { listFiles, parseFile, resolveImport, DOC };
