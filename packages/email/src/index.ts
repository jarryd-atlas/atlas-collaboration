import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM ?? "ATLAS Collaborate <noreply@crossnokaye.com>";

interface SendReportPublishedEmailParams {
  to: string;
  reportTitle: string;
  reportUrl: string;
  customerName: string;
}

export async function sendReportPublishedEmail({
  to,
  reportTitle,
  reportUrl,
  customerName,
}: SendReportPublishedEmailParams) {
  const subject = `New Status Report: ${reportTitle}`;
  const html = `
    <div style="font-family: 'Red Hat Display', sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #222222;">New Status Report Available</h2>
      <p style="color: #555555;">Hi,</p>
      <p style="color: #555555;">A new status report has been published for <strong>${customerName}</strong>:</p>
      <p style="font-size: 18px; font-weight: 600; color: #222222;">${reportTitle}</p>
      <a href="${reportUrl}" style="display: inline-block; padding: 12px 24px; background-color: #91E100; color: #222222; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
        View Report
      </a>
      <p style="color: #999999; font-size: 12px; margin-top: 32px;">
        ATLAS Collaborate · CrossnoKaye
      </p>
    </div>
  `;

  if (resend) {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    if (error) throw error;
  } else {
    console.log("[Email Stub] sendReportPublishedEmail:", { to, subject });
  }
}

interface SendInviteEmailParams {
  to: string;
  inviterName: string;
  orgName: string;
  loginUrl: string;
}

export async function sendInviteEmail({
  to,
  inviterName,
  orgName,
  loginUrl,
}: SendInviteEmailParams) {
  const subject = `You've been invited to ${orgName} on ATLAS Collaborate`;
  const html = `
    <div style="font-family: 'Red Hat Display', sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #222222;">You're Invited!</h2>
      <p style="color: #555555;">${inviterName} has invited you to join <strong>${orgName}</strong> on ATLAS Collaborate.</p>
      <p style="color: #555555;">ATLAS Collaborate is a customer collaboration portal where you can track project progress, view status reports, and communicate with the CrossnoKaye team.</p>
      <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #91E100; color: #222222; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
        Accept Invitation
      </a>
      <p style="color: #999999; font-size: 12px; margin-top: 32px;">
        ATLAS Collaborate · CrossnoKaye
      </p>
    </div>
  `;

  if (resend) {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    if (error) throw error;
  } else {
    console.log("[Email Stub] sendInviteEmail:", { to, subject });
  }
}

interface SendApprovalNeededEmailParams {
  to: string;
  userName: string;
  email: string;
}

export async function sendApprovalNeededEmail({
  to,
  userName,
  email,
}: SendApprovalNeededEmailParams) {
  const subject = `New User Approval Needed: ${userName}`;
  const html = `
    <div style="font-family: 'Red Hat Display', sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #222222;">New User Approval Needed</h2>
      <p style="color: #555555;">A new user is requesting access to ATLAS Collaborate:</p>
      <div style="background-color: #f9f9f9; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #222222; font-weight: 600; margin: 0;">${userName}</p>
        <p style="color: #555555; margin: 4px 0 0 0;">${email}</p>
      </div>
      <p style="color: #555555;">Please review and approve or deny this request in the admin panel.</p>
      <p style="color: #999999; font-size: 12px; margin-top: 32px;">
        ATLAS Collaborate · CrossnoKaye
      </p>
    </div>
  `;

  if (resend) {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    if (error) throw error;
  } else {
    console.log("[Email Stub] sendApprovalNeededEmail:", { to, subject });
  }
}
