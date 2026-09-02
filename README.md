# AI-Powered Real-Time Surveillance & Incident Detection Platform

An enterprise-grade, zero-cost, cloud-hosted real-time surveillance web platform that turns standard hardware (webcams, mobile devices, or CCTV feeds) into an automated monitoring network using **Client-Side Edge AI (TensorFlow.js on WebGL)**.

---

## 📚 Master Documentation
For detailed architecture and roadmap, refer to:
- **[System Blueprint (`SYSTEM_BLUEPRINT.md`)](./SYSTEM_BLUEPRINT.md)**: Architectural specs, Edge AI models, data flow, and free-tier cloud design.
- **[Master Implementation Plan (`IMPLEMENTATION_PLAN.md`)](./IMPLEMENTATION_PLAN.md)**: 5-tier modular directory tree, file-by-file responsibility matrix, phase-wise roadmap, and testing protocols.

---

## 🎯 Core Capabilities
1. **Instant Camera Activation**: Live webcam initializes immediately in the browser upon page load.
2. **Hand-to-Hand Combat Detection**: Tracks strikes, punches, and grapple movements using **MoveNet MultiPose**.
3. **Universal Handheld Threat Detection**: Adaptive hand grip radius tracking rigid objects in aggressive/striking postures.
4. **Vehicle Accident Detection**: Identifies vehicle collisions live from outdoor feeds or secondary screen playback.
5. **Configurable Alert Recipient Email**: Top-level UI input allowing operators to configure destination alert emails on the fly.
6. **Incident Email with Snapshot & 30-Minute Live Footage Link**: Serverless email dispatch via **Resend** delivering the evidence frame and a temporary tokenized link to view the live camera stream.

---

