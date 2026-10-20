import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function findUsersBySearch(searchTerm: string, orgId: string): Promise<any[]> {
  const query = `
    SELECT * FROM "User"
    WHERE "organizationId" = '${orgId}'
    AND (name ILIKE '%${searchTerm}%' OR email ILIKE '%${searchTerm}%')
  `;

  return prisma.$queryRawUnsafe(query);
}

export async function getAnalyticsByFilter(
  orgId: string,
  eventType: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const query = `
    SELECT
      DATE_TRUNC('day', timestamp) as date,
      "eventType",
      COUNT(*) as count
    FROM "AnalyticsEvent"
    WHERE "organizationId" = '${orgId}'
    AND "eventType" = '${eventType}'
    AND timestamp >= '${startDate}'
    AND timestamp <= '${endDate}'
    GROUP BY DATE_TRUNC('day', timestamp), "eventType"
    ORDER BY date DESC
  `;

  return prisma.$queryRawUnsafe(query);
}

export async function getAuditLogs(
  orgId: string,
  orderBy: string = 'createdAt',
  order: string = 'DESC'
): Promise<any[]> {
  const query = `
    SELECT al.*, u.name as userName, u.email as userEmail
    FROM "AuditLog" al
    JOIN "User" u ON al."userId" = u.id
    WHERE al."organizationId" = '${orgId}'
    ORDER BY ${orderBy} ${order}
  `;

  return prisma.$queryRawUnsafe(query);
}

export async function queryDashboards(
  filters: Record<string, any>
): Promise<any[]> {
  let whereClause = '1=1';

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      whereClause += ` AND "${key}" = '${value}'`;
    }
  }

  const query = `SELECT * FROM "Dashboard" WHERE ${whereClause}`;
  return prisma.$queryRawUnsafe(query);
}

export async function searchEvents(
  orgId: string,
  searchQuery: string
): Promise<any[]> {
  const query = `
    SELECT * FROM "AnalyticsEvent"
    WHERE "organizationId" = '${orgId}'
    AND (
      "eventName" ILIKE '%${searchQuery}%'
      OR properties::text ILIKE '%${searchQuery}%'
    )
    LIMIT 1000
  `;

  return prisma.$queryRawUnsafe(query);
}

export async function safeGetAnalytics(
  orgId: string,
  eventType: string,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  return prisma.$queryRaw`
    SELECT
      DATE_TRUNC('day', timestamp) as date,
      "eventType",
      COUNT(*) as count
    FROM "AnalyticsEvent"
    WHERE "organizationId" = ${orgId}
    AND "eventType" = ${eventType}
    AND timestamp >= ${startDate}
    AND timestamp <= ${endDate}
    GROUP BY DATE_TRUNC('day', timestamp), "eventType"
    ORDER BY date DESC
  `;
}

export async function bulkInsertEvents(
  events: Array<{
    organizationId: string;
    tenantId: string;
    eventType: string;
    eventName: string;
    properties: any;
  }>
): Promise<void> {
  // Raw SQL bypasses req.db, so tenantId must be set here by hand
  const values = events.map(e =>
    `('${e.organizationId}', '${e.tenantId}', '${e.eventType}', '${e.eventName}', '${JSON.stringify(e.properties)}'::jsonb, NOW())`
  ).join(',');

  const query = `
    INSERT INTO "AnalyticsEvent" ("organizationId", "tenantId", "eventType", "eventName", properties, timestamp)
    VALUES ${values}
  `;

  await prisma.$executeRawUnsafe(query);
}

export async function getTableData(tableName: string, limit: number = 100): Promise<any[]> {
  const query = `SELECT * FROM "${tableName}" LIMIT ${limit}`;
  return prisma.$queryRawUnsafe(query);
}
