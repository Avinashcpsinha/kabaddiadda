export const theme = {
  colors: {
    bg: '#0a0a0c',
    bgElevated: '#141418',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    primary: '#ff5c1a',
    primaryDim: '#ff5c1a33',
    border: '#27272a',
    success: '#10b981',
    danger: '#ef4444',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 },
  font: {
    h1: 32,
    h2: 24,
    h3: 18,
    body: 15,
    small: 12,
  },
} as const;
