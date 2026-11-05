import { NextResponse } from "next/server";
import { tg, telegramConfigured, webhookSecret, botUsername } from "@/lib/telegram";
import { siteOrigin } from "@/lib/siteOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Point the bot's webhook at this deployment. Visit once after deploying.
 * Always registers the production URL, so it is harmless to call again.
 */
export async function GET(req: Request) {
  if (!telegramConfigured()) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN is not set" }, { status: 503 });
  }
  try {
    const url = `${siteOrigin(req)}/api/telegram/webhook`;
    await tg("setWebhook", {
      url,
      secret_token: webhookSecret(),
      allowed_updates: ["message"],
      drop_pending_updates: true,
    });
    await tg("setMyCommands", {
      commands: [
        { command: "list", description: "Show your alerts" },
        { command: "stop", description: "Turn off all alerts" },
        { command: "help", description: "How this works" },
      ],
    });
    await tg("setMyDescription", {
      description:
        "EventEngine alerts: tell me what you're into and I'll message you when matching events are listed in your city.",
    });
    const info = await tg<{ url: string; pending_update_count: number; last_error_message?: string }>(
      "getWebhookInfo",
    );
    return NextResponse.json({ bot: `@${await botUsername()}`, webhook: info.url, last_error: info.last_error_message ?? null });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
