#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { buildGraph, report } = require('./build.cjs');
const { query, explain, shortestPath, impact } = require('./query.cjs');

function outputDir(root) { return path.join(root, '.arara', 'codemap'); }

function ensureArara(root) {
  const dir = path.join(root, '.arara');
  if (fs.existsSync(dir)) return;
  fs.mkdirSync(dir, { recursive: true });
  const gitignore = path.join(root, '.gitignore');
  if (!fs.existsSync(path.join(root, '.git')) && !fs.existsSync(gitignore)) return;
  const text = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, 'utf8') : '';
  if (text.split(/\r?\n/).some(line => /^\/?\.arara\/?(\*\*?)?$/.test(line.trim()))) return;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(gitignore, `${text}${text && !text.endsWith('\n') ? eol : ''}.arara/${eol}`);
}

function load(root) {
  const file = path.join(outputDir(root), 'graph.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function build(root) {
  const previous = load(root);
  ensureArara(root);
  const graph = buildGraph(root, previous);
  const dir = outputDir(root);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'graph.json'), JSON.stringify(graph));
  fs.writeFileSync(path.join(dir, 'REPORT.md'), report(graph));
  return graph;
}

function main(argv) {
  const [command = 'help', ...rest] = argv;
  const rootFlag = rest.indexOf('--root');
  const root = path.resolve(rootFlag >= 0 ? rest.splice(rootFlag, 2)[1] : process.cwd());
  if (command === 'build' || command === 'update') {
    const graph = build(root);
    console.log(`codemap: ${graph.files.length} files, ${graph.repos.length} repos → ${path.relative(root, outputDir(root))}/graph.json`);
    return 0;
  }
  if (!['query', 'explain', 'path', 'impact'].includes(command)) {
    console.log('Usage: codemap.cjs build|update|query <terms>|explain <file or symbol>|path <A> <B>|impact <file> [--root <dir>]');
    return command === 'help' ? 0 : 1;
  }
  const graph = load(root) ?? build(root);
  const out = command === 'query' ? query(graph, rest.join(' '))
    : command === 'explain' ? explain(graph, rest.join(' '))
      : command === 'path' ? shortestPath(graph, rest[0], rest[1])
        : impact(graph, rest.join(' '));
  console.log(out);
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { main, build, load, ensureArara, outputDir };
