# ClaimPilot

**ClaimPilot** is an AI-powered auto insurance claims copilot. It guides Claim Agents through the entire claim lifecycle — from intake and damage assessment to cost estimation and final decision — using AI vision and reasoning to accelerate review while keeping a human in the loop.
**Access it from here:**  - **Production**: https://claim-agent-app.lovable.app

> Built with Lovable, TanStack Start, React 19, Tailwind CSS v4, and Lovable Cloud (Supabase + Lovable AI Gateway), Gemini for the AI Models. 

---

## ✨ Features (More details in the PRD)

- **Claim intake** — Capture client, policy, and vehicle info plus damage photos and video
- **AI damage assessment** — Multimodal model analyzes media, identifies damaged parts, severity, and fraud signals
- **Interactive damage annotator** — Visualize and adjust AI-detected damage markers on the vehicle
- **Cost estimate builder** — Auto-generated parts & labor lines with editable repair catalog search
- **Recommendation engine** — Surfaces "Approve", "Review", or "Do Not Approve" guidance with iconography per severity
- **Fraud detection** — Flags high-risk claims (low confidence, inconsistent damage) and blocks premature approval
- **Explain chat** — Conversational AI that explains every assessment decision in context
- **Demo modes** — One-click loading of a standard claim or a suspicious (fraud) scenario

---

## 🧱 Tech Stack

| Layer        | Technology                                            |
| ------------ | ----------------------------------------------------- |
| Framework    | TanStack Start v1 (SSR, file-based routing)           |
| UI           | React 19, Tailwind CSS v4, shadcn/ui, framer-motion   |
| Build        | Vite 7                                                |
| Backend      | Lovable Cloud (Supabase) — Auth, DB, Edge Functions   |
| AI           | Lovable AI Gateway (Google Gemini multimodal models)  |
| Deployment   | Cloudflare Workers (Edge runtime)                     |

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (or Node 20+)
- A Lovable project with Lovable Cloud enabled (provides Supabase + AI Gateway automatically)

### Local development

```bash
bun install
bun run dev
```

The dev server runs at `http://localhost:8080`. Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, etc.) are auto-managed by Lovable Cloud via `.env`.

### Build

```bash
bun run build
```

---

## 📁 Project Structure

```
src/
├── components/
│   ├── ClaimsCopilot.tsx       # Main multi-step claim workflow
│   ├── DamageAnnotator.tsx     # Interactive damage marker editor
│   ├── ExplainChat.tsx         # Contextual AI assistant
│   ├── RepairCatalogSearch.tsx # Parts & labor catalog lookup
│   └── ui/                     # shadcn/ui primitives
├── routes/                     # File-based routes (TanStack Router)
│   ├── __root.tsx
│   └── index.tsx
├── integrations/supabase/      # Auto-generated Supabase client + types
└── styles.css                  # Tailwind v4 theme tokens (oklch)

supabase/
└── functions/
    ├── assess-claim/           # AI vision + reasoning for damage assessment
    └── explain-claim/          # Conversational explainer
```

---

## 🧠 How It Works

1. **Intake** — Claim Agent fills client, policy, vehicle info and uploads damage media.
2. **Assessment** — `assess-claim` edge function calls the Lovable AI Gateway with a multimodal prompt; returns damaged parts, severity, fraud risk, and confidence score.
3. **Estimate** — Damage list converts into editable repair line items priced via the catalog.
4. **Decision** — Recommendation engine evaluates fraud risk + confidence and either suggests approval or blocks it pending SIU review.
5. **Explain** — `explain-claim` lets the Claim Agent ask follow-up questions about any field in context.

---

## 🔐 Security

- Auth handled by Lovable Cloud (Supabase Auth)
- Edge functions validate sessions via JWT
- No private keys are ever stored client-side
- Roles, when introduced, must live in a dedicated `user_roles` table (never on profiles) to prevent privilege escalation

---

## 🌐 Deployment

The project is published via Lovable to Cloudflare Workers.

- **Preview**: https://id-preview--75366585-65c5-4160-82a6-a977590460a4.lovable.app
- **Production**: https://claim-agent-app.lovable.app


---

## 🤝 Contributing

This repository is bidirectionally synced with [Lovable](https://lovable.dev). You can:

- Edit in Lovable → changes auto-push to GitHub
- Push commits to GitHub → changes auto-sync back to Lovable
- Open PRs and use GitHub Actions normally


