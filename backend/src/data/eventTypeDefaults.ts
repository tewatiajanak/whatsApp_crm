/**
 * Default Event Types seeded per tenant on first access. From PHASE-4 spec.
 * Icons use bootstrap-icons class names (compatible with the existing
 * Event Manager pages that already load bootstrap-icons).
 *
 * defaultFeatures maps to the master §10.C event feature toggles; each new
 * event of this type pre-fills its features from here (the user can override).
 */
export type EventTypeDefault = {
  name: string;
  key: string;
  icon: string;
  color: string;
  description: string;
  defaultFeatures: Record<string, boolean>;
  sortOrder: number;
};

const F = {
  reg: { registrationRequired: true },
  regApproval: { registrationRequired: true, approvalRequired: true },
  regPaid: { registrationRequired: true, paymentRequired: true, qrPassRequired: true },
  regQR: { registrationRequired: true, qrPassRequired: true, attendanceTracking: true },
  fullEvent: {
    registrationRequired: true,
    approvalRequired: false,
    paymentRequired: true,
    qrPassRequired: true,
    attendanceTracking: true,
    certificateEnabled: true,
    feedbackEnabled: true,
    sessionRegistration: true,
    sponsors: true,
    exhibitors: true,
  },
  webinar: { registrationRequired: true, attendanceTracking: true, feedbackEnabled: true },
  workshop: {
    registrationRequired: true,
    qrPassRequired: true,
    attendanceTracking: true,
    certificateEnabled: true,
    feedbackEnabled: true,
  },
  vip: {
    registrationRequired: true,
    approvalRequired: true,
    qrPassRequired: true,
    attendanceTracking: true,
  },
  exhibition: {
    registrationRequired: true,
    qrPassRequired: true,
    attendanceTracking: true,
    exhibitors: true,
    multiGate: true,
  },
  sports: {
    registrationRequired: true,
    paymentRequired: true,
    qrPassRequired: true,
    attendanceTracking: true,
    multiGate: true,
  },
};

/**
 * Minimal seed — three essential event types. Users add more as needed
 * from the Add Event Type button. Keeping the seed lean means the table
 * isn't overwhelming on first login.
 */
export const EVENT_TYPE_DEFAULTS: EventTypeDefault[] = [
  {
    name: "Conference",
    key: "conference",
    icon: "bi-mic",
    color: "#217E79",
    description: "Multi-day, multi-session conferences with speakers, sponsors, and paid tickets.",
    defaultFeatures: F.fullEvent,
    sortOrder: 10,
  },
  {
    name: "Workshop",
    key: "workshop",
    icon: "bi-tools",
    color: "#8b5cf6",
    description: "Hands-on workshops with capacity limits, attendance tracking, and certificates.",
    defaultFeatures: F.workshop,
    sortOrder: 20,
  },
  {
    name: "Webinar",
    key: "webinar",
    icon: "bi-camera-video",
    color: "#0891b2",
    description: "Online-only sessions with registration, attendance tracking, and feedback.",
    defaultFeatures: F.webinar,
    sortOrder: 30,
  },
];
