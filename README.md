# Private Watch Room Starter

This starter gives you two parts:

- a single-page Next.js room UI
- a minimal Chrome extension bridge for Netflix

## 1. Run the Next.js app

```bash
npm install
npm run dev
```

Open `http://localhost:3000`

## 2. Load the Chrome extension

- Open `chrome://extensions`
- Turn on **Developer mode**
- Click **Load unpacked**
- Choose the `extension` folder

## 3. Test the handshake

- Keep the Next.js app open on `http://localhost:3000`
- Open Netflix in another tab
- Start any title
- Refresh the room page

The room page should eventually show the extension as connected.

## What this starter already does

- polished single-page UI
- room status pills
- presence list
- chat UI
- local demo playback state
- extension handshake with `window.postMessage`
- Netflix content script with play / pause / seek / read current time

## What you still need to wire for production

- real realtime backend (Socket.IO or Supabase Realtime)
- real host/guest session logic
- invite pin or lightweight protection
- Chrome Web Store packaging if you want non-technical installs

# Watch Room App — Single-Page Technical Document

## 1. Product Overview

### Product name

Watch Room

### Product goal

A private, single-link watch companion app for two people that feels intimate, minimal, premium, and friction-light.

The app does **not** stream Netflix itself. Instead, it provides:

* one persistent room link
* shared room presence
* chat and reactions
* ready states
* playback command UI
* extension connection state
* sync status messaging

Optional Chrome extension support allows each user’s local Netflix tab to respond to room commands.

### Core product truth

This app is a **companion control surface**, not a streaming platform.

### Primary use case

One user and their girlfriend share the same permanent room link and use it repeatedly without accounts or multi-page flows.

---

## 2. Product Principles

### Experience principles

* single page only
* no auth
* one permanent reusable room
* fast join
* low cognitive load
* soft premium UI
* intimate rather than enterprise
* Apple-like restraint, but unmistakably Dyrane
* emotional clarity over feature bloat

### UX principles

* every element should justify its existence
* the UI should feel calm while still alive
* controls should feel intentional, not cluttered
* status should be visible without feeling technical
* the app should work even before realtime automation is fully complete
* extension state should be readable by non-technical users

---

## 3. Product Scope

### In scope for MVP

* single page room UI
* permanent room link
* no login/auth
* local session identity
* presence indicators
* ready toggle
* playback control surface
* tiny chat panel
* connection status
* extension detection state
* Netflix tab connection state
* sync status messaging
* host/guest role model
* local browser persistence
* extension bridge contract

### Out of scope for MVP

* multi-room architecture
* full auth
* direct Netflix embedding
* video calling
* group streaming beyond 2 people
* mobile native apps
* advanced moderation/admin tools
* payment/billing
* Chrome Web Store publishing workflow
* server-owned analytics dashboards

---

## 4. Functional Model

## 4.1 App structure

The app is a single persistent room.

Examples:

* `https://yourdomain.com`
* `https://yourdomain.com/room`

No room creation flow is needed.

## 4.2 User flow

1. User opens the permanent room link
2. App restores local session from localStorage
3. App joins the room
4. App shows room status, partner presence, and extension state
5. User opens Netflix in another tab
6. Extension connects and reports readiness
7. User can chat, toggle ready, and send playback actions
8. Shared sync state updates live

## 4.3 User model

No auth exists.

Users are represented by:

* local session id
* display name
* optional preferred role
* trusted local device state

## 4.4 Role model

Recommended:

* **Host**: primary control authority
* **Guest**: receives playback state and can request sync

Host can be:

* fixed by config
* selected by first device
* changed manually

For MVP, one host at a time is strongly preferred.

---

## 5. System Architecture

## 5.1 High-level architecture

### Production assumption

The app is deployed publicly and accessed over the internet.

Primary production shape:

* **Frontend**: Next.js deployed on Vercel
* **Source control**: GitHub
* **Database + Realtime**: Supabase
* **Extension**: Chrome extension installed locally on each user device

Example production URL:

* `https://watch-room.vercel.app`

### Layer 1 — Next.js App on Vercel

Responsibilities:

* single-page UI
* room state display
* local identity/session persistence
* Supabase client integration
* chat UI
* presence UI
* playback control UI
* extension status indicators
* sync messaging

### Layer 2 — Supabase

Responsibilities:

* database storage
* room state persistence
* chat persistence
* optional presence metadata storage
* Realtime subscriptions for room events and updates
* optional Edge Functions for secured server-side actions later

### Layer 3 — Chrome Extension

Responsibilities:

