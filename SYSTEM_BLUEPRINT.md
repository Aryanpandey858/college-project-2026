# System Blueprint: AI-Powered Real-Time Surveillance & Incident Detection Platform

---

## 1. What Is This Project? (In Plain English)

Imagine turning an ordinary webcam, a laptop, or even a smartphone into a **smart, automated security guard** that watches the scene 24/7. 

Most security cameras (CCTV) today are **passive**. They quietly record hundreds of hours of video onto a hard drive, but nobody notices an incident until *after* something bad has already happened. Furthermore, traditional "smart" AI cameras require expensive supercomputers or high monthly cloud server fees to analyze video.

**This platform changes that completely:**
- It runs **entirely inside a standard web browser** (like Google Chrome or Microsoft Edge).
- It uses the computer's own graphics card to analyze video in real time.
- It **never sends continuous video feeds to an expensive server**, which means it costs **$0 to run**.
- When an emergency happens (a fist fight, an armed threat, or a car crash), it immediately takes a photo of the incident, saves it, and **emails the security team or building owner in under 3 seconds with photo evidence and a live camera link**.

---

## 2. What Problems Does It Solve?

| Traditional Security Systems | Our AI Surveillance Platform |
| :--- | :--- |
| **Human Fatigue**: Guards get tired watching 20 screens at once and miss critical moments. | **Never Blinks**: The AI analyzes 15 to 30 frames every single second without distraction. |
| **Expensive Cloud Bills**: Streaming video to cloud servers costs hundreds of dollars a month. | **Zero Cloud Computing Costs**: All AI thinking happens directly inside your web browser. |
| **Delayed Reaction**: Incidents are usually discovered hours or days later on recorded tapes. | **Instant Alarm**: Sends an emergency email with photo proof within 3 seconds of the event. |
| **Privacy Concerns**: Continuous live video streams are sent across the internet to third parties. | **100% Private**: Video stays on your local device; only frozen emergency snapshots are saved. |

---

## 3. What Can It Detect? (The Three Core Skills)

### 👊 1. Hand-to-Hand Combat & Physical Brawls
* **What it looks for**: Sudden punch strikes, rapid blows, and two people violently grappling or wrestling together.
* **How it understands it**: The system tracks human skeletons (wrists, elbows, shoulders, and heads). If it sees a person's fist moving at high speed directly toward another person's head or chest, or two bodies entangled in a struggle, it immediately recognizes a physical altercation.

### 🔪 2. Handheld Threats & Weapons (Universal Weapon Detection)
* **What it looks for**: People holding rigid, dangerous objects (such as sticks, bats, bottles, knives, or tools) in an aggressive posture.
* **How it understands it**: Instead of guessing what an object is from a rigid list, the AI looks at the person's hands. If an object is held in the hand and the person raises their arm high in a striking pose or brandishes it forward aggressively, the system triggers a threat alert.

### 🚗 3. Vehicle Collisions & Accidents (Live Road & Screen Playback)
* **What it looks for**: Car, bus, truck, and motorcycle crashes.
* **How it understands it**: The AI identifies vehicles in the frame and tracks their motion. When two vehicles collide, overlap, and suddenly screech to a halt, it triggers a crash alert.
* **Special Demonstration Feature**: This works on real outdoor traffic cameras, **and** it also works during presentations or testing if someone holds a smartphone or laptop playing a car crash video in front of the webcam!

---

## 4. How the Whole System Works (Step-by-Step Journey)

Here is the simple 5-step journey from the moment the camera sees something to the moment an email arrives:

```
  [ STEP 1: The Eyes ]
  The webcam opens automatically in your browser as soon as you open the website.
         │
         ▼
  [ STEP 2: The Brain (AI) ]
  TensorFlow.js runs directly on your computer's graphics card.
  It tracks human body skeletons and vehicles up to 30 times every second.
         │
         ▼
  [ STEP 3: The Alarm ]
  The moment a fight, weapon stance, or car crash occurs:
  • The screen lights up with red alert indicators.
  • The exact frame is frozen as photographic evidence.
  • A 15-second "cooldown" begins so you don't receive 50 emails for the same fight.
         │
         ▼
  [ STEP 4: The Cloud Filing Cabinet (Supabase) ]
  The frozen photo proof is saved to secure cloud storage, and the incident details
  (time, type of threat, and confidence score) are written into a database.
         │
         ▼
  [ STEP 5: Emergency Dispatch (Resend Email) ]
  An urgent email lands in the security officer's inbox:
  • Contains the exact photo of the incident.
  • Contains a secure button: "View Live Stream (Valid for 30 Minutes)".
```

---

## 5. The Tech Stack (Explained for Non-Coders)

Every tool used in this project was carefully chosen so that the platform is fast, modern, and completely free to operate:

| Technology | What Is It? | Why Did We Pick It? |
| :--- | :--- | :--- |
| **Next.js & React** | The Website Framework | Builds the user interface (buttons, panels, and layouts) and handles secure server tasks in one unified system. |
| **TensorFlow.js** | The Browser AI Engine | Allows Google's pre-trained artificial intelligence models to run directly inside web browsers using your laptop's graphics card. |
| **MoveNet MultiPose** | Human Skeleton Tracker | An AI model that tracks 17 joints (eyes, shoulders, wrists, knees) on up to 6 people simultaneously in real time. |
| **COCO-SSD** | Object & Vehicle Detector | An AI model that recognizes everyday objects like cars, trucks, motorcycles, and people. |
| **Tailwind CSS** | Styling & Design System | Gives the surveillance screen a sleek, futuristic, dark-mode security console appearance with glowing neon alerts. |
| **Supabase** | Cloud Database & File Storage | Acts as our secure online filing cabinet where incident logs and evidence photos are stored for free. |
| **Resend** | Emergency Email Dispatcher | Sends clean, professional alert emails with attached photos to inboxes in under 3 seconds. |
| **TypeScript** | Code Quality Guardian | Ensures the code is strictly typed and error-free before it ever runs. |

