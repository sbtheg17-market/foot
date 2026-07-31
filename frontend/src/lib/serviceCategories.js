/** Category presets shown in the service form. Free-text is not allowed for now. */
export const SERVICE_CATEGORIES = [
  { value: "assessment", label: "Assessment" },
  { value: "nail_care", label: "Nail care" },
  { value: "callus_corn", label: "Callus & corn care" },
  { value: "diabetic", label: "Diabetic foot care" },
  { value: "wound", label: "Wound care" },
  { value: "massage", label: "Foot massage" },
  { value: "other", label: "Other" },
];

export const CATEGORY_LABEL = Object.fromEntries(SERVICE_CATEGORIES.map((c) => [c.value, c.label]));
