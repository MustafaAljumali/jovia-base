export const colorTokens = {
  black: "#000000",
  white: "#ffffff",
  gray50: "#fafafa",
  gray100: "#f4f4f5",
  gray300: "#d4d4d8",
  gray500: "#71717a",
  gray700: "#3f3f46",
  gray900: "#18181b",
} as const;

export const semanticTokens = {
  light: {
    background: colorTokens.white,
    foreground: colorTokens.black,
    muted: colorTokens.gray500,
    surface: colorTokens.gray50,
    border: colorTokens.gray300,
  },
  dark: {
    background: colorTokens.black,
    foreground: colorTokens.white,
    muted: colorTokens.gray500,
    surface: colorTokens.gray900,
    border: colorTokens.gray700,
  },
} as const;
