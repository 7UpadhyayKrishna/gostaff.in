"use client";
import { useEffect, useState } from "react";

export function DemoCountdown() {
  const [end, setEnd] = useState(0);
  const [label, setLabel] = useState("2h 30m");

  useEffect(() => {
    setEnd(Date.now() + 2.5 * 60 * 60 * 1000);
  }, []);

  useEffect(() => {
    if (!end) return;
    const timer = setInterval(() => {
      const diff = Math.max(0, end - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(`${h}h ${m}m`);
    }, 1000);
    return () => clearInterval(timer);
  }, [end]);

  return <span className="rounded bg-amber-100 px-2 py-1 text-xs">Demo resets in {label}</span>;
}
