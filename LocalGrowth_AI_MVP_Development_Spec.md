# LocalGrowth AI — MVP Development Specification

> **Product:** LocalGrowth AI  
> **Positioning:** AI-powered affiliate and referral infrastructure for restaurants and local businesses  
> **Tagline:** Turn Customers and Creators Into Your Growth Engine  
> **Market:** India-first, starting with restaurants and cafes in Delhi NCR / Gurugram  
> **Document type:** Product requirements + implementation prompt + testing checklist

---

## 1. Role

You are a senior full-stack SaaS engineer, product architect, UI/UX designer, database engineer, security engineer, and AI product builder.

Build a real, functional MVP of **LocalGrowth AI**. Do not create only a static UI mockup.

The product must allow restaurants to create referral/affiliate campaigns and allow creators and customers to participate as referral partners.

The core flow is:

```text
Restaurant creates campaign
        ↓
Creator/customer joins campaign
        ↓
Unique referral link or code is generated
        ↓
Link is shared
        ↓
Referred person visits or purchases
        ↓
Restaurant verifies qualifying event
        ↓
Reward/commission is created
        ↓
Partner sees earnings and analytics
```

AI should assist campaign creation, creator recommendations, content generation, and growth insights. AI must not control money or fabricate metrics.

---

## 2. Product Vision

LocalGrowth AI helps restaurants and local businesses acquire customers through people they trust.

It combines:

1. Restaurant-owned referral programs.
2. Creator affiliate campaigns.
3. Customer-to-customer referrals.
4. Referral links and QR codes.
5. Conversion verification.
6. Rewards and commissions.
7. AI-powered growth assistance.
8. Business analytics.

### Positioning

> Levanta-style affiliate infrastructure for local commerce, with both creators and customers as referral partners.

Do not build a generic influencer marketplace, a simple loyalty app, or a restaurant ordering system.

---

## 3. MVP Scope

### Must-have in v1

- Authentication.
- Role-based access.
- Restaurant onboarding.
- Creator onboarding.
- Customer referral flow.
- Restaurant campaign creation.
- Creator campaign discovery and application.
- Unique referral links.
- Referral click tracking.
- Referral code/QR flow.
- Manual conversion verification.
- Reward and commission ledger.
- Basic payout request flow.
- Restaurant analytics.
- Creator earnings dashboard.
- Customer rewards dashboard.
- Admin dashboard.
- AI campaign generator.
- AI growth insights.
- AI creator content assistant.
- Responsive UI.
- Seed/demo data.
- Tests and README.

### Not required in v1

- Native mobile apps.
- Full POS integrations.
- Automatic UPI payouts.
- Advanced machine-learning fraud detection.
- Multi-country currencies.
- Full restaurant ordering/delivery system.
- Autonomous AI financial decisions.
- Large public creator marketplace.
- Complex tax accounting.

---

## 4. User Roles

### RESTAURANT_OWNER

Can:

- Create and edit restaurant profile.
- Create, edit, publish, pause, and archive campaigns.
- Set customer rewards.
- Set creator commissions.
- Set eligibility rules.
- Invite and approve creators.
- View customer referral partners.
- View clicks, referrals, conversions, revenue, rewards, and commissions.
- Manually verify or reject conversions.
- View AI insights.
- Request support.

### CREATOR

Can:

- Create creator profile.
- Add category, city, bio, and social links.
- Discover campaigns.
- Apply to campaigns.
- View approved campaigns.
- Generate referral links.
- Copy/share links.
- View clicks and conversions.
- View pending and approved commissions.
- Request payout.
- Use AI content assistant.

### CUSTOMER

Can:

- Open referral landing page.
- Join a restaurant referral program.
- Generate personal referral link/code.
- Share link.
- View referral activity.
- View pending and available rewards.
- Redeem or use eligible vouchers.

Keep customer onboarding low-friction. Do not force a complex dashboard before showing an offer.

### ADMIN

Can:

- Manage users.
- Manage restaurants.
- Manage creators.
- Manage campaigns.
- Review referral disputes.
- Verify or reject suspicious events.
- Manage payout requests.
- View audit logs.
- Suspend accounts.

---

## 5. Recommended Technology

Use this stack unless there is a strong technical reason to change it.

### Frontend

- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Lucide icons.
- Recharts.

