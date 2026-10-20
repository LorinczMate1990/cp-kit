# General AI working method

The tasks will be collected into folders and files.
Read only the instruction file that is instructed. 

Log the state of the task in the <folder>/state.md

# Code review rules

## Verify tenant isolation

1) Every tenant-specific model must have a `tenantId` field referencing `Tenant`, because `tenantMiddleware` (`backend/src/middleware/tenant.ts`) scopes queries by this field and rejects models without it. Tenants are not part of the logical data model: don't add `organizationId` (or any other relation) only for isolation. See `ai-instructions/adr/tenant-separation.md`.
2) Route handlers must access the database only through `req.db` (the tenant-scoped client attached by `tenantMiddleware`), never through the global `prisma`. Any exception must be explicit and justified in a comment.