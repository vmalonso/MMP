// ================================================== 
// XSD Parser - Automatic Schema Validation Rules Extraction
// ================================================== 

/**
 * Parses an XSD schema and extracts validation rules
 * @param {string} xsdText - The XSD schema as text
 * @returns {Object} Parsed schema with validation rules
 */
function parseXSDSchema(xsdText) {
    const parser = new DOMParser();
    const xsdDoc = parser.parseFromString(xsdText, 'text/xml');

    // Check for parsing errors
    const parserError = xsdDoc.querySelector('parsererror');
    if (parserError) {
        throw new Error('Error parsing XSD schema: ' + parserError.textContent);
    }

    const schema = {
        simpleTypes: {},
        complexTypes: {},
        elements: {},
        rootElement: null
    };

    // Parse simple types (restrictions, patterns, ranges)
    parseSimpleTypes(xsdDoc, schema);

    // Parse complex types (structure definitions)
    parseComplexTypes(xsdDoc, schema);

    // Parse root element
    parseRootElement(xsdDoc, schema);

    return schema;
}

/**
 * Parse simple type definitions (restrictions, enumerations, patterns)
 */
function parseSimpleTypes(xsdDoc, schema) {
    const simpleTypes = xsdDoc.querySelectorAll('simpleType[name]');

    simpleTypes.forEach(simpleType => {
        const name = simpleType.getAttribute('name');
        const restriction = simpleType.querySelector('restriction');

        if (!restriction) return;

        const baseType = restriction.getAttribute('base');
        const rules = {
            baseType: baseType,
            restrictions: {}
        };

        // Parse enumerations
        const enumerations = restriction.querySelectorAll('enumeration');
        if (enumerations.length > 0) {
            rules.restrictions.enum = Array.from(enumerations).map(e => e.getAttribute('value'));
        }

        // Parse min/max inclusive
        const minInclusive = restriction.querySelector('minInclusive');
        if (minInclusive) {
            rules.restrictions.minInclusive = parseValue(minInclusive.getAttribute('value'), baseType);
        }

        const maxInclusive = restriction.querySelector('maxInclusive');
        if (maxInclusive) {
            rules.restrictions.maxInclusive = parseValue(maxInclusive.getAttribute('value'), baseType);
        }

        // Parse pattern
        const pattern = restriction.querySelector('pattern');
        if (pattern) {
            rules.restrictions.pattern = pattern.getAttribute('value');
        }

        schema.simpleTypes[name] = rules;
    });
}

/**
 * Parse complex type definitions (structure with elements)
 */
function parseComplexTypes(xsdDoc, schema) {
    const complexTypes = xsdDoc.querySelectorAll('complexType[name]');

    complexTypes.forEach(complexType => {
        const name = complexType.getAttribute('name');
        const elements = {};

        // Parse elements within xs:all, xs:sequence, or xs:choice
        const elementNodes = complexType.querySelectorAll(':scope > all > element, :scope > sequence > element, :scope > choice > element');

        elementNodes.forEach(element => {
            const elemName = element.getAttribute('name');
            const elemType = element.getAttribute('type');
            const minOccurs = element.getAttribute('minOccurs') || '1';
            const maxOccurs = element.getAttribute('maxOccurs') || '1';
            const defaultValue = element.getAttribute('default');

            elements[elemName] = {
                type: elemType,
                required: minOccurs !== '0',
                minOccurs: parseInt(minOccurs),
                maxOccurs: maxOccurs === 'unbounded' ? Infinity : parseInt(maxOccurs),
                default: defaultValue,
                inlineType: null
            };

            // Check for inline simple type definition
            const inlineSimpleType = element.querySelector(':scope > simpleType');
            if (inlineSimpleType) {
                const restriction = inlineSimpleType.querySelector('restriction');
                if (restriction) {
                    const baseType = restriction.getAttribute('base');
                    const inlineRules = {
                        baseType: baseType,
                        restrictions: {}
                    };

                    // Parse inline enumerations
                    const enums = restriction.querySelectorAll('enumeration');
                    if (enums.length > 0) {
                        inlineRules.restrictions.enum = Array.from(enums).map(e => e.getAttribute('value'));
                    }

                    // Parse inline min/max
                    const minInc = restriction.querySelector('minInclusive');
                    if (minInc) {
                        inlineRules.restrictions.minInclusive = parseValue(minInc.getAttribute('value'), baseType);
                    }

                    const maxInc = restriction.querySelector('maxInclusive');
                    if (maxInc) {
                        inlineRules.restrictions.maxInclusive = parseValue(maxInc.getAttribute('value'), baseType);
                    }

                    elements[elemName].inlineType = inlineRules;
                }
            }

            // Check for inline complex type definition (e.g. POINTS container)
            const inlineComplexType = element.querySelector(':scope > complexType');
            if (inlineComplexType) {
                // Parse the inline structure recursively
                // We can reuse parseElementStructure logic but applied to this inline complex type
                // But parseElementStructure expects an 'element' node that contains a complexType.
                // Here we have the element node already.

                // Let's extract the structure parsing logic to a helper or reuse parseElementStructure
                // parseElementStructure actually takes the parent 'element' and looks for a child 'complexType'.
                // So we can just call it!
                const structure = parseElementStructure(element);
                elements[elemName].structure = structure;
            }
        });

        schema.complexTypes[name] = {
            elements: elements
        };
    });
}

