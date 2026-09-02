# Master Implementation Plan: AI-Powered Real-Time Surveillance & Incident Detection Platform

## 1. Executive Summary & Operational Concept

The **AI-Powered Surveillance System** is an enterprise-grade, zero-cost, cloud-hosted real-time surveillance web platform that turns standard hardware (webcams, mobile devices, or CCTV feeds) into an autonomous monitoring network.

All computer vision inference runs **locally on the client browser via WebGL (TensorFlow.js)**. This eliminates expensive cloud GPU costs, reduces bandwidth consumption, and guarantees instantaneous real-time detection without sending continuous video streams to a server.

### Core Target Capabilities:
1. **Instant Camera Activation**: Live webcam automatically initializes immediately upon loading the application.
2. **Hand-to-Hand Combat Detection**: Live tracking of punches, strikes, and grappling using **MoveNet MultiPose**.
3. **Universal Handheld Threat Detection**: Tracks any held object within hand/wrist grip zones combined with aggressive posture.
4. **Secondary-Screen Accident Detection**: Detects vehicle collisions whether live outdoors or played on a secondary laptop/phone screen held in front of the camera.
5. **Configurable Alert Dispatch**: Operator can specify destination alert recipient emails directly in the UI header.
6. **Incident Email with Snapshot & 30-Minute Live Replay Link**: Sends an email via **Resend** with the visual snapshot and a 30-minute temporary link to view the live camera footage.

---

## 2. Technical Stack & Speed Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT-SIDE BROWSER (EDGE AI)                           │
│  ┌───────────────────────┐       ┌────────────────────────┐      ┌──────────────────┐  │
│  │ HTML5 Webcam Stream   │ ────► │ Decoupled 15 FPS Loop  │ ───► │ TensorFlow.js    │  │
│  │ (Hardware Accelerated)│       │ (requestVideoFrame)    │      │ WebGL Backend    │  │
│  └───────────────────────┘       └────────────────────────┘      └────────┬─────────┘  │
│                                                                           │            │
│       ┌───────────────────────────────────────────────────────────────────┼──────────┐ │
│       │ AI Detection Engines (Parallel Heuristic Inference):              │          │ │
│       │  1. MoveNet MultiPose: 17 Keypoints x 6 Persons (Strikes/Clinch)  │          │ │
│       │  2. Handheld Threat: Wrist Grip Radius + Aggressive Stance        │          │ │
│       │  3. Accident Engine: COCO-SSD Vehicles + IoU Overlap + Velocity   │          │ │
│       └───────────────────────────────────────────────────────────────────┴──────────┘ │
│                                   │                                                    │
│                            Threat Triggered (15s Debounced Cooldown)                   │
│                                   │                                                    │
│                        ┌──────────┴──────────────┐                                     │
│                        │ Evidence Canvas Freeze  │                                     │
│                        │ (Bounding Boxes + HUD)  │                                     │
│                        └──────────┬──────────────┘                                     │
└───────────────────────────────────┼────────────────────────────────────────────────────┘
                                    │ POST (JSON + Base64 Snapshot)
                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              NEXT.JS 14 SERVERLESS BACKEND                             │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ POST /api/incidents                                                              │  │
│  │  1. Decodes Base64 Evidence Frame & Uploads to Supabase Storage                  │  │
│  │  2. Inserts Incident Record into Supabase PostgreSQL                             │  │
│  │  3. Generates 30-Minute HMAC Token (`TOKEN_SECRET`)                              │  │
│  │  4. Dispatches Emergency Email via Resend with Snapshot & Live Viewer Button     │  │
│  └────────────────────────┬─────────────────────────────────┬───────────────────────┘  │
└───────────────────────────┼─────────────────────────────────┼──────────────────────────┘
                            │                                 │
                            ▼                                 ▼
┌──────────────────────────────────────────────┐  ┌──────────────────────────────────────┐
│             SUPABASE CLOUD (FREE TIER)       │  │               RESEND API             │
│  • Storage Bucket: `incident-snapshots`      │  │  • Free Tier: 3,000 emails/month     │
│  • PostgreSQL Table: `incidents`             │  │  • Inline Snapshot Image Attachment  │
│  • Realtime Replication: WebSocket Broadcast │  │  • Direct Action Button to Live Feed │
└───────────────────────────┬──────────────────┘  └──────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              INCIDENT MONITORING & LIVE REPLAY                         │
│  • Live Dashboard (`/`): Realtime incident drawer updates via Supabase WebSocket       │
│  • Live Viewer (`/live/[token]`): 30-min expiring viewer via Supabase Broadcast/WebRTC │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Comprehensive File Inventory & Directory Structure

