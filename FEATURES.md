# Supportmail Helper — Feature Overview

This document lists the bot's features grouped by area with a short description for each.

**Commands**

- **`/admin send`**: (admin-only) send configured admin messages (placeholder `adminSend` utility).
- **`/bugs add|remove`**: Increment/decrement a user's reported-bugs counter; awards/removes the Bug Hunter role at a threshold.
- **`/deep-clone-channel`**: Deeply clone a channel (text, voice, forum, category, etc.) preserving settings and tags.
- **`/generate-invite`**: Create server invites with options for channel, max uses, max age, temporary membership, and uniqueness.
- **`/ping`**: Shows API ping, roundtrip latency and uptime; updates ping cache.
- **`/stats`**: Displays stored user statistics (bugs reported, etc.).
- **`/suggestion`**: Manage suggestion forum threads — set statuses (noted/accepted/rejected/implemented/duplicate) and optionally lock threads.
- **`/question`**: Manage support forum posts — `solve`, `unsolve`, mark for `dev` review, and `wrong-channel` (optionally open ticket / lock thread).
- **`/tempchannel`**: Full temporary voice-channel system: `create`, `delete`, `list`, `info`, `edit`, `debug` for temp-channel categories (WIP).
- **`/vote`**: Show vote links/buttons for the configured bots.
- **`/vote-notification`**: Toggle whether the user receives DMs when vote roles are lost.

**Components**

- **`tempChannelCategory`**: Component handlers for temporary-channel UI (show category info, edit flows via component custom IDs).

**Event-driven automation**

- **Auto-moderation: `noPings`**: Intercepts Automod pings (configured via `NO_PINGS_AUTOMOD_RULE_ID`) and sends a friendly warning/reply instead of allowing direct pings to developers/users.
- **Audit log: `joinRoleViewer`**: Tracks role-apply audit entries to coordinate join-role application logic and prevent duplicate application.
- **Guild member update: `joinRoles`**: Applies configured join roles after member onboarding (handles bots vs humans and caches interactions with the audit-log handler).
- **Guild member update: `looseVoteRole`**: Detects lost vote-roles and DMs users with buttons to re-vote; respects user DM preferences stored in DB.
- **Message create: `autoPublish`**: Crossposts messages in configured announcement channels when allowed by channel config (pings/whitelist/blacklist).
- **Message create: `autoThreads`**: Auto-create threads in configured channels using a naming schema with variables (username, date, time, etc.).
- **Message reaction add: `autoFlagRemove`**: Automatically removes country-flag (and some other) emoji reactions in configured channels or for configured users.
- **Thread create: `supportPostCreate`**: Auto-joins new support threads, updates DB username, and pins the starter message.
- **Voice state update: `tempChannelManage`**: Core temporary-voice-channel lifecycle manager — tracks user counts, creates/deletes temp voice channels, schedules cleanup and syncs minimal state to DB.

**Cron**

- **Daily job**: Sends periodic `voteMessage` (vote buttons) to a configured channel on a scheduled cron (`cron/daily.ts`) (Currently not customizable via config).

**Database models**

- **`User` (`models/user.ts`)**: Stores per-user stats (e.g., `bugsReported`), display name and DM preferences (`voteLooseDM`).
- **`TempChannelCategory` & `TempChannel` (`models/tempChannel.ts`)**: Persist temporary-channel categories, per-channel records, numbering and user counts.
- **`StickyMessage` (`models/stickyMessage.ts`)**: Tracks pinned/sticky message IDs per channel for sticky message management.

**Caches**

- **`cacheFactory`**: Type-safe wrapper for node-cache used by multiple caches.
- **`pingCache`**: Tracks last ping/interaction times per guild/channel.
- **`joinRoles` cache**: Short-lived cache to coordinate join-role handling between audit-log and member-update handlers.
- **`helpfulUsers` cache**: Caches thread member lookups used when marking helpful users in posts.

**Utilities & helpers**

- **`utils/main.ts`**: Collection of helpers which are used widely across the codebase.
- **`utils/tempChannels.ts`**: Helper functions for temp-channel flow: `createAndSaveTempChannel`, `deleteTempChannels`, fetch last channel data, numbering logic, and UI builders (WIP).
- **`utils/enums.ts`**: Common message-flag constants used across replies.
- **`utils/instrument.ts`**: Sentry initialization and instrumentation for error tracking.
- **`commands/utils/adminSend.ts`**: Admin helper placeholder used by `/admin send`.

# Feature Summary

Short, feature-only overview of what the bot does.

- Support forum automation: auto-tagging, mark solved/unsolved, developer review flags, wrong-channel handling, and starter-message pinning.
- Auto threads & publishing: create threads from messages using templates and crosspost allowed messages to announcement channels.
- Temporary voice channels: create, scale and clean up temporary voice channels with admin controls.
- Suggestions & moderation: set suggestion statuses, lock duplicates, remove certain emoji reactions automatically, and reply to automod pings with friendly guidance.
- User tracking & recognition: track bug reports and simple user stats; award/remove bug-hunter role at thresholds.
- Voting flow: publish vote buttons, notify users when vote roles expire, and allow opting in/out of DM notifications.
- Utilities for staff: generate invites, deep-clone channels, and small admin helpers.
- Configurable: behavior is driven by `config.json` and environment variables (channels, roles, tags, automod rule id, etc.).
