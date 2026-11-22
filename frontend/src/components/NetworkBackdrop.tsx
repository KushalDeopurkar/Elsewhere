/**
 * The page's background: a schematic transit map, the site's idea drawn
 * behind it. Lines run at 0°, 45° and 90° like a real line map, in the
 * category colours, with stations at their turns. It frames the edges of
 * the page and fades out behind the content (see .netbg in core.css), so
 * text always sits on plain background.
 *
 * Drawn once from a fixed seed: the same on the server and in the browser,
 * no layout cost. Trains run along each line and a station on each line
 * pings now and then.
 *
 * Every moving part animates transform and opacity only, so the GPU runs
 * them without the page repainting: the still map is painted once, and a
 * train is a small capsule translated along its line by keyframes made from
 * the line's own corners. (They used to animate an SVG stroke-dashoffset,
 * which repainted the whole viewport-sized layer every frame, on every page.)
 * Pure CSS, off for reduced motion.
 */

import BackdropStage from "./BackdropStage";

const W = 1600;
const H = 1000;
const STEP = 40;
/** Category hues (lib/categoryColors.ts), lightness and strength from the theme. */
const HUES = [30, 85, 150, 235, 300, 350, 62, 196];

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Eight directions, 45° apart.
const DIRS: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

interface Line {
  hue: number;
  points: [number, number][];
}

function network(): Line[] {
  const r = rng(20261120);
  const starts: [number, number, number][] = [
    // x, y, starting direction: half the lines enter from the left, half from the right.
    [0, 160, 0], [0, 400, 7], [0, 640, 0], [0, 880, 7],
    [W, 120, 4], [W, 360, 3], [W, 600, 4], [W, 840, 5],
  ];
  return starts.map(([x0, y0, d0], i) => {
    const pts: [number, number][] = [[x0, y0]];
    let x = x0;
    let y = y0;
    let d = d0;
    for (let seg = 0; seg < 9; seg++) {
      const len = STEP * (3 + Math.floor(r() * 5));
      let [dx, dy] = DIRS[d];
      let nx = x + dx * len;
      let ny = y + dy * len;
      // Stay on the canvas: turn back towards the middle rather than leave.
      if (ny < 60 || ny > H - 60) {
        d = dy < 0 ? (d0 === 4 ? 4 : 0) : d0 === 4 ? 4 : 0;
        [dx, dy] = DIRS[d];
        nx = x + dx * len;
        ny = y;
      }
      nx = Math.max(-40, Math.min(W + 40, nx));
      x = nx;
      y = ny;
      pts.push([x, y]);
      if (x <= -40 || x >= W + 40) break;
      // Turn by 45° one way or the other, never back on itself.
      const turn = r() < 0.5 ? 1 : 7;
      const horizontal = d0 === 4 ? 4 : 0;
      d = d === horizontal ? (horizontal + turn) % 8 : horizontal;
    }
    return { hue: HUES[i % HUES.length], points: pts };
  });
}

const LINES = network();

/** Per line: seconds for one trip, a head start, and which way it runs. */
const TRAINS = LINES.map((_, i) => {
  const r = rng(7 + i * 131);
  return { dur: 26 + Math.round(r() * 22), delay: -Math.round(r() * 40), reverse: i % 3 === 1 };
});

/** A point on the stage, in map units: the stage is a 1600x1000px box, scaled to cover the viewport. */
const at = (x: number, y: number) => `${x}px, ${y}px`;

/** Half the capsule's length (72px, see .netbg-train): how far ahead of a corner it starts to turn. */
const EASE_IN = 36;

/**
 * One @keyframes per train, placed by distance along the line so the speed
 * is even. Straight runs need only their two ends: linear interpolation
 * between them is exact. At each corner the capsule turns while it keeps
 * moving: it starts turning half a length before the corner, is halfway
 * round on it, and is straight on the next segment half a length after, so
 * it never stops, never pivots off the line, and always takes the short
 * way round (a capsule looks the same both ways, so no turn is over 90°).
 */
