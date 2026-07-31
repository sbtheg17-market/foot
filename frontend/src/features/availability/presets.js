/**
 * One-tap availability presets. Preserves the current travel zone —
 * only the weekly template is replaced.
 */
const NINE_TO_FIVE = { start: "09:00", end: "17:00" };
const TEN_TO_SIX = { start: "10:00", end: "18:00" };

export const AVAILABILITY_PRESETS = [
  {
    key: "weekdays_9_5",
    label: "9–5 Weekdays",
    weekly: {
      mon: [{ ...NINE_TO_FIVE }],
      tue: [{ ...NINE_TO_FIVE }],
      wed: [{ ...NINE_TO_FIVE }],
      thu: [{ ...NINE_TO_FIVE }],
      fri: [{ ...NINE_TO_FIVE }],
      sat: [],
      sun: [],
    },
  },
  {
    key: "daily_10_6",
    label: "10–6 Every day",
    weekly: {
      mon: [{ ...TEN_TO_SIX }],
      tue: [{ ...TEN_TO_SIX }],
      wed: [{ ...TEN_TO_SIX }],
      thu: [{ ...TEN_TO_SIX }],
      fri: [{ ...TEN_TO_SIX }],
      sat: [{ ...TEN_TO_SIX }],
      sun: [{ ...TEN_TO_SIX }],
    },
  },
  {
    key: "weekends_only",
    label: "Weekends only",
    weekly: {
      mon: [], tue: [], wed: [], thu: [], fri: [],
      sat: [{ start: "10:00", end: "16:00" }],
      sun: [{ start: "10:00", end: "16:00" }],
    },
  },
];
