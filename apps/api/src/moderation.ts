// SQL for keeping people apart and content out of sight (routes/social.ts, routes/moderation.ts).
// `viewer` is the query parameter holding the viewer's user id ("$1").

// People the viewer never sees, and who never see them: anyone either has blocked, and
// suspended accounts.
export const hiddenPeople = (viewer: string) => `(
  SELECT blocked_id FROM blocks WHERE blocker_id = ${viewer}
  UNION SELECT blocker_id FROM blocks WHERE blocked_id = ${viewer}
  UNION SELECT user_id FROM users WHERE banned_at IS NOT NULL
)`;

// Posts and comments the viewer reported: out of their sight as soon as they report them.
export const reportedBy = (viewer: string) => `(SELECT target_id FROM reports WHERE reporter_id = ${viewer})`;

// Tells whoever looks after reports that one came in, by email through Resend
// (https://resend.com), if RESEND_API_KEY and REPORTS_EMAIL are set. Apple expects reports to be
// acted on within a day, so they shouldn't wait for someone to open the Reports page. Never
// throws: a report is saved either way.
export async function notifyReport(
  report: { reason: string; targetType: string; content: string | null; details?: string | undefined },
  log: { warn: (obj: unknown, msg: string) => void },
) {
  const { RESEND_API_KEY, REPORTS_EMAIL, REPORTS_EMAIL_FROM, WEB_URL } = process.env;
  if (!RESEND_API_KEY || !REPORTS_EMAIL) return;
  const lines = [
    `A ${report.targetType} was reported for ${report.reason}.`,
    report.content ? `\nWhat was reported:\n${report.content}` : "",
    report.details ? `\nThe reporter added:\n${report.details}` : "",
    `\nReview it: ${WEB_URL ?? "https://hobbsflight.com"}/admin/reports`,
  ];
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: REPORTS_EMAIL_FROM ?? "Hobbs <reports@hobbsflight.com>",
        to: REPORTS_EMAIL.split(",").map((s) => s.trim()),
        subject: `Hobbs report: ${report.targetType} (${report.reason})`,
        text: lines.filter(Boolean).join("\n"),
      }),
    });
    if (!response.ok) log.warn({ status: response.status, body: await response.text() }, "Report email failed");
  } catch (err) {
    log.warn({ err }, "Report email failed");
  }
}
