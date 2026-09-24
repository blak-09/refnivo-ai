import Link from "next/link";
import type { Metadata } from "next";
import { AlertCircleIcon, ShieldCheckIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Refnivo collects, uses, stores and protects information when you use the platform.",
};

/**
 * ── OWNER: EDIT THESE THREE VALUES ─────────────────────────────────────────
 * Anything still written as [INSERT …] renders with a visible "needs to be
 * filled in" marker on the page, so a placeholder can never be mistaken for a
 * real policy detail. Replace the value and the marker disappears.
 */
const POLICY = {
  effectiveDate: "[INSERT DATE]",
  lastUpdated: "[INSERT DATE]",
  privacyEmail: "[INSERT PRIVACY EMAIL]",
  /** Registered entity name and address, once the company details are final. */
  legalEntity: "[INSERT LEGAL ENTITY NAME AND REGISTERED ADDRESS]",
};

const isPlaceholder = (value: string) => /^\[.*\]$/.test(value.trim());

/** Renders a value, or the placeholder marked as outstanding. */
function Editable({ value }: { value: string }) {
  if (!isPlaceholder(value)) return <>{value}</>;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-amber-400/70 bg-amber-50 px-1.5 py-0.5 font-mono text-[0.8em] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertCircleIcon className="size-3" aria-hidden />
      {value}
    </span>
  );
}

const SECTIONS = [
  { id: "information-we-collect", title: "Information we collect" },
  { id: "how-we-use-information", title: "How we use information" },
  { id: "information-sharing", title: "Information sharing" },
  { id: "cookies", title: "Cookies and tracking" },
  { id: "data-security", title: "Data security" },
  { id: "data-retention", title: "Data retention" },
  { id: "your-rights", title: "Your rights" },
  { id: "account-deletion", title: "Account deletion" },
  { id: "childrens-privacy", title: "Children’s privacy" },
  { id: "third-party-services", title: "Third-party services" },
  { id: "changes", title: "Changes to this policy" },
  { id: "contact", title: "Contact us" },
];

