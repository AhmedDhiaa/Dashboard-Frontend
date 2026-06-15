/**
 * ESLint Rule: require-entity-config
 * 
 * Requires that CRUD pages use ConfigDriven components with entity configs
 * instead of manual implementations.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Require entity config for CRUD pages',
            category: 'Architecture',
            recommended: true,
        },
        messages: {
            missingConfigDriven: 'CRUD page should use ConfigDriven{{pageType}}Page component. Import from @/components/crud/ConfigDriven{{pageType}}Page',
            missingEntityConfig: 'ConfigDriven page must specify entityConfigName prop',
        },
        schema: [],
    },

    create(context) {
        let hasConfigDrivenImport = false;
        let hasConfigDrivenUsage = false;
        let hasEntityConfigName = false;

        return {
            ImportDeclaration(node) {
                // Check for ConfigDriven imports
                if (
                    node.source.value &&
                    (node.source.value.includes('ConfigDrivenListPage') ||
                        node.source.value.includes('ConfigDrivenDetailPage') ||
                        node.source.value.includes('ConfigDrivenEditPage'))
                ) {
                    hasConfigDrivenImport = true;
                }
            },

            JSXOpeningElement(node) {
                if (node.name.type === 'JSXIdentifier') {
                    const componentName = node.name.name;

                    // Check if using ConfigDriven components
                    if (
                        componentName === 'ConfigDrivenListPage' ||
                        componentName === 'ConfigDrivenDetailPage' ||
                        componentName === 'ConfigDrivenEditPage'
                    ) {
                        hasConfigDrivenUsage = true;

                        // Check for entityConfigName prop
                        const hasEntityConfigProp = node.attributes.some(attr => {
                            if (attr.type === 'JSXAttribute' && attr.name.type === 'JSXIdentifier') {
                                return attr.name.name === 'entityConfigName';
                            }
                            return false;
                        });

                        if (hasEntityConfigProp) {
                            hasEntityConfigName = true;
                        } else {
                            context.report({
                                node,
                                messageId: 'missingEntityConfig',
                            });
                        }
                    }
                }
            },

            'Program:exit'(node) {
                const filename = context.getFilename();

                // Only check CRUD pages in app directory
                if (
                    (filename.includes('/app/(dashboard)/') || filename.includes('\\app\\(dashboard)\\')) &&
                    filename.endsWith('page.tsx') &&
                    !filename.includes('tracking') && // Exclude special pages
                    !filename.includes('ticket-messages') &&
                    !filename.includes('settings')
                ) {
                    // Determine page type from path
                    let pageType = 'List';
                    if (filename.includes('[id]')) {
                        if (filename.includes('/edit/') || filename.includes('\\edit\\')) {
                            pageType = 'Edit';
                        } else {
                            pageType = 'Detail';
                        }
                    }

                    // Check if using ConfigDriven pattern
                    if (!hasConfigDrivenImport || !hasConfigDrivenUsage) {
                        // Only report if the file seems to be a CRUD page (has certain patterns)
                        const sourceCode = context.getSourceCode();
                        const text = sourceCode.getText();

                        // Check for indicators of manual CRUD implementation
                        const hasManualCrud =
                            text.includes('DataTable') ||
                            text.includes('useForm') ||
                            text.includes('CRUDListPage') ||
                            text.includes('CRUDDetailPage') ||
                            text.includes('CRUDEditPage');

                        if (hasManualCrud && !hasConfigDrivenUsage) {
                            context.report({
                                node,
                                messageId: 'missingConfigDriven',
                                data: {
                                    pageType,
                                },
                            });
                        }
                    }
                }
            },
        };
    },
};