* runs on Netflix pages
* detects local video/player state
* receives playback commands
* reports current playback state
* acts as the bridge between room events and Netflix tab actions

## 5.2 Deployment and delivery workflow

### GitHub

GitHub is the source of truth for the codebase.

Recommended responsibilities:

* store the Next.js app repository
* store the extension folder in the same repo or a sibling repo
* track branches, issues, and releases
* trigger Vercel deployments from the main branch

### Vercel CLI

Vercel CLI is the preferred deployment interface during development and production iteration.

Recommended use:

* authenticate locally to Vercel
* link the project to the GitHub repo
* pull environment variables
* run preview deployments
* push production deployments when needed

Typical flow:

1. build locally
2. commit and push to GitHub
3. Vercel deploys automatically from GitHub
4. optionally use Vercel CLI for local linking, previews, env sync, and manual deploy workflows

### Supabase project

Supabase is the backend platform for this product.

Recommended use:

* Postgres database for persistent room data
* Realtime for live subscriptions
* storage only if needed later
* optional Edge Functions for advanced server logic

## 5.3 Recommended repository structure

```txt
watch-room/
  app/
  components/
  lib/
  public/
  extension/
  supabase/
    migrations/
    seed.sql
  package.json
  README.md
```

### Folder notes

* `app/`: Next.js App Router pages
* `components/`: UI components
* `lib/`: utilities, types, Supabase helpers, client logic
* `public/`: static assets
* `extension/`: Chrome extension files
* `supabase/`: schema migrations, SQL, and backend-related setup files

## 5.4 Environment configuration

Environment variables should be managed in Vercel and locally during development.

Expected variables:

* `NEXT_PUBLIC_SUPABASE_URL`
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional later variables:

* service-role keys for server-only contexts
* extension bridge endpoint values
* room secret or shared PIN configuration

Never expose server-only secrets in client-side code.

## 5.5 Production architecture summary

```txt
User Browser A
  ├─ watch-room.vercel.app
  ├─ Supabase Realtime subscription
  ├─ Supabase database writes/reads
  └─ Chrome extension controlling Netflix tab

User Browser B
  ├─ watch-room.vercel.app
  ├─ Supabase Realtime subscription
  ├─ Supabase database writes/reads
  └─ Chrome extension controlling Netflix tab

Shared backend
  └─ Supabase (Postgres + Realtime)
```

## 6. Frontend Architecture

## 6.1 Framework choice

* Next.js App Router
* React
* deployment on Vercel
* Tailwind CSS or CSS Modules
* optional Zustand for local client state
* Supabase JavaScript client for database and Realtime integration

## 6.2 Recommended page structure

Single route:

* `app/page.tsx`

Optional support files:

* `app/globals.css`
* `components/*`
* `lib/*`

## 6.3 Suggested component tree

```txt
app/page.tsx
  WatchRoomShell
    TopStatusBar
    RoomHero
    PresenceStrip
    PlaybackPanel
    SyncStatusCard
    ChatPanel
    FooterHint
```

### Component responsibilities

#### `WatchRoomShell`

Overall layout wrapper. Handles responsive spacing, ambient background, and top-level composition.

#### `TopStatusBar`

Shows:

* room name
* room connection status
* extension connection badge
* Netflix connected badge
* role badge

#### `RoomHero`

Core emotional header.
Shows:

* room title
* soft subtext
* shared session tone
* optional current title placeholder

#### `PresenceStrip`

Shows both participants:

* avatar/initial
* online/offline
* ready/not ready
* host/guest

#### `PlaybackPanel`

Main control card.
Contains:

* play button
* pause button
* sync button
* seek backward
* seek forward
* current room status
* last action source

#### `SyncStatusCard`

Shows plain-language system state:

* “Waiting for Netflix tab”
* “Extension connected”
* “Ready to sync”
* “Playing together”
* “Out of sync — tap Sync”

#### `ChatPanel`

Minimal chat:

* message list
* input
* send action

#### `FooterHint`

Very subtle helper copy:

* “Open Netflix in another tab”
* “Both users need the extension for automatic control”

---

## 7. Dyrane UI Definition

## 7.1 What “Dyrane UI” means here

Dyrane UI for this product should feel:

* premium
* restrained
* calm
* atmospheric
* emotionally intentional
* intimate, not loud
* glass-soft, not generic glassmorphism
* futuristic but warm

### It is not

* gamer UI
* neon overload
* dashboard-heavy SaaS UI
* loud gradients everywhere
* enterprise admin styling
* overly rounded toy aesthetic

## 7.2 Visual character

