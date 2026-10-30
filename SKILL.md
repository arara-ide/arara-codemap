---
name: arara-codemap
description: Persistent code map of the workspace (files, symbols and import links in .arara/codemap). Use it before grep or reading files blindly to locate code, trace dependencies and estimate impact; build or update it when the user mentions @codemap, when .arara/codemap is missing in a repository you will work on, and at the end of a large task.
---

# Arara Code map

The code map turns the workspace into a persistent graph: every source and Markdown file becomes a node with its symbols (functions, classes, types, headings, with line numbers) and the internal imports/links between files. It lives in `.arara/codemap/` at the workspace root and works for a single repository or for a folder that contains several repositories.

It is built by a local script with no dependencies and no network access. Building takes seconds; updates only re-read files that changed.

## Script

The script ships with this skill: `scripts/codemap.cjs` in the same folder as this `SKILL.md`. Run it with Node from the workspace root (or pass `--root <dir>`):

```bash
node <skill-dir>/scripts/codemap.cjs build            # first map (also creates .arara/ and adds it to .gitignore)
node <skill-dir>/scripts/codemap.cjs update           # refresh after changes (incremental)
node <skill-dir>/scripts/codemap.cjs query "auth token refresh"
node <skill-dir>/scripts/codemap.cjs explain src/api/client.ts     # or a symbol name
node <skill-dir>/scripts/codemap.cjs path src/extension.ts src/force.ts
node <skill-dir>/scripts/codemap.cjs impact src/model.ts
```

Outputs:

- `.arara/codemap/REPORT.md`: repositories, most imported files (entry points of understanding) and largest folders. Read this first; it is short.
- `.arara/codemap/graph.json`: the full map. Query it with the commands above instead of loading the whole file.

## Use the map before grep

When `.arara/codemap/graph.json` exists:

1. Read `REPORT.md` once per session to orient yourself.
2. To find where something lives, run `query` with the words of the task. It ranks files by path and symbol names and returns line numbers, so you can open exactly the right lines.
3. Before changing a file, run `impact` to see which files import it, directly or indirectly.
4. Use `explain` for a file or symbol (symbols, imports, packages, importers) and `path` to see how two files connect.
5. Fall back to grep only for literal strings the map does not index (messages, config values) or when the map says "No match". Grep inside the files the map pointed to, not across the whole tree.

The map is a navigation index, not the source of truth: always read the actual lines before editing.

## When the user mentions @codemap

Build the map if it does not exist, otherwise run `update`. Then read `REPORT.md` and answer in one or two sentences what the map covers (files, repositories, main hubs). If the user also asked a question, answer it using the map first.

## At the end of a large task

A task is large when it touched many files or several modules, took many steps, or the user described it as a sprint. After you answered every user message of that task, call the `suggest_codemap` tool of the Arara Code private server (`arara_questions_ide`) once, with a short `summary` of what was done. Arara Code shows the user an offer, above the message field, to keep the map for future maintenance. Do not call it for small or single-file tasks, and do not call it again in the same conversation. If the tool is not available, do nothing.

If the map already exists when you finish a large task, run `update` yourself instead.

## Rules

- `.arara/` is created by the script and added to `.gitignore` only when the script creates the folder. If `.arara/` already exists and is not ignored, the user chose to version it: do not edit `.gitignore`.
- The script skips `node_modules`, `.git`, build outputs and hidden folders, files over 512 KB and anything after 20,000 files.
- Never send the map contents outside the machine.
