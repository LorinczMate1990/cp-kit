import { prisma } from '../index';

// Reports are passed along in memory, never written to the local disk (see ai-instructions/adr/stateless-backend.md)

export function startReportJob() {
  console.log('Starting report job...');

  // Run daily at midnight (simplified - real app would use proper scheduler)
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      generateDailyReports();
    }
  }, 60 * 1000);
}
function generateDailyReports() {
  console.log('Generating daily reports...');

  // Get all organizations
  prisma.organization.findMany().then(orgs => {
    orgs.forEach(org => {
      generateOrgReport(org.id, (err, report) => {
        if (err) {
          console.log('Error generating report for org:', org.id, err);
          return;
        }

        console.log('Report generated for org:', org.id);

        // Send report to admins
        prisma.user.findMany({
          where: {
            organizationId: org.id,
            role: { in: ['owner', 'admin'] }
          }
        }).then(admins => {
          admins.forEach(admin => {
            sendReportEmail(admin.tenantId, admin.email, report!);
          });
        }).catch(e => {
          console.log('Failed to get admins:', e);
        });
      });
    });
  }).catch(err => {
    console.log('Failed to get organizations:', err);
  });
}
function generateOrgReport(orgId: string, callback: (err: any, report?: string) => void) {
  // Fetch data for report
  prisma.analyticsEvent.count({
    where: { organizationId: orgId }
  }).then(eventCount => {
    prisma.user.count({
      where: { organizationId: orgId }
    }).then(userCount => {
      prisma.dashboard.count({
        where: { organizationId: orgId }
      }).then(dashboardCount => {
        prisma.auditLog.findMany({
          where: {
            organizationId: orgId,
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        }).then(recentActivity => {
          // Build report
          const report = {
            generatedAt: new Date().toISOString(),
            organizationId: orgId,
            period: 'daily',
            metrics: {
              totalEvents: eventCount,
              totalUsers: userCount,
              totalDashboards: dashboardCount,
              activityCount: recentActivity.length
            },
            activity: recentActivity.map(a => ({
              action: a.action,
              timestamp: a.createdAt,
              userId: a.userId
            }))
          };
          callback(null, JSON.stringify(report, null, 2));
        }).catch(err => callback(err));
      }).catch(err => callback(err));
    }).catch(err => callback(err));
  }).catch(err => callback(err));
}

function sendReportEmail(tenantId: string, email: string, reportContent: string) {
  // Queue email with report attachment
  prisma.emailQueue.create({
    data: {
      id: require('uuid').v4(),
      tenantId,
      to: email,
      subject: 'Your Daily InsightHub Report',
      body: `
        <h1>Daily Report</h1>
        <p>Please find your daily analytics report attached.</p>
        <pre>${reportContent}</pre>
      `
    }
  }).then(() => {
    console.log('Report email queued for:', email);
  }).catch(err => {
    console.log('Failed to queue report email:', err);
  });
}

// Weekly report generation
export function generateWeeklyReport(orgId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    prisma.analyticsEvent.findMany({
      where: {
        organizationId: orgId,
        timestamp: { gte: weekAgo }
      }
    }).then(events => {
      const eventsByDay: Record<string, number> = {};
      const eventsByType: Record<string, number> = {};

      events.forEach(e => {
        const day = e.timestamp.toISOString().split('T')[0];
        eventsByDay[day] = (eventsByDay[day] || 0) + 1;
        eventsByType[e.eventType] = (eventsByType[e.eventType] || 0) + 1;
      });

      const report = {
        generatedAt: new Date().toISOString(),
        organizationId: orgId,
        period: 'weekly',
        totalEvents: events.length,
        eventsByDay,
        eventsByType
      };
      resolve(JSON.stringify(report, null, 2));
    }).catch(reject);
  });
}

// Export report data
export function exportReportData(
  orgId: string,
  startDate: Date,
  endDate: Date,
  callback: (err: any, data?: any) => void
) {
  prisma.analyticsEvent.findMany({
    where: {
      organizationId: orgId,
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: { timestamp: 'asc' }
  }).then(events => {
    const grouped = events.reduce((acc: any, e) => {
      const day = e.timestamp.toISOString().split('T')[0];
      if (!acc[day]) acc[day] = [];
      acc[day].push(e);
      return acc;
    }, {});

    callback(null, grouped);
  }).catch(err => {
    callback(err);
  });
}
