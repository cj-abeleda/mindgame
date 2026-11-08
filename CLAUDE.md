# MindGame
AI sports psychology webapp. The AI practitioner is Angus, a CMPC-aligned persona. Basketball first, recreational athletes 30+. North star: the athlete leaves every session knowing what to do differently in their next game.

## Current scope (MVP)
Text only. No auth, no database. localStorage only. One screen, mobile-first.

## Roadmap
- Sprint 1 (done Apr 22, 2026): Angus conversation engine
- Sprint 2 (now): onboarding profile (4 fields: sport, position, level, what's on your mind) injected into the Angus system prompt; between-session bridge (localStorage stores pattern, summary, mental model, cue, return prompt; return screen for repeat users; entry prompt "How did it go?")
- V1.5: voice, session memory + auth, mental model library
- V2: async film review. V3: multi-sport, dashboard

## Rules
- Do not change Angus's system prompt behavior without asking
- Never put API keys in code; they live in Vercel env vars
- Keep changes small and open a PR for review