* dark-first luxury tone
* soft ambient glow
* subtle layered depth
* glass/frost surfaces with discipline
* no visible hard borders unless absolutely needed
* edge lighting and soft separators instead of boxed outlines
* strong typography hierarchy
* sparse but meaningful motion

## 7.3 Surface language

Use:

* elevated translucent cards
* blurred backplates
* gradient fogs behind focal elements
* soft inner highlights
* thin luminous dividers
* radial atmospheric backgrounds

Avoid:

* thick strokes
* overly saturated component backgrounds
* multiple competing accent colors
* dense table-like structures

## 7.4 Typography tone

Typography should do a lot of the luxury work.

Recommended structure:

* high-contrast room title
* compact uppercase labels only when necessary
* clean secondary text with reduced opacity
* low text density
* line-height with breathing room

## 7.5 Motion language

Motion should be:

* short
* soft
* smooth
* spring-light
* confidence-based, not decorative

Examples:

* subtle fade/slide on chat messages
* soft pulse on connected state
* micro-scale hover on action chips
* smooth badge transitions

No flashy bounce spam.

## 7.6 Tone of controls

Buttons should feel:

* intentional
* tactile
* premium
* obvious without shouting

Primary actions:

* slightly brighter glass or denser fill
* subtle ambient glow
* large enough for confidence

Secondary actions:

* lighter tint
* smaller visual weight

## 7.7 Recommended palette direction

Dark base with one main emotional accent.

Possible direction:

* base: near-black / graphite / obsidian
* primary accent: electric violet, icy blue, or softened indigo
* secondary accent: faint rose or cyan glow only where useful
* text: near-white with layered opacity

Keep the palette disciplined.

## 7.8 Layout feel

The page should feel like a premium private lounge rather than an app dashboard.

Use:

* centered main shell
* generous negative space
* clearly separated content bands
* narrow readable width
* no full-screen clutter

---

## 8. UI Layout Specification

## 8.1 Page anatomy

### Section 1 — Ambient shell

Full-screen atmospheric background with subtle gradients and depth.

### Section 2 — Top status region

Slim horizontal row with:

* room name
* live status
* extension state
* role badge

### Section 3 — Hero block

Contains:

* room title
* emotional subtext
* optional current title label

### Section 4 — Presence strip

Two participant cards side by side or stacked on mobile.

### Section 5 — Primary playback card

Main focus area.
Contains command controls and state summary.

### Section 6 — Sync/connection helper card

System health in plain language.

### Section 7 — Chat card

Smaller but still elegant.

---

## 8.2 Mobile responsiveness

Even though this is desktop-first in current thought, it must degrade well.

### On small screens

* stack cards vertically
* reduce horizontal controls into two rows
* keep top status compact
* preserve visual elegance
* never crowd chat and playback into unreadable density

---

## 9. State Management

## 9.1 Local state categories

### UI state

* current input text
* pending animations
* panel expansion state
* selected role override

### Session state

* sessionId
* displayName
* trustedDevice flag
* local role preference

### Room state

* users
* readiness
* playback status
* current authoritative time
* last update timestamp
* last action source

### Connection state

* websocket status
* backend reachable
* extension connected
* Netflix tab connected

## 9.2 Persistence

Persist via localStorage:

* session id
* display name
* role preference
* last successful extension handshake time

Do not persist ephemeral live room state purely in localStorage as source of truth.

---

## 10. Data Model

## 10.1 Session model

```ts
export type LocalSession = {
  sessionId: string;
  displayName: string;
  preferredRole?: 'host' | 'guest';
  trustedDevice?: boolean;
};
```

## 10.2 Room user model

```ts
export type RoomUser = {
  sessionId: string;
  displayName: string;
  role: 'host' | 'guest';
  online: boolean;
  ready: boolean;
  extensionConnected: boolean;
  netflixConnected: boolean;
  lastSeenAt: number;
};
```

## 10.3 Playback model

```ts
export type PlaybackState = {
  status: 'idle' | 'playing' | 'paused' | 'buffering';
  currentTime: number;
  authoritativeBy: string | null;
  updatedAt: number;
  titleLabel?: string;
};
```

## 10.4 Chat model

```ts
export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: number;
};
```

## 10.5 Room state model

```ts
export type RoomState = {
  roomId: string;
  users: RoomUser[];
  playback: PlaybackState;
  chat: ChatMessage[];
};
```

---

## 11. Event Contract

## 11.1 Room events