/**
 * Parse root element definition
 */
function parseRootElement(xsdDoc, schema) {
    // Get the schema element (root of XSD document)
    const schemaElement = xsdDoc.documentElement;

    // Find direct child elements of schema that have a name attribute
    const rootElements = Array.from(schemaElement.children).filter(child =>
        child.localName === 'element' && child.hasAttribute('name')
    );

    if (rootElements.length > 0) {
        const rootElement = rootElements[0];
        const name = rootElement.getAttribute('name');

        schema.rootElement = {
            name: name,
            structure: parseElementStructure(rootElement)
        };
    }
}

/**
 * Parse element structure recursively
 */
function parseElementStructure(element) {
    const structure = {
        elements: {},
        attributes: {}
    };

    // Parse inline complex type
    const complexType = element.querySelector(':scope > complexType');
    if (complexType) {
        // Parse attributes
        const attributes = complexType.querySelectorAll(':scope > attribute');
        attributes.forEach(attr => {
            const attrName = attr.getAttribute('name');
            const attrType = attr.getAttribute('type');
            const use = attr.getAttribute('use') || 'optional';

            structure.attributes[attrName] = {
                type: attrType,
                required: use === 'required'
            };
        });

        // Parse child elements
        const childElements = complexType.querySelectorAll(':scope > sequence > element, :scope > all > element, :scope > choice > element');
        childElements.forEach(child => {
            const childName = child.getAttribute('name');
            const childType = child.getAttribute('type');
            const minOccurs = child.getAttribute('minOccurs') || '1';
            const maxOccurs = child.getAttribute('maxOccurs') || '1';

            structure.elements[childName] = {
                type: childType,
                required: minOccurs !== '0',
                minOccurs: parseInt(minOccurs),
                maxOccurs: maxOccurs === 'unbounded' ? Infinity : parseInt(maxOccurs),
                inlineType: null
            };

            // Check for inline simple type definition (like LINECOLOR, AREACOLOR, etc.)
            const inlineSimpleType = child.querySelector(':scope > simpleType');
            if (inlineSimpleType) {
                const restriction = inlineSimpleType.querySelector('restriction');
                if (restriction) {
                    const baseType = restriction.getAttribute('base');
                    const inlineRules = {
                        baseType: baseType,
                        restrictions: {}
                    };

                    // Parse inline enumerations
                    const enums = restriction.querySelectorAll('enumeration');
                    if (enums.length > 0) {
                        inlineRules.restrictions.enum = Array.from(enums).map(e => e.getAttribute('value'));
                    }

                    // Parse inline min/max
                    const minInc = restriction.querySelector('minInclusive');
                    if (minInc) {
                        inlineRules.restrictions.minInclusive = parseValue(minInc.getAttribute('value'), baseType);
                    }

                    const maxInc = restriction.querySelector('maxInclusive');
                    if (maxInc) {
                        inlineRules.restrictions.maxInclusive = parseValue(maxInc.getAttribute('value'), baseType);
                    }

                    // Parse inline pattern
                    const pattern = restriction.querySelector('pattern');
                    if (pattern) {
                        inlineRules.restrictions.pattern = pattern.getAttribute('value');
                    }

                    structure.elements[childName].inlineType = inlineRules;
                }
            }

            // Check for inline complex type definition (like GROUPS containing GROUP)
            const inlineComplexType = child.querySelector(':scope > complexType');
            if (inlineComplexType) {
                // Recursively parse the inline structure
                structure.elements[childName].structure = parseElementStructure(child);
            }
        });
    }

    return structure;
}

/**
 * Parse value based on type
 */
function parseValue(value, type) {
    if (type && type.includes('integer')) {
        return parseInt(value);
    } else if (type && type.includes('float')) {
        return parseFloat(value);
    }
    return value;
}

/**
 * Validate an XML element against a complex type definition
 */
