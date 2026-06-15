/**
 * ESLint Rule: no-manual-form-fields
 * 
 * Prevents manual form field definitions in CRUD edit pages when an entity config exists.
 * Enforces use of ConfigDrivenEditPage instead of manual form setup.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Prevent manual form field definitions when entity config exists',
            category: 'Architecture',
            recommended: true,
        },
        messages: {
            manualFormFields: 'Manual form field definitions detected. Use ConfigDrivenEditPage with entity config instead.',
        },
        schema: [],
    },

    create(context) {
        return {
            // Detect manual form field definitions
            CallExpression(node) {
                // Check for useForm() calls with manual field definitions
                if (
                    node.callee.type === 'Identifier' &&
                    node.callee.name === 'useForm' &&
                    node.arguments.length > 0
                ) {
                    const filename = context.getFilename();
                    // Only check in page components
                    if (filename.includes('/app/(dashboard)/') || filename.includes('\\app\\(dashboard)\\')) {
                        // Check if it's an edit page
                        if (filename.includes('/edit/') || filename.includes('\\edit\\')) {
                            context.report({
                                node,
                                messageId: 'manualFormFields',
                            });
                        }
                    }
                }
            },

            // Detect manual JSX form field definitions
            JSXElement(node) {
                if (node.openingElement.name.type === 'JSXIdentifier') {
                    const elementName = node.openingElement.name.name;

                    // Check for common form field components
                    if (['Input', 'Textarea', 'Select', 'Checkbox', 'RadioGroup'].includes(elementName)) {
                        const filename = context.getFilename();

                        // Only check in edit pages
                        if (
                            (filename.includes('/app/(dashboard)/') || filename.includes('\\app\\(dashboard)\\')) &&
                            (filename.includes('/edit/') || filename.includes('\\edit\\'))
                        ) {
                            // Check if parent is a form-like structure (has multiple form fields)
                            // This is a simplified check - in production, you'd want more sophisticated detection
                            const ancestors = context.getAncestors();
                            const hasFormParent = ancestors.some(ancestor =>
                                ancestor.type === 'JSXElement' &&
                                ancestor.openingElement.name.type === 'JSXIdentifier' &&
                                ancestor.openingElement.name.name === 'form'
                            );

                            if (hasFormParent) {
                                // Only report once per file to avoid spam
                                const sourceCode = context.getSourceCode();
                                const firstFormField = sourceCode.ast.body.find(stmt =>
                                    stmt.type === 'ExportDefaultDeclaration'
                                );

                                if (firstFormField && node === firstFormField) {
                                    context.report({
                                        node,
                                        messageId: 'manualFormFields',
                                    });
                                }
                            }
                        }
                    }
                }
            },
        };
    },
};
