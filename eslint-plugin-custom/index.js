/**
 * Custom ESLint Plugin for Config-Driven Architecture Enforcement
 * 
 * This plugin enforces architectural patterns to prevent regression
 * from config-driven components back to manual implementations.
 */

module.exports = {
    rules: {
        'no-manual-crud-columns': require('./rules/no-manual-crud-columns'),
        'no-manual-form-fields': require('./rules/no-manual-form-fields'),
        'max-lines-per-page': require('./rules/max-lines-per-page'),
        'require-entity-config': require('./rules/require-entity-config'),
        'domain-boundary-enforcement': require('./domain-boundary-enforcement'),
        'no-untranslated-strings': require('./rules/no-untranslated-strings'),
        'no-physical-direction': require('./rules/no-physical-direction'),
        'no-static-heavy-import': require('./rules/no-static-heavy-import'),
        'no-string-permission-key': require('./rules/no-string-permission-key'),
    },
    configs: {
        recommended: {
            rules: {
                'custom/no-manual-crud-columns': 'error',
                'custom/no-manual-form-fields': 'error',
                'custom/max-lines-per-page': ['error', { max: 100 }],
                'custom/require-entity-config': 'error',
                'custom/domain-boundary-enforcement': 'error',
                'custom/no-untranslated-strings': 'warn',
                'custom/no-physical-direction': 'error',
                'custom/no-static-heavy-import': 'error',
                'custom/no-string-permission-key': 'error',
            },
        },
    },
};
