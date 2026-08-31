# Jackbox-Style Party Game — Project Roadmap

A phased plan to build a self-hosted, browser-based party game, structured so each phase produces something *working* before you add complexity.

**Core principle: get one full round of one game playable end-to-end before adding anything else.** A working "Quiplash clone" with zero DevOps polish beats a beautifully containerized, monitored, CI/CD'd app that has no actual game in it.

---

## Phase 0 — Setup & Planning (few hours)

- [ ] Pick your first game mode. Keep it simple for v1 — a prompt/answer/vote game (Quiplash-style) is easier than something with complex turn logic.
- [ ] Sketch the game's state machine on paper: `lobby → prompt → answering → voting → results → (next round or end)`
- [ ] Create GitLab account + repo (private is fine)
- [ ] Set up your local dev folder structure:
  ```
  /game-project
    /client       (React app)
    /server       (Node/Express + Socket.io)
    /shared       (optional: shared types if using TypeScript)
    docker-compose.yml
    .gitlab-ci.yml
  ```
- [ ] Init git, push empty structure to GitLab

**Goal of this phase:** a repo exists, you know what game you're building first.

---

## Phase 1 — Core Game Loop (no styling, no persistence, no hosting)

This is the heart of the project. Build it entirely on `localhost` first — don't touch Docker, Cloudflare, or a database yet.

- [ ] Node.js + Express server: basic HTTP server running
- [ ] Socket.io wired into the Express server
- [ ] Room creation: host creates a room, gets a room code
- [ ] Players join a room via code (from a second browser tab/phone on same WiFi)
- [ ] In-memory game state per room (a `Map<roomCode, gameState>`)
- [ ] Basic game flow working end-to-end for **one round**:
  - Host starts round → prompt sent to players → players submit answers → answers shown for voting → votes tallied → results shown
- [ ] React frontend: two simple views
  - **Host view** (the "TV screen") — shows current game state, prompts, results
  - **Player view** (phone) — join screen, answer input, vote buttons

**Goal of this phase:** you and a friend can play one full round over your local WiFi, ugly UI and all. This is the single most important milestone — everything else is enhancement.

---

## Phase 2 — Make It a Real Game

- [ ] Support multiple rounds in sequence
- [ ] Score tracking across rounds (in memory is fine for now)
- [ ] Handle disconnects/reconnects gracefully (a player's phone locks mid-game — don't crash the room)
- [ ] Basic styling — doesn't need to be pretty, just usable on a phone screen
- [ ] Add a second game mode if you want variety, reusing the same room/socket infrastructure

**Goal of this phase:** a genuinely playable game you'd actually use at a game night on your home network.

---

## Phase 3 — Get It on the Internet

- [ ] Set up Cloudflare account, add a domain (or free subdomain option)
- [ ] Install and configure `cloudflared` on your PC, create a tunnel pointing to your local server port
- [ ] Test joining a room from a phone on cellular data (not your home WiFi) — this is the real test
- [ ] Handle CORS properly now that frontend/backend may be served from different origins during dev

**Goal of this phase:** you can text a friend a link and they can join from anywhere.

---

## Phase 4 — Containerize It

- [ ] Write a `Dockerfile` for your Node/Express server
- [ ] Write a `Dockerfile` (or use a static build + simple server) for your React frontend, or serve it directly from Express as static files
- [ ] Write `docker-compose.yml` tying frontend + backend together
- [ ] Confirm `docker compose up` gets the whole app running from a clean checkout
- [ ] Point `cloudflared` at the containerized app instead of your bare local process

**Goal of this phase:** your entire app comes up with one command, on any machine with Docker installed.

---

## Phase 5 — Add Persistence

- [ ] Add **PostgreSQL** container to your compose file, with a volume for data persistence
- [ ] Design tables for whatever should survive a restart: game history, player stats, custom prompt packs
- [ ] Add **Redis** container: use it to persist active room state so a server restart doesn't kill in-progress games
- [ ] (Stretch) Add a **MongoDB** container for something document-shaped — e.g., user-submitted custom prompt packs stored as flexible JSON

**Goal of this phase:** restarting your server doesn't wipe out game history or crash active games.

---

## Phase 6 — CI/CD Pipeline

- [ ] Write `.gitlab-ci.yml` with a `test` stage: run linter + any tests you've written
- [ ] Add a `build` stage: build Docker images, push to GitLab's container registry
- [ ] Add a `deploy` stage: SSH into your home PC, pull new images, restart via `docker compose`
- [ ] Set up `sshd` on your home PC (if not already) so GitLab CI can reach it for deployment
- [ ] Test the full loop: push code → pipeline runs → your live game updates automatically

**Goal of this phase:** `git push` is the only manual step between writing code and it being live.

---

## Phase 7 — Observability

- [ ] Add a **Prometheus** container, instrument your Node server to expose basic metrics (active rooms, connected players, request latency)
- [ ] Add a **Grafana** container, build a simple dashboard from those metrics
- [ ] (Stretch) Add **Loki** for centralized log viewing instead of `docker logs`-ing into each container manually

**Goal of this phase:** you can see what your app is doing without SSH-ing in and reading raw logs.

---

## Phase 8 — Orchestration (stretch goal, biggest leap)

- [ ] Install **k3s** (lightweight Kubernetes) on your PC, or use **minikube** for local practice first
- [ ] Convert your `docker-compose.yml` services into Kubernetes manifests (Deployments, Services, PersistentVolumeClaims)
- [ ] Package it as a **Helm chart** for repeatable deploys
- [ ] Get the same app running under Kubernetes that previously ran under plain Docker Compose

**Goal of this phase:** real hands-on Kubernetes experience, which is the single highest-value item for job purposes on your original skills list.

---

## Phase 9 — Infrastructure as Code (optional polish)

- [ ] Use **Terraform** to manage your Cloudflare DNS/Tunnel config declaratively
- [ ] Use **Ansible** to script your home PC's setup from scratch (install Docker, k3s, pull configs) — useful if you ever rebuild the machine

---

## What to explicitly skip

Don't force these in — they don't fit a party game and will waste time you could spend finishing phases above:
- AI/ML libraries (TensorFlow, YOLO, etc.) — unless you add an "AI generates prompts" feature later, which is a legitimate optional stretch using Ollama
- Kafka, NiFi, Airflow, Spark — built for data volumes this project will never produce
- Web mapping tools — no geographic component
- Neo4j — no graph-shaped data
- Multiple frontend frameworks — pick React and stay there

---

## Suggested pacing

| Phase | Focus | Roughly how it feels |
|---|---|---|
| 0–2 | Core game | The actual fun part — most of your learning happens here anyway |
| 3–4 | Hosting + Docker | Necessary friction, teaches real infra skills |
| 5 | Databases | Directly useful, not too hard |
| 6 | CI/CD | High value, moderate effort |
| 7 | Observability | Fun once you see live dashboards of your own app |
| 8 | Kubernetes | The hardest phase by far — budget real time here |
| 9 | IaC | Polish, do only if phases 0–8 didn't burn you out |

**Rule of thumb:** if a phase is dragging and you're losing motivation, it's fine to jump back and add a feature to the actual game instead. The checklist items don't need to be built in a perfectly straight line — momentum matters more than order.
