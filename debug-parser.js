// Test script para depurar el parser
console.log('=== INICIANDO TEST DE PARSER ===');

// Simular carga del XSD
fetch('mmp.xsd')
    .then(response => response.text())
    .then(xsdText => {
        console.log('XSD cargado, parseando...');
        const schema = parseXSDSchema(xsdText);

        console.log('\n=== SCHEMA PARSEADO ===');
        console.log('Complex Types:', Object.keys(schema.complexTypes));

        // Verificar PolygonType
        if (schema.complexTypes.PolygonType) {
            console.log('\n=== PolygonType Elements ===');
            const polygonElements = schema.complexTypes.PolygonType.elements;

            // Verificar LINECOLOR específicamente
            if (polygonElements.LINECOLOR) {
                console.log('LINECOLOR encontrado:');
                console.log('  - type:', polygonElements.LINECOLOR.type);
                console.log('  - inlineType:', polygonElements.LINECOLOR.inlineType);

                if (polygonElements.LINECOLOR.inlineType) {
                    console.log('  - baseType:', polygonElements.LINECOLOR.inlineType.baseType);
                    console.log('  - restrictions:', polygonElements.LINECOLOR.inlineType.restrictions);
                } else {
                    console.error('❌ ERROR: LINECOLOR no tiene inlineType!');
                }
            } else {
                console.error('❌ ERROR: LINECOLOR no encontrado en PolygonType!');
            }

            // Listar todos los elementos con inlineType
            console.log('\n=== Elementos con inlineType en PolygonType ===');
            Object.entries(polygonElements).forEach(([name, def]) => {
                if (def.inlineType) {
                    console.log(`✓ ${name}:`, def.inlineType.restrictions);
                }
            });
        } else {
            console.error('❌ ERROR: PolygonType no encontrado!');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
