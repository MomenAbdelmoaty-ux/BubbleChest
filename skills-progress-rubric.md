# Skills Progress Rubric — BubbleChest Project

Status key:
- ✅ **Practiced** — actually wrote/ran real code with this
- 🔶 **Discussed/Designed** — concept understood, decisions made, but no hands-on code yet
- ⬜ **Not started** — no meaningful exposure yet

---

## Core Languages
| Item | Status | Notes |
|---|---|---|
| JavaScript | ✅ Practiced | Deep coverage — closures, scope, hoisting, `this`, event loop, prototypes-adjacent (function-as-object) |
| **TypeScript** | ✅ Practiced | Converted both `client` and `server` to TS; interfaces, type annotations, structural typing, shapes |
| Python | ⬜ Not started | — |
| Java | ⬜ Not started | Only came up as a comparison point (hoisting, `??` equivalents, structural vs. nominal typing) |
| Go | ⬜ Not started | Only mentioned as a comparison point (async model discussion) |

## Web Frameworks
| Item | Status | Notes |
|---|---|---|
| **React** | ✅ Practiced | Components, JSX, props, `useState`, `useEffect`, `useRef`, Rules of Hooks, rendering/reconciliation, Fragments |
| Angular | ⬜ Not started | — |
| VueJS | ⬜ Not started | — |
| Redux / Recoil | ⬜ Not started | Not needed yet at this project's scale — would come up once prop-drilling gets painful |
| Material UI | ⬜ Not started | — |
| Svelte | ⬜ Not started | Deliberately deprioritized in favor of committing to React |

## CI/CD
| Item | Status | Notes |
|---|---|---|
| GitLab CI | ⬜ Not started | Originally planned, then **project switched to GitHub** |
| GitHub Actions | ⬜ Not started | Now the actual target (Phase 6) — concept of CI/CD (stages, pipelines, runners) explained in depth, no `.yml` written yet |
| Jenkins | ⬜ Not started | — |

## Operating Systems
| Item | Status | Notes |
|---|---|---|
| Windows (host) | ✅ Practiced | Actively developing on Windows this whole time |
| Linux (Debian/RedHat/Alpine) | 🔶 Discussed | Will become real once the Raspberry Pi (Raspberry Pi OS, Debian-based) is actually set up — not done yet |
| MacOS | ⬜ Not applicable | Not your dev machine |

## Configuration Management
| Item | Status | Notes |
|---|---|---|
| Ansible | 🔶 Discussed | Identified as a good fit for scripting Pi setup — Phase 9, not started |
| Terraform | 🔶 Discussed | Identified as a fit for managing Cloudflare DNS/Tunnel config — Phase 9, not started |
| SaltStack | ⬜ Not started | — |
| CloudFormation | ⬜ Not started | AWS-specific, deprioritized since self-hosting is the plan |

## Cloud
| Item | Status | Notes |
|---|---|---|
| AWS | 🔶 Discussed | Compared as an optional Phase 5 stretch (deploy a secondary copy) — not touched |
| Azure / GCP / Hybrid / OpenStack | ⬜ Not started | — |
| Free PaaS alternatives (Render/Railway/Fly.io) | 🔶 Discussed | Researched and deliberately **not chosen**, in favor of self-hosting — good comparative knowledge gained even without using them |

## Containers
| Item | Status | Notes |
|---|---|---|
| Docker | 🔶 Discussed in depth | Images vs. containers, volumes, daemons, Dockerfile syntax, docker-compose all explained conceptually — **zero actual Docker commands run yet** (Phase 4, not started) |
| Kubernetes | 🔶 Discussed | Identified as the single highest-value stretch item (Phase 8) — not started |
| Helm, OpenShift, Podman, Rancher | ⬜ Not started | — |

## AI/ML (entire category)
| Item | Status | Notes |
|---|---|---|
| Everything in this category | ⬜ Deliberately skipped | Explicitly identified as not fitting this project — only exception flagged was a possible future "Ollama generates prompts" stretch feature, not pursued |

## Data Storage
| Item | Status | Notes |
|---|---|---|
| PostgreSQL | 🔶 Discussed | Chosen as the right fit for relational room/round/score data — Phase 5, not implemented |
| Redis | 🔶 Discussed | Chosen for surviving server restarts mid-game — not implemented |
| MongoDB | 🔶 Discussed | Chosen specifically for document-shaped data (e.g. saved custom prompt packs) — not implemented |
| MySQL, Elasticsearch, Neo4j, Graph Studio | ⬜ Not started | Neo4j explicitly identified as not fitting (no graph-shaped data) |