Here is the exact, complete file structure matching all current files, configuration modules, and planned components:

```
college-project-2026/
├── public/                               # Static public assets (sounds, icons, images)
├── src/
│   ├── app/                              # Next.js 14 App Router
│   │   ├── api/                          # Serverless backend endpoints
│   │   │   ├── incidents/
│   │   │   │   └── route.ts              # Ingests incidents, uploads snapshot, inserts DB, sends email
│   │   │   └── live-token/
│   │   │       └── route.ts              # Validates 30-minute HMAC tokens & returns remaining time
│   │   ├── live/
│   │   │   └── [token]/
│   │   │       └── page.tsx              # Secure 30-minute temporary live feed viewer
│   │   ├── globals.css                   # Tailwind directives, HUD animations & scanlines
│   │   ├── layout.tsx                    # Root layout with dark theme & font configuration
│   │   └── page.tsx                      # Primary surveillance console & cockpit
│   ├── components/                       # UI & Canvas HUD components
│   │   ├── AlertHeader.tsx               # Top glassmorphism bar: recipient email, FPS, status badge
│   │   ├── CameraFeed.tsx                # Video stream, 15 FPS AI loop, glowing HUD canvas overlay
│   │   ├── EvidenceModal.tsx             # High-res snapshot inspector with detection metadata
│   │   ├── IncidentDrawer.tsx            # Realtime incident history panel via Supabase WebSockets
│   │   └── ThreatStats.tsx               # Live telemetry: model inference latency, keypoints & FPS
│   ├── lib/                              # Core AI algorithms, cloud clients & utilities
│   │   ├── ai/                           # Edge AI inference engines
│   │   │   ├── accidentEngine.ts         # Vehicle IoU intersection, velocity drop & crash state machine
│   │   │   ├── combatEngine.ts           # MoveNet wrist strike velocity vectors & torso clinch logic
│   │   │   ├── modelLoader.ts            # TensorFlow.js WebGL initialization & model singletons
│   │   │   └── weaponEngine.ts           # Wrist grip radius tracking & aggressive stance heuristics
│   │   ├── email/
│   │   │   └── resend.ts                 # Resend email template generator & dispatch handler
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Browser Supabase client (Anon key, Realtime subscriptions)
│   │   │   └── server.ts                 # Server Supabase client (Service role key, storage & DB writes)
│   │   ├── token.ts                      # HMAC-SHA256 30-minute token generation & verification
│   │   └── types.ts                      # Shared TypeScript definitions & domain interfaces
│   └── schema.sql                        # PostgreSQL schema, Realtime replication & Storage bucket setup
├── .env.local.example                    # Environment variable template with documented keys
├── .gitignore                            # Git exclusion rules
├── IMPLEMENTATION_PLAN.md                # This master architecture and sprint roadmap
├── SYSTEM_BLUEPRINT.md                   # High-level operational and conceptual blueprint
├── next-env.d.ts                         # Next.js TypeScript declarations
├── next.config.mjs                       # Next.js configuration (Supabase image domains & WebAssembly)
├── package.json                          # Project dependencies, scripts & devDependencies
├── package-lock.json                     # Pinned package lockfile
├── postcss.config.mjs                    # PostCSS configuration for Tailwind CSS
├── tailwind.config.ts                    # Custom styling tokens, radar sweeps & glowing borders
└── tsconfig.json                         # TypeScript compiler configuration with path aliases
```

---

## 4. File-by-File Responsibility Matrix

