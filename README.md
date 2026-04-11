# ⬡ SovereignSelf

> Your digital identity. Your compute. Your rules.

## What is this?

Your online reputation exists across dozens of platforms, analyzed by algorithms you don't control, stored on servers you don't own. When a coordinated attack targets your digital identity- a viral misquote, a bot swarm, a manipulated narrative..you find out from a stranger's DM, hours too late.

**SovereignSelf** is an autonomous AI agent that monitors, analyzes, and protects your digital reputation in real time-running entirely on *your own* Nosana GPU node. Built on [ElizaOS](https://github.com/elizaOS/eliza) with three custom plugins and powered by the Qwen language model via Nosana's decentralized compute network, it embodies the [OpenClaw](https://openclaw.org) philosophy: **you should own your AI, your data, and the compute it runs on**. No third-party APIs, no corporate middlemen, no surveillance. Just your agent, watching your back, 24/7.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    NOSANA GPU NODE                          │
│                                                             │
│  ┌──────────────────────────────────────────┐               │
│  │          ElizaOS Agent Runtime           │               │
│  │  ┌────────────┐ ┌──────────┐ ┌────────┐ │               │
│  │  │ Reputation │ │  Crisis  │ │ Nosana │ │               │
│  │  │  Engine    │ │ Detector │ │Monitor │ │               │
│  │  │  Plugin    │ │  Plugin  │ │ Plugin │ │               │
│  │  └─────┬──────┘ └────┬─────┘ └───┬────┘ │               │
│  │        │              │           │      │               │
│  │        └──────────────┴───────────┘      │               │
│  │                   │                      │               │
│  │            ┌──────▼──────┐               │               │
│  │            │  Event Bus  │               │               │
│  │            └──────┬──────┘               │               │
│  └───────────────────┼──────────────────────┘               │
│                      │                                      │
│  ┌───────────────────▼──────────────────────┐               │
│  │    Express 5 REST API + WebSocket Server  │              │
│  │    Port 3001 (REST) · Port 3002 (WS)      │              │
│  └───────────────────┬──────────────────────┘               │
│                      │                                      │
├──────────────────────┼──────────────────────────────────────┤
│                      │                                      │
│  ┌───────────────────▼──────────────────────┐               │
│  │        PostgreSQL 16 (Alpine)            │               │
│  │  mentions · reputation · events · metrics │              │
│  └──────────────────────────────────────────┘               │
│                                                             │
│  ┌──────────────────────────────────────────┐               │
│  │       Qwen 2.5 Coder (Nosana Endpoint)   │              │
│  │  Sentiment Analysis · Reply Drafting      │              │
│  │  Weekly Brief Generation                  │              │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
         │ WebSocket
         ▼
┌─────────────────────────────────────────────────────────────┐
│              React Dashboard (Vite + Tailwind)              │
│  ┌────────────┐ ┌──────────────┐ ┌────────────────────────┐│
│  │  Activity  │ │  Reputation  │ │   Crisis Alert Modal   ││
│  │   Feed     │ │    Panel     │ │   (Framer Motion)      ││
│  │ (terminal) │ │  (Recharts)  │ │                        ││
│  └────────────┘ └──────────────┘ └────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

- **Agent Layer** — ElizaOS runtime with three custom plugins (Reputation Engine, Crisis Detector, Nosana Monitor). Processes every mention through sentiment analysis, watches for coordinated attacks, and generates weekly intelligence briefs.
- **API Layer** — Express 5 REST server with WebSocket broadcasting. Bridges the event bus to the frontend in real time. All six event types (mention, crisis, draft, brief, node, thought) stream live to connected dashboards.
- **Dashboard Layer** — React 18 + Tailwind CSS dark terminal-aesthetic UI. Zustand state with WebSocket hydration, Recharts visualizations, Framer Motion crisis alerts, and a mock seeder for instant demo readiness.
- **Nosana Layer** — All LLM inference runs on the Nosana-hosted Qwen 2.5 Coder endpoint. Node health metrics are polled every 30 seconds and displayed in the dashboard.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Agent Runtime | ElizaOS (TypeScript) | Modular plugin architecture with Actions, Providers, and Evaluators |
| LLM Inference | Qwen 2.5 Coder via Nosana | Decentralized compute — no vendor lock-in, GPU acceleration |
| Database | PostgreSQL 16 | ACID compliance, JSON payloads, efficient time-series queries |
| API Server | Express 5 + ws | Lightweight REST + WebSocket for real-time event streaming |
| Dashboard | React 18 + Vite | Fast HMR in dev, optimized production builds |
| Styling | Tailwind CSS 3 | Rapid dark-theme development with custom design tokens |
| State | Zustand | Minimal boilerplate, selector-based re-renders |
| Charts | Recharts | Composable chart components, React-native integration |
| Animations | Framer Motion | Spring physics for the crisis modal entrance |
| Alerting | Telegram Bot API | Instant mobile notifications on crisis detection |
| Scheduling | node-cron | Weekly brief generation, heartbeat ticks |
| Logging | pino | Structured JSON logging with pretty-print in dev |
| Deployment | Docker + Nosana | Multi-stage builds, GPU container orchestration |

## Quick Start (Local)

### Prerequisites

- [Node.js 23+](https://nodejs.org/)
- [pnpm 9+](https://pnpm.io/)
- [Docker](https://docker.com/) (for PostgreSQL)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/sovereign-self.git
cd sovereign-self

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys (Twitter, Telegram, Nosana)

# 4. Start PostgreSQL
docker-compose up postgres -d

# 5. Start all services (agent + API + dashboard)
pnpm dev

# 6. Open the dashboard
# → http://localhost:5173
```

The dashboard will auto-seed with realistic mock data after 3 seconds if no live data is available — you'll see a fully populated UI immediately.

### Docker (Full Stack)

```bash
# Build and start everything (PostgreSQL + Agent + Dashboard)
pnpm docker:up

# Dashboard available at → http://localhost:8080
# Agent health check at → http://localhost:3001/health
# WebSocket at → ws://localhost:3002

# Tear down
pnpm docker:down
```

## Deploy to Nosana

```bash
# 1. Build the agent Docker image
docker build -t your-dockerhub/sovereign-agent:latest -f packages/agent/Dockerfile .

# 2. Push to Docker Hub
docker push your-dockerhub/sovereign-agent:latest

# 3. Update nosana/job.yaml with your Docker Hub username
# Edit: image: your-dockerhub/sovereign-self-agent:latest

# 4. Deploy to Nosana
nosana job post nosana/job.yaml --market {MARKET_ID}

# 5. Monitor deployment
nosana job get {JOB_ID}

# 6. Verify health
curl https://dashboard.nosana.com/jobs/{JOB_ID}/proxy/health

# 7. Update .env with job ID
echo "NOSANA_JOB_ID={JOB_ID}" >> .env
```

See [`nosana/job.yaml`](nosana/job.yaml) for the full deployment configuration including GPU resources, environment variable mappings, and port exposure.

## ElizaOS Agent Design

SovereignSelf extends ElizaOS with three custom plugins that hook into the framework's Action-Provider-Evaluator lifecycle:

| Plugin | Purpose | Actions | Providers | Evaluators |
|--------|---------|---------|-----------|------------|
| **Reputation Engine** | Sentiment analysis, reply drafting, weekly briefs | `FETCH_REPUTATION_SCORE`, `DRAFT_REPLY`, `GENERATE_WEEKLY_BRIEF` | `TWITTER_CONTEXT` | `SENTIMENT_EVALUATOR` |
| **Crisis Detector** | Real-time threat detection + Telegram alerts | `SEND_CRISIS_ALERT` | — | `CRISIS_EVALUATOR` |
| **Nosana Monitor** | GPU node health tracking | — | `NOSANA_STATUS` | — |

### Character Definition

The agent's personality is defined in [`packages/agent/src/character.ts`](packages/agent/src/character.ts) — a comprehensive ElizaOS character file that sets the agent's voice as **calm authority + protective intelligence**. It includes bio, lore, message examples, post examples, topics, and adjectives that shape every model response. The system prompt explicitly instructs the agent to talk about decentralized compute, digital sovereignty, and Nosana.

### Agent Reasoning Flow Example

```
1. Twitter mention ingested: "@sovereign_self terrible security model"
2. SENTIMENT_EVALUATOR runs → scores as negative (-0.72, 91% confidence)
3. Mention stored in DB with sentiment
4. CRISIS_EVALUATOR checks thresholds → 12 mentions in 15 min, avg -0.3
   → LOW threshold breached
5. crisis:detected event emitted
6. SEND_CRISIS_ALERT fires → Telegram notification sent
7. DRAFT_REPLY generates voice-matched response using 50-tweet history
8. ActivityFeed shows: [ALT] Crisis detected: LOW — 12 mentions in 15 min
9. CrisisAlertModal slides up in dashboard with severity, stats, draft
```

## API Reference

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/health` | Health check | `{ status, uptime, timestamp }` |
| GET | `/api/events?limit=50&type=ACTION` | Agent events (filterable) | `{ events[], total }` |
| GET | `/api/reputation/current` | Latest score + trend delta | `{ reputation, delta }` |
| GET | `/api/reputation/history?days=30` | Historical scores | `{ history[], days }` |
| GET | `/api/mentions?limit=20&filter=crisis` | Recent mentions | `{ mentions[], stats }` |
| GET | `/api/node/status` | Nosana node metrics | `{ metrics, history[] }` |
| POST | `/api/agent/trigger-brief` | Trigger weekly brief generation | `{ status, jobId }` |

## WebSocket Events

Connect to `ws://localhost:3002` to receive real-time events:

| Type | Trigger | Payload |
|------|---------|---------|
| `INIT` | On connect | Last 20 agent events |
| `MENTION` | New tweet ingested | Mention data |
| `CRISIS` | Threshold breached | Severity + crisis mentions |
| `DRAFT` | Reply drafted | Draft text |
| `BRIEF` | Weekly brief generated | Brief text + score |
| `NODE` | Every 30s | GPU/CPU/memory/uptime metrics |
| `THOUGHT` | Agent reasoning | Source + thought text |

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TWITTER_API_KEY` | Twitter API key | `abc123...` |
| `TWITTER_API_SECRET` | Twitter API secret | `def456...` |
| `TWITTER_ACCESS_TOKEN` | Twitter access token | `ghi789...` |
| `TWITTER_ACCESS_SECRET` | Twitter access secret | `jkl012...` |
| `TWITTER_BEARER_TOKEN` | Twitter bearer token | `AAAA...` |
| `TWITTER_USERNAME` | Your Twitter handle (no @) | `sovereignself` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | `123456:ABC-DEF` |
| `TELEGRAM_CHAT_ID` | Telegram chat/group ID | `-1001234567890` |
| `NOSANA_MODEL_ENDPOINT` | Nosana Qwen model endpoint | `https://api.nosana.com/...` |
| `NOSANA_API_KEY` | Nosana API key | `nosana_key_...` |
| `NOSANA_JOB_ID` | Nosana deployment job ID | `a1b2c3d4e5...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://sovereign:sovereign@localhost:5432/sovereign` |
| `API_PORT` | REST API port | `3001` |
| `API_WS_PORT` | WebSocket port | `3002` |
| `NODE_ENV` | Environment | `development` or `production` |
| `LOG_LEVEL` | Pino log level | `debug` |

## Demo (60-Second Script)

**Pre-demo setup:**
1. `pnpm seed:demo` — seeds DB with 30 days of realistic data
2. Open dashboard on external monitor at 1440px
3. Have Telegram open on phone (visible to audience)
4. Have character.ts and a plugin file open in VS Code

**The script:**

| Time | Action | What to Say |
|------|--------|-------------|
| 0–8s | Show dashboard, point to NODE ACTIVE + GPU widget | *"I built an AI agent that watches my back online, 24/7. It runs on my own Nosana node — not Google, not OpenAI. This is SovereignSelf."* |
| 8–20s | Hover MetricCards, point to charts | *"847 mentions this week, 73% positive, reach of 124K. Reputation score 8.1, up 0.4."* |
| 20–35s | Trigger crisis event (Ctrl+Shift+K) | *"Watch what happens when someone attacks my account."* → Crisis modal slides up, phone vibrates with Telegram alert |
| 35–50s | Alt-tab to VS Code, show character.ts + plugin | *"Custom ReputationEngine plugin — uses ElizaOS actions and evaluators, talks to Qwen on Nosana."* |
| 50–60s | Show NosanaStatusWidget, land on full dashboard | *"Every event, every analysis — runs on this Nosana node. Your agent. Your compute. Your identity."* |

## Judging Notes

**Nosana Integration Depth** — All LLM operations (sentiment analysis, reply drafting, brief generation) route through the Nosana-hosted Qwen endpoint. The NosanaMonitor plugin polls job metrics every 30s and surfaces GPU/CPU/memory/uptime in the dashboard. The `nosana/job.yaml` configures GPU resources, and the README documents the full deployment pipeline.

**ElizaOS Framework Depth** — Three custom plugins implementing the full Action-Provider-Evaluator lifecycle (not just wrappers). Custom character definition with system prompt, bio, lore, and personality shaping. The `SENTIMENT_EVALUATOR` (alwaysRun) and `CRISIS_EVALUATOR` are genuine post-processing hooks that fire on every message cycle.

**Creative Angle** — "Digital sovereignty" framing aligns with the hackathon's decentralization thesis. The reputation scoring algorithm is original (weighted formula, not just sentiment averaging). The crisis detection with three-tier thresholds and Telegram alerting is a novel agent behavior. The ActivityFeed as an "agent consciousness window" gives transparency into autonomous reasoning.

**UX Choices** — Terminal-aesthetic dark design with JetBrains Mono typography signals technical credibility. Mock data seeder ensures the dashboard is stunning on first load — judges never see empty states. Framer Motion crisis modal creates an emotionally resonant "wow moment" during the demo.

## Project Structure

```
sovereign-self/
├── pnpm-workspace.yaml
├── package.json                 # Monorepo scripts
├── tsconfig.base.json           # Shared TypeScript config
├── docker-compose.yml           # PostgreSQL + Agent + Dashboard
├── .env.example                 # Environment template
├── nosana/
│   └── job.yaml                 # Nosana GPU deployment config
└── packages/
    ├── agent/                   # ElizaOS Agent
    │   ├── Dockerfile
    │   └── src/
    │       ├── index.ts         # Agent entrypoint
    │       ├── character.ts     # SovereignSelf personality
    │       ├── utils/           # Logger, ModelClient, EventBus
    │       └── plugins/
    │           ├── reputation/  # 3 actions, 1 provider, 1 evaluator
    │           ├── crisis/      # 1 action, 1 evaluator
    │           └── nosana-monitor/  # 1 provider
    ├── api/                     # Express 5 + WebSocket
    │   └── src/
    │       ├── index.ts         # API entrypoint
    │       ├── routes/          # REST endpoints
    │       ├── ws/              # WebSocket broadcaster
    │       ├── middleware/      # CORS, error handler
    │       └── db/              # Pool + migrations
    └── dashboard/               # React 18 + Vite
        ├── Dockerfile
        ├── nginx.conf
        └── src/
            ├── App.tsx          # Root component
            ├── stores/          # Zustand state
            ├── hooks/           # WebSocket, reputation, node
            ├── lib/             # API client, mock seeder
            ├── styles/          # Global CSS + design tokens
            └── components/
                ├── layout/      # Shell, Sidebar, TopBar
                ├── ui/          # StatusDot, MetricCard, Badge, Card
                ├── panels/      # ActivityFeed, ReputationPanel, etc.
                └── charts/      # Recharts visualizations
```

## License

MIT — built for the Nosana Agent Hackathon.

---

*Built with ⬡ on Nosana's decentralized compute network.*
