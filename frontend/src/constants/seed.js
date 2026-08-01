// Seeded IDs mirror the backend seed (see backend/seed.py).
// Auth is deferred per handoff — the client selects a portal identity.
export const SEEDED_PROVIDER_IDS = [
  { id: "prov_maya", name: "Maya Okonkwo", city: "San Francisco" },
  { id: "prov_jordan", name: "Jordan Reyes", city: "Oakland" },
  { id: "prov_alex", name: "Alex Novak", city: "Berkeley" },
];

export const CATEGORIES = [
  "reflexology",
  "pedicure",
  "massage",
  "wellness",
  "senior-care",
  "spa",
  "recovery",
];

export const CITIES = ["San Francisco", "Oakland", "Berkeley", "San Jose"];
