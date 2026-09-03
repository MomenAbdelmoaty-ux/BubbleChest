# BubbleChest — Game Mode 1 Rulebook

*(working title — no official name assigned yet)*

**Players**: exactly 4
**Objective**: There is no win or lose condition. The game is structured to produce a single comedic moment — a live freestyle performance — for a group playing together in person or over a voice call.

---

## Roles

Roles are assigned **randomly** when the game starts; players do not select their own role. The player who creates the room (the host) is one of the four role-holders, not a separate controlling party.

### Rapper
When the Performance phase begins, this player is presented with:
- A **topic**, selected by the Record Label
- A set of **couplets**, each with a predetermined final word or short phrase, with the remainder of each line left blank

A looping instrumental (assembled by the Producer) begins playing at this point. The Rapper must improvise the remainder of each line in real time, concluding each line with its assigned ending.

### Ghostwriter
Responsible for writing the **ending word or phrase for each couplet**. No verification is performed to confirm that paired endings rhyme; this is left entirely to the Ghostwriter's discretion.

The number of couplets per round is configurable by the host, within a range of **6 to 12**.

### Producer
Responsible for constructing the round's instrumental using a step-sequencer interface, offering a selection of standard musical percussion sounds alongside a selection of non-musical novelty sound effects, giving the Producer room for comedic choices in addition to a functional beat. The exact set of available sounds is not yet finalized.
- Each available sound occupies its own row in the grid; each column represents a fixed time step. Selecting a cell toggles that sound on or off at that step.
- Rhythmic resolution is intentionally limited to quarter and eighth notes; sixteenth-note and half-note subdivisions are not supported, in order to keep pattern creation simple.
- Tempo (BPM) is adjustable via a slider control.

### Record Label
Responsible for selecting the **topic** the Rapper will perform on. This is the role's sole responsibility.

---

## Round Structure

**1. Lobby** — The host creates a room and receives a room code. Up to three additional players join using that code. The host initiates the round.

**2. Role assignment** — All four roles are assigned at random and disclosed to all players immediately; no role information is withheld from the group.

**3. Preparation phase** — The Record Label, Ghostwriter, and Producer complete their respective tasks **concurrently and independently**:
- Record Label selects the topic
- Ghostwriter writes the couplet endings
- Producer constructs the instrumental

The Rapper takes no action during this phase.

**4. Time limit** — The Preparation phase is governed by a countdown timer, configurable by the host between **one and five minutes**. When the timer reaches zero, a **three-second grace period** follows, during which an audible cue plays and all fields remain editable. At the conclusion of the grace period, all current values are submitted automatically, regardless of completeness; any incomplete field is submitted as blank.

**5. Performance phase** — At the conclusion of Preparation, the topic, couplet endings, and instrumental are released to all players simultaneously. Playback of the instrumental is synchronized across all connected devices to minimize perceptible timing drift between players. The Rapper performs the round.

**6. Round conclusion** — Following the performance, the group may choose to replay (with roles reassigned at random) or return to the lobby.

---

## Design Rationale

- **Absence of scoring** reflects the game's intent: the shared experience of the performance is the outcome, not competition between players.
- **Random role assignment** ensures no player can select or avoid a specific role.
- **Automatic submission at the end of the grace period** prevents any single player's incomplete work from indefinitely delaying the group; an incomplete submission is treated as a valid, if more difficult, input for the Rapper.
- **Restricted rhythmic complexity** in the Producer's interface reflects the tool's intended scope: rapid, low-effort pattern creation rather than a full music-production environment.
