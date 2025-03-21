# Supportmail Helper

The source code of the helper bot for the SupportMail support server.

If you want to use this code, you can do so by forking this repository and modifying the code to fit your needs.

> [!WARNING]
> The scripts that are being executed via cron have critical errors. Please do not use them!

## Current Features

- Auto Publishing of messages (with optional validation)
- Auto Threading of channels (with optional validation)
- Managing status updates for the main bot
- Managing support posts (via a support forum)
- Managing feature requests (with the ability to have a sticky message in the channel)
- Bug Tracking
  - Increment the bug report count for a user with `/bugs add`
  - Decrement the bug report count for a user with `/bugs remove`
- User stats tracking (example below)
  - Bug Tracking
  - Created support posts count
  - Who helped the most in support posts (when resolving a post, the author is asked to select the users who helped him the most)
  - Feature request stats

![image](https://github.com/user-attachments/assets/6249640a-5e66-43dc-90ef-6d66e2e86cc6)


## Setup Instructions

To set up the Bot, follow these steps:

1. **Clone the Repository**: Start by cloning the repository to your local machine using `git clone https://github.com/The-LukeZ/not-supportmail.git`.
2. **Install Dependencies**: Navigate to the project directory and install the necessary dependencies using `npm install` or `yarn install`.
3. **Configure Environment Variables**: Duplicate `.env.example` to `.env.production` and fill in the required environment variables with your specific values.
4. **Edit Configuration Files**: Duplicate the `example.config.json` to `config.json` and fill it with your own configuration values..
5. **Run the Bot**: Start the bot using 

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

# TODO

> See [here](/TODO.md).
