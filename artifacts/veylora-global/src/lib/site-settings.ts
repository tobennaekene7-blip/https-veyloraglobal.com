import { useQuery } from "@tanstack/react-query"
import { customFetch } from "@workspace/api-client-react"

// Mirrors the backend's SETTINGS_FIELDS defaults
// (artifacts/api-server/src/lib/settingsFields.ts) for the public groups
// (general/branding/seo) so the site renders correct content immediately
// on first paint, before the /api/settings/public fetch resolves — and
// keeps working even if that fetch ever fails.
export interface SiteSettings {
  site_name: string
  tagline: string
  company_blurb: string
  founding_year: string
  contact_email: string
  contact_email_secondary: string
  contact_phone: string
  contact_phone_secondary: string
  office_address: string
  social_facebook: string
  social_twitter: string
  social_linkedin: string
  color_primary_hsl: string
  color_accent_hsl: string
  seo_title: string
  seo_description: string
  footer_text: string
  business_hours: string
  currency: string
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  site_name: "Veylora Global",
  tagline: "Express Delivery",
  company_blurb:
    "Global logistics solutions tailored for your business. Reliable air freight, sea shipping, and road delivery across borders.",
  founding_year: "1998",
  contact_email: "support@veyloraglobal.online",
  contact_email_secondary: "sales@veyloraglobal.online",
  contact_phone: "+1 (800) 555-0199",
  contact_phone_secondary: "+1 (212) 555-0188",
  office_address: "1200 Logistics Way, Suite 400\nNew York, NY 10001, USA",
  social_facebook: "",
  social_twitter: "",
  social_linkedin: "",
  color_primary_hsl: "167 47% 11%",
  color_accent_hsl: "43 95% 53%",
  seo_title: "Veylora Global — Global Logistics & Express Delivery",
  seo_description:
    "Fast, secure, and reliable freight forwarding across the globe. Track your cargo in real-time and experience logistics excellence.",
  footer_text: "All rights reserved.",
  business_hours: "Mon–Fri: 8am–6pm",
  currency: "USD",
}

/**
 * Public site settings (company info, theme colors, SEO) — renders
 * instantly from hardcoded defaults via `initialData`, then swaps in the
 * admin-configured values once the fetch resolves. No loading state to
 * handle: the shape is always complete.
 */
export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings-public"],
    queryFn: () => customFetch<SiteSettings>("/api/settings/public"),
    initialData: DEFAULT_SITE_SETTINGS,
    staleTime: 5 * 60 * 1000,
  })
}