| File Path | Role | Key Functions / Responsibilities |
| :--- | :--- | :--- |
| **`src/schema.sql`** | PostgreSQL & Storage Setup | • Defines `public.incidents` table with UUID, type check, confidence, and snapshot URL.<br>• Creates performance indexes on `created_at DESC` and `type`.<br>• Configures RLS policies for anonymous read and service-role writes.<br>• Adds table to `supabase_realtime` publication.<br>• Creates public `incident-snapshots` S3 storage bucket. |
| **`src/lib/types.ts`** | Domain Type Definitions | • `ThreatType`: `'COMBAT' \| 'WEAPON' \| 'ACCIDENT' \| 'CUSTOM'`.<br>• `IncidentRecord`: Full database row structure.<br>• `IncidentPayload`: Snapshot Base64, confidence score, bounding boxes, and recipient email.<br>• `PoseKeypoint`, `DetectedPerson`, `DetectionBox`: AI inference primitives. |
| **`src/lib/token.ts`** | Live Session Security | • `generateLiveToken(incidentId)`: Generates HMAC-SHA256 token encoding `incidentId` and `expiresAt` (Current Time + 30 Mins).<br>• `verifyLiveToken(token)`: Validates signature and returns `{ valid: boolean, remainingSeconds: number, incidentId: string }`. |
| **`src/lib/supabase/client.ts`** | Browser Supabase Client | • Initializes Supabase client using public `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.<br>• Powers real-time WebSocket subscriptions on the `incidents` channel in `IncidentDrawer.tsx`. |
| **`src/lib/supabase/server.ts`** | Server Supabase Client | • Initializes Supabase client using `SUPABASE_SERVICE_ROLE_KEY`.<br>• Bypasses RLS to upload snapshots to `incident-snapshots` bucket and insert records into `incidents` table. |
| **`src/lib/email/resend.ts`** | Emergency Email Dispatcher | • `sendIncidentAlertEmail(incident)`: Compiles responsive HTML template with inline evidence snapshot, severity badge, detection metadata, and action button linking to `/live/[token]`. |
| **`src/lib/ai/modelLoader.ts`** | TensorFlow.js Initializer | • `loadModels()`: Single-execution loader initializing WebGL backend via `tf.setBackend('webgl')` and `tf.ready()`.<br>• Caches singleton instances of MoveNet MultiPose and COCO-SSD.<br>• Configures WebGL memory leak safeguards. |
| **`src/lib/ai/combatEngine.ts`** | Hand-to-Hand Combat Engine | • Tracks wrist velocity vector magnitude $(\|\vec{v}_{\text{wrist}}\| = \frac{\Delta d}{\Delta t})$.<br>• Computes directional vector from attacker's wrist to victim's head/torso keypoints.<br>• Evaluates torso clinch proximity ($< 0.8\times$ torso height) across adjacent persons. |
| **`src/lib/ai/weaponEngine.ts`** | Handheld Threat Engine | • Computes adaptive grip radius around left and right wrists ($R_{\text{grip}} = 0.25\times$ torso height).<br>• Identifies rigid intersecting objects.<br>• Classifies aggressive stances: overhead raised striking posture or two-handed aimed brandishing. |
| **`src/lib/ai/accidentEngine.ts`** | Vehicle Collision Engine | • Tracks pairwise bounding boxes of `car`, `truck`, `bus`, and `motorcycle`.<br>• Computes IoU overlap $\ge 0.15$.<br>• Detects sudden velocity collapse ($\Delta v < -60\%$ in $<3$ frames) followed by post-impact persistence ($>12$ frames). Supports secondary phone/laptop screen playback. |
| **`src/app/api/incidents/route.ts`** | Serverless Ingestion API | • `POST`: Validates request payload $\rightarrow$ converts Base64 snapshot to Buffer $\rightarrow$ uploads to Supabase Storage $\rightarrow$ writes incident row to PostgreSQL $\rightarrow$ generates 30-min token $\rightarrow$ calls Resend API $\rightarrow$ returns JSON response. |
| **`src/app/api/live-token/route.ts`** | Token Validation API | • `GET / POST`: Decodes token query parameter, verifies HMAC signature, checks whether `Date.now() < expiresAt`, and returns remaining seconds or expired error. |
| **`src/components/AlertHeader.tsx`** | Top Cockpit Glass Bar | • Input field for destination alert recipient email (saved in `localStorage`).<br>• Audio alert toggle switch.<br>• Live camera active indicator and system health status. |
| **`src/components/CameraFeed.tsx`** | Live Video & Canvas HUD | • Requests browser `navigator.mediaDevices.getUserMedia`.<br>• Decoupled 15 FPS requestVideoFrameCallback AI inference loop.<br>• Renders glowing minimalist HUD overlays (skeletons, strike vectors, threat boxes).<br>• Manages 15-second debounced incident cooldown. |
| **`src/components/IncidentDrawer.tsx`** | Realtime Alert Panel | • Subscribes to Supabase Realtime channel `public:incidents`.<br>• Displays animated alert cards with time, threat badge, confidence, and snapshot thumbnail.<br>• Clicking a card opens `EvidenceModal.tsx`. |
| **`src/components/EvidenceModal.tsx`** | Snapshot Inspector | • Fullscreen glass modal showing high-res snapshot, timestamp, confidence breakdown, and quick link to copy/open the live stream. |
| **`src/components/ThreatStats.tsx`** | AI Telemetry Bar | • Displays live FPS, AI inference latency (ms), active skeleton count, and detected vehicle counts. |
| **`src/app/page.tsx`** | Main Surveillance Dashboard | • Mounts `AlertHeader`, `CameraFeed`, `ThreatStats`, and `IncidentDrawer`.<br>• Coordinates shared state across camera feed and alert triggers. |
| **`src/app/live/[token]/page.tsx`** | 30-Minute Live Viewer | • Standalone route for emergency email recipients.<br>• Validates token with `/api/live-token`.<br>• Displays dynamic countdown timer (MM:SS) and live stream broadcast via Supabase Realtime / WebRTC. |
| **`src/app/globals.css`** | Global HUD Styles | • Tailwind base imports, CRT scanline overlay, glowing neon borders (`box-shadow`), pulsing radar animations, and dark glassmorphic styling. |
| **`next.config.mjs`** | Next.js Configuration | • Configures Supabase Storage remote patterns for Next.js image optimization.<br>• Configures WebAssembly and client-side webpack fallbacks for browser AI. |

---

## 5. Algorithmic State Machines & Detection Thresholds

### 1. Combat & Brawl Detection
```
[Wrist Velocity: ||v|| > 1.2 * Torso_Height / sec]
                        AND
