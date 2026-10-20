# ADR: Shared constants are copied into the backend for now

Status: Accepted · 2026-10-19

## Context

`shared/constants/index.ts` defines constants meant for both apps (rate limits, cache TTLs, roles, tiers, …),
but neither the backend nor the frontend imports it, so values are hard-coded again in the code.
The backend can't import `shared` today:

- **Docker:** the backend image is built with `context: ./backend`, so `shared/` isn't in the image.
- **TypeScript:** `backend/tsconfig.json` has `rootDir: ./src`; importing `../../shared` fails the build.
- **Package:** `insighthub-shared` is linked as an npm workspace but has no build (`main` points to a missing
  `index.js`), so the runtime would have to load raw `.ts` from `node_modules`.

Fixing this changes how the backend is built and deployed, which is out of scope for the changes that need the constants.

## Decision

1. **For now, the backend keeps a copy** of the constants it uses in `backend/src/constants/shared.ts`.
2. **The copy mirrors the original:** same constant names, same keys, same values as in `shared/constants/index.ts`.
   Only the constants the backend uses are copied; a key may be left out, but never renamed or changed.
3. **Changes go to `shared` first.** Changing a value means changing it in `shared/constants/index.ts` and in the
   copy, in the same commit.
4. **Later, `shared` is integrated properly** (a buildable package or TypeScript project references, and a Docker
   build context that includes it). Then the copy is deleted and imports point to `shared`.

## Consequences

- Values can drift between the copy and `shared`; this is caught only by code review until the integration is done.
- Code uses named constants instead of magic numbers, so switching to the real `shared` import later is a change
  of import paths only.
