# SaaS Architecture Sketch — RSVP Event Planner

## Stack Recommendation

| Layer | Technology |
|-------|-----------|
| Frontend | React (existing) + TailwindCSS |
| Backend | Supabase (auth, database, storage, row-level security) |
| Billing | Stripe |
| Hosting | Vercel (frontend) + Supabase Cloud (backend) |

---

## Data Model

```
users
  id, email, created_at

organizations        ← a "team" or individual account
  id, name, owner_id, plan (free|pro|enterprise), created_at

events               ← replaces the current single-event assumption
  id, org_id, name, date, venue, created_at

guests
  id, event_id, name, email, phone, rsvp_status, dietary, plus_one

floor_plans
  id, event_id, bg_image_url, orientation
  tables: JSONB      ← existing table layout data

seat_assignments
  id, floor_plan_id, table_id, guest_id
```

---

## Auth & Multi-tenancy

```
User → belongs to → Organization → has many → Events
```

- Supabase Auth handles login (email/password, Google OAuth)
- Row-Level Security (RLS) policies ensure users only see their org's data:

```sql
-- guests table policy
USING (event_id IN (
  SELECT id FROM events WHERE org_id = current_user_org()
))
```

---

## Pricing Tiers

| Plan | Price | Events | Guests/event |
|------|-------|--------|--------------|
| Free | $0 | 1 | 50 |
| Pro | $15/mo | Unlimited | 500 |
| Business | $49/mo | Unlimited | Unlimited + team members |

---

## Migration Path (phased)

### Phase 1 — Backend Foundation (2–3 weeks)
- Set up Supabase project
- Migrate localStorage → Supabase tables
- Add auth (login/signup page)

### Phase 2 — Multi-event Support (1–2 weeks)
- Event dashboard (list, create, delete events)
- Scope all existing tabs (guests, floor plan) under a selected event

### Phase 3 — Billing (1 week)
- Stripe Checkout for plan upgrades
- Enforce guest/event limits based on plan
- Webhook to sync subscription status to `organizations` table

### Phase 4 — Polish & Launch (2–3 weeks)
- Landing page with pricing
- Onboarding flow
- Export as PDF (floor plan + guest list)
- Basic email invite to co-planners

---

## Folder Structure (refactored)

```
src/
  pages/
    login.jsx
    dashboard.jsx           ← event list
    events/[id]/
      guests.jsx            ← AllGuestTab
      floor-plan.jsx        ← FloorPlanTab
      rsvp.jsx
  components/
    ui/                     ← existing shadcn components
  lib/
    supabase.js             ← supabase client
    stripe.js
  hooks/
    useEvent.js
    useGuests.js
    useFloorPlan.js
```

---

## Effort Estimate (solo dev)

| Phase | Estimated Time |
|-------|---------------|
| Phase 1 — Backend foundation | 2–3 weeks |
| Phase 2 — Multi-event support | 1–2 weeks |
| Phase 3 — Billing | 1 week |
| Phase 4 — Polish & launch | 2–3 weeks |
| **Total** | **~6–9 weeks** |

---

## Notes

- **Supabase** is the right call here — it eliminates the need to build auth and row-level security from scratch, and maps cleanly to the existing data shape.
- The biggest structural change is introducing `organizations` and `events` as top-level containers around everything that already exists.
- Existing players in this space: AllSeated, Social Tables. Key differentiator should be **price** (cheaper) or **simplicity** (less bloated).
- Validate demand before rebuilding the architecture — consider a waitlist or early access page first.
