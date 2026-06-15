/**
 * ESLint Rule: no-manual-crud-columns
 * 
 * Prevents manual column definitions in CRUD list pages when an entity config exists.
 * Enforces use of ConfigDrivenListPage instead of manual DataTable setup.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Prevent manual CRUD column definitions when entity config exists',
            category: 'Architecture',
            recommended: true,
        },
        messages: {
            manualColumns: 'Manual column definitions detected. Use ConfigDrivenListPage with entity config instead.',
        },
        schema: [],
    },

    create(context) {
        return {
            // Detect manual column definitions like: const columns = [...]
            VariableDeclarator(node) {
                // Check if variable name is 'columns' or 'tableColumns'
                if (
                    node.id.type === 'Identifier' &&
                    (node.id.name === 'columns' || node.id.name === 'tableColumns')
                ) {
                    // Check if it's an array literal
                    if (node.init && node.init.type === 'ArrayExpression') {
                        // Check if we're in a page component (file path contains /app/(dashboard)/)
                        const filename = context.getFilename();
                        if (filename.includes('/app/(dashboard)/') || filename.includes('\\app\\(dashboard)\\')) {
                            // Check if the array has column-like objects
                            const hasColumnObjects = node.init.elements.some(element => {
                                if (element && element.type === 'ObjectExpression') {
                                    return element.properties.some(prop => {
                                        if (prop.key && prop.key.type === 'Identifier') {
                                            return ['field', 'header', 'accessorKey', 'id'].includes(prop.key.name);
                                        }
                                        return false;
                                    });
                                }
                                return false;
                            });

                            if (hasColumnObjects) {
                                context.report({
                                    node,
                                    messageId: 'manualColumns',
                                });
                            }
                        }
                    }
                }
            },
        };
    },
};
