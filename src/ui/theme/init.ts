/**
 * Theme Initializer Script
 *
 * Injected into HTML head to prevent theme flash
 * Loads and applies theme before React hydration
 */

export const themeInitScript = `
(function() {
  try {
    var theme = localStorage.getItem('app-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (theme === 'dark' || (theme === 'system' && prefersDark) || (!theme && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {
    // Cannot use logger here as this runs before React hydration
    // Silent fail is acceptable for theme initialization
  }
})();
`
