/**
 * Visitor-facing reference content for the public entry page.
 *
 * Contact details are from evsu.edu.ph (main campus). Office hours are still
 * PLACEHOLDERS — confirm them with the university before going live.
 */
export const SITE = {
  university: "Eastern Visayas State University",
  shortName: "EVSU",
  motto: "Knowledge · Service · Excellence",
  address: "Archbishop Lino R. Gonzaga Avenue, Tacloban City, Philippines 6500",
  contactPhone: "+63 53 888 2565",
  contactEmail: "info@evsu.edu.ph",
  // TODO: replace with the EVSU Data Protection Officer's official address.
  dpoEmail: "info@evsu.edu.ph",
  campusMap: "/campus-map.jpg",
  officeHours: [
    { days: "Monday – Friday", hours: "7:00 AM – 6:00 PM" },
    { days: "Saturday", hours: "8:00 AM – 12:00 NN" },
    { days: "Sunday & holidays", hours: "Closed" },
  ],
} as const;

export const ABOUT =
  "Eastern Visayas State University (EVSU) is a leading public university in the region, offering quality education and extension services. With a strong commitment to service and excellence, EVSU continues to empower students and communities for a better future.";

export const QUICK_LINKS = [
  { label: "University Website", href: "https://evsu.edu.ph" },
  { label: "Campus Map", href: "#map" },
  { label: "Visitor Guidelines", href: "#guidelines" },
  { label: "Privacy Notice", href: "/privacy" },
  { label: "Contact Us", href: "#contact" },
] as const;

export const ENTRY_STEPS = [
  {
    title: "Pre-register online",
    body: "Scan your ID, choose the offices you need, and set the dates you are visiting. No account needed.",
  },
  {
    title: "Receive your QR pass",
    body: "We email a visitor pass with a scannable QR code and a reference number. You can also open or print it from this site.",
  },
  {
    title: "Present it at the gate",
    body: "Show the pass together with the same physical ID you registered. The guard scans you in.",
  },
  {
    title: "Visit each office",
    body: "Every office on your pass records its own entry, so you only register once for the whole trip.",
  },
  {
    title: "Check out on the way out",
    body: "Scan the pass again at the exit, or use self check-in with your pass code, so the system records that you left.",
  },
] as const;

export const ENTRY_REQUIREMENTS = [
  "A valid ID — National ID, passport, driver's license, UMID, PRC, student ID, or company ID (front side photo)",
  "The name of the person or office you are visiting",
  "The purpose of your visit",
  "An email address to receive your QR pass",
] as const;

export const PRIVACY_VERSION = "1.0";
export const PRIVACY_EFFECTIVE = "27 October 2026";

export const PRIVACY_NOTICE =
  "EVSU collects your name, contact details, ID type and number, ID and selfie photos, and visit details to register your visit, keep the campus safe, and keep entry records. We do not sell your data. Records are kept for one (1) year after your visit unless the law requires longer. You may access, correct, or erase your data, or complain to the National Privacy Commission.";

export const PRIVACY_SECTIONS = [
  {
    title: "Who is responsible",
    body: `Eastern Visayas State University (EVSU), ${SITE.address}, is the personal information controller. The university Data Protection Officer can be reached at ${SITE.dpoEmail} or ${SITE.contactPhone}.`,
  },
  {
    title: "What we collect",
    body: "Your name, date of birth, contact details, affiliation, ID type and number, a photo of your ID, an optional photo of you, vehicle details, the offices and person you are visiting, visit dates and times, and pass scan and audit logs.",
  },
  {
    title: "Why and our legal basis",
    body: "We use your data to register and identify visitors, issue and verify QR passes, record entry and exit, keep the campus safe, and maintain audit records. We rely on your consent, the university's legitimate interest in campus security, and legal obligations under applicable laws and CHED policies.",
  },
  {
    title: "Who can see it",
    body: "Guards, the offices you visit, and authorized university administrators. Our hosting, database, and email providers process data only on our instructions and under contract. We do not sell or rent personal data, and disclose it to authorities only when required by law.",
  },
  {
    title: "How long we keep it",
    body: "Visitor records, including ID and selfie photos, are kept for one (1) year after your last visit, then securely deleted. Audit logs are kept for one (1) year. We keep data longer only for legal claims, investigations, or when the law requires it.",
  },
  {
    title: "Your rights",
    body: "Under the Data Privacy Act of 2012 (RA 10173) you may be informed, object, access, correct, erase or block, request portability, claim damages, and complain to the National Privacy Commission. Email the DPO with your reference code and we will act within the period required by the NPC.",
  },
  {
    title: "Security",
    body: "We use access controls, encrypted connections, and audit logs, and limit access to staff who need it. If a breach affects you, we will notify you and the NPC when required.",
  },
  {
    title: "Minors and changes",
    body: "Visitors below 18 must be registered or accompanied by a parent or guardian. We may update this notice; the latest version and effective date are always on this page.",
  },
] as const;
