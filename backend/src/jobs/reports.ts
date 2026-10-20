import { prisma } from '../index';
import fs from 'fs';
import path from 'path';

const REPORTS_DIR = process.env.REPORTS_DIR || '/tmp/reports';

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
      generateOrgReport(org.id, (err, reportPath) => {
        if (err) {
          console.log('Error generating report for org:', org.id, err);
          return;
        }

        console.log('Report generated:', reportPath);

        // Send report to admins
        prisma.user.findMany({
          where: {
            organizationId: org.id,
            role: { in: ['owner', 'admin'] }
          }
        }).then(admins => {
          admins.forEach(admin => {
            sendReportEmail(admin.tenantId, admin.email, reportPath);
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
function generateOrgReport(orgId: string, callback: (err: any, path?: string) => void) {
  // Ensure reports directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const reportDate = new Date().toISOString().split('T')[0];
  const reportPath = path.join(REPORTS_DIR, `${orgId}_${reportDate}.json`);

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
          try {
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            callback(null, reportPath);
          } catch (writeErr) {
            callback(writeErr);
          }
        }).catch(err => callback(err));
      }).catch(err => callback(err));
    }).catch(err => callback(err));
  }).catch(err => callback(err));
}

function sendReportEmail(tenantId: string, email: string, reportPath: string) {
  let reportContent: string;
  try {
    reportContent = fs.readFileSync(reportPath, 'utf8');
  } catch (err) {
    console.log('Failed to read report:', err);
    return;
  }

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
    const reportDate = new Date().toISOString().split('T')[0];
    const reportPath = path.join(REPORTS_DIR, `${orgId}_weekly_${reportDate}.json`);

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
      try {
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        resolve(reportPath);
      } catch (err) {
        reject(err);
      }
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

// Clean up old reports
export function cleanupOldReports() {
  const files = fs.readdirSync(REPORTS_DIR);
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  files.forEach(file => {
    const filepath = path.join(REPORTS_DIR, file);
    const stats = fs.statSync(filepath);

    if (stats.mtime.getTime() < thirtyDaysAgo) {
      fs.unlinkSync(filepath);
      console.log('Deleted old report:', filepath);
    }
  });
}

// Schedule cleanup
setInterval(cleanupOldReports, 24 * 60 * 60 * 1000);