### Backend

- Next.js server actions and/or API routes.
- Prisma ORM.
- PostgreSQL.
- Zod validation.

### Authentication

- Auth.js / NextAuth or another secure solution.
- Secure sessions.
- Role-based authorization.
- Password hashing if using passwords.

### AI

- OpenAI or Anthropic API.
- Server-side API calls only.
- Provider configurable through environment variables.
- Never expose API keys in frontend code.

### Deployment

- Vercel-compatible.
- PostgreSQL production database.
- `.env.example`.
- Production build must work.

### Testing

- Vitest or Jest for unit tests.
- Playwright for end-to-end tests.
- TypeScript checks.
- ESLint.
- Production build check.

---

## 6. Brand and UI Direction

Create a premium modern SaaS interface.

### Visual style

- Clean.
- Professional.
- Trustworthy.
- Human-centered.
- AI-powered without excessive futuristic effects.
- Responsive on desktop, tablet, and mobile.
- Strong typography.
- Clear spacing.
- Accessible contrast.
- Good empty, loading, and error states.

### Suggested colors

- Light background.
- Dark text.
- Green growth accent.
- Subtle neutral borders.
- Soft shadows.
- Restrained gradients.

Do not overuse:

- Neon colors.
- Glassmorphism.
- Excessive animations.
- Fake AI visuals.
- Huge decorative sections.

---

## 7. Public Landing Page

Create the following sections.

### Hero

**Heading:**

> Turn Customers and Creators Into Your Growth Engine.

**Subheading:**

> Launch referral and affiliate programs for your restaurant, work with creators and customers, and track the revenue generated through every recommendation.

Buttons:

- Start Growing.
- Join as Creator.
- See How It Works.

### How It Works

1. Create Your Campaign.
2. Activate Your Network.
3. Track and Reward Results.

### For Restaurants

> Build your own customer acquisition network.

Show:

- Campaign management.
- Creator partnerships.
- Customer referrals.
- Conversion tracking.
- AI growth insights.

### For Creators

> Earn from the restaurants you love.

Show:

- Campaign discovery.
- Referral links.
- Performance tracking.
- Commission dashboard.

### For Customers

> Share great places. Get rewarded.

Show:

- Personal referral links.
- Friend offers.
- Rewards.
- Easy sharing.

### AI Section

Show:

- AI Campaign Assistant.
- AI Creator Recommendations.
- AI Growth Insights.
- AI Content Assistant.

### Footer

Include:

- Product.
- For Restaurants.
- For Creators.
- About.
- Contact.
- Privacy.
- Terms.

---

## 8. Required Routes

Create clean routes similar to:

```text
/
 /pricing
 /about
 /auth/login
 /auth/register
 /auth/onboarding

 /dashboard/restaurant
 /dashboard/restaurant/campaigns
 /dashboard/restaurant/campaigns/new
 /dashboard/restaurant/partners
 /dashboard/restaurant/referrals
 /dashboard/restaurant/analytics
 /dashboard/restaurant/ai
 /dashboard/restaurant/settings

 /dashboard/creator
 /dashboard/creator/campaigns
 /dashboard/creator/campaigns/[id]
 /dashboard/creator/links
 /dashboard/creator/conversions
 /dashboard/creator/earnings
 /dashboard/creator/payouts
 /dashboard/creator/profile

 /dashboard/customer
 /dashboard/customer/referrals
 /dashboard/customer/rewards
 /dashboard/customer/profile

 /dashboard/admin
 /dashboard/admin/users
 /dashboard/admin/restaurants
 /dashboard/admin/creators
 /dashboard/admin/campaigns
 /dashboard/admin/referrals
 /dashboard/admin/payouts
 /dashboard/admin/audit-logs

 /r/[code]
 /c/[code]
```

---

## 9. Database Models

Use Prisma and PostgreSQL.

### User

```text
id
name
email
passwordHash
role
phone
avatarUrl
status
createdAt
updatedAt
```

Roles:

```text
RESTAURANT_OWNER
CREATOR
CUSTOMER
ADMIN
```

### Restaurant

```text
id
ownerId
name
slug
description
logoUrl
coverImageUrl
address
city
state
country
latitude
longitude
cuisineType
phone
website
status
createdAt
updatedAt
```

### CreatorProfile

