'use strict';

function index(graph) {
  const byPath = new Map(graph.files.map(file => [file.path, file]));
  const importers = new Map();
  for (const file of graph.files) for (const target of file.imports) {
    if (!importers.has(target)) importers.set(target, []);
    importers.get(target).push(file.path);
  }
  return { byPath, importers };
}

function locate(graph, term) {
  const lower = String(term ?? '').toLowerCase();
  if (!lower) return [];
  const exact = graph.files.filter(f => f.path.toLowerCase() === lower || f.path.toLowerCase().endsWith('/' + lower));
  if (exact.length) return exact;
  const bySymbol = graph.files.filter(f => f.symbols.some(s => s.name.toLowerCase() === lower));
  if (bySymbol.length) return bySymbol;
  return graph.files.filter(f => f.path.toLowerCase().includes(lower));
}

function query(graph, text) {
  const terms = String(text).toLowerCase().split(/[^\w$.-]+/).filter(t => t.length > 2);
  const { importers } = index(graph);
  const scored = graph.files.map(file => {
    const p = file.path.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (p.includes(term)) score += 3;
      for (const symbol of file.symbols) if (symbol.name.toLowerCase().includes(term)) score += symbol.exported ? 2 : 1;
    }
    return { file, score: score ? score + Math.min(3, (importers.get(file.path)?.length ?? 0) / 5) : 0 };
  }).filter(r => r.score).sort((a, b) => b.score - a.score).slice(0, 15);
  if (!scored.length) return `No match for "${text}". Fall back to grep.`;
  return scored.map(({ file }) => {
    const hits = file.symbols.filter(s => terms.some(t => s.name.toLowerCase().includes(t))).slice(0, 5).map(s => `${s.name}:${s.line}`);
    return `${file.path}${hits.length ? `  [${hits.join(', ')}]` : ''}`;
  }).join('\n');
}

function explain(graph, term) {
  const { importers } = index(graph);
  const found = locate(graph, term).slice(0, 3);
  if (!found.length) return `Not in the code map: "${term}".`;
  return found.map(file => [
    `File: ${file.path} (repo ${file.repo})`,
    `Symbols: ${file.symbols.slice(0, 30).map(s => `${s.name}:${s.line}`).join(', ') || '-'}`,
    `Imports: ${file.imports.join(', ') || '-'}`,
    `Packages: ${file.packages.join(', ') || '-'}`,
    `Imported by: ${(importers.get(file.path) ?? []).slice(0, 30).join(', ') || '-'}`,
  ].join('\n')).join('\n\n');
}

function bfs(start, goal, next) {
  const previous = new Map([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    if (current === goal) break;
    for (const n of next(current)) if (!previous.has(n)) { previous.set(n, current); queue.push(n); }
  }
  if (!previous.has(goal)) return null;
  const steps = [];
  for (let p = goal; p; p = previous.get(p)) steps.unshift(p);
  return steps;
}

function shortestPath(graph, a, b) {
  const from = locate(graph, a)[0], to = locate(graph, b)[0];
  if (!from || !to) return `Not in the code map: "${!from ? a : b}".`;
  const { byPath, importers } = index(graph);
  const imports = p => byPath.get(p)?.imports ?? [];
  const directed = bfs(from.path, to.path, imports) ?? bfs(to.path, from.path, imports)?.reverse();
  if (directed) return `imports: ${directed.join(' → ')}`;
  const loose = bfs(from.path, to.path, p => [...imports(p), ...(importers.get(p) ?? [])]);
  return loose ? `related through: ${loose.join(' ~ ')}` : `No import path between ${from.path} and ${to.path}.`;
}

function impact(graph, term) {
  const file = locate(graph, term)[0];
  if (!file) return `Not in the code map: "${term}".`;
  const { importers } = index(graph);
  const seen = new Set([file.path]);
  const queue = [file.path];
  while (queue.length) for (const p of importers.get(queue.shift()) ?? []) if (!seen.has(p)) { seen.add(p); queue.push(p); }
  seen.delete(file.path);
  return `Changing ${file.path} can affect ${seen.size} files:\n${[...seen].slice(0, 60).join('\n')}`;
}

module.exports = { query, explain, shortestPath, impact, locate };
