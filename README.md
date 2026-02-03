# Supportmail Helper

The source code of the helper bot for the SupportMail support server.

If you want to use this code, you can do so by forking this repository and modifying the code to fit your needs.

## Installation and Usage

### Prerequisites

- [Node.js](https://nodejs.org/) (version 20 or higher)
- [bun](https://bun.sh/) package manager
- [MongoDB](https://www.mongodb.com/) database
- Discord Bot Token from the [Discord Developer Portal](https://discord.com/developers/applications)

### Setup

#### 1. Clone the repository

```bash
git clone https://github.com/your-username/sm-helper.git
cd sm-helper
```

#### 2. Install dependencies

```bash
bun install
```

#### 3. Environment Configuration

Create environment files in the root directory, based on the [`.env.example`](.env.example) file:

- `.env.dev`: For development environment variables
- `.env.production`: For production environment variables

> [!IMPORTANT]
> Make sure, if you use Sentry, to update the `sentry:sourcemaps` script in the `package.json` to point to your Sentry project.
> **Tip:** You can use the [Sentry CLI](https://docs.sentry.io/platforms/javascript/guides/node/sourcemaps/uploading/typescript/#automatic-setup) to automatically let sentry handle this for you.

#### 4. Configure the bot

- Invite your bot to your Discord server with the necessary permissions
- Set up the required channels and roles according to your server structure
- Customize configuration values in the source code as needed

### Running the Bot

**Development mode:**

```bash
bun dev
```

**Production mode:**

```bash
bun start
```

**Building only:**

```bash
bun build
```

### Bot Permissions

The bot requires the following Discord permissions:

- Send Messages
- Use Slash Commands
- Manage Messages
- Manage Threads
- Add Reactions
- Read Message History
- Embed Links
- Attach Files
- Mention Everyone
- Use External Emojis

### Database Setup

The bot uses MongoDB to store data. Make sure your MongoDB instance is running and accessible via the `MONGODB_URI` in your environment file. The bot will automatically create the necessary collections and indexes on startup.

## Current Features

Please refer to the [FEATURES.md](FEATURES.md) file for a detailed list of current features, components, event-driven automations, cron jobs, database models, caches, utilities, and configuration options.

---

## License (Summary - not binding)

### **GPL3 LICENSE**

1. Anyone can copy, modify and distribute this code.
2. You have to include the license and copyright notice with each and every distribution.
3. You can use this software privately.
4. You can use this software for commercial purposes.
5. If you dare build your business solely from this code, you risk open-sourcing the whole code base.
6. If you modify it, you have to indicate changes made to the code.
7. Any modifications of this code base MUST be distributed with the same license, GPLv3.
8. This software is provided without warranty.
9. The software author or license can not be held liable for any damages inflicted by the software.

More information on about the [LICENSE can be found here](http://choosealicense.com/licenses/gpl-3.0/)

---

## TODOs?

- [ ] Add a way to input `ends_at` on `/incident create` field for maintenance