---

## 6. Plain English Tour of the Project Files

Here is a map of the project folders and what each part does:

```
college-project-2026/
│
├── src/                                  # All the project's source code lives here
│   │
│   ├── app/                              # The Website Pages & Server Helpers
│   │   ├── page.tsx                      # The main surveillance screen you see when you visit the site
│   │   ├── layout.tsx                    # The overall wrapper that applies dark mode and fonts
│   │   ├── globals.css                   # Styles that create neon glows, scanlines, and radar effects
│   │   ├── live/[token]/page.tsx         # The special page where an email recipient views live video
│   │   └── api/                          # Secret backend routes that run securely on the server
│   │       ├── incidents/route.ts        # Receives alert photos, saves them, and triggers the email
│   │       └── live-token/route.ts       # Verifies if the 30-minute live viewer link is still valid
│   │
│   ├── components/                       # The Visual Building Blocks on the Screen
│   │   ├── CameraFeed.tsx                # Shows the live camera video and draws the glowing AI boxes
│   │   ├── AlertHeader.tsx               # The top bar where you type your alert email address
│   │   ├── IncidentDrawer.tsx            # The slide-out side panel showing past incident alert cards
│   │   ├── EvidenceModal.tsx             # The pop-up window to inspect an incident photo up close
│   │   └── ThreatStats.tsx               # Shows live stats (frames per second, latency, skeletons tracked)
│   │
│   ├── lib/                              # The Brain & Cloud Connections
│   │   ├── ai/                           # The Artificial Intelligence Engines
│   │   │   ├── modelLoader.ts            # Downloads and starts the AI models inside the browser
│   │   │   ├── combatEngine.ts           # Math that detects punches, kicks, and wrestling
│   │   │   ├── weaponEngine.ts           # Math that checks if a person is holding a dangerous item
│   │   │   └── accidentEngine.ts         # Math that detects when two vehicles crash into each other
│   │   │
│   │   ├── email/resend.ts               # Builds the emergency alert email and sends it
│   │   ├── supabase/                     # Cloud Database Connections
│   │   │   ├── client.ts                 # Listens for real-time new incident alerts on the screen
│   │   │   └── server.ts                 # Safely uploads photos and writes incident logs to the database
│   │   ├── token.ts                      # Creates secure, tamper-proof 30-minute expiring keys
│   │   └── types.ts                      # Definitions that keep our data clean and structured
│   │
│   └── schema.sql                        # The database recipe used to set up Supabase tables and folders
│
├── .env.local.example                    # Example list of secret passwords and keys needed to run the app
├── IMPLEMENTATION_PLAN.md                # Detailed technical coding guide for programmers
├── SYSTEM_BLUEPRINT.md                   # This document (the plain-English overview of the platform)
├── README.md                             # Quick-start guide with instructions to download and run
└── package.json                          # List of all open-source libraries installed in the project
```

---

## 7. How Does the 30-Minute Live Link Work?

When an incident occurs, sending an email with just a picture might not be enough. Emergency responders or security personnel need to know: **"Is the threat still happening right now?"**

To answer this without requiring expensive 24/7 video streaming servers:
1. When an incident is detected, the system creates a **digital VIP pass (a cryptographic token)** stamped with an expiration time of exactly **30 minutes**.
2. The emergency email includes a button: **`[View Live Stream (Valid 30 Mins)]`**.
3. When the recipient clicks this button, their browser opens the secure `/live/[token]` page.
4. The page checks the pass:
   - If **less than 30 minutes** have passed: It connects directly to the surveillance feed and displays a live countdown timer (`28:45 remaining`).
   - If **more than 30 minutes** have passed: The pass expires automatically, and the screen displays `Access Expired for Security`.

---

## 8. Why Does It Cost $0 to Run?

Traditional video monitoring services charge $50 to $200 per camera per month because streaming video through cloud servers is bandwidth-heavy and GPU-intensive. 

This project achieves an **enterprise-grade result at $0 total operating cost** by using generous free tiers smartly:

1. **Client-Side Edge AI ($0)**: The AI runs directly inside your computer's browser using your device's graphics card. Zero server GPU hours are purchased.
2. **Vercel ($0)**: Hosts the website and executes the email/storage functions for free on their Hobby plan.
3. **Supabase ($0)**: Stores up to 500 MB of incident logs and 1 GB of snapshot pictures for free.
4. **Resend ($0)**: Sends up to 3,000 incident alert emails every month for free.

---

## 9. Summary for Evaluators and Non-Technical Stakeholders

This platform proves that **modern web technologies and on-device AI can replace costly surveillance hardware**. 

By combining **TensorFlow.js (AI in the browser)**, **Supabase (cloud storage)**, and **Resend (emergency emails)**, any ordinary computer with a webcam can become a proactive, life-saving security sentinel that spots violence, threats, and accidents in seconds—with no expensive equipment, no monthly subscriptions, and zero privacy compromises.