```ts
export type RoomEvent =
  | { type: 'JOIN'; payload: { sessionId: string; displayName: string } }
  | { type: 'LEAVE'; payload: { sessionId: string } }
  | { type: 'READY'; payload: { sessionId: string; ready: boolean } }
  | { type: 'PLAY'; payload: { sessionId: string; at: number; sentAt: number } }
  | { type: 'PAUSE'; payload: { sessionId: string; at: number; sentAt: number } }
  | { type: 'SEEK'; payload: { sessionId: string; to: number; sentAt: number } }
  | { type: 'SYNC_REQUEST'; payload: { sessionId: string } }
  | { type: 'STATE'; payload: { sessionId: string; currentTime: number; paused: boolean; sentAt: number } }
  | { type: 'CHAT'; payload: { sessionId: string; text: string; sentAt: number } }
  | { type: 'EXTENSION_STATUS'; payload: { sessionId: string; connected: boolean } }
  | { type: 'NETFLIX_STATUS'; payload: { sessionId: string; connected: boolean } };
```

## 11.2 Authority rules

Recommended MVP rule:

* Host-originated playback commands are authoritative
* Guest can request sync
* Guest chat and readiness are unrestricted

---

## 12. Realtime Layer

## 12.1 Why realtime exists

The room must feel live.

Realtime is needed for:

* presence
* chat
* readiness
* playback command relay
* extension status updates
* sync status updates

## 12.2 Recommended transport

Supabase Realtime is the recommended transport for this production shape because it fits the Vercel + Supabase architecture cleanly.

Use Realtime for:

* subscribed room updates
* live presence-style room awareness
* chat updates
* playback state change propagation

## 12.3 Backend responsibilities via Supabase

* persist room state in Postgres
* persist chat messages
* provide row-level or room-level data access patterns if needed later
* broadcast state changes to connected clients
* support future server-side logic via Edge Functions if the product grows

## 12.4 Suggested MVP data flow

1. user opens `watch-room.vercel.app`
2. frontend restores local session
3. frontend connects to Supabase
4. frontend subscribes to room updates
5. user actions write state changes or messages
6. Supabase broadcasts updates to both clients
7. extension-aware UI reflects latest shared state

## 13. Extension Integration Contract

## 13.1 Why extension exists

The app cannot directly control Netflix from a separate site.
The extension acts as the local browser bridge.

## 13.2 Extension responsibilities

* detect Netflix video/player
* listen for playback commands
* report current state
* report extension connected
* report Netflix tab connected

## 13.3 Extension files

```txt
extension/
  manifest.json
  background.js
  content.js
```

## 13.4 `manifest.json` responsibilities

* declare extension metadata
* register service worker
* register content script
* request Netflix host permissions
* define action metadata

## 13.5 `content.js` responsibilities

* run on Netflix pages
* locate `<video>`
* execute play/pause/seek
* read currentTime and paused state
* send updates to background

## 13.6 `background.js` responsibilities

* maintain extension-level messaging
* communicate with room backend if needed
* relay messages between content script and app context

## 13.7 Frontend-extension bridge options

### Option A — backend-mediated bridge

* app sends command to backend
* backend broadcasts
* extension receives via its own websocket

### Option B — same-browser app-to-extension bridge

* app sends message to extension directly on same device
* extension handles local action
* backend still handles cross-device propagation

Recommended long-term shape:

* backend as authoritative relay
* extension as local executor

---

## 14. Connection States

Define plain-language states for users.

### App states

* Disconnected
* Connecting
* Connected

### Extension states

* Extension not detected
* Extension installed
* Extension connected

### Netflix states

* Netflix tab not found
* Netflix tab found
* Video ready

### Sync health states

* Waiting for both users
* Waiting for both users to be ready
* Ready to play
* Playing together
* Possibly out of sync
* Sync correction recommended

These should appear as humane UI text, not raw technical logs.

---

## 15. Security and Privacy Model

## 15.1 No-auth implication

Because no auth exists, possession of the room link effectively grants access.

## 15.2 Minimum protection recommendation

Use one of:

* shared PIN
* secret query string
* device trust gate

For the simplest real-world setup, use a shared room PIN if privacy matters.

## 15.3 Privacy principle

Do not over-collect anything.

Avoid collecting:

* real identity data
* Netflix credentials
* unnecessary analytics

Only store what the room needs.

---

## 16. Error Handling Strategy

## 16.1 UX-level error goals

Errors should be:

* plain language
* calm
* recoverable
* non-scary

## 16.2 Examples

* “Your extension is not connected yet.”
* “Netflix tab not detected.”
* “Your partner is offline.”
* “Sync data is stale. Tap Sync.”
* “Realtime connection lost. Reconnecting…”

## 16.3 Do not show