[Directional Dot Product: v_wrist · (Victim_Head - Attacker_Wrist) > 0.7]
                        OR
[Grappling: Distance(Torso_A, Torso_B) < 0.8 * Height AND Delta_Keypoints > Threshold for 4 frames]
                        ▼
                [TRIGGER: COMBAT DETECTED]
```

### 2. Universal Handheld Threat Detection
```
[Identify Wrist Keypoint (x_w, y_w)]
                 ▼
[Grip Circle: Radius = 0.25 * Torso_Height]
                 ▼
[Intersecting Non-Person Bounding Box detected]
                 ▼
[Posture Analysis]:
  Case A: Wrist raised above Ear keypoint with downward/forward strike momentum
  Case B: Two hands converged (< 0.15 * Height) with rigid object pointing outward
                 ▼
          [TRIGGER: WEAPON / THREAT DETECTED]
```

### 3. Vehicle Accident Detection (Live & Secondary Screen)
```
[Track Vehicle Bounding Boxes: Car, Truck, Bus, Motorcycle]
                 ▼
[Pairwise Overlap: IoU(Box_A, Box_B) >= 0.15]
                 ▼
[Impact Dynamics]:
  • Pre-impact Approach Velocity > 0
  • Impact Deceleration: Delta_v < -60% within 3 frames
  • Post-impact Persistence: Overlap maintained for >= 12 frames
                 ▼
          [TRIGGER: VEHICLE COLLISION DETECTED]
