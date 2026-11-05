import { NextResponse } from "next/server";
import { handleMessage } from "@/lib/alerts";
import { telegramConfigured, webhookSecret, sendMessage } from "@/lib/telegram";
import { siteOrigin } from "@/lib/siteOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!telegramConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  // Only Telegram knows the secret it was registered with.
  if (req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: { message?: { chat: { id: number; type: string }; text?: string } };
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  const msg = update.message;
  if (!msg?.chat?.id) return NextResponse.json({ ok: true });

  try {
    await handleMessage(msg, siteOrigin(req));
  } catch (err) {
    console.error("[telegram]", (err as Error).message);
    await sendMessage(msg.chat.id, "Something went wrong on my side. Please try again in a minute.").catch(() => {});
  }
  // Always 200: a non-200 makes Telegram retry the same update repeatedly.
  return NextResponse.json({ ok: true });
}