```text
id
userId
displayName
username
bio
profileImageUrl
category
city
followerCount
engagementRate
socialLinks
verificationStatus
createdAt
updatedAt
```

Do not claim follower or engagement data is verified unless it is actually verified.

### Campaign

```text
id
restaurantId
name
slug
description
campaignType
offerTitle
offerDescription
rewardType
customerRewardValue
creatorCommissionType
creatorCommissionValue
minimumPurchaseAmount
newCustomerOnly
startDate
endDate
budget
status
createdAt
updatedAt
```

Statuses:

```text
DRAFT
PENDING_REVIEW
ACTIVE
PAUSED
ENDED
ARCHIVED
```

### PartnerApplication

```text
id
campaignId
userId
partnerType
status
message
createdAt
updatedAt
```

Partner types:

```text
CREATOR
CUSTOMER
```

### ReferralLink

```text
id
campaignId
ownerId
partnerType
code
destinationUrl
status
createdAt
updatedAt
```

Use secure, unique random codes. Creator and customer links must be distinguishable.

### ReferralClick

```text
id
referralLinkId
campaignId
anonymousVisitorId
ipHash
userAgent
createdAt
```

Do not store unnecessary personal data.

### Referral

```text
id
campaignId
referralLinkId
referrerId
referredUserId
referredPhoneHash
status
qualifyingEvent
verifiedAt
createdAt
updatedAt
```

Statuses:

```text
PENDING
CLICKED
VISITED
PURCHASED
VERIFIED
REJECTED
CANCELLED
```

### Conversion

```text
id
referralId
restaurantId
orderReference
amount
currency
source
verifiedBy
verifiedAt
createdAt
```

### Reward

```text
id
referralId
recipientId
rewardType
amount
currency
status
createdAt
updatedAt
```

### Commission

```text
id
referralId
creatorId
amount
currency
status
createdAt
updatedAt
```

Statuses:

```text
PENDING
APPROVED
PAID
REJECTED
```

### PayoutRequest

```text
id
userId
amount
currency
status
payoutMethod
payoutReference
requestedAt
processedAt
```

Statuses:

```text
REQUESTED
UNDER_REVIEW
APPROVED
PROCESSING
PAID
REJECTED
```

### AIInsight

```text
id
restaurantId
campaignId
type
title
description
recommendation
createdAt
```

### AuditLog

```text
id
userId
action
entityType
entityId
metadata
createdAt
```

Add foreign keys, indexes, unique constraints, timestamps, and appropriate cascade rules.

---

## 10. Restaurant Dashboard

Create a professional SaaS dashboard with sidebar navigation.

### Navigation

```text
Overview
Campaigns
Partners
Referrals
Rewards & Commissions
Analytics
AI Growth Assistant
Restaurant Profile
Settings
```

### Overview KPI cards

- Attributed revenue.
- Active campaigns.
- New referred customers.
- Active partners.
- Pending rewards.
- Campaign ROI.

### Charts

- Revenue by campaign.
- Referrals over time.
- Creator vs customer referrals.
- Conversion funnel.
- Reward and commission cost.

### AI insight card

Example:

> Your weekend campaign generated more eligible customers than your weekday campaign. Consider testing a similar offer next weekend.

Never fabricate metrics. If data is insufficient, say so.

---

## 11. Campaign Creation Wizard

Create a multi-step flow.

### Step 1: Basic information

Fields:

- Campaign name.
- Description.
- Offer title.
- Offer description.
- Category.

### Step 2: Rewards and commissions

Fields:

- Customer reward type.
- Customer reward value.
- Creator commission type.
- Creator commission value.
- Currency.

Types:

```text
FIXED_AMOUNT
PERCENTAGE
VOUCHER
DISCOUNT
```

### Step 3: Eligibility

Fields:

- New customer only.
- Minimum purchase amount.
- Validity duration.
- Maximum reward per customer.
- Campaign budget.

### Step 4: Duration

- Start date.
- End date.

### Step 5: Preview

Show:

- Customer offer.
- Creator commission.
- Eligibility.
- Campaign rules.
- Estimated reward cost.

### Step 6: Publish

Before publishing:

- Validate all values.
- Confirm dates.
- Confirm budget.
- Confirm reward rules.
- Require owner confirmation.

---

