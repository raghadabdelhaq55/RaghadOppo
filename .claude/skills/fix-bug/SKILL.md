---
name: fix-bug
description: Use when fixing a reported bug in this project (e.g. an issue from ISSUES.md). Enforces a reproduce-first, test-driven fix loop and the project's git conventions.
---

# Fix a Bug in Bill Splitter

When fixing a bug, work in this order so the fix is provable and the history stays clean:

1. **Reproduce first.** Find or write a test in `test/` that fails *because* of the bug, then run `npm test` and confirm the failure. Never fix code you haven't seen fail.
2. **Fix the root cause, not the symptom.** Put the change in the layer that owns the logic — usually a pure function in `core/`. Keep it minimal; don't refactor unrelated code.
3. **Prove it.** Run `npm test` and confirm the once-failing test now passes and nothing else broke.
4. **Branch.** Work on `fix/<issue-number>-<short-description>` (e.g. `fix/1-split-rounding`). Never commit to `main`.
5. **Commit.** Conventional Commits, `fix:` type, imperative mood, under 60 chars, e.g. `fix: distribute leftover cents so shares sum to total`. Reference the issue in the body (`Closes #1`).
6. **Pull request.** Open a PR with `gh pr create`, summarizing the root cause and the fix, and linking the issue.
