"use client";

import { useEffect, useState } from "react";
import { Medal, Stamp } from "@phosphor-icons/react/ssr";
import TransitionLink from "./TransitionLink";
import { onPassportNews, type PassportNews } from "@/lib/passport";
import { sfx } from "@/lib/sound";

/** Small toast when a stamp or badge is earned. Links to the passport. */
export default function PassportToast() {
  const [items, setItems] = useState<PassportNews[]>([]);
  useEffect(
    () =>
      onPassportNews((n) => {
        sfx("stamp");
        setItems((list) => [...list, n].slice(-2));
        window.setTimeout(() => setItems((list) => list.filter((x) => x.id !== n.id)), 3600);
      }),
    [],
  );
  return (
    <div className="ptoast-wrap" aria-live="polite" role="status">
      {items.map((n) => (
        <TransitionLink key={n.id} href="/passport" className={`ptoast is-${n.kind}`}>
          <span className="ptoast-icon" aria-hidden="true">
            {n.kind === "badge" ? <Medal size={20} weight="fill" /> : <Stamp size={20} weight="fill" />}
          </span>
          <span>
            <strong>{n.title}</strong>
            <small>{n.body}</small>
          </span>
        </TransitionLink>
      ))}
    </div>
  );
}
