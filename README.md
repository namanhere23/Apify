# AURA — Agent Dating Studio

A working React + Express application that reads exactly two public profile sources, creates evidence-based agent briefings, runs agent-to-agent date simulations, and ranks the complete cohort for every person.

The repaired demo includes **28 people, 56 source links, 378 saved pair sessions, and 756 directional ranking entries**. The source data was retrieved through Apify, with explicit public Instagram checks, matching-name checks and a manual review for obvious same-name conflicts. See [the complete cohort](docs/COHORT.md) and [the rejection audit](server/data/discovery-audit.json).

## Run

Requires Node.js **22.12 or newer**. From the repository directory:

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:3001**. The production server serves both the UI and API. `npm run dev` runs the API and Vite separately; the Vite page is http://localhost:5173.

The included timestamped cohort works without an Apify token. To retrieve a **new** source pair, copy `.env.example` to `.env` and set `APIFY_TOKEN`, or enter a token in Connection settings. The UI never stores a token in local storage, and APIs never return it. Tokens entered in the UI last for the server session. External source retrieval requires valid provider access and account credit; failures are shown and never replaced with invented data.

The server binds to loopback by default. Set `HOST=0.0.0.0` only when deploying behind your own access controls. `AURA_DATA_DIR` selects a writable persistent directory. The Dockerfile builds the full app; mount a volume at `/data` for durable imports and sessions.

## What to try

1. **People:** search names or observed topics. Each person links to LinkedIn and public Instagram.
2. **Add person:** paste both profile URLs. The same saved pair opens its cached snapshot; a new pair retrieves both sources. The profile analysis opens before navigating to rankings. Invalid URLs, private accounts, source mismatches and unavailable providers produce actual errors.
3. **Profile:** inspect needs, hobbies, interests, public topic signals, source reading, and the evidence ledger. Each extracted topic has an excerpt, source URL, source field and claim ID. Profiles have shareable `?profile=<id>` URLs. Romantic needs, boundaries and participation stay unknown.
4. **Date studio:** select any two different agents and start the date. Play, pause, step, replay or reveal all ten turns; inspect evidence and remembered replies. The agents propose an activity, address unknowns, and issue independent debriefs. Download the transcript as JSON.
5. **Rankings:** choose any person and inspect all 27 counterparts. Expand score explanations, compare directional and mutual fit, and open the saved date behind a ranking. Download rankings or export the entire studio.

## The two-source pipeline

`LinkedIn profile + public Instagram profile → source snapshots → evidence briefing → agent date → independent debriefs → per-person rankings`

LinkedIn retrieval uses [`harvestapi/linkedin-profile-scraper`](https://apify.com/harvestapi/linkedin-profile-scraper/input-schema), accepting actual profile URLs. Instagram retrieval uses [`apify/instagram-scraper`](https://apify.com/apify/instagram-scraper/input-schema) in `details` mode. Source capture timestamps and exact Apify run IDs are retained per snapshot. The retrieval script respects ten-profile LinkedIn batches and charge caps, reuses existing snapshots, and records rejected candidates.

Only the two normalized snapshots enter the analyzer. It uses explicit word-boundary topic rules to extract observed mentions; it never fills missing schools, employment, captions, follower counts, personality traits or hobbies. A caption mentioning an activity is a conversation signal and does not establish a personal preference. No other biography, search result or website feeds the analysis.

## How the agents date

This implementation is an **explainable rule-based agent harness**, with no LLM service dependency. Each agent owns its person’s evidence and a separate memory of received topics, questions, replies, proposals and decisions. The dialogue policies progress through opening, discovery, trade-offs, planning and reflection. Responses use the previous turn, select an evidence-backed topic, and keep unsupported relationship information unresolved.

Sessions are deterministically identified by the two person IDs and engine version. All unordered pairs run when the cohort loads or grows. Their ten-turn transcripts and both evaluations are saved, so replay and ranking refer to the same date. Agents speak as agents; the dialogue is a simulation and does not impersonate statements by the people.

## Ranking calculation

Each agent evaluates the counterpart separately:

| Component | Weight | Calculation |
|---|---:|---|
| Public interest mentions | 45 | Shared interests divided by the target’s observed interest count |
| Leisure mentions | 30 | Shared hobbies divided by the target’s observed hobby count |
| Dialogue outcome | 15 | Shared-topic discussion, topics remembered, and acceptance/holding of the activity proposal |
| Source coverage | 10 | Minimum coverage of the two agents’ source readings |

Unsupported interest/leisure categories receive no weight; remaining weights are normalized. Coverage counts populated source fields, capped at five per platform. The dialogue score and coverage formula are visible in `server/simulationEngine.js` and `server/profileAnalyzer.js`. Mutual fit averages both independent agent scores. Stable ID tie-breaking makes repeated rankings identical. Scores are **heuristic public-topic conversation-fit indices**, not probabilities of attraction or romantic compatibility.

Account ownership and participation have not been independently verified. These public figures have not been enrolled as dating participants. An actual dating deployment needs participant-provided preferences and confirmation; this demo cannot infer them from public profiles.

## Persistence and failure behavior

`server/data/demo-cohort.json` holds the included 28 source snapshots. On startup, the server initializes `server/data/state.json` to store profiles, analysis, and simulated date sessions. Writes are serialized and use temporary-file replacement. Concurrent imports of the same source pair are deduplicated. The reset API requires an explicit command, and cross-origin state changes are rejected.

## Verification

```sh
npm test
npm run build
```

Tests cover URL allowlists, public status, identity mismatches, deterministic evidence extraction, agent memory, independent evaluations, ranking completeness, restart persistence, concurrent deduplication, cached imports, API failures and cross-origin protection.
