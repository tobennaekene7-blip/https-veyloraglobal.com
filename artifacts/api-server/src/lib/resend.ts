import { getSettingsMap } from "./settings";

export interface EmailAttachment {
  /** Original filename, shown to the recipient (e.g. "receipt.pdf"). */
  filename: string;
  /** Base64-encoded file content, no "data:...;base64," prefix. */
  content: string;
}

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  attachments?: EmailAttachment[],
): Promise<void> {
  const settings = await getSettingsMap(["resend_api_key", "from_email"]);
  const apiKey = settings.resend_api_key ?? process.env.RESEND_API_KEY;
  const fromAddress =
    settings.from_email ?? process.env.FROM_EMAIL ?? "Veylora Global <support@veyloraglobal.online>";

  if (!apiKey) {
    throw new Error("Resend API key is not configured. Set it in Admin → Settings → Integrations.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to,
      subject,
      html,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }
}

export async function getFromAddress(): Promise<string> {
  const settings = await getSettingsMap(["from_email"]);
  return settings.from_email ?? process.env.FROM_EMAIL ?? "Veylora Global <support@veyloraglobal.online>";
}

export async function getResendApiKey(): Promise<string | undefined> {
  const settings = await getSettingsMap(["resend_api_key"]);
  return settings.resend_api_key ?? process.env.RESEND_API_KEY;
}
