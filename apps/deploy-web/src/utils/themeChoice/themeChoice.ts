const ONE_YEAR_IN_SECONDS = 31536000;

export function rememberThemeChoice(theme: string) {
  document.cookie = `theme=${theme}; path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax`;
}
