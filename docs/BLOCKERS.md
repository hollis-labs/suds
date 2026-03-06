# Known Blockers & Deferred Items

## Blockers (must resolve before production)
- [ ] PostgreSQL database needs to be provisioned (DigitalOcean managed DB)
- [ ] OAuth provider credentials need to be configured (Google, GitHub, Discord)
- [ ] NEXTAUTH_SECRET needs to be generated for production
- [ ] ANTHROPIC_API_KEY needed for AI content generation
- [ ] Domain name and SSL setup required
- [ ] Database migrations need to be run on production DB

## Deferred / TODO
- [ ] tRPC hooks not fully wired in play page (mock data still used) — need DB connection to complete
- [ ] AI content generation (room descriptions, NPC dialogue, quests) — needs API key
- [ ] E2E tests with Playwright — needs running app instance
- [ ] Game balance playtesting — needs playable build
- [ ] Sound effects are opt-in stubs — Web Audio API beeps only
- [ ] Mobile responsive needs real device testing

## P1 Features (Post-MVP)
- [ ] Quest system (AI-generated story + daily quests)
- [ ] Fast travel stones
- [ ] Room annotations / personal map
- [ ] Rare random events
- [ ] Configurable encounter tuning
- [ ] Advanced combat (keyboard hotkeys for abilities)