## 🛠 Tech Stack
- **Framework**: [Next.js 14 (App Router)](https://nextjs.org/) + [React 18](https://react.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **Client-Side Edge AI**: [TensorFlow.js](https://www.tensorflow.org/js) (WebGL backend) + `@tensorflow-models/pose-detection` (MoveNet MultiPose) + `@tensorflow-models/coco-ssd`
- **Database & Storage**: [Supabase](https://supabase.com/) (PostgreSQL + S3 Storage Bucket + Realtime WebSockets)
- **Email Service**: [Resend](https://resend.com/)
- **Type System**: [TypeScript 5](https://www.typescriptlang.org/)

---

## 💻 Developer Setup Guide

Follow these steps to set up and run the project locally for development.

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Node.js**: `v18.17.0` or higher (Node `v20+` LTS recommended).
- **Package Manager**: `npm` (comes with Node.js) or `pnpm` / `yarn`.
- **Modern Browser**: Google Chrome, Microsoft Edge, or Brave (recommended for optimal WebGL 2.0 hardware acceleration and WebRTC/Camera APIs).
- **Accounts (Free Tier)**:
  - [Supabase](https://supabase.com) (Database, Storage & Realtime).
  - [Resend](https://resend.com) (Email dispatch).

---

### 2. Clone and Install Dependencies

```bash
# Clone repository
git clone <your-repository-url>
cd college-project-2026

# Install dependencies
npm install
```

> [!NOTE]
> `@types/emscripten` is included in `devDependencies` to provide type definitions required by TensorFlow's WebAssembly backend (`@tensorflow/tfjs-backend-wasm`). If your IDE ever displays a type definition warning, run `Ctrl + Shift + P` and choose **TypeScript: Restart TS Server**.

---

### 3. Environment Variables Configuration

Create a `.env.local` file in the root directory by copying the example template:

```bash
# On Windows (PowerShell):
Copy-Item .env.local.example .env.local

# On Linux / macOS:
cp .env.local.example .env.local
```

Open `.env.local` and configure the following keys:

```env
# -------------------------------------------------------------
# Supabase Configuration (Free Tier)
# Found in: Supabase Dashboard > Project Settings > API
# -------------------------------------------------------------
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key

# -------------------------------------------------------------
# Resend Email API Configuration (Free Tier)
# Found in: Resend Dashboard > API Keys
# -------------------------------------------------------------
RESEND_API_KEY=re_your_api_key_here
ALERT_SENDER_EMAIL=onboarding@resend.dev  # Use verified domain or onboarding@resend.dev for sandbox testing

# -------------------------------------------------------------
# Application URL
# Used for generating the 30-minute live viewer links inside incident emails
# -------------------------------------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000

# -------------------------------------------------------------
# Security Secret for 30-Minute Live Streaming HMAC Tokens
# Generate any 32+ character random string
# -------------------------------------------------------------
TOKEN_SECRET=generate-a-secure-random-32-char-string-here
```

---

### 4. Supabase Database & Storage Setup

1. Log in to your [Supabase Dashboard](https://app.supabase.com/) and create a new project.
2. Navigate to the **SQL Editor** tab in the left sidebar.
3. Open [`src/schema.sql`](./src/schema.sql) and run the SQL commands to:
   - Create the `incidents` table with appropriate indexes.
   - Enable Supabase Realtime on the `incidents` table.
   - Create the public `incident-snapshots` storage bucket for security incident evidence frames.
4. Verify under **Storage** that `incident-snapshots` exists with public read access enabled for snapshot retrieval in incident emails.

---

### 5. Running the Application

Start the local Next.js development server:

```bash
npm run dev
```

The application will be accessible at:
```
http://localhost:3000
```

> [!IMPORTANT]
> When opening the app for the first time, allow browser camera permissions when prompted. TensorFlow.js models (`MoveNet` and `COCO-SSD`) will automatically download weights from Google Cloud Storage on first load and cache them in IndexedDB.

---

## 📂 Project Architecture

```
college-project-2026/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # Backend API routes (Alerts, Snapshots, WebRTC)
│   │   │   ├── alert/route.ts    # Resend email dispatch endpoint
│   │   │   └── snapshot/route.ts # Supabase storage upload & DB insert
│   │   ├── live/[token]/         # 30-minute temporary live feed viewer page
│   │   ├── layout.tsx            # Global layout with providers
│   │   └── page.tsx              # Main dashboard with live detection feed
│   ├── components/               # UI & Visual Components
│   │   ├── AlertHeader.tsx       # Recipient email config & emergency status bar
│   │   ├── CameraFeed.tsx        # Video canvas & bounding box/pose renderer
│   │   ├── IncidentLog.tsx       # Realtime incident history & snapshots drawer
│   │   └── ThreatStats.tsx       # FPS, inference latency & active threat metrics
│   ├── lib/
│   │   ├── ai/                   # Edge AI Inference Engines
│   │   │   ├── coco.ts           # COCO-SSD object & vehicle detection
│   │   │   ├── collision.ts      # IoU bbox tracking & crash detection logic
│   │   │   ├── combat.ts         # MoveNet pose heuristics (strikes & grappling)
│   │   │   ├── movenet.ts        # MoveNet MultiPose pipeline
│   │   │   └── threat.ts         # Handheld weapon/object proximity heuristics
│   │   ├── email/                # Resend HTML email generator & transport
│   │   ├── supabase/             # Browser & Service-Role Supabase clients
│   │   ├── token.ts              # HMAC time-expiring stream token generator
│   │   └── types.ts              # Shared TypeScript definitions
│   └── schema.sql                # PostgreSQL migration & Supabase bucket setup
├── public/                       # Static public assets
├── .env.local.example            # Environment variables template
├── IMPLEMENTATION_PLAN.md        # Technical execution & sprint roadmap
├── SYSTEM_BLUEPRINT.md           # System architecture specification
├── tsconfig.json                 # TypeScript compiler configuration
└── package.json                  # Scripts and dependencies
```

---

## 🔧 Useful Development Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Next.js development server on port 3000 with hot-reload |
| `npm run build` | Builds the optimized production build |
| `npm run start` | Runs the compiled production server |
| `npm run lint` | Runs Next.js ESLint checks |
| `npx tsc --noEmit` | Runs TypeScript typecheck across all files without emitting JS |

---

## 🔍 Troubleshooting for Developers

- **Camera Not Initializing**: Ensure your browser allows camera access for `localhost:3000`. If using Chrome, check `chrome://settings/content/camera`.
- **WebGL Performance / Low FPS**: Check `chrome://gpu` to verify that Hardware Acceleration is enabled in your browser. MoveNet MultiPose runs fastest with WebGL acceleration enabled.
- **Resend Email Not Delivering**: When using the free tier without a custom verified domain, Resend will only deliver to the email address registered with your Resend account, and `ALERT_SENDER_EMAIL` must be set to `onboarding@resend.dev`.
- **TypeScript Type Definition Warnings**: If you see missing type library warnings on `tsconfig.json`, run `npm install -D @types/emscripten` and restart the TS Server in your IDE (`Ctrl + Shift + P` -> `TypeScript: Restart TS Server`).