## 12. Creator Dashboard

### Navigation

```text
Overview
Discover Campaigns
My Campaigns
Referral Links
Conversions
Earnings
Payouts
Profile
Settings
```

### KPI cards

- Total clicks.
- Eligible referrals.
- Total earnings.
- Pending earnings.
- Approved earnings.

### Discover campaigns

Campaign cards must show:

- Restaurant image.
- Restaurant name.
- Location.
- Campaign name.
- Offer.
- Commission.
- Duration.
- Application status.
- Apply button.

Filters:

- City.
- Category.
- Commission.
- Campaign type.

### Campaign details

Show:

- Restaurant details.
- Offer.
- Commission rules.
- Eligibility.
- Terms.
- Apply button.

---

## 13. Customer Experience

Keep this simple and mobile-friendly.

### Referral landing page

Example:

```text
The Burger House
Gurugram

Weekend Burger Offer

Get ₹100 OFF on your first eligible purchase.

Referred by: Foodie Gurgaon

[Get Offer]
[Get Directions]
[Share]
```

### Customer dashboard

Show:

- Active referral links.
- Total referrals.
- Successful referrals.
- Rewards earned.
- Pending rewards.
- Reward history.

### Referral link card

Show:

- Restaurant.
- Campaign.
- Link.
- Copy button.
- Share button.
- QR code.
- Status.

Do not expose private information about referred people.

---

## 14. Referral Link and Attribution System

### Public routes

```text
/r/[code]  → customer referral
/c/[code]  → creator referral
```

### On click

1. Validate code.
2. Validate campaign status.
3. Record click.
4. Create anonymous visitor ID.
5. Store attribution securely.
6. Redirect to campaign landing page.
7. Display valid offer and terms.

### Attribution rules for MVP

- Last valid referral click wins.
- Attribution window defaults to 30 days.
- Campaign must be active.
- Expired or paused campaigns must not create new eligible conversions.
- Do not count a click as a sale.

### Self-referral and duplicate prevention

Flag or reject:

- Same user referring themselves.
- Same account referring itself.
- Duplicate referral for the same campaign and customer.
- Suspicious repeated code usage.
- Duplicate order reference.

Use more than IP address. IP alone is not reliable.

---

## 15. Conversion Verification

Implement manual verification first.

### Method 1: Manual restaurant verification

Restaurant opens:

```text
Referrals → Pending Verification
```

Show:

- Campaign.
- Referral partner.
- Date.
- Order reference.
- Purchase amount.
- Status.

Actions:

- Verify.
- Reject.
- Request review.

### Method 2: Referral code at checkout

Customer provides code.

Restaurant enters code and purchase details.

### Method 3: QR code

Customer displays QR code.

Restaurant scans it.

A QR scan alone must not automatically mean a completed purchase. The restaurant must confirm the qualifying event.

---

## 16. Rewards and Commission Logic

### Customer reward flow

```text
Referral created
    ↓
Purchase recorded
    ↓
Restaurant verifies
    ↓
Reward pending
    ↓
Reward approved
    ↓
Reward available
```

### Creator commission flow

```text
Referral created
    ↓
Eligible conversion
    ↓
Restaurant verifies
    ↓
Commission pending
    ↓
Commission approved
    ↓
Payout request
```

### Example

```text
Customer reward: ₹50
Creator commission: ₹100
```

If a creator generates 5 eligible customers:

```text
5 × ₹100 = ₹500 commission
```

If a customer generates 2 eligible referrals:

```text
2 × ₹50 = ₹100 reward
```

These are illustrative examples only.

Use integer minor units for money calculations where appropriate. Do not use floating-point arithmetic for financial amounts.

---

## 17. Wallet and Payouts

For v1, create an internal ledger.

### Creator wallet

```text
Total earnings
Pending
Approved
Paid
```

### Customer rewards

```text
Rewards earned
Pending
Available
Redeemed
```

### Payout request

- Minimum threshold configurable.
- Creator submits request.
- Admin reviews.
- Admin marks paid manually.
- Record payout reference and audit log.

Do not claim automatic UPI payouts unless a real payout provider is integrated.

---

## 18. AI Features

AI must be useful and grounded in real data.

### AI Feature 1: Campaign Generator

Input:

> Create a campaign for my Gurugram cafe to attract more customers on weekends.

