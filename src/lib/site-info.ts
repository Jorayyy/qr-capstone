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

export const PRIVACY_NOTICE =
  "We record your name, contact details, ID type and number, a photo of you and your ID, and visit details to manage entry and keep the campus safe. We use this information only for visitor management and keep it according to the university's records policy. For questions or requests about your data, please contact the Front Desk.";