* stack traces
* raw socket payloads
* browser-level jargon
* extension internals to non-technical users

---

## 17. UI Copy Direction

The copy should sound:

* clean
* understated
* intimate
* helpful
* not nerdy
* not corporate

### Good examples

* “Waiting for you both”
* “Netflix is ready”
* “You’re in sync”
* “Paused together”
* “Your room is live”
* “Open Netflix in another tab”

### Avoid

* “Socket handshake failed”
* “Runtime bridge unavailable”
* “Manifest host permission error”

---

## 18. Suggested File Structure

```txt
app/
  page.tsx
  globals.css

components/
  watch-room-shell.tsx
  top-status-bar.tsx
  room-hero.tsx
  presence-strip.tsx
  playback-panel.tsx
  sync-status-card.tsx
  chat-panel.tsx
  footer-hint.tsx

lib/
  constants.ts
  supabase.ts
  session.ts
  utils.ts
  types.ts

extension/
  manifest.json
  background.js
  content.js

supabase/
  migrations/
  seed.sql
```

## 18.1 GitHub and Vercel workflow

Recommended workflow:

1. develop locally
2. test the single-page UI and extension locally
3. commit changes to GitHub
4. push branch to GitHub
5. Vercel creates a preview deployment
6. merge to main for production deployment
7. manage environment variables in Vercel
8. manage schema evolution through Supabase migrations

## 18.2 Local development workflow

Recommended local flow:

* run the Next.js app locally
* use Supabase project credentials in local env files
* load the Chrome extension unpacked in Chrome
* test app and extension together
* deploy frontend with Vercel CLI and GitHub-connected Vercel project

## 19. Build Phases

## Phase 1 — Static UI shell

Goal:

* build full single-page Dyrane UI with fake/mock data

Deliverables:

* polished page layout
* all core cards
* loading, connected, disconnected visual states
* responsive structure

## Phase 2 — Local session and interaction

Goal:

* make the page interactive without backend

Deliverables:

* local display name/session
* ready toggle
* local chat mock
* mock playback state changes

## Phase 3 — Supabase integration

Goal:

* connect both users through Supabase database and Realtime

Deliverables:

* room presence model
* live chat
* readiness sync
* shared playback state relay
* room persistence in Postgres

## Phase 4 — Extension bridge

Goal:

* connect both users through a room backend

Deliverables:

* room presence
* live chat
* readiness sync
* shared playback state relay

## Phase 4 — Extension bridge

Goal:

* bridge room commands to Netflix tabs

Deliverables:

* extension connection status
* Netflix tab detection
* play/pause/seek handling
* current time reporting

## Phase 5 — Sync refinement

Goal:

* improve felt quality

Deliverables:

* drift correction
* reconnect recovery
* stale state handling
* better health indicators

---

## 20. Visual Priority Order

When designing the UI, emphasize in this order:

1. overall atmosphere
2. room identity and emotional tone
3. connection clarity
4. playback control confidence
5. presence/readiness clarity
6. chat usefulness
7. subtle helper text

The playback panel and connection clarity should carry the experience.

---

## 21. Non-Functional Requirements

### Performance

* page should load fast
* animations should feel smooth
* no layout jank
* minimal hydration complexity

### Maintainability

* components must stay modular
* state contracts must stay typed
* event names must remain consistent
* UI should be mockable without backend

### Reliability

* reconnect gracefully
* tolerate extension absence
* tolerate partner disconnect
* tolerate stale state

---

## 22. Design Checklist for Dyrane UI Execution

### Page-level

* is the page instantly understandable?
* does the page feel premium within 2 seconds?
* is there enough negative space?
* is the atmosphere strong but controlled?

### Component-level

* are surfaces borderless or near-borderless?
* do controls feel tactile?
* are secondary elements visually quiet?
* does each card have a clear job?

### Emotional tone

* does it feel intimate rather than generic?
* does it feel private?
* does it feel crafted?
* does it avoid looking like a dashboard template?

---

## 23. Final Product Definition

This app is a **single-page premium private watch room**.

It is designed around one persistent link, two people, no auth, and a calm, premium Dyrane-style interface.

The production stack assumes:

* **GitHub** for source control
* **Vercel** for deployment of the Next.js frontend
* **Vercel CLI** for project linking, local workflow support, and deployments
* **Supabase** for Postgres and Realtime
* **Chrome extension** for local Netflix control

The Next.js app owns the room experience.
Supabase owns persistent and live shared state.
The extension owns local Netflix control.

The UI should feel like a private digital lounge for two people rather than a utility tool.

That emotional framing should guide every layout and visual decision.