## Data Processing
| Item | Status | Notes |
|---|---|---|
| Everything in this category (Kafka, NiFi, Airflow, Spark, RabbitMQ, Valkey, NATS, GIS) | ⬜ Deliberately skipped | Explicitly identified as built for data volumes this project will never produce |

## Scripting Languages
| Item | Status | Notes |
|---|---|---|
| Bash | 🔶 Light exposure | Terminal commands run (npm, git), but not real Bash *scripting* (no `.sh` files, no loops/conditionals written) yet |
| Python | ⬜ Not started | — |
| JavaScript | ✅ Practiced | Covered under Core Languages above |
| PowerShell | 🔶 Incidental | Your terminal is likely PowerShell by default on Windows, but no deliberate PowerShell scripting done |

## Server Orchestration and Networking
| Item | Status | Notes |
|---|---|---|
| Reverse proxy (concept) | ✅ Understood | Explained in depth via Cloudflare Tunnel's role |
| Cloudflare Tunnel | 🔶 Discussed | Chosen as the hosting solution — Phase 3, not yet set up |
| nginx, Traefik, Apache HTTPD | 🔶 Discussed | Compared as alternatives; Traefik specifically flagged as a good Docker-native fit for the skills list — none actually configured |

## Web Mapping
| Item | Status | Notes |
|---|---|---|
| Everything in this category | ⬜ Deliberately skipped | No geographic component in this game |

## Observability & Monitoring
| Item | Status | Notes |
|---|---|---|
| Prometheus, Grafana | 🔶 Discussed | Planned for Phase 7 — not implemented |
| Loki | 🔶 Discussed | Mentioned as a log-aggregation option — not implemented |
| ELK Stack, Splunk, Cloudwatch | ⬜ Not started | — |

## Communication and Documentation
| Item | Status | Notes |
|---|---|---|
| Markdown | ✅ Practiced | Written multiple real `.md` files (README, roadmap, this rubric, the project context handoff) |
| GitHub (platform + repo management) | ✅ Practiced | Repo created, committed, pushed, pulled, resolved a diverged-history conflict from a web-UI edit |
| GitLab | ⬜ Abandoned | Originally the plan, switched to GitHub partway through |
| Slack, MS Teams, Mattermost, RocketChat, JIRA, Confluence | ⬜ Not started | No natural fit for a solo project — would only come up in a team context |

---

## Honest Summary

**Genuinely strong, hands-on progress**: JavaScript, TypeScript, React, Git/GitHub, Markdown — this is where real code has been written and real concepts internalized (not just discussed), including a fair amount of depth most tutorials skip (Rules of Hooks internals, structural typing, the event loop, middleware chains).

**Well-designed but not yet built**: the entire game's data model, socket event contract, and reconnect logic exist as a solid plan (in the project context file) but haven't been turned into actual server/client code yet. This is genuinely the biggest gap right now — not a knowledge gap, a **building** gap. Phase 1 (room creation/join logic) is the next concrete step to close it.

**Conceptually covered, zero hands-on**: Docker, Kubernetes, Postgres/Redis/Mongo, Cloudflare Tunnel, CI/CD, Terraform/Ansible, Prometheus/Grafana. You could explain *why* each of these fits and *what* it would do — but haven't run a single command in any of them yet. This is expected at this stage of the roadmap (these are Phases 3–9), not a red flag.

**Untouched, and mostly fine to stay that way for this project**: Python, Java, Go, Angular/Vue/Svelte, AI/ML, data-processing tools, web mapping, Neo4j, and the team-communication tools — these were flagged early on as either poor fits for a party game or requiring a different project entirely to justify learning.

**Where to focus next, if closing gaps efficiently matters**: finishing Phase 1 (room/role/prep logic in code) is the highest-priority item, since everything else in the roadmap builds on top of an actually-working game. After that, Docker (Phase 4) is probably the best next skills-list item to convert from "discussed" to "practiced," since it's foundational to nearly everything after it (deployment, Kubernetes, CI/CD all assume Docker is already working).
