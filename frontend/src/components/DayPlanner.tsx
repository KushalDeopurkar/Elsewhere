"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Sparkle,
  Microphone,
  CalendarPlus,
  ShareNetwork,
  ArrowClockwise,
  MapPin,
  Car,
  Check,
  WarningCircle,
} from "@phosphor-icons/react/ssr";
import { PlanResult, planToIcs, googleCalendarLink } from "@/lib/plan";
import { getCategoryColor } from "@/lib/categoryColors";
import { priceBadge } from "@/lib/money";

const PlanMap = dynamic(() => import("@/components/PlanMap"), {
  ssr: false,
  loading: () => <div className="plan-map plan-map-loading" />,
});

const EXAMPLES = [
  "Saturday in Mumbai under ₹1000, music and food",
  "Free tech meetups in Bengaluru this weekend",
  "Kal shaam Andheri mein comedy aur khana",
];

const STEPS = [
  "Reading your request",
  "Checking upcoming events nearby",
  "Picking stops that fit",
  "Working out the route and timings",
];

const timeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const dayFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  day: "numeric",
  month: "short",
});

const RUPEES = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

// Minimal typing for the browser speech API, which TypeScript's DOM lib omits.
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => Recognition;

function speechCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function DayPlanner({ city }: { city: string }) {
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [copied, setCopied] = useState(false);
  const recog = useRef<Recognition | null>(null);
  const section = useRef<HTMLElement>(null);
  const heard = useRef("");

  useEffect(() => setCanListen(Boolean(speechCtor())), []);

  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1100);
    return () => clearInterval(id);
  }, [loading]);

  const run = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (q.length < 3 || loading) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: q, city }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Planner failed");
        setPlan(json.data as PlanResult);
      } catch (e) {
        setError((e as Error).message || "Planner failed");
      } finally {
        setLoading(false);
      }
    },
    [city, loading],
  );

  // Shared links land here as /?plan=<request>.
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("plan");
    if (shared) {
      setPrompt(shared);
      run(shared);
      section.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = () => {
    if (listening) {
      recog.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-IN"; // Copes with Indian English and Hinglish in Latin script.
    r.interimResults = true;
    r.continuous = false;
    heard.current = "";
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ");
      heard.current = text;
      setPrompt(text);
    };
    r.onerror = () => setListening(false);
    r.onend = () => {
      setListening(false);
      if (heard.current.trim().length > 2) run(heard.current);
    };
    recog.current = r;
    setListening(true);
    r.start();
  };

  const downloadIcs = () => {
    if (!plan) return;
    const blob = new Blob([planToIcs(plan, window.location.origin)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "eventengine-plan.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const share = async () => {
    const url = `${window.location.origin}/?plan=${encodeURIComponent(prompt.trim())}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: plan?.title ?? "My EventEngine plan", url });
        return;
      }
    } catch {
      // Share sheet dismissed; fall back to copying.
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <section ref={section} id="plan" className="shell section planner">
      <div className="planner-head">
        <span className="planner-kicker">
          <Sparkle size={15} weight="fill" /> AI day planner
        </span>
        <h2>Plan my day</h2>
        <p className="lede">
          Say what kind of day you want. It picks real events, orders them so
          you can make each one, and maps the route.
        </p>
      </div>

      <form
        className="planner-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(prompt);
        }}
      >
        <div className="search-shell planner-input">
          <input
            className="search-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Saturday in Bandra, under ₹1000, music and food"
            aria-label="Describe your day"
            maxLength={400}
          />
          {canListen && (
            <button
              type="button"
              className={`map-tool planner-mic${listening ? " is-live" : ""}`}
              onClick={toggleMic}
              aria-label={listening ? "Stop listening" : "Speak your plan"}
              aria-pressed={listening}
            >
              <Microphone size={17} weight={listening ? "fill" : "bold"} />
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Planning…" : "Plan it"}
          </button>
        </div>
        <div className="prompt-row">
          {EXAMPLES.map((p) => (
            <button
              key={p}
              type="button"
              className="prompt"
              onClick={() => {
                setPrompt(p);
                run(p);
              }}
            >
              {p}
            </button>
          ))}
        </div>
        {listening && <p className="planner-hint">Listening… speak in English or Hinglish.</p>}
      </form>

      {loading && (
        <ol className="planner-steps" aria-live="polite">
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? "done" : i === step ? "active" : ""}>
              {i < step ? <Check size={14} weight="bold" /> : <span className="dot" />}
              {s}
            </li>
          ))}
        </ol>
      )}

      {error && !loading && (
        <p className="planner-error" role="alert">
          <WarningCircle size={18} weight="fill" /> {error}
        </p>
      )}

      {plan && !loading && (
        <div className="plan">
          <div className="plan-meta">
            <div>
              <h3>{plan.title}</h3>
              {plan.summary && <p>{plan.summary}</p>}
            </div>
            <div className="plan-facts">
              <span>{plan.stops.length} stop{plan.stops.length === 1 ? "" : "s"}</span>
              <span>{plan.totalCost === 0 ? "Free" : `From ${RUPEES.format(plan.totalCost)}`}</span>
              <span>{plan.considered} events checked</span>
              <span className={`plan-engine ${plan.engine.kind}`}>
                {plan.engine.kind === "ai" ? <Sparkle size={12} weight="fill" /> : null}
                {plan.engine.kind === "ai" ? plan.engine.label : "Rules planner"}
              </span>
            </div>
          </div>

          {plan.note && <p className="plan-note">{plan.note}</p>}
          {plan.isSample && (
            <p className="plan-note">Live data is unreachable right now, so this plan uses sample events.</p>
          )}

          {plan.stops.length > 0 && (
            <div className="plan-body">
              <ol className="plan-timeline">
                {plan.stops.map((s, i) => {
                  const e = s.event;
                  const hue = getCategoryColor(e.category);
                  return (
                    <li key={e.id} className="plan-stop">
                      {s.travel && (
                        <div className="plan-leg">
                          <Car size={14} weight="bold" />~{s.travel.minutes} min · {s.travel.km} km
                        </div>
                      )}
                      <div className="plan-card" style={{ ["--stop-hue" as string]: hue.color }}>
                        <span className="plan-num">{i + 1}</span>
                        <div className="plan-card-body">
                          <p className="plan-time">
                            {dayFmt.format(new Date(e.start_time))} · {timeFmt.format(new Date(e.start_time))}
                            {e.end_time && dayFmt.format(new Date(e.end_time)) === dayFmt.format(new Date(e.start_time))
                              ? `–${timeFmt.format(new Date(e.end_time))}`
                              : ""}
                          </p>
                          <Link href={`/events/${e.id}`} className="plan-title">
                            {e.title}
                          </Link>
                          <p className="plan-venue">
                            <MapPin size={13} weight="bold" />
                            {[e.location_name, e.city].filter(Boolean).join(", ") || "Venue on listing"}
                          </p>
                          <p className="plan-why">{s.why}</p>
                          <div className="plan-card-foot">
                            <span className="plan-price">{priceBadge(e)}</span>
                            <a
                              href={googleCalendarLink(s, origin)}
                              target="_blank"
                              rel="noreferrer"
                              className="plan-link"
                            >
                              Add to Google Calendar
                            </a>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <PlanMap stops={plan.stops} />
            </div>
          )}

          <div className="plan-actions">
            {plan.stops.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={downloadIcs}>
                <CalendarPlus size={17} weight="bold" /> Add all to calendar
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={share}>
              {copied ? <Check size={17} weight="bold" /> : <ShareNetwork size={17} weight="bold" />}
              {copied ? "Link copied" : "Share plan"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => run(prompt)}>
              <ArrowClockwise size={17} weight="bold" /> Plan again
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
