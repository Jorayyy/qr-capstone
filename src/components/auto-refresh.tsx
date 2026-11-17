"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Keeps a server-rendered tracking view fresh without a manual reload. */
export function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, router]);

  return null;
}
