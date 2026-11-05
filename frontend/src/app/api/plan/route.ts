import { NextResponse } from "next/server";
import { makePlan } from "@/lib/planEngine";

// Served by Next before the /api/* rewrite to the FastAPI backend, so the
// planner ships with the frontend and its API key stays on Vercel.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: { prompt?: unknown; city?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON: { prompt, city? }" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 3) {
    return NextResponse.json({ error: "Describe the day you want, e.g. \"Saturday in Bandra, music and food\"." }, { status: 400 });
  }

  try {
    const plan = await makePlan({
      prompt,
      city: typeof body.city === "string" ? body.city : null,
    });
    return NextResponse.json({ data: plan });
  } catch (err) {
    console.error("[plan]", err);
    return NextResponse.json({ error: "The planner hit a problem. Try again in a moment." }, { status: 500 });
  }
}
