/**
 * ESLint Rule: no-untranslated-strings
 *
 * Flags user-visible English strings inside JSX that bypass the i18n
 * pipeline. Catches the class of bug this codebase has: a translator runs
 * the app in Arabic, hits an error path, and sees half-English UI because
 * someone forgot to wrap a string in `t(...)`.
 *
 * Scope:
 *   - JSXText content (text between tags). Triggers on strings containing
 *     three or more consecutive ASCII letters — the cheap signal that this
 *     is English prose, not punctuation/numbers/symbols.
 *
 *   - String literals passed to a small allowlist of *visible* JSX
 *     attributes: `aria-label`, `title`, `placeholder`, `alt`. These render
 *     to the user (screen-readers and tooltips), so they need translation
 *     too. Other attributes (`href`, `id`, `className`, `data-testid`, etc.)
 *     are not user-visible and are intentionally not checked.
 *
 * Exemptions (never flagged):
 *   - JSX expressions (`{...}`) — those go through their own rules.
 *   - Fragments / whitespace / numbers / single-symbol text.
 *   - Strings shorter than 4 characters.
 *
 * The rule is intentionally conservative. False negatives are fine; the
 * point is to catch obvious regressions, not to police every literal.
 *
 * Configuration:
 *   - `allowlist` (string[]): regex patterns whose match should pass. Use
 *     for branding ("Acme", "OAuth2") and one-off product names.
 */

const DEFAULT_ALLOWLIST = [
    // Common branding / product names — extend via the `allowlist` option
    "^Acme$",
    "^OAuth2$",
    "^SignalR$",
];

const ENGLISH_PROSE_RE = /[A-Za-z]{3,}/;
const VISIBLE_ATTRIBUTES = new Set(["aria-label", "title", "placeholder", "alt"]);

module.exports = {
    meta: {
        type: "suggestion",
        docs: {
            description: "Flag untranslated user-visible English strings in JSX",
            category: "I18n",
            recommended: true,
        },
        messages: {
            jsxText:
                'Untranslated user-visible string in JSX: "{{snippet}}". Wrap with `t("...")` from `useT()`.',
            jsxAttribute:
                'Untranslated user-visible string in `{{attribute}}`: "{{snippet}}". Pass `t("...")` instead.',
        },
        schema: [
            {
                type: "object",
                properties: {
                    allowlist: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
                additionalProperties: false,
            },
        ],
    },

    create(context) {
        const options = context.options[0] || {};
        const allowlistPatterns = [
            ...DEFAULT_ALLOWLIST,
            ...(options.allowlist || []),
        ].map(p => new RegExp(p));

        function isAllowlisted(text) {
            return allowlistPatterns.some(p => p.test(text));
        }

        function snippet(text) {
            const trimmed = text.trim();
            return trimmed.length > 50 ? `${trimmed.slice(0, 47)}...` : trimmed;
        }

        function looksLikeProse(text) {
            const trimmed = text.trim();
            if (trimmed.length < 4) return false;
            if (!ENGLISH_PROSE_RE.test(trimmed)) return false;
            if (isAllowlisted(trimmed)) return false;
            return true;
        }

        return {
            JSXText(node) {
                if (looksLikeProse(node.value)) {
                    context.report({
                        node,
                        messageId: "jsxText",
                        data: { snippet: snippet(node.value) },
                    });
                }
            },

            JSXAttribute(node) {
                const attrName =
                    node.name.type === "JSXIdentifier"
                        ? node.name.name
                        : node.name.type === "JSXNamespacedName"
                            ? `${node.name.namespace.name}:${node.name.name.name}`
                            : null;

                if (!attrName || !VISIBLE_ATTRIBUTES.has(attrName)) return;
                if (!node.value || node.value.type !== "Literal") return;
                if (typeof node.value.value !== "string") return;

                if (looksLikeProse(node.value.value)) {
                    context.report({
                        node: node.value,
                        messageId: "jsxAttribute",
                        data: {
                            attribute: attrName,
                            snippet: snippet(node.value.value),
                        },
                    });
                }
            },
        };
    },
};
