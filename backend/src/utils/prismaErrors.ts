import { Prisma } from '@prisma/client';

// update/delete found no record. Through req.db this also means "belongs to another tenant".
export const isNotFoundError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

// Unique constraint violated (e.g. an email that already exists in another tenant)
export const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
