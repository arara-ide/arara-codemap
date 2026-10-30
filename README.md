# Arara Code map

An agent skill that maps a codebase once into a persistent graph, so coding agents query the map instead of grepping the whole tree on every task.

- **No dependencies, no network.** One Node.js script (`scripts/codemap.cjs`) reads source and Markdown files, extracts symbols with line numbers, resolves relative imports and links, and ranks central files with PageRank over the import graph (the approach popularized by Aider's repo map).
- **Incremental.** `update` re-reads only files whose size or modification time changed. A 3,700-file multi-repository workspace builds in about 1.6 s.
- **One repository or many.** Run it at the root of a repository or of a folder that holds several repositories; each file records which repository it belongs to.
- **Lives with the project.** Output goes to `.arara/codemap/` (`graph.json` and a short `REPORT.md`). When the script creates `.arara/`, it adds `.arara/` to `.gitignore`. If `.arara/` already exists and is not ignored, the script leaves `.gitignore` alone.

It ships as a default skill of [Arara Code](https://github.com/arara-ide/arara-code), which installs it for every supported assistant (Codex, Claude Code, Antigravity, Kiro, OpenCode and the built-in assistant), shows the map from a title bar button and offers to keep it after large tasks. The skill also works on its own with any assistant that reads `SKILL.md` files.

## Usage

```bash
node scripts/codemap.cjs build                  # first map
node scripts/codemap.cjs update                 # refresh after changes
node scripts/codemap.cjs query "auth token refresh"
node scripts/codemap.cjs explain src/api/client.ts
node scripts/codemap.cjs path src/a.ts src/b.ts
node scripts/codemap.cjs impact src/model.ts
```

Add `--root <dir>` to map another folder.

## Install as a skill

Copy this folder to your assistant's skills directory, for example `~/.claude/skills/arara-codemap`, `~/.agents/skills/arara-codemap` (Codex) or `~/.kiro/skills/arara-codemap`. Or use the skills CLI:

```bash
npx skills add https://github.com/arara-ide/arara-codemap --skill arara-codemap
```

## Credits

The idea of a persistent knowledge graph that agents query instead of grepping is popularized by [Graphify](https://github.com/Graphify-Labs/graphify). This project is an independent, simplified implementation and contains no Graphify code.

## License

MIT