Output:

- Campaign name.
- Description.
- Target audience.
- Offer ideas.
- Customer reward suggestion.
- Creator commission suggestion.
- Campaign duration suggestion.
- Promotion ideas.

All financial amounts must be labelled as suggestions.

Restaurant owner must approve before publishing.

### AI Feature 2: Growth Insights

Use actual database metrics:

- Clicks.
- Referrals.
- Verified conversions.
- Revenue.
- Reward cost.
- Commission cost.
- Conversion rate.

Possible output:

> Your creator campaign generated more eligible customers than your customer referral campaign during this period.

If data is missing:

> Not enough data to generate a reliable insight.

### AI Feature 3: Creator Matching

For v1, use simple rule-based scoring plus optional AI explanation.

Inputs:

- City.
- Category.
- Target audience.
- Campaign objective.
- Creator profile data.

Do not claim verified audience demographics or guaranteed sales without real data.

### AI Feature 4: Creator Content Assistant

Generate:

- Instagram caption.
- Reel idea.
- WhatsApp message.
- CTA.
- Short campaign summary.

Add:

- Copy.
- Edit.
- Regenerate.

### AI technical rules

- Server-side API calls.
- Environment-based API key.
- Input validation.
- Rate limits or usage limits.
- Loading state.
- Error state.
- Provider failure fallback.
- No fabricated metrics.
- No automatic payout approval.
- No automatic commission changes.
- No unnecessary personal data sent to AI.

Suggested files:

```text
lib/ai/campaign-generator.ts
lib/ai/growth-insights.ts
lib/ai/creator-matching.ts
lib/ai/content-assistant.ts
```

---

## 19. Admin Dashboard

### Overview

Show:

- Total users.
- Restaurants.
- Creators.
- Customers.
- Active campaigns.
- Verified conversions.
- Platform revenue.

### Management pages

- Users.
- Restaurants.
- Creators.
- Campaigns.
- Referrals.
- Payouts.
- Audit logs.

Admin must be able to:

- Search.
- Filter.
- View details.
- Suspend users.
- Approve/reject creators.
- Verify/reject referrals.
- Review payout requests.
- Record decisions.

---

## 20. Security and Privacy

Implement:

- Secure authentication.
- Role-based authorization.
- Server-side validation.
- Zod schemas.
- Protected routes.
- Ownership checks on every query.
- Secure referral codes.
- Duplicate conversion prevention.
- Audit logging.
- Rate limiting where practical.
- No API keys in client code.
- No unnecessary personal data collection.
- Safe error messages.
- No sensitive information in logs.

Restaurant A must never access Restaurant B's data.

Creators must only see campaigns and earnings they are authorized to see.

Customers must not see private information about referred users.

---

## 21. Demo Data

Create seed data marked clearly as demo data.

### Restaurants

- The Burger House — Gurugram.
- Brew District Cafe — Gurugram.
- Delhi Food Lab — Delhi.

### Creators

- Foodie Gurgaon.
- Delhi Eats.
- Campus Foodies.

### Campaigns

- Weekend Burger Offer.
- Coffee & Friends.
- First Visit Special.

Use realistic but clearly fictional sample metrics.

Display a `Demo Data` label wherever appropriate.

Never present seed data as real business performance.

---

## 22. Environment Variables

Create `.env.example` with placeholders such as:

```env
DATABASE_URL=
AUTH_SECRET=
NEXTAUTH_URL=

AI_PROVIDER=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

NEXT_PUBLIC_APP_URL=
```

Do not commit real secrets.

Document every variable in the README.

---

## 23. Testing Requirements

### Authentication tests

- User can register.
- User can log in.
- Invalid credentials fail.
- Protected routes redirect.
- Role restrictions work.

### Campaign tests

- Restaurant can create campaign.
- Restaurant can edit campaign.
- Restaurant can publish campaign.
- Invalid reward values are rejected.
- Expired campaigns cannot receive new eligible conversions.
- Non-owner cannot edit campaign.

### Referral tests

- Referral codes are unique.
- Valid link records click.
- Invalid link shows safe error.
- Paused campaign cannot create new conversion.
- Self-referral is blocked or flagged.
- Duplicate referral is blocked or flagged.
- Attribution window works.

### Conversion tests

