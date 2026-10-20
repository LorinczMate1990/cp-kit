import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const prisma = new PrismaClient();
function hashPassword(password: string): string {
  return crypto.createHash('md5').update(password).digest('hex');
}

async function main() {
  console.log('Seeding database...');

  // Create demo organization
  const org = await prisma.organization.create({
    data: {
      id: uuidv4(),
      name: 'Demo Company',
      slug: 'demo-company',
      tier: 'pro',
      monthlyBudget: 100.0,
      currentSpend: 45.50,
      // Organizations are the tenants for now: every new organization gets its own tenant
      tenant: { create: {} },
    },
  });

  console.log(`Created organization: ${org.name}`);

  // Create demo users
  const owner = await prisma.user.create({
    data: {
      id: uuidv4(),
      email: 'owner@demo.com',
      passwordHash: hashPassword('password123'),
      name: 'Demo Owner',
      role: 'owner',
      organizationId: org.id,
      tenantId: org.tenantId,
    },
  });

  const admin = await prisma.user.create({
    data: {
      id: uuidv4(),
      email: 'admin@demo.com',
      passwordHash: hashPassword('password123'),
      name: 'Demo Admin',
      role: 'admin',
      organizationId: org.id,
      tenantId: org.tenantId,
    },
  });

  const member = await prisma.user.create({
    data: {
      id: uuidv4(),
      email: 'member@demo.com',
      passwordHash: hashPassword('password123'),
      name: 'Demo Member',
      role: 'member',
      organizationId: org.id,
      tenantId: org.tenantId,
    },
  });

  console.log(`Created users: ${owner.email}, ${admin.email}, ${member.email}`);

  // Create demo dashboards
  const dashboard1 = await prisma.dashboard.create({
    data: {
      id: uuidv4(),
      name: 'Overview Dashboard',
      description: 'Main analytics overview',
      organizationId: org.id,
      tenantId: org.tenantId,
      createdById: owner.id,
      layout: 'grid',
    },
  });

  const dashboard2 = await prisma.dashboard.create({
    data: {
      id: uuidv4(),
      name: 'Sales Metrics',
      description: 'Sales performance tracking',
      organizationId: org.id,
      tenantId: org.tenantId,
      createdById: admin.id,
      layout: 'grid',
    },
  });

  console.log(`Created dashboards: ${dashboard1.name}, ${dashboard2.name}`);

  // Create demo widgets for Overview Dashboard
  await prisma.widget.createMany({
    data: [
      {
        id: uuidv4(),
        name: 'Total Events',
        type: 'metric',
        config: { title: 'Total Events', format: 'number' },
        position: { x: 0, y: 0, w: 3, h: 2 },
        dashboardId: dashboard1.id,
        organizationId: org.id,
        tenantId: org.tenantId,
      },
      {
        id: uuidv4(),
        name: 'Active Users',
        type: 'metric',
        config: { title: 'Active Users', format: 'number' },
        position: { x: 3, y: 0, w: 3, h: 2 },
        dashboardId: dashboard1.id,
        organizationId: org.id,
        tenantId: org.tenantId,
      },
      {
        id: uuidv4(),
        name: 'Conversion Rate',
        type: 'metric',
        config: { title: 'Conversion Rate', format: 'percent' },
        position: { x: 6, y: 0, w: 3, h: 2 },
        dashboardId: dashboard1.id,
        organizationId: org.id,
        tenantId: org.tenantId,
      },
      {
        id: uuidv4(),
        name: 'Avg Session Time',
        type: 'metric',
        config: { title: 'Avg Session Time', format: 'duration' },
        position: { x: 9, y: 0, w: 3, h: 2 },
        dashboardId: dashboard1.id,
        organizationId: org.id,
        tenantId: org.tenantId,
      },
      {
        id: uuidv4(),
        name: 'Events by Type',
        type: 'chart',
        config: { chartType: 'bar', title: 'Events by Type' },
        position: { x: 0, y: 2, w: 6, h: 4 },
        dashboardId: dashboard1.id,
        organizationId: org.id,
        tenantId: org.tenantId,
      },
      {
        id: uuidv4(),
        name: 'Events Over Time',
        type: 'chart',
        config: { chartType: 'line', title: 'Events Over Time' },
        position: { x: 6, y: 2, w: 6, h: 4 },
        dashboardId: dashboard1.id,
        organizationId: org.id,
        tenantId: org.tenantId,
      },
      {
        id: uuidv4(),
        name: 'Recent Activity',
        type: 'table',
        config: { sortable: true, pageSize: 10 },
        position: { x: 0, y: 6, w: 12, h: 4 },
        dashboardId: dashboard1.id,
        organizationId: org.id,
        tenantId: org.tenantId,
      },
    ],
  });

  // Create demo widgets for Sales Metrics Dashboard
  await prisma.widget.createMany({
    data: [
      {
        id: uuidv4(),
        name: 'Total Revenue',
        type: 'metric',
        config: { title: 'Total Revenue', format: 'currency' },
        position: { x: 0, y: 0, w: 4, h: 2 },
        dashboardId: dashboard2.id,
        organizationId: org.id,
        tenantId: org.tenantId,
      },
      {
        id: uuidv4(),
        name: 'Orders Today',
        type: 'metric',
        config: { title: 'Orders Today', format: 'number' },
        position: { x: 4, y: 0, w: 4, h: 2 },
        dashboardId: dashboard2.id,
        organizationId: org.id,
        tenantId: org.tenantId,
      },
      {
        id: uuidv4(),
        name: 'Avg Order Value',
        type: 'metric',
        config: { title: 'Avg Order Value', format: 'currency' },
        position: { x: 8, y: 0, w: 4, h: 2 },
        dashboardId: dashboard2.id,
        organizationId: org.id,
        tenantId: org.tenantId,
      },
      {
        id: uuidv4(),
        name: 'Sales Trend',
        type: 'chart',
        config: { chartType: 'line', title: 'Sales Trend' },
        position: { x: 0, y: 2, w: 8, h: 4 },
        dashboardId: dashboard2.id,
        organizationId: org.id,
        tenantId: org.tenantId,
      },
      {
        id: uuidv4(),
        name: 'Top Products',
        type: 'chart',
        config: { chartType: 'pie', title: 'Top Products' },
        position: { x: 8, y: 2, w: 4, h: 4 },
        dashboardId: dashboard2.id,
        organizationId: org.id,
        tenantId: org.tenantId,
      },
      {
        id: uuidv4(),
        name: 'Recent Orders',
        type: 'table',
        config: { sortable: true, pageSize: 5 },
        position: { x: 0, y: 6, w: 12, h: 3 },
        dashboardId: dashboard2.id,
        organizationId: org.id,
        tenantId: org.tenantId,
      },
    ],
  });

  console.log('Created widgets');

  // Create demo analytics events
  const eventTypes = ['page_view', 'click', 'form_submit', 'purchase', 'signup'];
  const eventNames = ['Homepage', 'Product Page', 'Checkout', 'Contact Form', 'Dashboard'];

  const events = [];
  for (let i = 0; i < 1000; i++) {
    events.push({
      id: uuidv4(),
      organizationId: org.id,
      tenantId: org.tenantId,
      eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      eventName: eventNames[Math.floor(Math.random() * eventNames.length)],
      properties: { random: Math.random() },
      timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      source: 'api',
    });
  }

  await prisma.analyticsEvent.createMany({ data: events });
  console.log('Created 1000 demo analytics events');

  // Create demo notifications
  await prisma.notification.createMany({
    data: [
      {
        id: uuidv4(),
        userId: owner.id,
        organizationId: org.id,
        tenantId: org.tenantId,
        type: 'info',
        title: 'Welcome to InsightHub!',
        message: 'Get started by creating your first dashboard.',
      },
      {
        id: uuidv4(),
        userId: owner.id,
        organizationId: org.id,
        tenantId: org.tenantId,
        type: 'warning',
        title: 'Budget Alert',
        message: 'You have used 45% of your monthly budget.',
      },
    ],
  });

  console.log('Created demo notifications');

  // Create some audit logs
  await prisma.auditLog.createMany({
    data: [
      {
        id: uuidv4(),
        organizationId: org.id,
        tenantId: org.tenantId,
        userId: owner.id,
        action: 'user.registered',
        resourceType: 'user',
        resourceId: owner.id,
      },
      {
        id: uuidv4(),
        organizationId: org.id,
        tenantId: org.tenantId,
        userId: owner.id,
        action: 'dashboard.created',
        resourceType: 'dashboard',
        resourceId: dashboard1.id,
      },
    ],
  });

  console.log('Created demo audit logs');

  console.log('Seeding complete!');
  console.log('\nDemo credentials:');
  console.log('  Owner: owner@demo.com / password123');
  console.log('  Admin: admin@demo.com / password123');
  console.log('  Member: member@demo.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