```

---

## 6. Live Streaming Mechanism for `/live/[token]`

How the 30-minute temporary link receives live footage:
1. **Primary Operator Console (`/`)**:
   - The broadcaster establishes a persistent channel on Supabase Realtime: `realtime.channel('surveillance_stream')`.
   - When a live stream viewer connects, the host pushes WebRTC peer signaling or lightweight 5 FPS base64 preview frames over the encrypted Realtime Broadcast channel.
2. **Viewer Page (`/live/[token]`)**:
   - The recipient clicks the link from their alert email.
   - The page verifies the HMAC token against `/api/live-token`. If `Date.now() > expiresAt`, access is denied with an `EXPIRED_SESSION` UI.
   - If valid, it subscribes to the matching Realtime broadcast channel and displays the live surveillance feed accompanied by an active countdown timer displaying the remaining minutes and seconds.

---

## 7. Step-by-Step Implementation Roadmap

```
  ┌──────────────────────────────────────────────────────────────────┐
  │ SPRINT 1: Core Scaffolding & Cloud Data Layer                   │
  │ • Validate next.config.mjs, tailwind.config.ts, schema.sql      │
  │ • Complete src/lib/types.ts with all domain definitions         │
  │ • Implement src/lib/supabase/client.ts & server.ts               │
  │ • Implement src/lib/token.ts (HMAC 30-minute token generator)    │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
  ┌──────────────────────────────▼───────────────────────────────────┐
  │ SPRINT 2: Edge AI Detection Engines (TensorFlow.js)              │
  │ • Implement src/lib/ai/modelLoader.ts (MoveNet + COCO-SSD)       │
  │ • Implement src/lib/ai/combatEngine.ts (Strike & clinch logic)   │
  │ • Implement src/lib/ai/weaponEngine.ts (Grip radius & stance)    │
  │ • Implement src/lib/ai/accidentEngine.ts (IoU & crash dynamics)  │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
  ┌──────────────────────────────▼───────────────────────────────────┐
  │ SPRINT 3: Surveillance Console UI & Canvas Overlay               │
  │ • Implement src/components/AlertHeader.tsx (Email config bar)    │
  │ • Implement src/components/CameraFeed.tsx (15 FPS AI loop & HUD) │
  │ • Implement src/components/ThreatStats.tsx (Latency & FPS)       │
  │ • Implement src/components/IncidentDrawer.tsx & EvidenceModal.tsx│
  │ • Assemble src/app/page.tsx with state coordination              │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
  ┌──────────────────────────────▼───────────────────────────────────┐
  │ SPRINT 4: Serverless API & Email Dispatch Pipeline               │
  │ • Implement src/lib/email/resend.ts (Responsive HTML email)      │
  │ • Implement src/app/api/incidents/route.ts (Storage, DB, Email)  │
  │ • Implement src/app/api/live-token/route.ts (Validation)         │
  │ • Implement src/app/live/[token]/page.tsx (30-min viewer UI)     │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
  ┌──────────────────────────────▼───────────────────────────────────┐
  │ SPRINT 5: Live Verification & Edge Case Hardening                │
  │ • Test live physical combat motion & punch strike triggers       │
  │ • Test secondary screen car crash playback from mobile phone     │
  │ • Test rigid handheld object raised striking stance              │
  │ • Verify Resend email delivery with snapshot & 30-min live link  │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 8. Verification & Live Protocol

| Test Case | Procedure | Expected Outcome |
| :--- | :--- | :--- |
| **1. Zero-Click Startup** | Open `http://localhost:3000` in Chrome/Edge. | Camera permissions requested immediately $\rightarrow$ Live video appears $\rightarrow$ AI models load into WebGL without lag $\rightarrow$ FPS displays 30–60 FPS. |
| **2. Combat Strike** | Move fist rapidly towards the camera/adjacent person. | Velocity vector lights up red $\rightarrow$ HUD displays `[COMBAT DETECTED]` $\rightarrow$ 15-second cooldown activates $\rightarrow$ Snapshot captured. |
| **3. Secondary Screen Accident** | Play a YouTube vehicle collision video on a smartphone and hold it in front of the webcam. | COCO-SSD detects vehicles on the phone screen $\rightarrow$ When vehicles collide, IoU $\ge 0.15$ triggers `[VEHICLE CRASH DETECTED]` $\rightarrow$ Snapshot captured. |
| **4. Handheld Threat** | Hold a bottle, umbrella, or tool and raise arm above shoulder in an aggressive striking posture. | Wrist grip radius attaches to object $\rightarrow$ Elevated posture triggers `[HANDHELD THREAT DETECTED]`. |
| **5. Email Delivery** | Set recipient email in the top bar to your email address. | Emergency email arrives in inbox with snapshot image embedded inline and a prominent button to view the live feed. |
| **6. 30-Min Expirable Link** | Click the email button to open `/live/[token]`. | Page opens with active countdown timer (e.g. `29:54 remaining`) and displays live footage. After 30 minutes, access expires automatically. |