- Restaurant can create conversion.
- Restaurant can verify conversion.
- Restaurant can reject conversion.
- Duplicate order reference is handled.
- Unauthorized user cannot verify conversion.

### Reward tests

- Reward calculation is correct.
- Reward is pending before verification.
- Reward becomes approved after verification.
- Duplicate reward is prevented.

### Commission tests

- Commission calculation is correct.
- Commission remains pending until verification.
- Approved commission appears in earnings.
- Duplicate commission is prevented.

### Payout tests

- Creator can request payout.
- Minimum threshold is enforced.
- Admin can approve/reject.
- Paid status is recorded.
- Audit log is created.

### AI tests

- Valid campaign prompt returns structured output.
- Empty prompt is rejected.
- AI provider failure has fallback.
- Growth insights use real metrics.
- Missing data does not produce invented numbers.
- AI cannot approve payouts.

### Security tests

- Cross-restaurant access is blocked.
- Cross-user access is blocked.
- Admin-only routes are protected.
- API keys are not exposed.
- Server-side validation works.

---

## 24. Development Phases

### Phase 0 — Planning

- Explain architecture.
- Confirm assumptions.
- Create folder structure.
- Create database ERD or model explanation.
- Define MVP boundaries.

### Phase 1 — Foundation

- Initialize Next.js.
- Configure TypeScript.
- Configure Tailwind and shadcn/ui.
- Configure Prisma and PostgreSQL.
- Add authentication.
- Add role-based access.
- Add environment variables.

### Phase 2 — Restaurant

- Restaurant onboarding.
- Restaurant profile.
- Campaign CRUD.
- Campaign publishing.
- Reward and commission settings.

### Phase 3 — Creator

- Creator onboarding.
- Campaign discovery.
- Application flow.
- Approval flow.
- Creator referral links.
- Creator dashboard.

### Phase 4 — Customer

- Referral landing page.
- Customer referral link.
- QR code.
- Customer dashboard.
- Reward history.

### Phase 5 — Tracking and Money Logic

- Click tracking.
- Referral attribution.
- Conversion recording.
- Manual verification.
- Reward ledger.
- Commission ledger.
- Payout requests.

### Phase 6 — Admin

- Admin dashboard.
- User management.
- Campaign management.
- Referral verification.
- Payout management.
- Audit logs.

### Phase 7 — AI

- Campaign generator.
- Growth insights.
- Creator content assistant.
- Basic creator matching.

### Phase 8 — QA and Deployment

- Unit tests.
- Integration tests.
- End-to-end tests.
- TypeScript check.
- Lint.
- Production build.
- Seed data.
- README.
- Deployment instructions.

---

## 25. Definition of Done

The MVP is complete only when this complete flow works:

### Restaurant

```text
Register
  ↓
Create restaurant
  ↓
Create campaign
  ↓
Set reward and commission
  ↓
Publish campaign
  ↓
View partners
  ↓
View referrals
  ↓
Verify conversion
  ↓
Approve reward/commission
```

### Creator

```text
Register
  ↓
Create profile
  ↓
Discover campaign
  ↓
Apply
  ↓
Get approved
  ↓
Generate referral link
  ↓
Share link
  ↓
View conversion
  ↓
View earnings
  ↓
Request payout
```

### Customer

```text
Open referral link
  ↓
View offer
  ↓
Join program
  ↓
Generate personal link
  ↓
Share with friend
  ↓
Friend visits
  ↓
Restaurant verifies
  ↓
Reward is created
```

### AI

```text
Restaurant opens AI assistant
  ↓
Enters campaign goal
  ↓
AI creates draft
  ↓
Restaurant reviews
  ↓
Restaurant approves
  ↓
Campaign is published
```

---

## 26. Final Deliverables

Provide:

1. Complete source code.
2. Prisma schema.
3. Database migrations.
4. Seed/demo data.
5. `.env.example`.
6. README.
7. Local setup instructions.
8. Deployment instructions.
9. Unit tests.
10. Integration tests.
11. End-to-end tests.
12. API documentation.
13. Feature documentation.
14. Known limitations.
15. Future roadmap.

---

## 27. Important Build Rules

