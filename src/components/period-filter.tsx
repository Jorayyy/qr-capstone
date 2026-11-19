"use client";

import { usePathname, useRouter } from "next/navigation";
import { Select } from "@/components/ui";

export function PeriodFilter<T extends string>({
  value,
  options,
  label = "Period",
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(e) => router.push(`${pathname}?period=${e.target.value}`)}
      className="w-36"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