const KEYFRAMES = LINES.map((l, i) => {
  const pts = l.points;
  const lens = pts.slice(1).map((p, j) => Math.hypot(p[0] - pts[j][0], p[1] - pts[j][1]));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const raw = lens.map((_, j) => (Math.atan2(pts[j + 1][1] - pts[j][1], pts[j + 1][0] - pts[j][0]) * 180) / Math.PI);
  // Unwrap: each segment's angle within ±90° of the one before.
  const ang: number[] = [];
  raw.forEach((r, j) => {
    if (j === 0) return ang.push(r);
    let d = r - ang[j - 1];
    d = ((((d + 90) % 180) + 180) % 180) - 90;
    ang.push(ang[j - 1] + d);
  });
  // A point `dist` along the line, and the stop for it.
  const along = (dist: number): [number, number] => {
    let left = Math.max(0, Math.min(total, dist));
    for (let j = 0; j < lens.length; j++) {
      if (left <= lens[j] || j === lens.length - 1) {
        const t = lens[j] ? left / lens[j] : 0;
        return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t];
      }
      left -= lens[j];
    }
    return pts[pts.length - 1];
  };
  const stops: { d: number; a: number }[] = [{ d: 0, a: ang[0] }];
  let run = 0;
  for (let j = 0; j < lens.length - 1; j++) {
    run += lens[j];
    const e = Math.min(EASE_IN, lens[j] / 2, lens[j + 1] / 2);
    stops.push({ d: run - e, a: ang[j] }, { d: run, a: (ang[j] + ang[j + 1]) / 2 }, { d: run + e, a: ang[j + 1] });
  }
  stops.push({ d: total, a: ang[ang.length - 1] });
  const frames = stops.map(({ d, a }) => {
    const [x, y] = along(d);
    return `${((d / total) * 100).toFixed(3)}% { transform: translate(${at(x, y)}) rotate(${a.toFixed(1)}deg) translate(-36px, -3.5px) }`;
  });
  return `@keyframes netbg-run-${i} { ${frames.join(" ")} }`;
}).join("\n");

/** One station per line that pings now and then. */
const PINGS = LINES.flatMap((l, i) => {
  const p = l.points[1 + (i % Math.max(1, l.points.length - 2))];
  return p ? [{ x: p[0], y: p[1], hue: l.hue }] : [];
});

export default function NetworkBackdrop() {
  const STATIONS = (
    <>
      {LINES.flatMap((l, i) =>
          l.points.slice(1, -1).map((p, j) => (
            <circle
              key={`${i}-${j}`}
              cx={p[0]}
              cy={p[1]}
              r={7}
              strokeWidth={4}
              style={{ fill: "var(--bg)", stroke: `oklch(var(--cat-l) var(--cat-c) ${l.hue})` }}
            />
          )),
        )}
    </>
  );
  return (
    <>
    <div className="netbg" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" focusable="false">
        <g className="netbg-static">
        {LINES.map((l, i) => (
          <polyline
            key={i}
            points={l.points.map((p) => p.join(",")).join(" ")}
            fill="none"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ stroke: `oklch(var(--cat-l) var(--cat-c) ${l.hue})` }}
          />
        ))}
        {STATIONS}
        </g>
      </svg>
    </div>
    {/* Moving parts in their own layer: they may show a little more behind
        the content than the still map does, so the motion reads. */}
    <div className="netbg is-moving" aria-hidden="true">
      <style>{KEYFRAMES}</style>
      <BackdropStage>
        {LINES.map((l, i) => {
          const t = TRAINS[i];
          return (
            <span
              key={i}
              className="netbg-train"
              style={{
                "--hue": l.hue,
                animationName: `netbg-run-${i}`,
                animationDuration: `${t.dur}s`,
                animationDelay: `${t.delay}s`,
                animationDirection: t.reverse ? "reverse" : "normal",
              } as React.CSSProperties}
            />
          );
        })}
        {PINGS.map((p, i) => (
          // Placed by the outer span, pulsed by the inner: the keyframes stay
          // plain numbers, which the compositor can run on its own.
          <span key={`ping-${i}`} className="netbg-ping-at" style={{ transform: `translate(${p.x}px, ${p.y}px)` }}>
            <span className="netbg-ping" style={{ "--hue": p.hue, animationDelay: `${-i * 1.7}s` } as React.CSSProperties} />
          </span>
        ))}
      </BackdropStage>
    </div>
    </>
  );
}
