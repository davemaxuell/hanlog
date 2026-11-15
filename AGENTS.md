<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## HanLog project rules

3. Follow your plan task by task: write the failing test, watch it fail, implement, watch it pass, commit. One commit per task at minimum.
4. `npm run check` must pass before every commit that ends a task.
5. Never read, print, or commit secrets. Real keys live only in `.env.local`, which is ignored by git. Tests never need a real key except the two tasks that say so.
6. Development and tests run with no environment variables set at all. If something needs configuration to start, that is a bug.
7. Use the exact names, types, limits, and wording from the spec. If the spec is silent, choose the simplest thing and note the choice in your handoff file.
8. Next.js 16 differs from older versions. The scaffold writes an `AGENTS.md` that points to the bundled Next.js docs; read the relevant page there before using a framework API from memory. Route handler `params` is a promise. `cookies()` and `headers()` are async. Do not use the Edge runtime.
9. Interface text is English. Wrap Korean text in an element with `lang="ko"`.

Spec: docs/superpowers/specs/2026-11-15-hanlog-speaking-demo-design.md
Your lane: docs/superpowers/plans/2026-11-15-hanlog-00-orchestration.md, section Ownership
