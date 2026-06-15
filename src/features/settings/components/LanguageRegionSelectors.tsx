/**
 * Language Selection Component
 * Extracted from settings/language/page.tsx to reduce complexity
 */

interface Language {
  code: string
  name: string
  nativeName: string
}

interface LanguageSelectorProps {
  languages: Language[]
  selectedLanguage: string
  onLanguageChange: (code: string) => void
  label: string
}

export function LanguageSelector({ languages, selectedLanguage, onLanguageChange, label }: LanguageSelectorProps) {
  return (
    <div>
      <h3 className="font-semibold mb-3 text-foreground">{label}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {languages.map(lang => (
          <button
            key={lang.code}
            onClick={() => onLanguageChange(lang.code)}
            className={`p-4 rounded-lg border-2 transition-all text-start ${
              selectedLanguage === lang.code
                ? "border-primary bg-primary/10"
                : "border-border hover:border-input"
            }`}
          >
            <div className="font-semibold text-sm text-foreground">{lang.name}</div>
            <div className="text-xs text-muted-foreground">{lang.nativeName}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

interface Region {
  code: string
  name: string
}

interface RegionSelectorProps {
  regions: Region[]
  selectedRegion: string
  onRegionChange: (code: string) => void
  label: string
}

export function RegionSelector({ regions, selectedRegion, onRegionChange, label }: RegionSelectorProps) {
  return (
    <div>
      <h3 className="font-semibold mb-3 text-foreground">{label}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {regions.map(region => (
          <button
            key={region.code}
            onClick={() => onRegionChange(region.code)}
            className={`p-4 rounded-lg border-2 transition-all text-start ${
              selectedRegion === region.code
                ? "border-primary bg-primary/10"
                : "border-border hover:border-input"
            }`}
          >
            <div className="font-semibold text-sm text-foreground">{region.name}</div>
            <div className="text-xs text-muted-foreground">{region.code}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
