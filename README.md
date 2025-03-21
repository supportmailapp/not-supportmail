# Supportmail Helper

The source code of the helper bot for the SupportMail support server.

If you want to use this code, you can do so by forking this repository and modifying the code to fit your needs.

> [!WARNING]
> The scripts that are being executed via cron have critical errors. Please do not use them!

## Current Features

### Support Forum Management

- **Support Post Tracking**: Monitors and manages support forum threads
- **Automatic Tag Management**: Dynamically changes tags from unanswered to unsolved when someone responds
- **Intelligent Post Closure**: Detects when users express gratitude and suggests marking posts as solved
- **Helper Recognition System**: Allows post authors to commend users who helped them
- **Review Flagging**: Mark posts for review by developers with `/mark-for-review`
- **Anti-Archive Protection**: Prevents posts from being automatically archived if needed

### Automation

- **Auto-Threading**: Creates threads automatically for messages in designated channels
- **Auto-Publishing**: Publishes messages in announcement channels with customizable rules
- **Flag Emoji Removal**: Automatically removes country flag reactions in specified channels
- **Customizable Permissions**: Configure whitelist/blacklist for users and roles

### Feature Request System

- **Categorized Requests**: Organizes feature requests by category (Subscriptions, Settings, Translations, etc.)
- **Status Workflow**: Track requests from submission through implementation
- **Sticky Message Management**: Maintains interactive feature request forms
- **Thread-Based Discussions**: Each request creates its own discussion thread

### Incident & Status Management

- **Incident Tracking**: Create and manage service incidents
- **Status Updates**: Update incident status (Investigating, Identified, Monitoring, Resolved)
- **Notification System**: Optional role pinging for status changes

### Administration & Metrics

- **Bug Tracker**: Track user-reported bugs with `/bugs add` and `/bugs remove` commands
- **User Statistics**: Comprehensive stats tracking for support contributions
- **Command-Based Management**: Administration commands for various server functions

![image](https://github.com/user-attachments/assets/6249640a-5e66-43dc-90ef-6d66e2e86cc6)

## Setup Instructions

To set up the Bot, follow these steps:

1. **Clone the Repository**: Start by cloning the repository to your local machine using `git clone https://github.com/The-LukeZ/not-supportmail.git`.
2. **Install Dependencies**: Navigate to the project directory and install the necessary dependencies using `npm install` or `yarn install`.
3. **Configure Environment Variables**: Duplicate `.env.example` to `.env.production` and fill in the required environment variables with your specific values.
4. **Edit Configuration Files**: Duplicate the `example.config.json` to `config.json` and fill it with your own configuration values..
5. **Run the Bot**: Start the bot using `npm run start` or `yarn run start`. _You might need to install all dependencies first._

> [!TIP]
> To run the bot in develoment mode, make a `.env.dev` and use the command `npm dev` or `yarn dev`.

By following these steps, you will have the Supportmail Helper bot set up and running on your server. Make sure to review the configuration files and adjust them to fit your specific needs.

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

> [Here!](/TODO.md).
