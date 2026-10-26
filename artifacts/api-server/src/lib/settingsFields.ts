// Single source of truth for every admin-editable site setting: its
// group, whether it's a secret (masked on read, never sent back in
// plaintext once saved), and its default value (used when no row exists
// yet in `app_settings`, and mirrored by the frontend for instant render
// before the first fetch resolves).
export type SettingGroup = "general" | "branding" | "integrations" | "seo";

export interface SettingField {
  key: string;
  group: SettingGroup;
  secret: boolean;
  default: string;
  label: string;
}

export const SETTINGS_FIELDS: SettingField[] = [
  // General — company & contact info
  { key: "site_name", group: "general", secret: false, default: "Veylora Global", label: "Company name" },
  { key: "tagline", group: "general", secret: false, default: "Express Delivery", label: "Tagline" },
  {
    key: "company_blurb",
    group: "general",
    secret: false,
    default:
      "Global logistics solutions tailored for your business. Reliable air freight, sea shipping, and road delivery across borders.",
    label: "Short company description",
  },
  { key: "founding_year", group: "general", secret: false, default: "1998", label: "Founded in" },
  { key: "contact_email", group: "general", secret: false, default: "support@veyloraglobal.online", label: "Primary contact email" },
  { key: "contact_email_secondary", group: "general", secret: false, default: "sales@veyloraglobal.online", label: "Secondary contact email" },
  { key: "contact_phone", group: "general", secret: false, default: "+1 (800) 555-0199", label: "Primary phone (toll-free)" },
  { key: "contact_phone_secondary", group: "general", secret: false, default: "+1 (212) 555-0188", label: "Secondary phone (international)" },
  {
    key: "office_address",
    group: "general",
    secret: false,
    default: "1200 Logistics Way, Suite 400\nNew York, NY 10001, USA",
    label: "Office address",
  },
  { key: "social_facebook", group: "general", secret: false, default: "", label: "Facebook URL" },
  { key: "social_twitter", group: "general", secret: false, default: "", label: "Twitter / X URL" },
  { key: "social_linkedin", group: "general", secret: false, default: "", label: "LinkedIn URL" },

  // Branding — theme colors (applied at runtime via CSS custom properties)
  { key: "color_primary_hsl", group: "branding", secret: false, default: "167 47% 11%", label: "Primary color (HSL)" },
  { key: "color_accent_hsl", group: "branding", secret: false, default: "43 95% 53%", label: "Accent color (HSL)" },

  // Integrations — provider credentials
  { key: "resend_api_key", group: "integrations", secret: true, default: "", label: "Resend API Key" },
  { key: "from_email", group: "integrations", secret: false, default: "Veylora Global <support@veyloraglobal.online>", label: "From address (outbound email)" },
  { key: "admin_email", group: "integrations", secret: false, default: "support@veyloraglobal.online", label: "Admin notification email" },
  { key: "resend_webhook_secret", group: "integrations", secret: true, default: "", label: "Resend Inbound Webhook Secret" },
  { key: "termii_api_key", group: "integrations", secret: true, default: "", label: "Termii API Key" },
  { key: "termii_sender_id", group: "integrations", secret: false, default: "Veylora", label: "Termii Sender ID" },
  { key: "twilio_account_sid", group: "integrations", secret: true, default: "", label: "Twilio Account SID" },
  { key: "twilio_auth_token", group: "integrations", secret: true, default: "", label: "Twilio Auth Token" },
  { key: "twilio_from_number", group: "integrations", secret: false, default: "", label: "Twilio From Number" },

  // SEO & misc
  { key: "seo_title", group: "seo", secret: false, default: "Veylora Global — Global Logistics & Express Delivery", label: "SEO page title" },
  {
    key: "seo_description",
    group: "seo",
    secret: false,
    default: "Fast, secure, and reliable freight forwarding across the globe. Track your cargo in real-time and experience logistics excellence.",
    label: "SEO meta description",
  },
  { key: "footer_text", group: "seo", secret: false, default: "All rights reserved.", label: "Footer copyright line" },
  { key: "business_hours", group: "seo", secret: false, default: "Mon–Fri: 8am–6pm", label: "Business hours" },
  { key: "currency", group: "seo", secret: false, default: "USD", label: "Currency" },
];

export const PUBLIC_GROUPS: SettingGroup[] = ["general", "branding", "seo"];

export function fieldsForGroup(group: SettingGroup): SettingField[] {
  return SETTINGS_FIELDS.filter((f) => f.group === group);
}

export function fieldByKey(key: string): SettingField | undefined {
  return SETTINGS_FIELDS.find((f) => f.key === key);
}
