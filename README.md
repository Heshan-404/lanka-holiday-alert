# HolidaySync (Vercel Edition)

HolidaySync is a serverless automation agent that runs on Vercel to fetch Sri Lanka public holidays and post monthly consolidated reports to Slack and Discord.

## Features
- **Serverless**: Runs as a Vercel Function.
- **Consolidated Monthly Reports**: Sends upcoming holidays for the current and next month.
- **Rich Formatting**: Beautiful markdown layout with emojis and dividers.
- **Multi-channel Support**: Supports multiple Slack and Discord webhooks.

## Setup

1. **Environment Variables**:
   Add these to your Vercel Project Settings:
   - `CALENDARIFIC_API_KEY`: Your Calendarific API Key.
   - `SLACK_WEBHOOK_URL`: (Optional) Comma-separated Slack webhook URLs.
   - `DISCORD_WEBHOOK_URL`: (Optional) Comma-separated Discord webhook URLs.
   - `CRON_SECRET`: (Recommended) A secret string to protect your API from manual triggers.

2. **Cron Schedule**:
   The `vercel.json` is pre-configured to run on the **15th of every month at 9 AM (Asia/Colombo)**.

3. **Local Testing**:
   ```bash
   npm install
   npm run dev
   ```

## Folder Structure
- `/api/check.js`: The serverless function.
- `index.js`: Local wrapper for testing.
- `vercel.json`: Cron job configuration.