function Section({ id, index, title, children }: { id: string; index: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t pt-8 first:border-t-0 first:pt-0">
      <h2 className="flex items-baseline gap-3 text-lg font-semibold tracking-tight sm:text-xl">
        <span className="text-sm font-bold text-indigo-500 tabular-nums">{String(index).padStart(2, "0")}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <>
      {/* Header */}
      <section className="border-b bg-linear-to-b from-violet-50/70 to-background py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-medium text-foreground" aria-current="page">
                Privacy Policy
              </li>
            </ol>
          </nav>
          {/* Icon stacks above the heading on phones so the title keeps the full width. */}
          <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:mt-1">
              <ShieldCheckIcon className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Your privacy matters to us. This Privacy Policy explains how Refnivo collects, uses, stores and protects information when you use our platform.
              </p>
            </div>
          </div>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            {[
              { label: "Effective date", value: POLICY.effectiveDate },
              { label: "Last updated", value: POLICY.lastUpdated },
              { label: "Privacy contact", value: POLICY.privacyEmail },
            ].map((row) => (
              <div key={row.label} className="rounded-xl border bg-card px-3 py-2.5">
                <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
                <dd className="mt-1 font-medium break-words">
                  {row.label === "Privacy contact" && !isPlaceholder(row.value) ? (
                    <a href={`mailto:${row.value}`} className="text-primary underline-offset-4 hover:underline">
                      {row.value}
                    </a>
                  ) : (
                    <Editable value={row.value} />
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
          {/* On this page */}
          <nav aria-label="On this page" className="mb-10 lg:sticky lg:top-24 lg:mb-0 lg:self-start">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">On this page</p>
            <ol className="mt-3 space-y-1.5 text-sm">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-2 text-muted-foreground transition-colors hover:text-foreground">
                    <span className="tabular-nums opacity-60">{String(i + 1).padStart(2, "0")}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-8">
            <Section id="information-we-collect" index={1} title="Information we collect">
              <p>We collect only what a feature needs. Depending on how you use Refnivo, that may include:</p>
              <ul>
                <li>
                  <strong>Account information</strong> — name, email address, optional phone number, your role (brand, creator or customer) and a hashed password.
                  If you sign in with Google, we receive your name, email address and profile picture from Google instead of a password.
                </li>
                <li>
                  <strong>Profile information</strong> — brand details (name, logo, website, category, description), creator profile details (display name,
                  username, bio, category, self-reported audience numbers) and anything else you choose to publish.
                </li>
                <li>
                  <strong>Campaign and product information</strong> — products, offers, commission and reward rules, campaign dates and rules you create.
                </li>
                <li>
                  <strong>Referral and transaction information</strong> — referral links and codes, link clicks and QR scans (recorded against a randomly
                  generated visitor identifier stored in a cookie, with the IP address stored only as a salted hash, never in raw form), order confirmations,
                  order references and values, commissions, rewards and payout requests.
                </li>
                <li>
                  <strong>Order-confirmation details</strong> — when a customer confirms an order, the email or phone used for that order is stored as a salted
                  hash plus a masked version (for example <span className="font-mono">ar•••@example.com</span>) so the brand can match the order without receiving
                  the full contact details.
                </li>
                <li>
                  <strong>Device and usage information</strong> — browser user agent and referring page for link clicks, and basic server logs needed to operate
                  and secure the service.
                </li>
                <li>
                  <strong>Information you provide voluntarily</strong> — messages you send us, campaign applications, notes on orders and support requests.
                </li>
              </ul>
              <p>We do not ask for card numbers or bank credentials on Refnivo, and no payment processor is connected to the platform at this time.</p>
            </Section>

            <Section id="how-we-use-information" index={2} title="How we use information">
              <ul>
                <li>Create and manage accounts, and keep you signed in.</li>
                <li>Provide the platform: campaigns, referral links, QR codes, dashboards and the ledger.</li>
                <li>Facilitate collaboration between brands and creators, including applications and approvals.</li>
                <li>Track referrals, order confirmations and campaign performance, and attribute them to the right partner.</li>
                <li>Calculate and settle commissions, rewards and payout requests.</li>
                <li>Communicate with you — service emails and in-app notifications about applications, orders, payouts and account changes.</li>
                <li>Improve the platform and understand which features are used.</li>
                <li>Maintain security: rate limiting, session protection and abuse detection.</li>
                <li>Prevent fraud and abuse, such as self-referrals and duplicate order claims.</li>
                <li>Comply with applicable legal requirements and resolve disputes.</li>
              </ul>
            </Section>

            <Section id="information-sharing" index={3} title="Information sharing">
              <p>We do not sell personal information. We share it only where it is needed to run the platform:</p>
              <ul>
                <li>
                  <strong>With other users, where the feature requires it</strong> — a brand sees the profile and self-reported audience details of creators who
                  apply to its campaigns, and the masked contact plus order number on an order confirmation. Partners see the brand and campaign they joined.
                  Public profile pages are visible to anyone.
                </li>
                <li>
                  <strong>With service providers</strong> that operate parts of the platform on our behalf (see{" "}
                  <a href="#third-party-services">Third-party services</a>).
                </li>
                <li>
                  <strong>With payment providers</strong>, if and when online payments are enabled. Payouts are currently arranged by our team outside the
                  platform, and this section will be updated before that changes.
                </li>
                <li>
                  <strong>With authorities or advisers</strong> where we are legally required to, or where it is necessary to establish, exercise or defend legal
                  claims.
                </li>
                <li>
                  <strong>In a business transfer</strong> — if the business or its assets are acquired or reorganised, information may transfer as part of that
                  transaction.
                </li>
              </ul>
            </Section>

            <Section id="cookies" index={4} title="Cookies and tracking">
              <p>Refnivo uses a small number of first-party cookies. We do not run third-party advertising or analytics trackers on the site.</p>
              <ul>
                <li>
                  <strong>Necessary — session.</strong> A sign-in cookie that keeps you authenticated and lets us end every session if a password changes.
                </li>
                <li>
                  <strong>Necessary — referral attribution.</strong> A randomly generated visitor identifier and a last-click referral cookie, so a referral can be
                  credited to the right partner. The referral cookie expires after the campaign’s attribution window (30 days by default); the visitor identifier
                  lasts up to a year.
                </li>
                <li>
                  <strong>Necessary — sign-up flow.</strong> A short-lived cookie that remembers which role you chose when signing in with Google (10 minutes).
                </li>
              </ul>
              <p>
                You can clear or block cookies in your browser. Blocking the session cookie will prevent you from signing in; blocking the referral cookies means a
                purchase may not be credited to the person who referred you.
              </p>
            </Section>

            <Section id="data-security" index={5} title="Data security">
              <p>
                We use reasonable technical and organisational measures to protect information: passwords are stored only as bcrypt hashes, traffic is served over
                HTTPS, IP addresses and order contacts are stored as salted hashes, dashboards are protected by role-based access checks, sensitive actions are rate
                limited, and changes to money are written to an audit log.
              </p>
              <p>No online service can be completely secure, and we cannot guarantee that unauthorised access will never occur. Please use a strong, unique password.</p>
            </Section>

            <Section id="data-retention" index={6} title="Data retention">
              <p>
                We keep information for as long as it is needed to provide the service, and afterwards where we must retain records to resolve disputes, enforce our
                agreements, prevent abuse or comply with legal obligations.
              </p>
              <p>
                Referral, order and payout records are financial history for both sides of a campaign, so they are retained after an account is closed — attached to
                an anonymised account rather than to your personal details (see <a href="#account-deletion">Account deletion</a>).
              </p>
            </Section>

            <Section id="your-rights" index={7} title="Your rights">
              <p>Depending on where you live and which laws apply to you, you may have the right to:</p>
              <ul>
                <li>Access the personal information we hold about you.</li>
                <li>Correct information that is inaccurate or out of date.</li>
                <li>Request deletion of your personal information.</li>
                <li>Request a copy of information you provided to us.</li>
                <li>Manage communication preferences — email notifications can be turned off in your dashboard settings at any time.</li>
                <li>Withdraw consent where our use of information relies on consent.</li>
              </ul>
              <p>
                Not every right applies in every jurisdiction, and some requests are limited by records we must keep. You can exercise most of these directly from
                your dashboard, or write to us at <Editable value={POLICY.privacyEmail} />.
              </p>
            </Section>

            <Section id="account-deletion" index={8} title="Account deletion">
              <p>
                You can delete your account yourself: sign in and open <strong>Dashboard → Settings → Delete account</strong>. You will be asked to confirm, and to
                re-enter your password if your account has one.
              </p>
              <p>What deletion does:</p>
              <ul>
                <li>
                  <strong>Removed:</strong> your name, email address, phone number, profile photo, password, Google link, notifications, queued emails and your
                  public creator profile. Your email address is freed, so you can register again later.
                </li>
                <li>
                  <strong>Kept, attached to an anonymised account:</strong> referrals, confirmed orders, commissions, rewards, payout requests and audit records,
                  because the other side of each transaction — a brand’s ledger or a partner’s earnings — must not change when one party leaves.
                </li>
                <li>
                  If you own a brand, its campaigns are ended and referral links disabled. An open payout request must be settled or cancelled before deletion.
                </li>
              </ul>
              <p>
                If you cannot sign in, contact us at <Editable value={POLICY.privacyEmail} /> and we will verify your identity before acting on the request.
              </p>
            </Section>

            <Section id="childrens-privacy" index={9} title="Children’s privacy">
              <p>
                Refnivo is built for businesses and adults, and is not directed at children. We do not knowingly collect personal information from children where
                that is prohibited by applicable law. If you believe a child has provided us with personal information, contact us and we will review and remove it
                where required.
              </p>
            </Section>

            <Section id="third-party-services" index={10} title="Third-party services">
              <p>We rely on a small number of providers to run the platform. Each processes only what its function requires:</p>
              <ul>
                <li>
                  <strong>Vercel</strong> — application hosting and delivery.
                </li>
                <li>
                  <strong>Supabase</strong> — database and file storage for uploaded images.
                </li>
                <li>
                  <strong>Google</strong> — optional “Sign in with Google” authentication, when you choose it.
                </li>
                <li>
                  <strong>Resend</strong> — delivery of service emails such as verification, notifications and payout updates.
                </li>
                <li>
                  <strong>Upstash</strong> — rate limiting, which processes a hashed identifier for abuse protection.
                </li>
              </ul>
              <p>
                We do not currently use third-party analytics, advertising or AI providers, and no payment processor is connected. If that changes, this section
                will be updated before the provider goes live.
              </p>
            </Section>

            <Section id="changes" index={11} title="Changes to this policy">
              <p>
                We may update this Privacy Policy from time to time — for example when we add a feature or a provider. The latest version is always published on
                this page with an updated “last updated” date, and we will give notice of significant changes where required.
              </p>
            </Section>

            <Section id="contact" index={12} title="Contact us">
              <p>Questions about your privacy?</p>
              <Card className="rounded-2xl not-prose">
                <CardContent className="space-y-2 text-sm">
                  <p className="text-foreground">
                    Contact us at <Editable value={POLICY.privacyEmail} />.
                  </p>
                  <p className="text-muted-foreground">
                    Entity and registered address: <Editable value={POLICY.legalEntity} />
                  </p>
                  <p className="text-muted-foreground">
                    General enquiries go through our{" "}
                    <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
                      contact page
                    </Link>
                    ; signed-in users can also raise verification and payout questions from their dashboard.
                  </p>
                </CardContent>
              </Card>
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}
