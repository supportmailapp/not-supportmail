# Supportmail Helper

The source code of the helper bot for the SupportMail support server.

If you want to use this code, you can do so by forking this repository and modifying the code to fit your needs.

## Installation and Usage

### Prerequisites

- [Node.js](https://nodejs.org/) (version 20 or higher)
- [pnpm](https://pnpm.io/) package manager
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
pnpm install
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
pnpm dev
```

**Production mode:**

```bash
pnpm start
```

**Building only:**

```bash
pnpm build
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

### Support Forum Management

- **Automatic Post Tracking**: Creates database entries for new support posts in the forum
- **Auto-tagging**: Automatically applies "unanswered" tags to new posts and switches to "unsolved" when responses are received
- **Post Lifecycle Management**: Tracks post activity, sends reminders after 24 hours of inactivity, and auto-closes posts after another 24 hours
- **Question Closure Suggestions**: Automatically suggests using the solve command when users express gratitude or indicate their question is answered

### Support Post Commands (`/question`)

- **Solve/Unsolve Posts**: Mark support questions as solved or reopen them
- **Developer Review**: Flag posts for developer attention with optional priority levels
- **Priority Setting**: Set priority levels (low, medium, high, urgent) for support posts
- **Helpful User Recognition**: Select users who helped solve problems for commendation tracking

### Feature Request System

- **Interactive Request Creation**: Modal-based feature request submission with categorization
- **Status Management**: Track and update request status (pending, accepted, denied, duplicate, implemented)
- **Thread Management**: Automatic thread creation and status-based naming
- **Rate Limiting**: One request per hour per user to prevent spam

### Incident Management (`/incident`)

- **Create Incidents**: Create new incidents with status tracking and optional BetterStack integration
- **Update Incidents**: Add status updates to existing incidents
- **Multi-platform Sync**: Optional integration with BetterStack for status page synchronization
- **Automated Messaging**: Formatted incident reports with duration tracking and affected services

### User Statistics & Recognition

- **Stats Tracking**: Track user contributions including bugs reported, support posts created, and commendations received
- **Bug Hunter System**: Automatic role assignment for users who report multiple bugs (threshold: 5 bugs)
- **Vote Tracking**: Bot voting system with automatic role management and cleanup

### Administrative Tools

- **Invite Generation**: Advanced invite creation with customizable parameters (duration, uses, temporary access)
- **Auto-publishing**: Automatic message crossposting in designated announcement channels
- **Sticky Message Management**: Automated sticky message updates for feature request channels
- **Flag Emoji Removal**: Automatic removal of flag emojis from reactions in specified channels

### Automation & Cron Jobs

- **Support Post Lifecycle**: Automated reminders and post closure for inactive support threads
- **Vote Synchronization**: Regular cleanup of expired voting roles and database entries
- **Activity Tracking**: Continuous monitoring of user activity and post status updates

### Utility Features

- **Ping Command**: Basic bot responsiveness testing with latency metrics
- **Auto-join Threads**: Bot automatically joins new support threads for monitoring
- **Message Pinning**: Automatically pins the starter message in new support posts
- **Username Tracking**: Maintains up-to-date user information in the database

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
