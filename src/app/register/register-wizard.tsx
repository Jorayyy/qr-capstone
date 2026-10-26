"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Car,
  Check,
  CheckCircle2,
  ClipboardCheck,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button, Input, Select, cx } from "@/components/ui";
import PhotoCapture from "@/components/photo-capture";
import IdScan from "./id-scan";
import { registerPublicAction, type PublicRegistrationState } from "@/lib/actions/public-registration";
import { todayIso } from "@/lib/registration";
import type { OcrResult } from "@/lib/registration";

type Department = { id: string; name: string; building: string | null };

type OfficeChoice = {
  departmentId: string;
  purpose: string;
  hostName: string;
  hostPreference: "SPECIFIC" | "ANY";
};

const ID_TYPES = [
  { value: "NATIONAL_ID", label: "National ID (PhilSys)" },
  { value: "PASSPORT", label: "Passport" },
  { value: "DRIVERS_LICENSE", label: "Driver's License" },
  { value: "UMID", label: "UMID" },
  { value: "PRC", label: "PRC ID" },
  { value: "POSTAL_ID", label: "Postal ID" },
  { value: "STUDENT_ID", label: "Student ID" },
  { value: "SSS", label: "SSS ID" },
  { value: "TIN", label: "TIN ID" },
  { value: "COMPANY_ID", label: "Company ID" },
  { value: "OTHER", label: "Other" },
] as const;

const AFFILIATIONS = [
  { value: "VISITOR", label: "Visitor" },
  { value: "STUDENT", label: "Student" },
  { value: "FACULTY", label: "Faculty" },
  { value: "STAFF", label: "EVSU Staff" },
  { value: "ALUMNI", label: "Alumni" },
  { value: "PARENT", label: "Parent / Guardian" },
  { value: "SUPPLIER", label: "Supplier" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "OTHER", label: "Other" },
] as const;

const PURPOSES = [
  { value: "MEETING", label: "Meeting" },
  { value: "ATTENDANCE", label: "Attendance" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "SCHOOL_VISIT", label: "School visit" },
  { value: "OTHER", label: "Other" },
] as const;

const STEPS = [
  { key: "method", label: "Method" },
  { key: "id", label: "Upload ID" },
  { key: "details", label: "Personal info" },
  { key: "offices", label: "Offices & purpose" },
  { key: "vehicle", label: "Vehicle" },
  { key: "schedule", label: "Schedule" },
  { key: "review", label: "Review" },
] as const;

