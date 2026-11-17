"use client";

import { useState, type ReactNode } from "react";
import { Select } from "@/components/ui";

export function VisitHistory({
  items,
}: {
  items: Array<{ id: string; label: string; content: ReactNode }>;
}) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  if (!selected) return null;

  return (
    <div>
      <div className="border-b border-[var(--border)] px-5 py-4">
        <label htmlFor="visit-history-select" className="label">
          Showing visit
        </label>
        <Select
          id="visit-history-select"
          value={selected.id}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
      </div>
      {selected.content}
    </div>
  );
}
