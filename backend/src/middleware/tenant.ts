import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../index';
import { AuthRequest } from './auth';

// Tenant separation: see ai-instructions/adr/tenant-separation.md

// Models that carry a tenantId column, read from the generated schema.
// Queries on these are scoped to the tenant; every other model (i.e. Tenant itself) is rejected.
export const TENANT_MODELS = new Set(
  (Prisma.dmmf?.datamodel.models ?? [])
    .filter((model) => model.fields.some((field) => field.name === 'tenantId'))
    .map((model) => model.name)
);

// Fail closed: an empty set would make the tenant client unusable without a clear reason
if (TENANT_MODELS.size === 0) {
  throw new Error('No tenant models found in the Prisma schema. Run `prisma generate`.');
}

const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany'
]);

// Forces the tenant on data that creates a record. A caller-supplied tenant is overwritten, never trusted.
const withTenant = ({ tenant, ...data }: any, tenantId: string) => ({ ...data, tenantId });

// Removes the tenant from data that updates a record, so a record can never be moved to another tenant.
const withoutTenant = ({ tenant, tenantId, ...data }: any) => data;

// Runtime: scopes every query to the tenant
const scopeToTenant = (tenantId: string) => {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          if (!TENANT_MODELS.has(model)) {
            throw new Error(`${model} has no tenantId and cannot be used through req.db`);
          }

          const where = { ...args?.where, tenantId };

          switch (operation) {
            case 'create':
              return query({ ...args, data: withTenant(args.data, tenantId) });
            case 'createMany': {
              const data = Array.isArray(args.data) ? args.data : [args.data];
              return query({ ...args, data: data.map((row: any) => withTenant(row, tenantId)) });
            }
            case 'update':
            case 'updateMany':
              return query({ ...args, where, data: withoutTenant(args.data) });
            case 'upsert':
              return query({
                ...args,
                where,
                create: withTenant(args.create, tenantId),
                update: withoutTenant(args.update)
              });
          }

          if (WHERE_OPERATIONS.has(operation)) {
            return query({ ...args, where });
          }

          // Fail closed: an operation we don't know how to scope must not run unscoped
          throw new Error(`Tenant scoping not supported for ${model}.${operation}`);
        }
      }
    }
  });
};

// Types: the write methods' signatures without tenantId and the tenant relation
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type WithoutTenant<T> = DistributiveOmit<T, 'tenantId' | 'tenant'>;
type WithoutTenantMany<T> = T extends readonly (infer E)[] ? WithoutTenant<E>[] : WithoutTenant<T>;

type CreateArgs<T> = Omit<Prisma.Args<T, 'create'>, 'data'> & {
  data: WithoutTenant<Prisma.Args<T, 'create'>['data']>;
};
type CreateManyArgs<T> = Omit<Prisma.Args<T, 'createMany'>, 'data'> & {
  data: WithoutTenantMany<Prisma.Args<T, 'createMany'>['data']>;
};
type UpdateArgs<T> = Omit<Prisma.Args<T, 'update'>, 'data'> & {
  data: WithoutTenant<Prisma.Args<T, 'update'>['data']>;
};
type UpdateManyArgs<T> = Omit<Prisma.Args<T, 'updateMany'>, 'data'> & {
  data: WithoutTenant<Prisma.Args<T, 'updateMany'>['data']>;
};
type UpsertArgs<T> = Omit<Prisma.Args<T, 'upsert'>, 'create' | 'update'> & {
  create: WithoutTenant<Prisma.Args<T, 'upsert'>['create']>;
  update: WithoutTenant<Prisma.Args<T, 'upsert'>['update']>;
};

// The same model on the client below, i.e. the tenant-scoped one
const parent = (self: unknown): any => {
  const context: any = Prisma.getExtensionContext(self);
  return context.$parent[context.$name];
};

// Returns a client that shares the base client's engine and connection pool, but is scoped to one tenant.
// The model extension only changes types and forwards to the scoped client below, so the scoping always runs.
// Not exported: the only way to get a tenant client is tenantMiddleware, which takes the tenant from req.user.
const forTenant = (tenantId: string) => {
  return scopeToTenant(tenantId).$extends({
    model: {
      $allModels: {
        create<T, A extends CreateArgs<T>>(this: T, args: Prisma.Exact<A, CreateArgs<T>>): Prisma.PrismaPromise<Prisma.Result<T, A, 'create'>> {
          return parent(this).create(args);
        },
        createMany<T, A extends CreateManyArgs<T>>(this: T, args: Prisma.Exact<A, CreateManyArgs<T>>): Prisma.PrismaPromise<Prisma.Result<T, A, 'createMany'>> {
          return parent(this).createMany(args);
        },
        update<T, A extends UpdateArgs<T>>(this: T, args: Prisma.Exact<A, UpdateArgs<T>>): Prisma.PrismaPromise<Prisma.Result<T, A, 'update'>> {
          return parent(this).update(args);
        },
        updateMany<T, A extends UpdateManyArgs<T>>(this: T, args: Prisma.Exact<A, UpdateManyArgs<T>>): Prisma.PrismaPromise<Prisma.Result<T, A, 'updateMany'>> {
          return parent(this).updateMany(args);
        },
        upsert<T, A extends UpsertArgs<T>>(this: T, args: Prisma.Exact<A, UpsertArgs<T>>): Prisma.PrismaPromise<Prisma.Result<T, A, 'upsert'>> {
          return parent(this).upsert(args);
        }
      }
    }
  });
};

export type TenantPrismaClient = ReturnType<typeof forTenant>;

export interface TenantRequest extends AuthRequest {
  db?: TenantPrismaClient;
}

// Must run after authMiddleware / apiKeyMiddleware
export const tenantMiddleware = (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.tenantId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  req.db = forTenant(req.user.tenantId);

  next();
};