function validateAgainstComplexType(element, typeName, schema, errors, path = '', xmlString = null) {
    const complexType = schema.complexTypes[typeName];
    if (!complexType) {
        console.warn(`Complex type ${typeName} not found in schema`);
        return;
    }

    const typeElements = complexType.elements;

    // Check required elements
    for (const [elemName, elemDef] of Object.entries(typeElements)) {
        if (elemDef.required) {
            const childElement = element.querySelector(`:scope > ${elemName}`);
            if (!childElement) {
                // Try to find approximate location of parent
                const locationInfo = xmlString ? findLocation(xmlString, element.tagName, '') : '';
                const locationStr = locationInfo ? ` (${locationInfo})` : '';

                errors.push({
                    type: 'Campo Requerido Faltante',
                    message: `${path}: Falta el campo requerido <${elemName}>`,
                    location: `${path}${locationStr}`
                });
            }
        }
    }

    // Validate existing elements
    for (const [elemName, elemDef] of Object.entries(typeElements)) {
        const childElements = element.querySelectorAll(`:scope > ${elemName}`);

        childElements.forEach((childElement, index) => {
            const childPath = `${path} > ${elemName}${childElements.length > 1 ? `[${index}]` : ''}`;
            const value = childElement.textContent.trim();

            // Skip validation for empty optional fields
            if (value === '') {
                if (elemDef.required) {
                    const locationInfo = xmlString ? findLocation(xmlString, elemName, '') : '';
                    const locationStr = locationInfo ? ` (${locationInfo})` : '';

                    errors.push({
                        type: 'Valor Requerido Faltante',
                        message: `${childPath}: El campo <${elemName}> es obligatorio y no puede estar vacío`,
                        location: `${childPath}${locationStr}`
                    });
                }
                return;
            }

            // Validate based on type
            if (elemDef.inlineType) {
                validateValue(value, elemDef.inlineType, errors, childPath, elemName, xmlString);
            } else if (elemDef.structure) {
                // Handle inline complex type structure
                // We need to validate the child element against this structure
                // The structure object has { elements: {}, attributes: {} }
                // We can create a temporary schema-like object or refactor validateAgainstComplexType

                // Let's create a temporary "complex type" definition from the structure
                // and call validateAgainstComplexType recursively with a fake name
                // OR better, refactor validateAgainstComplexType to accept a structure object directly.

                // For now, let's implement the validation logic for the structure here directly
                // This mimics validateAgainstComplexType but uses elemDef.structure

                const structure = elemDef.structure;

                // Check required elements in the inline structure
                for (const [subElemName, subElemDef] of Object.entries(structure.elements)) {
                    if (subElemDef.required) {
                        const subChildElement = childElement.querySelector(`:scope > ${subElemName}`);
                        if (!subChildElement) {
                            const locationInfo = xmlString ? findLocation(xmlString, childElement.tagName, '') : '';
                            const locationStr = locationInfo ? ` (${locationInfo})` : '';

                            errors.push({
                                type: 'Campo Requerido Faltante',
                                message: `${childPath}: Falta el campo requerido <${subElemName}>`,
                                location: `${childPath}${locationStr}`
                            });
                        }
                    }
                }

                // Validate existing elements in the inline structure
                for (const [subElemName, subElemDef] of Object.entries(structure.elements)) {
                    const subChildElements = childElement.querySelectorAll(`:scope > ${subElemName}`);

                    subChildElements.forEach((subChildElement, subIndex) => {
                        const subChildPath = `${childPath} > ${subElemName}${subChildElements.length > 1 ? `[${subIndex}]` : ''}`;
                        const subValue = subChildElement.textContent.trim();

                        // Check empty required
                        if (subValue === '') {
                            if (subElemDef.required) {
                                const locationInfo = xmlString ? findLocation(xmlString, subElemName, '') : '';
                                const locationStr = locationInfo ? ` (${locationInfo})` : '';

                                errors.push({
                                    type: 'Valor Requerido Faltante',
                                    message: `${subChildPath}: El campo <${subElemName}> es obligatorio y no puede estar vacío`,
                                    location: `${subChildPath}${locationStr}`
                                });
                            }
                            return;
                        }

                        // Validate type
                        if (subElemDef.type) {
                            const subSimpleType = schema.simpleTypes[subElemDef.type];
                            if (subSimpleType) {
                                validateValue(subValue, subSimpleType, errors, subChildPath, subElemName, xmlString);
                            } else if (subElemDef.type.startsWith('xs:')) {
                                validateValue(subValue, { baseType: subElemDef.type, restrictions: {} }, errors, subChildPath, subElemName, xmlString);
                            } else {
                                const subComplexType = schema.complexTypes[subElemDef.type];
                                if (subComplexType) {
                                    validateAgainstComplexType(subChildElement, subElemDef.type, schema, errors, subChildPath, xmlString);
                                }
                            }
                        }
                    });
                }

            } else if (elemDef.type) {
                const simpleType = schema.simpleTypes[elemDef.type];
                if (simpleType) {
                    validateValue(value, simpleType, errors, childPath, elemName, xmlString);
                } else if (elemDef.type.startsWith('xs:')) {
                    // Handle built-in XSD types
                    validateValue(value, { baseType: elemDef.type, restrictions: {} }, errors, childPath, elemName, xmlString);
                } else {
                    // It might be a complex type
                    const complexChildType = schema.complexTypes[elemDef.type];
                    if (complexChildType) {
                        validateAgainstComplexType(childElement, elemDef.type, schema, errors, childPath, xmlString);
                    }
                }
            }
        });
    }
}

