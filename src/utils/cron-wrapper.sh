#!/bin/bash
# cron-wrapper.sh
echo $PATH
cd /home/helper/bot
npm run cron:support-questions
npm run cron:sync-votes
# Currently not used:
# npm run cron:check-subs >> /logs/check-subs.log 2>&1
