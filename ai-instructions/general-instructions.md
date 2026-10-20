# General AI working method

The tasks will be collected into folders and files.
Read only the instruction file that is instructed. 

Log the state of the task in the <folder>/state.md

# Code review rules

## Verify tenant isolation

1) Every tenant-specific model must have a `tenantId` field referencing `Tenant`, because `tenantMiddleware` (`backend/src/middleware/tenant.ts`) scopes queries by this field and rejects models without it. Tenants are not part of the logical data model: don't add `organizationId` (or any other relation) only for isolation. See `ai-instructions/adr/tenant-separation.md`.
2) Route handlers must access the database only through `req.db` (the tenant-scoped client attached by `tenantMiddleware`), never through the global `prisma`. Any exception must be explicit and justified in a comment.

## Verify shared constants

1) Every constant in `backend/src/constants/shared.ts` must have the same name, keys and values as in `shared/constants/index.ts` (keys may be left out, never renamed or changed). A change to a value must update both files in the same commit. See `ai-instructions/adr/shared-constants.md`.
2) Values that exist in `shared/constants/index.ts` must not be hard-coded in the backend; use the copy instead.

## Verify cache invalidation

1) If mutable data is cached (`cache.set`), every code path that changes that data (create, update, delete, including changes made by other routes or jobs) must invalidate the cache entry in the same change. Caching and its invalidation are added together, never one without the other.
2) Invalidating a key that nothing writes is dead code and must not be added.
3) Currently uncached entities, so they must not get invalidation code until they are actually cached:
   - dashboards and their widgets (`dashboard:<id>`, `dashboard:<id>:widgets`): if cached, invalidate on dashboard update/delete and on widget create/update/delete;
   - users (`user:<id>`): if cached, invalidate on profile, password, role/status changes and on deletion.

## Verify client-side navigation

1) Links to routes of the frontend app must use React Router's `<Link>` (or `navigate()`), never a plain `<a href>`. A plain anchor makes the browser reload the whole page: the in-memory state (auth store, React Query cache) is lost, every query refetches and the WebSocket reconnects.
2) A plain `<a>` is only acceptable where a page load is intended: external URLs, `mailto:` links and file downloads (e.g. the `document.createElement('a')` pattern used for exports).

## Verify immutable store updates

1) Store slices (`frontend/src/store/*Slice.ts`) must never modify state in place: no `push`, `splice`, `Object.assign`, `sort` or property assignment on objects or arrays taken from `get()`. Zustand and React detect changes by reference, so an in-place change passed to `set` may not re-render the components that use it.
2) Every object and array on the path from the store to the changed value must be replaced with a new one (spread, `map`, `filter`); unchanged parts are reused as they are.