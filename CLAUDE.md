# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun dev                    # Run bot in dev mode (uses .env.dev)

# Build & Type Check
bun run build              # Bundle to ./dist (cleans old build first)
bunx tsc --noEmit          # Type check without emitting files

# Register slash commands with Discord
bun run register-dev       # Register to dev guild (uses .env.dev)
bun run register-prod      # Register globally (uses .env.production)

# Production
npm start                  # Launch via PM2 (uses .env.production)
```

There are no test scripts. Use `bunx tsc --noEmit` for validation.

## Architecture

**SupportMail Helper** is a Discord bot (discord.js v14, Bun runtime, MongoDB/Mongoose) for automating support server operations.

### Module loading pattern (`src/index.ts`)

At startup, the bot dynamically scans and loads three module types from their directories:
- **`src/commands/`** — Slash command handlers. Each file exports `data` (SlashCommandBuilder) and `run(interaction)`.
- **`src/events/`** — Discord event listeners. Folder names match discord.js event names (e.g. `messageCreate/`). Multiple handler files per event are supported.
- **`src/components/`** — Button/modal/select menu handlers. Routed by custom ID prefix. IDs starting with `~/` are ignored.

### Custom ID routing

Component interactions use a structured custom ID: `prefix/path?param1/param2`. The `parseCustomId()` utility in `src/utils/main.ts` parses these. Handlers are matched by prefix.

### Configuration

Two config sources are merged in `src/config.ts`:
- **`config.json`** (git-ignored) — server-specific config validated against `config.schema.json`. Defines auto-thread channels, auto-publish channels, flag removal rules, join role configs, and the developer list.
- **`.env.dev` / `.env.production`** — all Discord IDs (bot token, channel/role/tag IDs), MongoDB URI, Sentry DSN.

### Scheduling (Agenda.js)

`src/scheduler/agenda.ts` initializes Agenda with MongoDB. Jobs live in `src/scheduler/jobs/`. The `voteReminder` job runs daily; `postReminder` is scheduled per-post dynamically. Use `src/utils/agendaHelper.ts` helpers when creating or cancelling jobs.

### Caching (`src/caches/`)

`src/caches/cacheFactory.ts` provides a type-safe wrapper around node-cache. All cache modules follow the pattern of exporting typed get/set helpers. Cache getters accept async DB fallback functions to transparently populate from MongoDB on cache miss.

### Support post lifecycle

Support forum posts are the central object of most features. `src/models/supportPosts.ts` stores post metadata. The `canUpdateSupportPost()` utility in `src/utils/main.ts` enforces permission checks before any state changes. Post state is changed via subcommands on `/question` (solve, unsolve, dev-review, reply-needed).

### Key env variables

| Variable | Purpose |
|---|---|
| `BOT_TOKEN`, `CLIENT_ID`, `GUILD_ID` | Discord auth |
| `CHANNEL_SUPPORT_FORUM` | Main forum channel |
| `TAG_SOLVED`, `TAG_DEV`, `TAG_REPL_NEEDED` | Forum post tags |
| `ROLE_THREAD_MANAGER`, `ROLE_DEVELOPER` | Permission roles |
| `MONGO_URI` | MongoDB connection |
| `SENTRY_DSN` | Error tracking (via `instrument.js` preloaded at startup) |
