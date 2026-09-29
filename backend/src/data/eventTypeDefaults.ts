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

export const EVENT_TYPE_DEFAULTS: EventTypeDefault[] = [
  { name: "Conference", key: "conference", icon: "bi-mic", color: "#2249b7", description: "Multi-day, multi-session conferences with speakers, sponsors and paid tickets.", defaultFeatures: F.fullEvent, sortOrder: 10 },
  { name: "Seminar", key: "seminar", icon: "bi-easel", color: "#0d6b68", description: "Single or multi-session educational seminars with registration and attendance.", defaultFeatures: F.workshop, sortOrder: 20 },
  { name: "Workshop", key: "workshop", icon: "bi-tools", color: "#8b5cf6", description: "Hands-on workshops with capacity limits, attendance tracking and certificates.", defaultFeatures: F.workshop, sortOrder: 30 },
  { name: "Webinar", key: "webinar", icon: "bi-camera-video", color: "#0891b2", description: "Online-only sessions with registration, attendance tracking and feedback.", defaultFeatures: F.webinar, sortOrder: 40 },
  { name: "School Event", key: "school-event", icon: "bi-mortarboard", color: "#f59e0b", description: "School annual functions, PTM, cultural days with parent + student registration.", defaultFeatures: F.regQR, sortOrder: 50 },
  { name: "College Fest", key: "college-fest", icon: "bi-stars", color: "#ec4899", description: "Multi-day college festivals with sessions, sponsors and paid tickets.", defaultFeatures: F.fullEvent, sortOrder: 60 },
  { name: "Corporate Event", key: "corporate-event", icon: "bi-building", color: "#334155", description: "Internal or external corporate gatherings with team registration.", defaultFeatures: F.regQR, sortOrder: 70 },
  { name: "Exhibition", key: "exhibition", icon: "bi-shop-window", color: "#059669", description: "Trade expos with exhibitors, booths and multi-gate visitor check-in.", defaultFeatures: F.exhibition, sortOrder: 80 },
  { name: "Trade Show", key: "trade-show", icon: "bi-briefcase", color: "#0e7490", description: "Industry trade shows with exhibitors, sponsors and business networking.", defaultFeatures: F.exhibition, sortOrder: 90 },
  { name: "Sports Event", key: "sports-event", icon: "bi-trophy", color: "#dc2626", description: "Marathons, tournaments and athletic competitions with categories.", defaultFeatures: F.sports, sortOrder: 100 },
  { name: "Cultural Event", key: "cultural-event", icon: "bi-music-note-beamed", color: "#a855f7", description: "Cultural gatherings, dance events, art shows with registration.", defaultFeatures: F.regQR, sortOrder: 110 },
  { name: "Award Function", key: "award-function", icon: "bi-award", color: "#eab308", description: "Award ceremonies with VIP invitees and formal seating.", defaultFeatures: F.vip, sortOrder: 120 },
  { name: "Festival", key: "festival", icon: "bi-balloon", color: "#f97316", description: "Multi-day festivals with sponsors, food stalls, sessions and passes.", defaultFeatures: F.fullEvent, sortOrder: 130 },
  { name: "Product Launch", key: "product-launch", icon: "bi-rocket-takeoff", color: "#3b82f6", description: "Product launch events with press, customers and media invitees.", defaultFeatures: F.vip, sortOrder: 140 },
  { name: "Networking", key: "networking", icon: "bi-people", color: "#14b8a6", description: "Networking meetups with registration and QR-based check-in.", defaultFeatures: F.regQR, sortOrder: 150 },
  { name: "Training", key: "training", icon: "bi-clipboard-check", color: "#0284c7", description: "Corporate or professional training with attendance and certificates.", defaultFeatures: F.workshop, sortOrder: 160 },
  { name: "Competition", key: "competition", icon: "bi-flag", color: "#e11d48", description: "Talent hunts, quizzes, contests with team registration and scoring.", defaultFeatures: F.regApproval, sortOrder: 170 },
  { name: "Hackathon", key: "hackathon", icon: "bi-code-slash", color: "#7c3aed", description: "Team-based hackathons with group registration and multi-day sessions.", defaultFeatures: F.fullEvent, sortOrder: 180 },
  { name: "Recruitment Drive", key: "recruitment-drive", icon: "bi-person-badge", color: "#065f46", description: "Job fairs and campus recruitment with candidate registration and screening.", defaultFeatures: F.regApproval, sortOrder: 190 },
  { name: "Government / Public", key: "government-public", icon: "bi-bank", color: "#1e40af", description: "Government functions, public rallies and civic events.", defaultFeatures: F.regQR, sortOrder: 200 },
  { name: "VIP / Private", key: "vip-private", icon: "bi-shield-lock", color: "#4c1d95", description: "Invitation-only VIP events with strict approval and seating.", defaultFeatures: F.vip, sortOrder: 210 },
  { name: "Wedding / Ceremony", key: "wedding-ceremony", icon: "bi-heart", color: "#db2777", description: "Weddings and family ceremonies with guest RSVP and seating.", defaultFeatures: F.regApproval, sortOrder: 220 },
  { name: "Charity / Fundraiser", key: "charity-fundraiser", icon: "bi-hand-thumbs-up", color: "#16a34a", description: "Charity events, donation drives and fundraisers with sponsor tracking.", defaultFeatures: F.fullEvent, sortOrder: 230 },
  { name: "Film Screening", key: "film-screening", icon: "bi-film", color: "#1e293b", description: "Movie premieres and film festival screenings with seating.", defaultFeatures: F.regPaid, sortOrder: 240 },
  { name: "Music Concert", key: "music-concert", icon: "bi-music-player", color: "#be123c", description: "Concerts with paid tickets, tiered seating and QR gate check-in.", defaultFeatures: F.regPaid, sortOrder: 250 },
];
