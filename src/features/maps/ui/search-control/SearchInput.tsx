"use client"

import { Search, X, Loader2 } from "lucide-react"
import { Input } from "@/ui/design-system/primitives/input"
import { Button } from "@/ui/design-system/primitives/button"

export function SearchInput({
  searchValue,
  isSearching,
  placeholder,
  handleClear,
  handleKeyDown,
  onSearchChange,
  searchInputRef,
}: {
  searchValue: string
  isSearching: boolean
  placeholder: string
  handleClear: () => void
  handleKeyDown: (e: React.KeyboardEvent) => void
  onSearchChange: (value: string) => void
  searchInputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="relative group">
      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
      <Input
        ref={searchInputRef}
        value={searchValue}
        onChange={e => onSearchChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="ps-9 pe-9 h-11 bg-background/50 border-border/50 focus-visible:ring-primary/20 rounded-lg transition-all"
        autoComplete="off"
      />
      {isSearching && (
        <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {!isSearching && searchValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute end-1 top-1/2 -translate-y-1/2 h-6 w-6"
          onClick={handleClear}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
