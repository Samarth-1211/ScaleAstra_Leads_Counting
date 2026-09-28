/**
 * ScaleHour Lead App: everything you might want to change lives here.
 * After editing, rebuild and redeploy the app.
 */
export const CONFIG = {
  /** The Web App URL from Apps Script (Deploy > Manage deployments). It ends in /exec. */
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz5MEXGsBWhnVpMXhAfBYLSDzFHQBL50FS6RINGZdFqdwwNgRIXMi409mlWD2nQeZIO/exec',

  /** Must match the PASSCODE script property in Apps Script. */
  PASSCODE: 'ScaleHour@71',

  /** Leads each person should add per day. */
  DAILY_TARGET: 71,

  /** Team members. To add someone, add their name here; nothing else needs to change. */
  TEAM: ['Shakti', 'Parag'],

  /** How often the leaderboard refreshes by itself, in seconds. */
  REFRESH_SECONDS: 45,

  /** How long the opening quote stays before the app continues, in seconds. */
  QUOTE_SECONDS: 5,

  /** Most phone numbers one lead can have, counting the main one. */
  MAX_PHONE_NUMBERS: 5,
};

/** Whether we can also pitch them a website, and roughly why. */
export const WEBSITE_PITCH = [
  'Yes – no website',
  'Yes – website needs work',
  'No – website is good',
  'Not sure',
];

export const DESIGNATIONS = ['Founder', 'Director', 'Owner', 'Sales Head', 'Manager', 'Other'];

export const BUSINESS_TYPES = [
  'Builder/Developer',
  'Broker/Agency',
  'Channel Partner',
  'Property Consultant',
  'Other',
];

export const LEAD_SOURCES = [
  'Housing.com',
  '99acres',
  'MagicBricks',
  'Meta (Facebook/Instagram)',
  'Google',
  'NoBroker',
  'Referral',
  'Other',
];

export const isConfigured = () => /^https?:\/\//.test(CONFIG.APPS_SCRIPT_URL);
