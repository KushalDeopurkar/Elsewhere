"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Sparkle,
  Microphone,
  CalendarPlus,
  ShareNetwork,
  WhatsappLogo,
  DownloadSimple,
  GoogleLogo,
  ArrowClockwise,
  MapPin,
  Car,
  Check,
  WarningCircle,
  BookmarkSimple,
  Trash,
  ArrowRight,
} from "@phosphor-icons/react/ssr";
import { PlanResult, planToIcs, googleCalendarLink } from "@/lib/plan";
import { whatsappUrl, planShareText } from "@/lib/share";
import { getCategoryColor } from "@/lib/categoryColors";
import { priceBadge } from "@/lib/money";
import { hasTime } from "@/lib/formatDate";
import AlertButton from "@/components/AlertButton";
import EventImage from "@/components/EventImage";
import { CATEGORIES, EventCategory } from "@/lib/types";
import { useSavedPlans, savePlan, deletePlan } from "@/lib/savedPlans";

const PlanMap = dynamic(() => import("@/components/PlanMap"), {
  ssr: false,
  loading: () => <div className="plan-map plan-map-loading" />,
});

const EXAMPLES = [
  "Saturday in Mumbai under ₹1000, music and food",
  "Free tech meetups in Bengaluru this weekend",
  "Kal shaam Andheri mein comedy aur khana",
];

const STARTS = [
  { value: "10 am", label: "Morning" },
  { value: "12 noon", label: "Noon" },
  { value: "3 pm", label: "Afternoon" },
  { value: "6 pm", label: "Evening" },
  { value: "8 pm", label: "Night" },
];
const DURATIONS = [2, 4, 6, 8];
const dayName = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "long" });

/** Today, tomorrow and the five days after, as the words the planner reads. */
function nextDays(now: number): { value: string; label: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const name = dayName.format(new Date(now + i * 86_400_000));
    return { value: i === 0 ? "today" : i === 1 ? "tomorrow" : name, label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : name };
  });
}

interface Details {
  day: string;
  start: string;
  hours: number;
  budget: string;
  people: number;
  interests: EventCategory[];
  close: boolean;
  notes: string;
}

/** The details form as one plain-language request, exactly what is sent. */
export function composeRequest(d: Details, city: string): string {
  const labels = d.interests.map((v) => CATEGORIES.find((c) => c.value === v)?.label.toLowerCase() ?? v);
  const parts = [
    `${d.day === "today" ? "Today" : d.day === "tomorrow" ? "Tomorrow" : d.day} in ${city}`,
    `starting around ${d.start} for about ${d.hours} hours`,
    d.budget ? `budget ₹${d.budget} total${d.people > 1 ? ` for ${d.people} people` : ""}` : d.people > 1 ? `for ${d.people} people` : "",
    labels.length ? `I'm into ${labels.join(", ")}` : "",
    d.close ? "keep the stops close together" : "happy to travel between stops",
    d.notes.trim(),
  ].filter(Boolean);
  return parts.join(". ").replace(/\.\./g, ".");
}

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

