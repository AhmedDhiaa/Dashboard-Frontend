import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import customPlugin from "./eslint-plugin-custom/index.js";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "eslint-plugin-custom/**", // Ignore the plugin itself
    // Tooling — not part of the runtime app
    "plop-templates/**",
    "plopfile.mjs",
    "scripts/**",
    // Deployment configs (PM2 .cjs, systemd, nginx, IIS, start scripts) — not
    // app source; they intentionally use CommonJS / platform conventions.
    "deploy/**",
    "coverage/**",
    "node_modules/**",
    // Playwright e2e specs use a separate runtime + globals
    "e2e/**",
    "playwright.config.ts",
  ]),
  // Custom Architecture Enforcement Plugin + react-hooks overrides.
  //
  // The react-hooks plugin is hoisted to the project's root `node_modules/`
  // by eslint-config-next, so we can import it directly even though it's not
  // a top-level dependency. We need the explicit `react-hooks` namespace here
  // because flat-config rules can only reference plugins declared in the same
  // block, and eslint-config-next's preset blocks are imported as opaque
  // arrays.
  {
    plugins: {
      custom: customPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
      // React-Compiler-era rules from react-hooks v7 — aspirational guidance
      // (idempotent renders, no ref-access during render, no setState in
      // effects) that the existing codebase doesn't satisfy. Disabled to
      // match the project's `preserve-manual-memoization` posture; revisit
      // as a separate refactor effort.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/refs": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/component-hook-factories": "off",
      "react-hooks/config": "off",
      "react-hooks/fbt": "off",
      "react-hooks/gating": "off",
      "react-hooks/globals": "off",
    },
  },
  {
    rules: {
      // TypeScript Rules - STRICT MODE ENABLED (Production Quality)
      "@typescript-eslint/no-explicit-any": "error", // Upgraded from warn - no any types allowed
      "@typescript-eslint/no-unused-vars": ["error", { // Upgraded from warn
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-empty-object-type": "error", // Upgraded from warn
      // Note: `react/no-unescaped-entities` is provided by
      // eslint-config-next/core-web-vitals; we don't override it here because
      // doing so requires eslint-plugin-react in the same config block, and
      // eslint-plugin-react isn't hoisted to root node_modules/.

      // TypeScript additional rules
      "@typescript-eslint/no-require-imports": "error", // Upgraded from warn
      "@typescript-eslint/no-unsafe-function-type": "error", // Upgraded from warn
      "@typescript-eslint/ban-ts-comment": "error", // Upgraded from warn

      // Code Quality Rules
      "no-console": ["error", { allow: ["warn", "error"] }], // Ban console.log, force logger usage
      "complexity": ["error", { max: 15 }], // Limit cyclomatic complexity
      "max-lines-per-function": ["warn", { max: 100, skipBlankLines: true, skipComments: true }],
      "max-depth": ["error", { max: 4 }], // Limit nesting depth

      // Enforce centralized notification system. Both toast engines are
      // blocked outside the wrapper (useNotification.ts) + the Toaster mount
      // (ClientProviders.tsx), which use eslint-disable. `sonner` is the
      // current engine; `react-hot-toast` stays listed so it can't creep back.
      "no-restricted-imports": ["error", {
        "paths": [
          {
            "name": "sonner",
            "message": "Use @/hooks/useNotification instead of importing sonner directly"
          },
          {
            "name": "react-hot-toast",
            "message": "react-hot-toast was replaced by sonner — use @/hooks/useNotification"
          }
        ]
      }],

      // Custom Architecture Enforcement Rules
      "custom/no-manual-crud-columns": "error",
      "custom/no-manual-form-fields": "error",
      "custom/max-lines-per-page": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
      "custom/require-entity-config": "warn", // Start with warn to avoid breaking existing code
      "custom/domain-boundary-enforcement": "error",
      // Catches user-visible English strings in JSX text + visible attrs
      // (aria-label/title/placeholder/alt). Conservative on purpose — it
      // skips short text, single symbols, and the JSX-expression path —
      // false positives are rare but possible.
      //
      // Currently OFF: a baseline scan flagged ~184 existing strings across
      // ~30 files (auth, tickets, security/api-settings, vehicle/warehouse
      // components, a few configs). Translating each is mechanical but
      // requires picking a key namespace and updating both `messages/en/*`
      // and `messages/ar/*` per string — too large for one drop. Re-enable
      // as `warn` after a dedicated translation sprint, then ratchet to
      // `error` once the count is zero. Held at "off" so CI's
      // `--max-warnings 0` gate stays meaningful for everything else.
      "custom/no-untranslated-strings": "off",

      // RTL hygiene — flag Tailwind's physical-direction utilities (pl-/
      // pr-/ml-/mr-/left-/right-/text-left/text-right) so the layout
      // stays correct under Arabic. Use the logical equivalents (ps-/pe-/
      // ms-/me-/start-/end-/text-start/text-end) — they automatically
      // honor `dir="rtl"`.
      "custom/no-physical-direction": "error",

      // Bundle-size hygiene — block top-level value imports of heavy
      // client libs from anywhere outside a designated dynamic-boundary
      // file. The `allowFiles` allowlist enumerates files that are either
      // (a) themselves wrapped in `next/dynamic` by their consumer, or
      // (b) live inside a directory whose root is dynamic-imported (e.g.
      // dashboard widgets reached through `dynamic(() => import("@/features/dashboard"))`).
      // Type-only imports (`import type { … }`) and dynamic imports
      // (`import("…")`) are always permitted.
      //
      // Adding a file to allowFiles should be justified in PR review —
      // call out *who* dynamic-imports it. If no consumer does, fix the
      // consumer instead of widening the allowlist.
      "custom/no-static-heavy-import": ["error", {
        packages: [
          "recharts",
          "framer-motion",
          "exceljs",
          "jspdf",
          "react-easy-crop",
          "cmdk",
          "@googlemaps/js-api-loader",
        ],
        allowFiles: [
          // Dedicated lazy wrappers (create new ones here as needed).
          "src/shared/lazy/**",
          // Chart-rendering primitive — dynamic-imported by WidgetRenderer.tsx.
          "src/shared/widgets/ChartBody.tsx",
          // Dashboard widgets — dynamic-imported by `(dashboard)/page.tsx`
          // via `dynamic(() => import("@/features/dashboard"))`.
          "src/features/dashboard/components/**",
          "src/features/dashboard/sections/**",
          "src/features/dashboard/widgets/**",
          // Command palette — dynamic-imported by `(dashboard)/layout.tsx`.
          "src/features/navigation/CommandPalette.tsx",
          // cmdk primitive — only consumers (CommandPalette, kpis filters,
          // EntityAutocomplete) sit behind dynamic boundaries or limited
          // routes; the primitive itself is treated as a wrapper.
          "src/ui/design-system/primitives/command.tsx",
          // Theme customizer — `/admin/theme/page.tsx` dynamic-imports the
          // entire ThemeCustomizerPage module.
          "src/ui/theme/**",
          // Runtime-builder chart body — dynamic-imported (ssr:false) by
          // DashboardView at `/runtime/dashboard/[id]`, so the recharts
          // surface never lands in that route's first-load bundle.
          "src/features/runtime-builder/components/DashboardChartBody.tsx",
          // Reports/fuel-balances — own route; charts gated by route nav.
          "src/app/(dashboard)/reports/fuel-balances/**",
          // Tank stock pages — own routes (`/inventory/tanks`, `/vehicles/tanks`).
          "src/domains/operations/vehicle/components/TankStockView.tsx",
          "src/domains/operations/vehicle/components/TankStockCard.tsx",
          "src/domains/operations/vehicle/components/ModernTank.tsx",
          // Tickets — domain components reached via ticket-feature routes.
          "src/domains/tickets/components/TicketCard.tsx",
          // Showcase — dev-only gallery, never linked from a localized route.
          "src/app/(dashboard)/showcase/**",
          // Auth interstitials — own routes; framer-motion stays per-route.
          "src/app/auth/session-expired/page.tsx",
          // Maps loader — js-api-loader is itself a lazy facade for the
          // Google Maps SDK; the package is small (~5 KB) and importing
          // it is the only sanctioned way to call `importLibrary`.
          "src/features/maps/providers/GoogleMapsProvider.ts",
        ],
      }],

      // Permission-key hygiene — block fully-qualified `Api.X.Y` literals
      // outside the single source of truth at
      // `src/shared/auth/permission-keys.ts`. A typo in a permission
      // literal silently denies access; routing every key through the
      // central `PERMISSIONS` map turns renames into a single-file change
      // and surfaces typos as TypeScript errors at the call site.
      //
      // Two-segment entity prefixes (`Api.Brand`, `Api.City`) live on
      // each entity config and are intentionally NOT in the central map —
      // the rule's regex requires the second dot, so they're never flagged.
      "custom/no-string-permission-key": ["error", {
        allowFiles: [
          // The source of truth itself.
          "src/shared/auth/permission-keys.ts",
          // MSW handlers seed mock permission sets; literals are fixtures.
          "src/shared/test-utils/**",
          // Standalone-mode mock handlers are the runtime twin of the MSW
          // fixtures: they synthesize the backend's permission catalog and
          // `Api.*` setting names as demo data, not as auth gates.
          "src/infra/api/mock/handlers/**",
          // API-settings group registry uses `Api.Mobile.Selling`-style
          // prefixes to filter *settings*, not permissions. These happen
          // to share the regex shape but mean something different.
          "src/app/(dashboard)/system/api-settings/_utils.ts",
          // Tests hand-craft permission grants for guard fixtures.
          "**/*.test.{ts,tsx}",
          "**/__tests__/**",
        ],
      }],

      // Design System Enforcement Rules - ENFORCED (0 violations)
      // Hardcoded colors eliminated - now enforcing to prevent future violations
      "no-restricted-syntax": [
        "error", // Upgraded from warn - zero violations achieved!
        {
          "selector": "Literal[value=/bg-\\[#[0-9a-fA-F]{3,6}\\]|text-\\[#[0-9a-fA-F]{3,6}\\]|border-\\[#[0-9a-fA-F]{3,6}\\]/]",
          "message": "❌ HARDCODED COLOR DETECTED! Use design tokens from @/lib/design-tokens. Example: Use 'bg-primary', 'bg-card', 'bg-accent', or 'bg-[var(--feature-oliveGreen)]' instead of hex colors."
        },
        {
          "selector": "TemplateLiteral[expressions.length=0] > TemplateElement[value.raw=/bg-\\[#[0-9a-fA-F]{3,6}\\]|text-\\[#[0-9a-fA-F]{3,6}\\]|border-\\[#[0-9a-fA-F]{3,6}\\]/]",
          "message": "❌ HARDCODED COLOR DETECTED! Use design tokens from @/lib/design-tokens instead."
        },
        // Block common hardcoded color patterns
        {
          "selector": "Literal[value=/bg-(white|black|gray|red|blue|green|yellow|orange|purple|pink|indigo|emerald|slate|zinc|neutral|stone|amber|lime|cyan|sky|violet|fuchsia|rose)-(50|100|200|300|400|500|600|700|800|900|950)/]",
          "message": "❌ HARDCODED COLOR UTILITY DETECTED! Use semantic tokens: 'bg-background', 'bg-card', 'bg-muted', 'bg-primary', 'bg-accent', 'bg-destructive', etc. from design tokens."
        }
      ],

      // Block inline styles with hardcoded colors
      "no-restricted-properties": [
        "error",
        {
          "object": "style",
          "property": "backgroundColor",
          "message": "❌ NO INLINE STYLES! Use design tokens: className='bg-primary', 'bg-card', 'bg-background', etc."
        },
        {
          "object": "style",
          "property": "color",
          "message": "❌ NO INLINE STYLES! Use design tokens: className='text-foreground', 'text-primary', 'text-muted-foreground', etc."
        },
        {
          "object": "style",
          "property": "borderColor",
          "message": "❌ NO INLINE STYLES! Use design tokens: className='border-border', 'border-primary', 'border-accent', etc."
        }
      ],
    },
  },
  // Allow type suppressions in entity config files
  {
    files: ["**/*.config.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  // The design-system showcase ("`showcase`") is a developer-only gallery
  // of UI primitives — never linked from any localized route, mounted only in
  // dev. The theme customizer (`ui/theme/`) is the in-app design-system editor
  // where the inline strings are component identifiers ("Button", "Card", a
  // CSS-variable label) — translating them would obscure the registry.
  // Tests and storybook fixtures get the same exemption: they're never
  // rendered to end users.
  {
    files: [
      "src/app/(dashboard)/showcase/**",
      "src/ui/theme/**",
      "**/*.test.{ts,tsx}",
      "**/__tests__/**",
    ],
    rules: {
      "custom/no-untranslated-strings": "off",
      // Test files routinely host many `it` blocks inside a single
      // `describe` arrow. The default 100-line cap forces artificial
      // splitting purely for length, with no readability benefit. The
      // source-code cap stays at 100; tests get the same 200 ceiling
      // the maps subsystem uses for legacy reasons.
      "max-lines-per-function": ["warn", { max: 200 }],
    },
  },
  // Relax rules for map subsystem (legacy Google Maps API integration)
  {
    files: ["src/features/maps/**/*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "complexity": ["warn", { max: 25 }],
      "max-lines-per-function": ["warn", { max: 200 }],
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]);

export default eslintConfig;
