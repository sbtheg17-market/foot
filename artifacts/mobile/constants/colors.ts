/**
 * OnCall Foot — Mobile color tokens.
 * Synced from the web app's index.css HSL variables → hex.
 */
const colors = {
  light: {
    // Legacy aliases
    text: '#2B1E12',
    tint: '#3D8A6A',

    // Core surfaces
    background: '#FAF8F5',
    foreground: '#2B1E12',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#2B1E12',

    // Primary action (green)
    primary: '#3D8A6A',
    primaryForeground: '#FFFFFF',

    // Secondary
    secondary: '#EDE8E0',
    secondaryForeground: '#2B1E12',

    // Muted
    muted: '#EDE8E0',
    mutedForeground: '#8A7A6A',

    // Accent (warm amber — star ratings, highlights)
    accent: '#D4942A',
    accentForeground: '#FFFFFF',

    // Destructive
    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',

    // Borders
    border: '#E5DDD4',
    input: '#E5DDD4',
  },

  // Border radius (px)
  radius: 16,
};

export default colors;
