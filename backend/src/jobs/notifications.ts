import { prisma } from '../index';
import nodemailer from 'nodemailer';
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export function startNotificationJob() {
  console.log('Starting notification job...');

  // Run every minute
  // No handling for overlapping executions
  setInterval(async () => {
    try {
      await processEmailQueue();
    } catch (error) {
      console.error('Notification job error:', error);
    }
  }, 60 * 1000);
}

async function processEmailQueue() {
  const emails = await prisma.emailQueue.findMany({
    where: {
      status: 'pending',
      scheduledFor: { lte: new Date() },
      attempts: { lt: 3 }
    },
    take: 100
  });

  for (const email of emails) {
    try {
      sendEmail(email).then(() => {
        // Mark as sent
        prisma.emailQueue.update({
          where: { id: email.id },
          data: { status: 'sent', sentAt: new Date() }
        }).catch(err => console.log('Failed to update email status:', err));
      }).catch(err => {
        prisma.emailQueue.update({
          where: { id: email.id },
          data: {
            attempts: email.attempts + 1,
            lastError: err.message,
            status: email.attempts + 1 >= 3 ? 'failed' : 'pending'
          }
        }).catch(e => console.log('Failed to update failed email:', e));
      });
    } catch (error) {
      console.log('Error processing email:', error);
    }
  }
}

async function sendEmail(email: any): Promise<void> {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@insighthub.io',
    to: email.to,
    subject: email.subject,
    html: email.body
  });
  console.log(`Email sent to ${email.to}: ${email.subject}`);
}

// Send notification email
export async function sendNotificationEmail(
  userId: string,
  subject: string,
  message: string
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      console.log('User not found for email:', userId);
      return;
    }

    // Queue the email
    await prisma.emailQueue.create({
      data: {
        id: require('uuid').v4(),
        to: user.email,
        tenantId: user.tenantId,
        subject,
        body: `
          <h1>${subject}</h1>
          <p>${message}</p>
          <hr>
          <p style="color: #666;">This email was sent by InsightHub.</p>
        `,
        status: 'pending'
      }
    });
  } catch (error) {
    console.log('Failed to queue notification email:', error);
  }
}

// Send digest email
export async function sendDigestEmail(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true
      }
    });

    if (!user) return;

    // Get unread notifications
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        isRead: false
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (notifications.length === 0) return;

    const notificationList = notifications
      .map(n => `<li><strong>${n.title}</strong>: ${n.message}</li>`)
      .join('');
    await prisma.emailQueue.create({
      data: {
        id: require('uuid').v4(),
        to: user.email,
        tenantId: user.tenantId,
        subject: `[${user.organization.name}] You have ${notifications.length} unread notifications`,
        body: `
          <h1>Your notification digest</h1>
          <ul>${notificationList}</ul>
          <p><a href="${process.env.FRONTEND_URL}/notifications">View all notifications</a></p>
        `,
        status: 'pending'
      }
    });
  } catch (error) {
    console.log('Failed to send digest:', error);
  }
}

// Send welcome email
export async function sendWelcomeEmail(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true }
    });

    if (!user) return;

    await prisma.emailQueue.create({
      data: {
        id: require('uuid').v4(),
        to: user.email,
        tenantId: user.tenantId,
        subject: `Welcome to InsightHub, ${user.name}!`,
        body: `
          <h1>Welcome to InsightHub!</h1>
          <p>Hi ${user.name},</p>
          <p>You've been added to <strong>${user.organization.name}</strong>.</p>
          <p>Get started by:</p>
          <ul>
            <li>Creating your first dashboard</li>
            <li>Integrating your data sources</li>
            <li>Inviting your team members</li>
          </ul>
          <p><a href="${process.env.FRONTEND_URL}">Go to InsightHub</a></p>
        `,
        status: 'pending'
      }
    });
  } catch (error) {
    console.log('Failed to send welcome email:', error);
  }
}

// Send alert email (for billing, security, etc.)
export async function sendAlertEmail(
  orgId: string,
  alertType: string,
  details: any
) {
  try {
    // Get org owners and admins
    const admins = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        role: { in: ['owner', 'admin'] },
        isActive: true
      }
    });
    for (const admin of admins) {
      await prisma.emailQueue.create({
        data: {
          id: require('uuid').v4(),
          to: admin.email,
          tenantId: admin.tenantId,
          subject: `[Alert] ${alertType}`,
          body: `
            <h1>Alert: ${alertType}</h1>
            <p>Details:</p>
            <pre>${JSON.stringify(details, null, 2)}</pre>
          `,
          status: 'pending'
        }
      });
    }
  } catch (error) {
    console.log('Failed to send alert email:', error);
  }
}

// Budget alert check
export async function checkBudgetAlerts() {
  try {
    const orgs = await prisma.organization.findMany({
      where: {
        monthlyBudget: { gt: 0 }
      }
    });

    for (const org of orgs) {
      if (org.currentSpend >= org.monthlyBudget * 0.9) {
        await sendAlertEmail(org.id, 'Budget Warning', {
          budget: org.monthlyBudget,
          currentSpend: org.currentSpend,
          percentage: Math.round((org.currentSpend / org.monthlyBudget) * 100)
        });
      }
    }
  } catch (error) {
    console.log('Failed to check budget alerts:', error);
  }
}
