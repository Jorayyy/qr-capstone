import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Inbox } from "lucide-react";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "success";
export function buttonClass(variant: ButtonVariant = "primary", extra?: string): string {
  const base =
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]",
    secondary:
      "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]",
    danger: "bg-[var(--danger)] text-white hover:bg-[var(--danger-strong)]",
    success: "bg-[var(--success)] text-white hover:bg-[var(--success-strong)]",
    ghost: "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
  };
  return cx(base, variants[variant], extra);
}

export function Button({ variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

type PillTone = "brand" | "amber" | "emerald" | "red";

/** Square icon-only action: tinted face that fills with colour on hover. */
export function iconActionClass(tone: PillTone = "brand", extra?: string): string {
  const tones: Record<PillTone, string> = {
    brand: "bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white",
    amber: "bg-[var(--warning-soft)] text-[var(--warning)] hover:bg-[var(--warning)] hover:text-white",
    emerald: "bg-[var(--success-soft)] text-[var(--success)] hover:bg-[var(--success)] hover:text-white",
    red: "bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white",
  };
  return cx(
    "inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-40",
    tones[tone],
    extra
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx("field", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx("field", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx("field", props.className)} />;
}

const badgeTones = {
  gray: "bg-[var(--surface-muted)] text-[var(--muted)]",
  green: "bg-[var(--success-soft)] text-[var(--success)]",
  red: "bg-[var(--danger-soft)] text-[var(--danger)]",
  amber: "bg-[var(--warning-soft)] text-[var(--warning)]",
  brand: "bg-[var(--brand-soft)] text-[var(--brand)]",
  violet: "bg-[var(--info-soft)] text-[var(--info)]",
} as const;

export function Badge({ tone = "gray", children }: { tone?: keyof typeof badgeTones; children: React.ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-black/5",
        badgeTones[tone]
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--brand)]">
        <Inbox className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  leading,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        {leading}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-[var(--muted)]">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Monochrome initials badge — stays on-brand instead of a rainbow of hues. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-[var(--brand-soft)] text-[11px] font-semibold uppercase tracking-wide text-[var(--brand)] ring-1 ring-black/5",
        className
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/** One segment of a metric strip. Siblings render their own dividers. */
export function Metric({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: number | string;
  delta?: number | null;
  hint?: string;
}) {
  const up = typeof delta === "number" && delta > 0;
  const down = typeof delta === "number" && delta < 0;
  return (
    <div className="min-w-0 flex-1 px-5 py-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <p className="text-3xl font-semibold tabular-nums leading-none tracking-tight text-[var(--foreground)]">
          {value}
        </p>
        {typeof delta === "number" && delta !== 0 && (
          <span
            className={cx(
              "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
              up ? "bg-[var(--success-soft)] text-[var(--success)]" : down ? "bg-[var(--danger-soft)] text-[var(--danger)]" : "bg-[var(--surface-muted)] text-[var(--muted)]"
            )}
          >
            {up ? "↑" : down ? "↓" : ""} {Math.abs(delta)}%
          </span>
        )}
      </div>
      {hint ? <p className="mt-1 truncate text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}
