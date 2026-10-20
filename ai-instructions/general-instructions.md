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