- Build functional features, not fake buttons.
- Use real database operations.
- Use server-side authorization.
- Keep financial calculations deterministic.
- Keep AI optional and fault-tolerant.
- Clearly label demo data.
- Do not fabricate analytics.
- Do not claim automatic payouts without integration.
- Do not overbuild Phase 2 features in v1.
- Explain assumptions before making major architectural decisions.
- After each phase, run tests and report results.
- Fix errors before moving to the next phase.
- Keep the code modular and maintainable.

---

# 28. Developer Testing Checklist

Use this checklist while building.

## Foundation

- [ ] Project runs locally.
- [ ] Database connects.
- [ ] Prisma migration works.
- [ ] Authentication works.
- [ ] Role-based routing works.
- [ ] `.env.example` exists.
- [ ] README setup instructions work.

## Restaurant

- [ ] Restaurant can register.
- [ ] Restaurant profile can be created.
- [ ] Campaign can be created.
- [ ] Campaign can be edited.
- [ ] Campaign can be published.
- [ ] Campaign can be paused.
- [ ] Reward rules validate.
- [ ] Commission rules validate.
- [ ] Restaurant dashboard works.

## Creator

- [ ] Creator can register.
- [ ] Creator profile works.
- [ ] Campaign discovery works.
- [ ] Creator can apply.
- [ ] Restaurant can approve creator.
- [ ] Creator can generate link.
- [ ] Creator can see clicks.
- [ ] Creator can see conversions.
- [ ] Creator earnings work.

## Customer

- [ ] Customer referral link works.
- [ ] Campaign landing page works.
- [ ] Customer can join program.
- [ ] Customer link is unique.
- [ ] QR code works.
- [ ] Customer referral activity works.
- [ ] Customer reward status works.

## Tracking

- [ ] Click tracking works.
- [ ] Attribution works.
- [ ] Invalid codes are handled.
- [ ] Expired campaigns are handled.
- [ ] Self-referrals are blocked or flagged.
- [ ] Duplicate referrals are handled.
- [ ] Conversion can be recorded.
- [ ] Conversion can be verified.
- [ ] Conversion can be rejected.

## Rewards and payouts

- [ ] Reward calculation works.
- [ ] Commission calculation works.
- [ ] Pending status works.
- [ ] Approved status works.
- [ ] Payout request works.
- [ ] Admin payout review works.
- [ ] Audit logs work.

## AI

- [ ] Campaign generator works.
- [ ] AI errors are handled.
- [ ] AI output can be edited.
- [ ] AI insights use actual metrics.
- [ ] Missing data is handled.
- [ ] Creator content assistant works.
- [ ] AI keys are server-side.
- [ ] AI cannot approve payouts.

## Admin

- [ ] Admin dashboard works.
- [ ] User management works.
- [ ] Restaurant management works.
- [ ] Creator management works.
- [ ] Campaign management works.
- [ ] Referral review works.
- [ ] Payout review works.
- [ ] Audit logs work.

## Quality

- [ ] TypeScript passes.
- [ ] Lint passes.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] End-to-end tests pass.
- [ ] Production build passes.
- [ ] Mobile layout works.
- [ ] Loading states work.
- [ ] Empty states work.
- [ ] Error states work.
- [ ] No critical security issue remains.

---

# 29. Suggested Commands

Use commands appropriate for the selected stack.

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npx prisma migrate dev
npx prisma db seed
```

If a command does not exist, add it to `package.json` or document the correct equivalent.

---

# 30. Future Roadmap

## Phase 2

- WhatsApp integration.
- Automated reward notifications.
- Creator marketplace.
- Advanced creator matching.
- Restaurant subscription billing.
- Better analytics.
- Campaign templates.

## Phase 3

- POS integrations.
- Automated payout provider.
- Advanced fraud detection.
- Multi-location restaurants.
- More local business categories.
- Partner performance prediction.

## Phase 4

- AI Growth Agent.
- Automated campaign optimization.
- Cross-business referral network.
- Enterprise tools.
- International expansion.

---

# 31. Final Instruction

Start by explaining the architecture and identifying assumptions.

Then implement the MVP phase by phase.

After each phase:

1. Show what was built.
2. Run relevant tests.
3. Report passed and failed tests.
4. Fix failures.
5. Update the checklist.
6. Explain how to manually test the feature.
7. Only then continue to the next phase.

The final result must be a professional, functional, secure, India-first MVP of LocalGrowth AI.
