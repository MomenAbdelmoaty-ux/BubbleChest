# BubbleChest — SMART Goal & Progress Tracker (Revised)

**Today's date**: September 2
**Deadline**: September 19 (17 days)
**Change from previous version**: one unified goal, not two separate ones. Effort goes into making **one game mode genuinely good and actually deployed** (reachable over the real internet via Cloudflare Tunnel, containerized with Docker) rather than splitting time across a second, undesigned game mode. The second mode is explicitly dropped from this deadline — better to ship one excellent thing than two rushed ones.

---

## The Goal

**Specific**: The rap-battle game mode, fully playable end to end (room creation, join, random role assignment, prep phase with all three roles, timer + grace period, synced performance phase, round-end), running inside Docker containers, reachable by anyone over the real internet via a Cloudflare Tunnel URL — not just on your local WiFi. Visually polished enough to comfortably demo to someone who's never seen it, not just "technically functional."

**Measurable**: Success = you can send a friend who is *not* on your WiFi a URL, they open it on their own phone over cellular data, join a room you created, and you complete a full round together with zero manual troubleshooting on your end — and it looks presentable while you do it.

**Achievable**: Scoped to Phases 0–4 of the original roadmap, with Phase 5 (persistence) as an explicit optional stretch, and Phases 6–9 (CI/CD, observability, Kubernetes, IaC) deliberately excluded — those are genuinely not needed to hit "good, working, deployed," and attempting them risks the actual deadline.

**Relevant**: This directly matches what you asked for — one real, demoable thing, not a checklist of unfinished features.

**Time-bound**: September 19.

---

## Milestones (17 days)

| Date | Focus | Done when... |
|---|---|---|
| **Sep 2–3** | Room creation, join-by-code, random role assignment | Host creates a room, 3 others join by code, hitting "start" randomly assigns and broadcasts all 4 roles |
| **Sep 4–5** | Prep phase UI + socket wiring | Record Label, Ghostwriter, and Producer each submit through real UI (topic input, couplet inputs, step-sequencer grid) via the actual socket events |
| **Sep 6** | Timer + grace period | Prep countdown works, hits the 3-second "ding" grace window at zero, force-submits whatever exists afterward |
| **Sep 7–8** | Performance phase + synced beat | Rapper sees topic + couplet endings; beat plays in sync across devices using the `startAt` timestamp approach; round-end offers replay/return to lobby |
| **Sep 9** | Full local playtest + bugfix | Complete loop works repeatedly with 4 real tabs/devices on local WiFi, not just once by luck |
| **Sep 10** | Visual polish pass | Real styling — not "usable," genuinely presentable: consistent layout, readable on a phone, no default-unstyled elements. This is the day that turns "prototype" into "something you're not embarrassed to demo" |
| **Sep 11** | Dockerize | `server` and `client` each have a working `Dockerfile`; `docker-compose.yml` brings both up together with one command, replacing your two manual `npm run dev` terminals |
| **Sep 12** | Cloudflare Tunnel setup | `cloudflared` installed and configured, tunnel created, your containerized app is reachable at a real public URL |
| **Sep 13** | Fix production config | Replace the hardcoded `localhost:3000` in `App.tsx` with the real public URL (ideally via an environment variable, not another hardcode); confirm CORS still works correctly against the real domain |
| **Sep 14** | Remote playtest + bugfix buffer | Test with a friend genuinely NOT on your WiFi (cellular data on their end) — this is where networking surprises usually show up, budget real debugging time here |
| **Sep 15–16** | Optional stretch: Redis for reconnect survival, OR more polish/stability | Only pursue Phase 5 if Sep 2–14 finished with room to spare — otherwise, this time defaults to hardening what already exists (edge cases, disconnect handling, minor UI fixes) rather than adding new infrastructure |
| **Sep 17** | Full dress-rehearsal demo | Run the exact demo you'd give — remote friends, real devices, start to finish — at least twice, back to back, without intervention |
| **Sep 18** | Buffer | Fix whatever the rehearsal exposed. No new features. |
| **Sep 19** | **Demo day** | — |

---

## Explicitly out of scope for this deadline
The second game mode, CI/CD pipelines, Kubernetes, Terraform/Ansible, observability tooling (Prometheus/Grafana), and any AI/ML or data-processing tools from the original skills list. All of these remain valid future work — none of them are required to hit "one good, deployed game," and chasing them here risks the actual deadline.

## Why Phase 5 (Postgres/Redis) is optional, not required
The core demo experience — join, play a round, have fun — doesn't functionally require anything to survive a server restart *during* a single demo session. Redis becomes valuable once you're running this long-term for repeated game nights, not for a one-time polished demo. Treat Sep 15–16 as a genuine "if there's time" slot, not a hidden requirement.

## Tracking notes
- Check progress against this file every 2–3 days, not just at the deadline.
- **Sep 12–14 (the Cloudflare/networking stretch) is the highest-risk part of this whole plan** — self-hosted networking issues (firewall quirks, CORS against a real domain, DNS propagation) are usually the messiest, least predictable part of a project like this. If something's going to slip, budget the buffer days (14, 18) to absorb it from here specifically, not from the earlier game-logic milestones.
- If by Sep 10 the core loop *isn't* solid yet, seriously consider cutting Cloudflare Tunnel down to "just get it reachable, skip the visual polish day" rather than compressing both — a working-but-plain game reachable over the internet is a better demo than a beautiful one still stuck on localhost.