const noopSubscribe = () => () => {};

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
  const [days] = useState(() => nextDays(Date.now()));
  const [details, setDetails] = useState<Details>({
    day: "tomorrow",
    start: "3 pm",
    hours: 6,
    budget: "",
    people: 1,
    interests: [],
    close: true,
    notes: "",
  });
  const set = (patch: Partial<Details>) => setDetails((d) => ({ ...d, ...patch }));
  const composed = composeRequest(details, city);
  const [lastPrompt, setLastPrompt] = useState("");
  const savedPlans = useSavedPlans();
  const [justSaved, setJustSaved] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [calDone, setCalDone] = useState<string[]>([]);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const recog = useRef<Recognition | null>(null);
  const section = useRef<HTMLElement>(null);
  const heard = useRef("");

  // Speech support is a browser fact: false while server-rendering, real on
  // the client, without a hydration mismatch.
  const canListen = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(speechCtor()),
    () => false,
  );

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1100);
    return () => clearInterval(id);
  }, [loading]);

  const run = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (q.length < 3 || loading) return;
      setStep(0);
      setLoading(true);
      setError(null);
      setLastPrompt(q);
      setJustSaved(false);
      setCalOpen(false);
      setCalDone([]);
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

  // Shared links land here as /plan-my-day?plan=<request>.
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("plan");
    if (!shared) return;
    // Deferred a tick so the page has painted before the plan starts.
    const t = setTimeout(() => {
      setPrompt(shared);
      run(shared);
      section.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => clearTimeout(t);
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

  const planUrl = () => `${window.location.origin}/plan-my-day?plan=${encodeURIComponent((lastPrompt || prompt).trim())}`;
  const shareWhatsApp = () => {
    if (!plan) return;
    window.open(whatsappUrl(planShareText(plan, planUrl())), "_blank", "noopener,noreferrer");
  };

  const share = async () => {
    const url = planUrl();
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
    <section ref={section} id="plan" className="shell planner">
      <div className="planner-modes">
      <div className="planner-card">
        <p className="planner-card-title">In your own words</p>
        <p className="planner-card-sub">Type or speak it, in English or Hinglish.</p>
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
      </div>

      <form
        className="planner-card builder"
        onSubmit={(e) => {
          e.preventDefault();
          run(composed);
        }}
      >
        <p className="planner-card-title">Or pick the details</p>
        <fieldset className="bfield">
          <legend>Day</legend>
          <div className="fchips">
            {days.map((d) => (
              <button key={d.value} type="button" className="fchip" aria-pressed={details.day === d.value} onClick={() => set({ day: d.value })}>
                {d.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="brow">
          <fieldset className="bfield">
            <legend>Start</legend>
            <div className="fchips">
              {STARTS.map((s) => (
                <button key={s.value} type="button" className="fchip" aria-pressed={details.start === s.value} onClick={() => set({ start: s.value })}>
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="bfield">
            <legend>For</legend>
            <div className="fchips">
              {DURATIONS.map((h) => (
                <button key={h} type="button" className="fchip" aria-pressed={details.hours === h} onClick={() => set({ hours: h })}>
                  {h} hrs
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="brow">
          <label className="bfield">
            <span className="blabel">Budget (₹, total)</span>
            <input className="binput" inputMode="numeric" placeholder="e.g. 1500" value={details.budget}
              onChange={(e) => set({ budget: e.target.value.replace(/[^0-9]/g, "").slice(0, 6) })} />
          </label>
          <label className="bfield">
            <span className="blabel">People</span>
            <select className="binput" value={details.people} onChange={(e) => set({ people: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <fieldset className="bfield">
            <legend>Travel</legend>
            <div className="fchips">
              <button type="button" className="fchip" aria-pressed={details.close} onClick={() => set({ close: true })}>Stay close</button>
              <button type="button" className="fchip" aria-pressed={!details.close} onClick={() => set({ close: false })}>Happy to travel</button>
            </div>
          </fieldset>
        </div>
        <fieldset className="bfield">
          <legend>Interests</legend>
          <div className="fchips">
            {CATEGORIES.filter((c) => c.value !== "other").map((c) => {
              const on = details.interests.includes(c.value);
              return (
                <button key={c.value} type="button" className="fchip" aria-pressed={on}
                  onClick={() =>
                    setDetails((d) => ({
                      ...d,
                      interests: d.interests.includes(c.value) ? d.interests.filter((v) => v !== c.value) : [...d.interests, c.value],
                    }))
                  }>
                  {c.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="bfield">
          <span className="blabel">Anything else (optional)</span>
          <input className="binput" value={details.notes} maxLength={160} placeholder="e.g. vegetarian food, no late nights"
            onChange={(e) => set({ notes: e.target.value })} />
        </label>
        <p className="bpreview"><span>The planner will be asked:</span> “{composed}”</p>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          <Sparkle size={16} weight="fill" /> {loading ? "Planning…" : "Build my plan"}
        </button>
      </form>
      </div>

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
                        <div className="plan-thumb">
                          <EventImage src={e.image_url} category={e.category} ratio="1 / 1" />
                        </div>
                        <div className="plan-card-body">
                          <p className="plan-time">
                            {dayFmt.format(new Date(e.start_time))} ·{" "}
                            {hasTime(e.start_time) ? timeFmt.format(new Date(e.start_time)) : "time on listing"}
                            {hasTime(e.start_time) && e.end_time && dayFmt.format(new Date(e.end_time)) === dayFmt.format(new Date(e.start_time))
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
                            <Link href={`/events/${e.id}`} className="plan-view">
                              View event <ArrowRight size={12} weight="bold" />
                            </Link>
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
              <button
                type="button"
                className="btn btn-primary"
                aria-expanded={calOpen}
                aria-controls="plan-calendar"
                onClick={() => setCalOpen((o) => !o)}
              >
                <CalendarPlus size={17} weight="bold" /> Add day to calendar
              </button>
            )}
            {plan.stops.length > 0 && (
              <button type="button" className="btn btn-ghost btn-wa" onClick={shareWhatsApp}>
                <WhatsappLogo size={17} weight="fill" /> WhatsApp
              </button>
            )}
            {plan.stops.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={justSaved}
                onClick={() => {
                  savePlan(lastPrompt || prompt, plan);
                  setJustSaved(true);
                }}
              >
                {justSaved ? <Check size={17} weight="bold" /> : <BookmarkSimple size={17} weight="bold" />}
                {justSaved ? "Plan saved" : "Save plan"}
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={share}>
              {copied ? <Check size={17} weight="bold" /> : <ShareNetwork size={17} weight="bold" />}
              {copied ? "Link copied" : "Share plan"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => run(lastPrompt || prompt)}>
              <ArrowClockwise size={17} weight="bold" /> Plan again
            </button>
            <AlertButton query={lastPrompt || prompt} city={city} />
          </div>
          {calOpen && plan.stops.length > 0 && (
            <div className="plan-cal" id="plan-calendar">
              <div className="plan-cal-all">
                <div>
                  <p className="plan-cal-title">All {plan.stops.length} stops at once</p>
                  <p className="plan-cal-sub">One file with every stop. Opens in Apple Calendar or Outlook; on Google Calendar use Settings, Import.</p>
                </div>
                <button type="button" className="btn btn-primary" onClick={downloadIcs}>
                  <DownloadSimple size={16} weight="bold" /> Download .ics
                </button>
              </div>
              <p className="plan-cal-title">Or add each stop to Google Calendar</p>
              <ol className="plan-cal-list">
                {plan.stops.map((st, i) => (
                  <li key={st.event.id}>
                    <span className="plan-cal-num">{i + 1}</span>
                    <span className="plan-cal-name">{st.event.title}</span>
                    <a
                      href={googleCalendarLink(st, origin)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`btn btn-ghost plan-cal-add${calDone.includes(st.event.id) ? " is-done" : ""}`}
                      onClick={() => setCalDone((d) => (d.includes(st.event.id) ? d : [...d, st.event.id]))}
                    >
                      {calDone.includes(st.event.id) ? <Check size={14} weight="bold" /> : <GoogleLogo size={14} weight="bold" />}
                      {calDone.includes(st.event.id) ? "Added" : "Add"}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
      {savedPlans.length > 0 && !loading && (
        <div className="saved-plans">
          <p className="planner-card-title">Your saved plans</p>
          <ul>
            {savedPlans.map((sp) => (
              <li key={sp.id}>
                <button type="button" className="saved-plan-open" onClick={() => { setPlan(sp.plan); setLastPrompt(sp.prompt); setJustSaved(true); }}>
                  <span className="saved-plan-title">{sp.plan.title}</span>
                  <span className="saved-plan-sub">{sp.plan.stops.length} stops · “{sp.prompt.slice(0, 70)}{sp.prompt.length > 70 ? "…" : ""}”</span>
                </button>
                <button type="button" className="icon-btn" aria-label={`Delete ${sp.plan.title}`} onClick={() => deletePlan(sp.id)}>
                  <Trash size={15} weight="bold" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
