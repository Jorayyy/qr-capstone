"use client";

import { useState, type ReactNode } from "react";
import { CardHeader, Select } from "@/components/ui";

export function VisitHistory({
  items,
}: {
  items: Array<{ id: string; label: string; content: ReactNode }>;
}) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  if (!selected) return null;

  return (
    <>
      <CardHeader
        title="Visit History"
        subtitle={`${items.length} visit(s)`}
        action={
          items.length > 1 ? (
            <Select
              aria-label="Select visit"
              value={selected.id}
              onChange={(event) => setSelectedId(event.target.value)}
              className="h-9 min-h-9 w-36 shrink-0 py-1.5 text-xs sm:w-52"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />
      {selected.content}
    </>
  );
}
