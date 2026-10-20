# ADR: Tenant separation

Status: Accepted · 2026-10-19

## Context

InsightHub is multi-tenant: many customers share one backend and one database.
Until now the `Organization` model doubled as the tenant, and tenant isolation was built on `organizationId`.
This mixed two different concerns:

- **Logical data model:** which business entity a record belongs to (a dashboard belongs to an organization,
  a comment belongs to a resource and an author).
- **Tenant isolation:** which customer's data partition a record lives in, so no customer can reach another's data.

Using `organizationId` for isolation forced changes to the logical model (e.g. a direct `Comment → Organization`
link, while a comment is only indirectly related to an organization through its resource) and left models
without an `organizationId` (`Organization` itself, `Session`, `EmailQueue`) unscoped.

## Decision

1. **Tenants are not part of the logical data model.** Tenant isolation is a separate, technical concern.
2. **A dedicated `Tenant` model exists.** It currently has only an `id` (plus the back-relation lists Prisma requires).
3. **Every tenant-specific model has a `tenantId`** referencing `Tenant`, including `Organization`.
   The only model without `tenantId` is `Tenant` itself.
4. **Currently, organizations are the tenants:** a new `Tenant` is created whenever the code creates a new
   `Organization`, in the same write. This is a runtime rule, not a schema constraint: `Organization.tenantId`
   is not unique, so the 1:1 mapping can change later without touching the data model.
5. **Isolation is enforced by `tenantMiddleware`** (`backend/src/middleware/tenant.ts`) through the tenant-scoped
   client `req.db`. It forces `tenantId = req.user.tenantId` on every query and creation, and rejects models
   without a `tenantId`. Code never sets `tenantId` by hand when going through `req.db`.
6. **`tenantId` is hidden from the tenant client's types.** In the schema `tenantId` is required with no default.
   The tenant client is built from two chained `$extends`:
   - a `query` extension that does the runtime work: filters every query by `tenantId` and injects it on creates;
   - a `model` extension on top that overrides the signatures of `create`, `createMany`, `update`, `updateMany`
     and `upsert` so `tenantId` (and the `tenant` relation) can't be passed at all. It only changes types and
     forwards to the scoped client below, so the filtering always runs.

   As a result, code using `req.db` never writes `tenantId` (passing it is a type error, so it can't move a
   record to another tenant either), and code using the global client gets a compile-time error if it forgets it.

## Consequences

- Logical relations (`organizationId`, `userId`, `dashboardId`, …) are kept or removed purely on domain grounds.
  `Comment` no longer references `Organization` directly.
- Per-user ownership (e.g. only revoking your own sessions or notifications) is authorization, not tenant
  isolation, and stays an explicit check in the route.
- Code outside requests (registration, background jobs, seed) uses the global client and must set `tenantId`
  explicitly; the compiler enforces it.
- Raw SQL bypasses `req.db` and must include `tenantId` by hand.
