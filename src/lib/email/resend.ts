// resend: Handles emergency email dispatch containing incident metadata, embedded snapshot evidence, and the 30-minute live viewer link.
import { Resend } from 'resend';

type AlertEmailInput = {
  recipientEmail: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  snapshotUrl?: string;
  liveViewerUrl?: string;
  createdAt?: string;
};

const resend = new Resend(process.env.RESEND_API_KEY);

function formatTimestamp(value?: string): string {
  if (!value) return new Date().toLocaleString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toLocaleString();
  return date.toLocaleString();
}

export async function sendIncidentAlertEmail({
  recipientEmail,
  type,
  title,
  description,
  confidence,
  snapshotUrl,
  liveViewerUrl,
  createdAt,
}: AlertEmailInput) {
  if (!recipientEmail) {
    throw new Error('Recipient email is required');
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const viewerUrl =
    liveViewerUrl ?? `${appUrl}/live/expired`;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; background:#0b1020; padding:32px; color:#ecf3ff;">
      <div style="max-width:700px; margin:0 auto; background:#121a2d; border:1px solid #26314d; border-radius:18px; overflow:hidden;">
        <div style="padding:20px 24px; background:linear-gradient(135deg,#1b2c4f,#121a2d); border-bottom:1px solid #2a3c67;">
          <h2 style="margin:0; color:#f8fbff; font-size:28px;">🚨 Security Incident Alert</h2>
        </div>

        <div style="padding:24px;">
          <div style="display:inline-block; padding:8px 12px; border-radius:999px; background:#ff4d4d; color:white; font-weight:bold; font-size:12px; letter-spacing:0.08em;">
            ${type}
          </div>

          <h3 style="margin:16px 0 8px; color:#ffffff; font-size:22px;">${title}</h3>

          <p style="margin:0 0 12px; color:#dfe9ff; font-size:15px; line-height:1.6;">
            ${description}
          </p>

          <div style="display:flex; gap:16px; flex-wrap:wrap; margin:18px 0;">
            <div style="background:#0d1627; border:1px solid #26314d; padding:10px 14px; border-radius:10px; min-width:140px;">
              <div style="font-size:10px; letter-spacing:0.08em; color:#9bb0d9; text-transform:uppercase;">Confidence</div>
              <div style="font-size:20px; color:#ffffff; font-weight:bold; margin-top:5px;">
                ${(confidence * 100).toFixed(1)}%
              </div>
            </div>

            <div style="background:#0d1627; border:1px solid #26314d; padding:10px 14px; border-radius:10px; min-width:160px;">
              <div style="font-size:10px; letter-spacing:0.08em; color:#9bb0d9; text-transform:uppercase;">Time</div>
              <div style="font-size:15px; color:#ffffff; margin-top:5px;">
                ${formatTimestamp(createdAt)}
              </div>
            </div>
          </div>

          ${
            snapshotUrl
              ? `
                <div style="margin-top:18px;">
                  <img
                    src="${snapshotUrl}"
                    alt="Incident Snapshot"
                    style="width:100%; max-width:100%; border-radius:12px; border:1px solid #2b3d65; display:block;"
                  />
                </div>
              `
              : ''
          }

          <div style="margin-top:24px;">
            <a
              href="${viewerUrl}"
              style="display:inline-block; background:#3b82f6; color:white; text-decoration:none; padding:14px 22px; border-radius:10px; font-weight:bold; font-size:15px;"
            >
              View Live Feed
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  const response = await resend.emails.send({
    from: 'Alert System <alerts@yourdomain.com>',
    to: recipientEmail,
    subject: `🚨 ${title} | ${type}`,
    html: emailHtml,
  });

  if (response.error) {
    throw new Error(response.error.message || 'Email failed to send');
  }

  return response;
}