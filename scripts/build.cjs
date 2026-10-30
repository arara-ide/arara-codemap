'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { listFiles, parseFile, resolveImport, DOC } = require('./scan.cjs');

const SCHEMA = 1;

function findRepos(root) {
  if (fs.existsSync(path.join(root, '.git'))) return [root];
  const repos = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('.') && fs.existsSync(path.join(root, entry.name, '.git'))) repos.push(path.join(root, entry.name));
  }
  return repos.length ? repos : [root];
}

function buildGraph(root, previous) {
  const old = new Map((previous?.files ?? []).map(file => [file.path, file]));
  const repos = findRepos(root).map(repo => path.relative(root, repo).replace(/\\/g, '/') || '.');
  const absolute = listFiles(root);
  const known = new Set(absolute);
  const files = [];
  for (const full of absolute) {
    const rel = path.relative(root, full).replace(/\\/g, '/');
    const stat = fs.statSync(full);
    const cached = old.get(rel);
    if (cached && cached.mtime === Math.floor(stat.mtimeMs) && cached.size === stat.size) { files.push(cached); continue; }
    const parsed = parseFile(fs.readFileSync(full, 'utf8'), DOC.test(full));
    const links = parsed.imports.map(spec => resolveImport(full, spec, known)).filter(Boolean).map(target => path.relative(root, target).replace(/\\/g, '/'));
    const repo = repos.filter(r => r === '.' || rel === r || rel.startsWith(r + '/')).sort((a, b) => b.length - a.length)[0] ?? '.';
    files.push({ path: rel, repo, mtime: Math.floor(stat.mtimeMs), size: stat.size, symbols: parsed.symbols, imports: [...new Set(links)], packages: parsed.imports.filter(spec => !spec.startsWith('.')).slice(0, 50) });
  }
  const indegree = new Map();
  for (const file of files) for (const target of file.imports) indegree.set(target, (indegree.get(target) ?? 0) + 1);
  const hubs = [...indegree].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([file, count]) => ({ file, importedBy: count }));
  return { schema: SCHEMA, generatedAt: new Date().toISOString(), root: path.basename(root), repos, files, hubs };
}

function report(graph) {
  const lines = [`# Code map: ${graph.root}`, '', `Generated ${graph.generatedAt}. ${graph.files.length} files, ${graph.files.reduce((n, f) => n + f.imports.length, 0)} internal links.`, ''];
  lines.push('## Repositories', '', ...graph.repos.map(repo => `- ${repo} (${graph.files.filter(f => f.repo === repo).length} files)`), '');
  lines.push('## Most imported files (start here)', '', ...graph.hubs.map(h => `- ${h.file} ← ${h.importedBy}`), '');
  const dirs = new Map();
  for (const file of graph.files) { const dir = path.posix.dirname(file.path); dirs.set(dir, (dirs.get(dir) ?? 0) + 1); }
  lines.push('## Largest folders', '', ...[...dirs].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([dir, n]) => `- ${dir}/ (${n})`), '');
  return lines.join('\n') + '\n';
}

module.exports = { buildGraph, report, findRepos, SCHEMA };
