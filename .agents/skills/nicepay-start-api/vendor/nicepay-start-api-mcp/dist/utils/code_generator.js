export function generateClientCodeFromTemplate(operation, input) {
    const template = operation['x-mcp-template'];
    if (typeof template !== 'string') {
        return '// Error: No valid "x-mcp-template" found for this tool.';
    }
    const properties = operation.requestBody?.content?.['application/json']?.schema?.properties || {};
    const options = [];
    for (const key in properties) {
        if (input[key] !== undefined) {
            const formattedValue = typeof input[key] === 'string' ? `'${input[key]}'` : input[key];
            options.push(`${key}: ${formattedValue}`);
        }
    }
    options.push(`fnError: function (result) { alert('결제 오류: ' + result.errorMsg); }`);
    const optionsString = `{\n        ${options.join(',\n        ')}\n      }`;
    const finalCode = template.replace('{{requestPayOptions}}', optionsString);
    return finalCode;
}