const STEP_ICONS = [ClipboardCheck, IdCard, User, Building2, Car, MapPin, ShieldCheck];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00+08:00`));
}

export default function RegisterWizard({ departments }: { departments: Department[] }) {
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<"PRE_REGISTERED" | "WALK_IN">("PRE_REGISTERED");
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    email: "",
    phone: "",
    idType: "NATIONAL_ID",
    idNumber: "",
    affiliation: "VISITOR",
    visitType: "ONE_DAY" as "ONE_DAY" | "MULTIPLE",
    validFrom: todayIso(),
    validUntil: "",
    vehicleType: "",
    vehicleModel: "",
    vehicleColor: "",
    vehiclePlateNumber: "",
  });
  const [hasVehicle, setHasVehicle] = useState(false);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [idPhotoPath, setIdPhotoPath] = useState<string | null>(null);
  const [offices, setOffices] = useState<Record<string, OfficeChoice>>({});
  const [search, setSearch] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PublicRegistrationState["data"] | null>(null);

  const officeList = useMemo(() => Object.values(offices), [offices]);
  const selectedIds = useMemo(() => new Set(officeList.map((office) => office.departmentId)), [officeList]);
  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return departments;
    return departments.filter(
      (department) =>
        department.name.toLowerCase().includes(query) ||
        (department.building ?? "").toLowerCase().includes(query)
    );
  }, [departments, search]);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyOcr(fields: OcrResult) {
    setForm((current) => ({
      ...current,
      firstName: fields.firstName || current.firstName,
      middleName: fields.middleName || current.middleName,
      lastName: fields.lastName || current.lastName,
      dateOfBirth: fields.dateOfBirth || current.dateOfBirth,
      idNumber: fields.idNumber || current.idNumber,
    }));
  }

  function toggleDepartment(department: Department) {
    setOffices((current) => {
      if (current[department.id]) {
        const next = { ...current };
        delete next[department.id];
        return next;
      }
      return {
        ...current,
        [department.id]: {
          departmentId: department.id,
          purpose: "MEETING",
          hostName: "",
          hostPreference: "ANY",
        },
      };
    });
  }

  function updateOffice(id: string, patch: Partial<OfficeChoice>) {
    setOffices((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  function validateStep(index: number): string {
    if (index === 1) {
      if (!idPhotoPath) return "Upload or scan the front of your ID to continue.";
    }
    if (index === 2) {
      if (!form.firstName.trim() || !form.lastName.trim()) return "Enter your first and last name.";
      if (!EMAIL.test(form.email.trim())) return "Enter a valid email address — the pass is emailed there.";
      if (form.phone.trim().length < 7) return "Enter a contact number.";
      if (!form.idType) return "Choose the ID you presented.";
    }
    if (index === 3) {
      if (officeList.length === 0) return "Choose at least one office to visit.";
      const missingHost = officeList.find(
        (office) => office.hostPreference === "SPECIFIC" && !office.hostName.trim()
      );
      if (missingHost) return "Enter the name of the person you are visiting, or choose “Any available staff”.";
    }
    if (index === 5) {
      if (!form.validFrom) return "Choose the first day of your visit.";
      if (form.visitType === "MULTIPLE") {
        if (!form.validUntil) return "Choose the last day your pass should work.";
        if (form.validUntil < form.validFrom) return "The end date must be on or after the start date.";
      }
    }
    return "";
  }

  function next() {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit() {
    if (!agree) {
      setError("Please confirm that the details are correct.");
      return;
    }
    const message = validateStep(5);
    if (message) {
      setError(message);
      return;
    }
    setError("");

    const payload = {
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || undefined,
      lastName: form.lastName.trim(),
      dateOfBirth: form.dateOfBirth || undefined,
      email: form.email.trim(),
      phone: form.phone.trim(),
      idType: form.idType,
      idNumber: form.idNumber.trim() || undefined,
      affiliation: form.affiliation,
      photoUrl: photoPath || undefined,
      idPhotoUrl: idPhotoPath || undefined,
      offices: officeList.map((office) => ({
        departmentId: office.departmentId,
        purpose: office.purpose,
        hostName: office.hostName.trim() || undefined,
        hostPreference: office.hostPreference,
      })),
      vehicleType: hasVehicle ? form.vehicleType.trim() || undefined : undefined,
      vehicleModel: hasVehicle ? form.vehicleModel.trim() || undefined : undefined,
      vehicleColor: hasVehicle ? form.vehicleColor.trim() || undefined : undefined,
      vehiclePlateNumber: hasVehicle ? form.vehiclePlateNumber.trim() || undefined : undefined,
      visitType: form.visitType,
      validFrom: form.validFrom,
      validUntil: form.visitType === "MULTIPLE" ? form.validUntil : undefined,
      agree: "on",
    };

    startTransition(async () => {
      const response = await registerPublicAction(payload);
      if (response.success && response.data) {
        setResult(response.data);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(response.message);
      }
    });
  }

  function reset() {
    setResult(null);
    setStep(0);
    setMethod("PRE_REGISTERED");
    setForm({
      firstName: "",
      middleName: "",
      lastName: "",
      dateOfBirth: "",
      email: "",
      phone: "",
      idType: "NATIONAL_ID",
      idNumber: "",
      affiliation: "VISITOR",
      visitType: "ONE_DAY",
      validFrom: todayIso(),
      validUntil: "",
      vehicleType: "",
      vehicleModel: "",
      vehicleColor: "",
      vehiclePlateNumber: "",
    });
    setHasVehicle(false);
    setPhotoPath(null);
    setIdPhotoPath(null);
    setOffices({});
    setAgree(false);
    setError("");
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-[var(--brand)]">Pre-Registration Submitted!</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Your information has been recorded. Your QR pass has been sent to your email.
          </p>

          <div className="mt-6 rounded-xl border border-[var(--accent)] bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800/70">Reference number</p>
            <p className="mt-1 font-mono text-xl font-bold text-[var(--brand)]">{result.referenceCode}</p>
          </div>

          <dl className="mt-6 grid gap-3 text-left text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--muted)]">Valid from</dt>
              <dd className="font-semibold">{new Date(result.validFrom).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" })}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Valid until</dt>
              <dd className="font-semibold">{new Date(result.validUntil).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" })}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-[var(--muted)]">Pass delivery</dt>
              <dd className={`font-semibold ${result.emailSent ? "text-emerald-700" : "text-amber-700"}`}>
                {result.emailSent
                  ? `Emailed to ${result.emailTo}. Check your inbox for the QR pass.`
                  : `We could not email ${result.emailTo}. Open or download the pass below.`}
              </dd>
            </div>
          </dl>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={result.passPath}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-strong)]"
            >
              <IdCard className="h-4 w-4" />
              View / Download Visitor Pass
            </Link>
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              Register another visitor
            </button>
          </div>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[var(--brand)] hover:underline">
            Back to homepage
          </Link>
        </div>
      </div>
    );
  }

  const StepIcon = STEP_ICONS[step];

  return (
    <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--brand)]/55">Visitor registration</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[var(--brand)] sm:text-4xl">
          Pre-register your visit
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          Register before you arrive, get your QR pass by email, and walk through the gate without
          filling out forms at the Front Desk.
        </p>

        <ol className="mt-7 space-y-1">
          {STEPS.map((item, index) => {
            const Icon = STEP_ICONS[index];
            const active = index === step;
            const done = index < step;
            return (
              <li key={item.key}>
                <div
                  className={cx(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                    active && "bg-[var(--brand)] text-white",
                    !active && "text-[var(--muted)]"
                  )}
                >
                  <span
                    className={cx(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      active && "bg-white/20 text-white",
                      done && "bg-emerald-100 text-emerald-700",
                      !active && !done && "bg-slate-100 text-slate-500"
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className={cx("font-semibold", active && "text-white")}>{item.label}</span>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-7 rounded-xl border border-[var(--border)] bg-white p-4 text-xs leading-relaxed text-[var(--muted)]">
          <p className="flex items-center gap-2 font-semibold text-[var(--brand)]">
            <ShieldCheck className="h-4 w-4" />
            Bring the same ID on the day
          </p>
          <p className="mt-1.5">
            The guard checks your QR pass against the physical ID you registered. Passes cannot be
            transferred.
          </p>
        </div>
      </aside>

      <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
              <StepIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Step {step + 1} of {STEPS.length}
              </p>
              <h2 className="font-display text-lg font-bold tracking-tight text-[var(--brand)]">{STEPS[step].label}</h2>
            </div>
          </div>
          <span className="hidden text-xs text-[var(--muted)] sm:block">
            {Math.round(((step + 1) / STEPS.length) * 100)}%
          </span>
        </div>

        <div className="space-y-5 p-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {step === 0 && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setMethod("PRE_REGISTERED")}
                className={cx(
                  "w-full rounded-xl border-2 p-4 text-left transition",
                  method === "PRE_REGISTERED"
                    ? "border-[var(--brand)] bg-[var(--brand-soft)]/40"
                    : "border-[var(--border)] hover:border-[var(--brand)]/40"
                )}
              >
                <span className="flex items-center gap-3">
                  <ClipboardCheck className="h-6 w-6 text-[var(--brand)]" />
                  <span>
                    <span className="block text-sm font-bold">Pre-Register (Optional)</span>
                    <span className="block text-xs text-[var(--muted)]">
                      Register in advance, get a QR pass, and use it within your chosen date range.
                    </span>
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMethod("WALK_IN")}
                className={cx(
                  "w-full rounded-xl border-2 p-4 text-left transition",
                  method === "WALK_IN"
                    ? "border-[var(--brand)] bg-[var(--brand-soft)]/40"
                    : "border-[var(--border)] hover:border-[var(--brand)]/40"
                )}
              >
                <span className="flex items-center gap-3">
                  <User className="h-6 w-6 text-[var(--brand)]" />
                  <span>
                    <span className="block text-sm font-bold">Walk-In Registration</span>
                    <span className="block text-xs text-[var(--muted)]">
                      Register when you arrive at the campus entrance — the guard will assist you.
                    </span>
                  </span>
                </span>
              </button>

              {method === "WALK_IN" && (
                <div className="rounded-lg border border-[var(--accent)] bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Walk-in visitors are registered at the Main Gate.</p>
                  <p className="mt-1 text-xs">
                    Bring a valid ID. Pre-registration is optional for everyone, but it saves time at
                    the gate.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => setMethod("PRE_REGISTERED")}>
                      Pre-register instead
                    </Button>
                    <Link
                      href="/#map"
                      className="inline-flex min-h-11 items-center rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900"
                    >
                      View campus map
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold">Upload or scan your ID *</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Front side required. We read it automatically and fill in your details. You can
                  correct everything on the next step.
                </p>
              </div>
              <IdScan onPath={setIdPhotoPath} onExtract={applyOcr} />
              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-sm font-bold">Your photo for the pass (optional)</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  A clear photo helps the guard match you to the pass. You can skip this.
                </p>
                <div className="mt-3">
                  <PhotoCapture
                    label="Visitor photo"
                    kind="face"
                    facing="user"
                    endpoint="/api/register/uploads"
                    onPath={setPhotoPath}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="firstName">First name *</label>
                  <Input id="firstName" value={form.firstName} onChange={(event) => setField("firstName", event.target.value)} autoComplete="given-name" />
                </div>
                <div>
                  <label className="label" htmlFor="middleName">Middle name</label>
                  <Input id="middleName" value={form.middleName} onChange={(event) => setField("middleName", event.target.value)} autoComplete="additional-name" />
                </div>
                <div>
                  <label className="label" htmlFor="lastName">Last name *</label>
                  <Input id="lastName" value={form.lastName} onChange={(event) => setField("lastName", event.target.value)} autoComplete="family-name" />
                </div>
                <div>
                  <label className="label" htmlFor="dateOfBirth">Date of birth</label>
                  <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={(event) => setField("dateOfBirth", event.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="phone">Contact number *</label>
                  <Input id="phone" type="tel" value={form.phone} onChange={(event) => setField("phone", event.target.value)} autoComplete="tel" placeholder="0917 123 4567" />
                </div>
                <div>
                  <label className="label" htmlFor="email">Email address *</label>
                  <Input id="email" type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} autoComplete="email" placeholder="name@email.com" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="idType">ID type *</label>
                  <Select id="idType" value={form.idType} onChange={(event) => setField("idType", event.target.value)}>
                    {ID_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="label" htmlFor="idNumber">ID number</label>
                  <Input id="idNumber" value={form.idNumber} onChange={(event) => setField("idNumber", event.target.value)} />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="affiliation">Affiliation *</label>
                <Select id="affiliation" value={form.affiliation} onChange={(event) => setField("affiliation", event.target.value)}>
                  {AFFILIATIONS.map((affiliation) => (
                    <option key={affiliation.value} value={affiliation.value}>{affiliation.label}</option>
                  ))}
                </Select>
              </div>

              <p className="flex items-center gap-2 rounded-lg bg-[var(--brand-soft)]/50 px-3 py-2 text-xs text-[var(--brand)]">
                <Mail className="h-4 w-4 shrink-0" />
                Your QR pass and confirmation will be sent to this email address.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold">Choose one or more offices</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Provide the person to visit and purpose for each office.
                </p>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <Input
                  className="pl-9"
                  placeholder="Search offices, departments, buildings…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search offices"
                />
              </div>

              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-1.5">
                {filteredDepartments.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-[var(--muted)]">No offices match that search.</p>
                ) : (
                  filteredDepartments.map((department) => {
                    const checked = selectedIds.has(department.id);
                    return (
                      <button
                        key={department.id}
                        type="button"
                        onClick={() => toggleDepartment(department)}
                        aria-pressed={checked}
                        className={cx(
                          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition",
                          checked ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "hover:bg-slate-50"
                        )}
                      >
                        <span
                          className={cx(
                            "flex h-4 w-4 items-center justify-center rounded border",
                            checked ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-slate-300"
                          )}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{department.name}</span>
                          {department.building && (
                            <span className="block truncate text-xs text-[var(--muted)]">{department.building}</span>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {officeList.length > 0 && (
                <div className="space-y-3">
                  {officeList.map((office) => {
                    const department = departments.find((item) => item.id === office.departmentId);
                    return (
                      <div key={office.departmentId} className="rounded-xl border border-[var(--border)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold">{department?.name ?? "Office"}</p>
                          <button
                            type="button"
                            onClick={() => toggleDepartment({ id: office.departmentId, name: "", building: null })}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-3 space-y-3">
                          <div>
                            <label className="label">Purpose of visit *</label>
                            <Select
                              value={office.purpose}
                              onChange={(event) => updateOffice(office.departmentId, { purpose: event.target.value })}
                            >
                              {PURPOSES.map((purpose) => (
                                <option key={purpose.value} value={purpose.value}>{purpose.label}</option>
                              ))}
                            </Select>
                          </div>

                          <div>
                            <span className="label">Who are you going to visit? *</span>
                            <div className="mt-1 flex flex-wrap gap-4 text-sm">
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`host-${office.departmentId}`}
                                  checked={office.hostPreference === "SPECIFIC"}
                                  onChange={() => updateOffice(office.departmentId, { hostPreference: "SPECIFIC" })}
                                />
                                A specific person
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`host-${office.departmentId}`}
                                  checked={office.hostPreference === "ANY"}
                                  onChange={() => updateOffice(office.departmentId, { hostPreference: "ANY" })}
                                />
                                Any available staff
                              </label>
                            </div>
                            {office.hostPreference === "SPECIFIC" && (
                              <Input
                                className="mt-2"
                                placeholder="Name of person to visit"
                                value={office.hostName}
                                onChange={(event) => updateOffice(office.departmentId, { hostName: event.target.value })}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold">Will you bring a vehicle?</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Vehicle details are optional and help the guard at the gate.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setHasVehicle(true)}
                  className={cx(
                    "flex-1 rounded-lg border-2 px-4 py-3 text-sm font-semibold",
                    hasVehicle ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--border)]"
                  )}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setHasVehicle(false)}
                  className={cx(
                    "flex-1 rounded-lg border-2 px-4 py-3 text-sm font-semibold",
                    !hasVehicle ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--border)]"
                  )}
                >
                  No
                </button>
              </div>

              {hasVehicle && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="vehicleType">Vehicle type</label>
                    <Select id="vehicleType" value={form.vehicleType} onChange={(event) => setField("vehicleType", event.target.value)}>
                      <option value="">Select type</option>
                      <option value="Car">Car</option>
                      <option value="Motorcycle">Motorcycle</option>
                      <option value="Van">Van</option>
                      <option value="Truck">Truck</option>
                      <option value="Tricycle">Tricycle</option>
                    </Select>
                  </div>
                  <div>
                    <label className="label" htmlFor="vehiclePlateNumber">Plate number</label>
                    <Input id="vehiclePlateNumber" value={form.vehiclePlateNumber} onChange={(event) => setField("vehiclePlateNumber", event.target.value)} placeholder="ABC 1234" />
                  </div>
                  <div>
                    <label className="label" htmlFor="vehicleModel">Vehicle model</label>
                    <Input id="vehicleModel" value={form.vehicleModel} onChange={(event) => setField("vehicleModel", event.target.value)} placeholder="Toyota Vios" />
                  </div>
                  <div>
                    <label className="label" htmlFor="vehicleColor">Vehicle color</label>
                    <Input id="vehicleColor" value={form.vehicleColor} onChange={(event) => setField("vehicleColor", event.target.value)} placeholder="White" />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="label">Visit type *</label>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {[
                    { value: "ONE_DAY" as const, label: "One-day visit" },
                    { value: "MULTIPLE" as const, label: "Multiple visits / recurring" },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={cx(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
                        form.visitType === option.value ? "border-[var(--brand)] bg-[var(--brand-soft)]/40" : "border-[var(--border)]"
                      )}
                    >
                      <input
                        type="radio"
                        name="visitType"
                        checked={form.visitType === option.value}
                        onChange={() => setField("visitType", option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="validFrom">Valid from *</label>
                  <Input
                    id="validFrom"
                    type="date"
                    min={todayIso()}
                    value={form.validFrom}
                    onChange={(event) => setField("validFrom", event.target.value)}
                  />
                </div>
                {form.visitType === "MULTIPLE" && (
                  <div>
                    <label className="label" htmlFor="validUntil">Valid until *</label>
                    <Input
                      id="validUntil"
                      type="date"
                      min={form.validFrom}
                      value={form.validUntil}
                      onChange={(event) => setField("validUntil", event.target.value)}
                    />
                  </div>
                )}
              </div>

              <ul className="space-y-2 rounded-lg bg-[var(--brand-soft)]/40 p-4 text-xs text-[var(--brand)]">
                <li>• Your QR pass can be used for multiple visits within the selected date range.</li>
                <li>• A new entry is recorded each time you visit.</li>
                <li>• The pass is non-transferable and must be used with the same physical ID.</li>
              </ul>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold">Review your information</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">Check every detail before submitting.</p>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Personal information</p>
                  <button type="button" onClick={() => setStep(2)} className="text-xs font-semibold text-[var(--brand)] hover:underline">Edit</button>
                </div>
                <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--muted)]">Full name</dt>
                    <dd className="font-semibold">{form.firstName} {form.middleName} {form.lastName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Date of birth</dt>
                    <dd className="font-semibold">{form.dateOfBirth ? formatDate(form.dateOfBirth) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Contact</dt>
                    <dd className="font-semibold">{form.phone}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Email</dt>
                    <dd className="break-all font-semibold">{form.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">ID</dt>
                    <dd className="font-semibold">
                      {ID_TYPES.find((type) => type.value === form.idType)?.label ?? form.idType}
                      {form.idNumber ? ` · ${form.idNumber}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Affiliation</dt>
                    <dd className="font-semibold">{AFFILIATIONS.find((item) => item.value === form.affiliation)?.label}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Offices to visit</p>
                  <button type="button" onClick={() => setStep(3)} className="text-xs font-semibold text-[var(--brand)] hover:underline">Edit</button>
                </div>
                <ul className="mt-2 space-y-2 text-sm">
                  {officeList.map((office) => {
                    const department = departments.find((item) => item.id === office.departmentId);
                    return (
                      <li key={office.departmentId} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-semibold">{department?.name}</span>
                        <span className="text-xs text-[var(--muted)]">
                          {PURPOSES.find((purpose) => purpose.value === office.purpose)?.label}
                          {office.hostPreference === "SPECIFIC" && office.hostName ? ` · ${office.hostName}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {hasVehicle && (
                <div className="rounded-xl border border-[var(--border)] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Vehicle</p>
                  <p className="mt-1 text-sm font-semibold">
                    {[form.vehicleColor, form.vehicleModel, form.vehicleType].filter(Boolean).join(" · ") || "Vehicle"}
                    {form.vehiclePlateNumber ? ` · ${form.vehiclePlateNumber}` : ""}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Visit schedule</p>
                  <button type="button" onClick={() => setStep(5)} className="text-xs font-semibold text-[var(--brand)] hover:underline">Edit</button>
                </div>
                <p className="mt-1 text-sm font-semibold">
                  {formatDate(form.validFrom)}
                  {form.visitType === "MULTIPLE" ? ` – ${formatDate(form.validUntil)}` : ""}
                  <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                    {form.visitType === "MULTIPLE" ? "Multiple visits" : "One-day visit"}
                  </span>
                </p>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
                <span>
                  I confirm that all information provided is true and correct, and I agree to the
                  university&apos;s visitor privacy notice.
                </span>
              </label>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={back}
              disabled={step === 0 || pending}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-[var(--muted)] hover:bg-slate-50 disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={next}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-strong)]"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-strong)] disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                {pending ? "Submitting…" : "Submit registration"}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
