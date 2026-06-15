/**
 * Theme Selection Components
 * Extracted from settings/theme/page.tsx to reduce complexity
 */

interface ThemeOption {
  id: string
  labelKey: string
  descriptionKey: string
}

interface ThemeSelectorProps {
  themes: ThemeOption[]
  currentTheme: string | undefined
  onThemeChange: (theme: string) => void
  t: (key: string) => string
}

export function ThemeSelector({ themes, currentTheme, onThemeChange, t }: ThemeSelectorProps) {
  return (
    <div>
      <h3 className="font-semibold mb-3 text-foreground">{t("settings.theme.theme_label")}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {themes.map(themeItem => (
          <button
            key={themeItem.id}
            onClick={() => onThemeChange(themeItem.id)}
            className={`p-4 rounded-lg border-2 transition-all text-start ${
              currentTheme === themeItem.id
                ? "border-primary bg-primary/10"
                : "border-border hover:border-input"
            }`}
          >
            <div className="font-semibold text-sm text-foreground">{t(themeItem.labelKey)}</div>
            <div className="text-xs text-muted-foreground">{t(themeItem.descriptionKey)}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

interface ColorScheme {
  id: string
  labelKey: string
  colorClass: string
}

interface ColorSchemeSelectorProps {
  colorSchemes: ColorScheme[]
  selectedColor: string
  onColorChange: (color: string) => void
  t: (key: string) => string
}

export function ColorSchemeSelector({ colorSchemes, selectedColor, onColorChange, t }: ColorSchemeSelectorProps) {
  return (
    <div>
      <h3 className="font-semibold mb-3 text-foreground">{t("settings.theme.color_scheme_label")}</h3>
      <div className="flex gap-4 flex-wrap">
        {colorSchemes.map(c => (
          <button
            key={c.id}
            onClick={() => onColorChange(c.id)}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
              selectedColor === c.id ? "border-foreground" : "border-border hover:border-input"
            }`}
          >
            <div className={`w-8 h-8 rounded-full ${c.colorClass}`} />
            <span className="text-xs font-medium text-foreground">{t(c.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

interface FontSizeControlProps {
  t: (key: string) => string
  onFontSizeChange: () => void
}

export function FontSizeControl({ t, onFontSizeChange }: FontSizeControlProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{t("common.fields.base_font_size")}</label>
      <input type="range" min="12" max="18" defaultValue="14" className="w-full" onChange={onFontSizeChange} />
    </div>
  )
}
