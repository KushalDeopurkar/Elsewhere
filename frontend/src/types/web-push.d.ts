// web-push ships no types; only what the reminders sender uses.
declare module "web-push" {
  export interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }
  export interface SendOptions {
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
    timeout?: number;
    vapidDetails?: { subject: string; publicKey: string; privateKey: string };
  }
  export class WebPushError extends Error {
    statusCode: number;
    body: string;
    endpoint: string;
  }
  export function sendNotification(
    sub: PushSubscription,
    payload?: string | Buffer | null,
    options?: SendOptions,
  ): Promise<{ statusCode: number; body: string }>;
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };
}
