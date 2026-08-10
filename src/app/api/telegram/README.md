# Remotify Telegram webhook

Point BotFather / `setWebhook` at:

`https://<your-domain>/api/telegram/webhook`

Register commands:

`POST /api/telegram/setup` with `Authorization: Bearer $CRON_SECRET`

Supported updates: `message`, `channel_post`.

Preferred UX: DM the bot `/grab` or `/matches` to receive Excel; `/resume` for PDF.
