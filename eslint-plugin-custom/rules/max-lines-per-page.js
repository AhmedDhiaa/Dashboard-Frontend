/**
 * ESLint Rule: max-lines-per-page
 * 
 * Enforces maximum line count for page components to encourage
 * use of config-driven patterns and component extraction.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Enforce maximum lines per page component',
            category: 'Architecture',
            recommended: true,
        },
        messages: {
            tooManyLines: 'Page component has {{actual}} lines, maximum allowed is {{max}}. Consider using ConfigDriven components or extracting logic.',
        },
        schema: [
            {
                type: 'object',
                properties: {
                    max: {
                        type: 'integer',
                        minimum: 1,
                    },
                    skipBlankLines: {
                        type: 'boolean',
                    },
                    skipComments: {
                        type: 'boolean',
                    },
                },
                additionalProperties: false,
            },
        ],
    },

    create(context) {
        const options = context.options[0] || {};
        const max = options.max || 100;
        const skipBlankLines = options.skipBlankLines !== false;
        const skipComments = options.skipComments !== false;

        return {
            Program(node) {
                const filename = context.getFilename();

                // Only check page components in app directory
                if (
                    (filename.includes('/app/(dashboard)/') || filename.includes('\\app\\(dashboard)\\')) &&
                    filename.endsWith('page.tsx')
                ) {
                    const sourceCode = context.getSourceCode();
                    const lines = sourceCode.lines;

                    let lineCount = lines.length;

                    if (skipBlankLines || skipComments) {
                        const allComments = sourceCode.getAllComments();
                        const commentLines = new Set();

                        if (skipComments) {
                            allComments.forEach(comment => {
                                for (let i = comment.loc.start.line; i <= comment.loc.end.line; i++) {
                                    commentLines.add(i);
                                }
                            });
                        }

                        lineCount = lines.reduce((count, line, index) => {
                            const lineNumber = index + 1;

                            if (skipComments && commentLines.has(lineNumber)) {
                                return count;
                            }

                            if (skipBlankLines && line.trim() === '') {
                                return count;
                            }

                            return count + 1;
                        }, 0);
                    }

                    if (lineCount > max) {
                        context.report({
                            node,
                            messageId: 'tooManyLines',
                            data: {
                                actual: lineCount,
                                max,
                            },
                        });
                    }
                }
            },
        };
    },
};