/**
 * Validate a value against a simple type definition
 */
function validateValue(value, typeRules, errors, path, fieldName, xmlString = null) {
    const restrictions = typeRules.restrictions;
    const locationInfo = xmlString ? findLocation(xmlString, fieldName, value) : '';
    const locationStr = locationInfo ? ` (${locationInfo})` : '';

    // Validate base type first (integer, float, etc.)
    if (typeRules.baseType) {
        if (typeRules.baseType.includes('integer')) {
            // Strict integer check
            if (!/^-?\d+$/.test(value)) {
                errors.push({
                    type: 'Tipo de Dato Inválido',
                    message: `${path}: El valor debe ser un número entero válido`,
                    location: `Valor actual: ${value}${locationStr}`
                });
                return;
            }
        } else if (typeRules.baseType.includes('float') || typeRules.baseType.includes('double') || typeRules.baseType.includes('decimal')) {
            // Strict float check
            if (!/^-?\d*(\.\d+)?$/.test(value) || value === '' || value === '.') {
                errors.push({
                    type: 'Tipo de Dato Inválido',
                    message: `${path}: El valor debe ser un número decimal válido`,
                    location: `Valor actual: ${value}${locationStr}`
                });
                return;
            }
        }
    }

    // Validate enumeration
    if (restrictions.enum) {
        if (!restrictions.enum.includes(value)) {
            errors.push({
                type: 'Valor Inválido',
                message: `${path}: El valor debe ser uno de: ${restrictions.enum.join(', ')}`,
                location: `Valor actual: ${value}${locationStr}`
            });
        }
    }

    // Validate range for numeric types
    if (typeRules.baseType && (typeRules.baseType.includes('integer') || typeRules.baseType.includes('float') || typeRules.baseType.includes('double') || typeRules.baseType.includes('decimal'))) {
        const numValue = typeRules.baseType.includes('integer') ? parseInt(value) : parseFloat(value);

        if (restrictions.minInclusive !== undefined && numValue < restrictions.minInclusive) {
            errors.push({
                type: 'Valor Fuera de Rango',
                message: `${path}: El valor debe ser mayor o igual a ${restrictions.minInclusive}`,
                location: `Valor actual: ${value}${locationStr}`
            });
        }

        if (restrictions.maxInclusive !== undefined && numValue > restrictions.maxInclusive) {
            errors.push({
                type: 'Valor Fuera de Rango',
                message: `${path}: El valor debe ser menor o igual a ${restrictions.maxInclusive}`,
                location: `Valor actual: ${value}${locationStr}`
            });
        }
    }

    // Validate pattern
    if (restrictions.pattern) {
        const regex = new RegExp(restrictions.pattern);
        if (!regex.test(value)) {
            errors.push({
                type: 'Formato Inválido',
                message: `${path}: El valor no cumple con el formato esperado`,
                location: `Valor actual: ${value}, Patrón: ${restrictions.pattern}${locationStr}`
            });
        }
    }
}

/**
 * Helper to find line number
 */
function getLineNumber(xmlString, index) {
    if (index === -1 || !xmlString) return 'Desconocida';
    return xmlString.substring(0, index).split('\n').length;
}

/**
 * Helper to find location of a value or tag
 */
function findLocation(xmlString, tagName, value) {
    if (!xmlString) return '';

    let index = -1;
    if (value) {
        // Try to find >value<
        index = xmlString.indexOf(`>${value}<`);
    }

    // If not found or no value (empty tag), try to find the tag
    if (index === -1) {
        // This is a heuristic, it finds the first occurrence
        // Ideally we would pass the index down, but for now this helps
        index = xmlString.indexOf(`<${tagName}`);
    }

    if (index !== -1) {
        return `Línea ${getLineNumber(xmlString, index)}`;
    }
    return '';
}

// Export functions for use in validator.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseXSDSchema,
        validateAgainstComplexType,
        validateValue,
        getLineNumber // Exporting helper if needed
    };
}
