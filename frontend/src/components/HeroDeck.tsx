"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { Event } from "@/lib/types";
import { formatWhen } from "@/lib/formatDate";

/**
 * Three real event cards fanned out behind the hero copy, drifting against
 * the pointer at different depths.
 *
 * The parallax communicates that these are browsable objects rather than a
 * flat illustration, which is the one thing the hero needs to say. Pointer
 * position is held in motion values so the drift never re-renders React.
 */

const LAYOUT = [
  { top: "2rem", left: "0.5rem", rotate: -8, depth: 14, z: 1, scale: 0.9 },
  { top: "5rem", left: "6.5rem", rotate: 2, depth: 26, z: 3, scale: 1 },
  { top: "0.5rem", left: "12.5rem", rotate: 8, depth: 20, z: 2, scale: 0.94 },
];

function DeckCard({
  event,
  index,
  px,
  py,
}: {
  event: Event;
  index: number;
  px: ReturnType<typeof useSpring>;
  py: ReturnType<typeof useSpring>;
}) {
  const cfg = LAYOUT[index];
  const x = useTransform(px, [-1, 1], [-cfg.depth, cfg.depth]);
  const y = useTransform(py, [-1, 1], [-cfg.depth * 0.6, cfg.depth * 0.6]);

  return (
    <motion.div
      className="hero-deck-card"
      style={{
        top: cfg.top,
        left: cfg.left,
        zIndex: cfg.z,
        rotate: cfg.rotate,
        scale: cfg.scale,
        x,
        y,
      }}
    >
      <Link href={`/events/${event.id}`} aria-label={event.title}>
        {event.image_url && (
          <img src={event.image_url} alt="" loading="eager" decoding="async" />
        )}
        <div className="hero-deck-meta">
          <p className="hero-deck-title">{event.title}</p>
          <p className="hero-deck-sub mono">{formatWhen(event.start_time)}</p>
        </div>
      </Link>
    </motion.div>
  );
}

export default function HeroDeck({ events }: { events: Event[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const px = useSpring(rawX, { stiffness: 90, damping: 22, mass: 0.6 });
  const py = useSpring(rawY, { stiffness: 90, damping: 22, mass: 0.6 });

  const picks = events.slice(0, 3);
  if (picks.length < 3) return null;

  return (
    <div
      ref={ref}
      className="hero-deck"
      aria-hidden={false}
      onPointerMove={
        reduce
          ? undefined
          : (e) => {
              const box = ref.current?.getBoundingClientRect();
              if (!box) return;
              rawX.set(((e.clientX - box.left) / box.width) * 2 - 1);
              rawY.set(((e.clientY - box.top) / box.height) * 2 - 1);
            }
      }
      onPointerLeave={() => {
        rawX.set(0);
        rawY.set(0);
      }}
    >
      {picks.map((event, i) => (
        <DeckCard key={event.id} event={event} index={i} px={px} py={py} />
      ))}
    </div>
  );
}
