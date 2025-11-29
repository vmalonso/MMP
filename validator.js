// ================================================== 
// MMP Validator - Main JavaScript
// ================================================== 

// XSD Schema will be loaded from external file
// Note: When using file:// protocol, we need to load XSD differently
let XSD_SCHEMA = null;
let PARSED_SCHEMA = null;

// Load XSD Schema on initialization
async function loadXSDSchema() {
  try {
    // Try to fetch the XSD file
    const response = await fetch('mmp.xsd');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    XSD_SCHEMA = await response.text();
    console.log('✓ XSD Schema cargado exitosamente:', XSD_SCHEMA.length, 'caracteres');

    // Parse the XSD schema
    try {
      PARSED_SCHEMA = parseXSDSchema(XSD_SCHEMA);
      console.log('✓ XSD Schema parseado exitosamente');
      console.log('  - Tipos simples:', Object.keys(PARSED_SCHEMA.simpleTypes).length);
      console.log('  - Tipos complejos:', Object.keys(PARSED_SCHEMA.complexTypes).length);
    } catch (parseError) {
      console.error('Error parseando XSD:', parseError);
      alert('Error al parsear el esquema XSD. Revisa la consola para más detalles.');
    }
  } catch (error) {
    console.error('Error cargando XSD con fetch:', error);
    console.log('Intentando método alternativo...');

    // Fallback: Try XMLHttpRequest which works better with file:// protocol
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'mmp.xsd', false); // Synchronous request
      xhr.send();

      if (xhr.status === 200 || xhr.status === 0) { // 0 is for file:// protocol
        XSD_SCHEMA = xhr.responseText;
        console.log('✓ XSD Schema cargado exitosamente (método alternativo):', XSD_SCHEMA.length, 'caracteres');

        // Parse the XSD schema
        try {
          PARSED_SCHEMA = parseXSDSchema(XSD_SCHEMA);
          console.log('✓ XSD Schema parseado exitosamente');
          console.log('  - Tipos simples:', Object.keys(PARSED_SCHEMA.simpleTypes).length);
          console.log('  - Tipos complejos:', Object.keys(PARSED_SCHEMA.complexTypes).length);
        } catch (parseError) {
          console.error('Error parseando XSD:', parseError);
          alert('Error al parsear el esquema XSD. Revisa la consola para más detalles.');
        }
      } else {
        throw new Error(`No se pudo cargar el archivo: ${xhr.status}`);
      }
    } catch (xhrError) {
      console.error('Error con XMLHttpRequest:', xhrError);
      alert('Error: No se pudo cargar el esquema XSD (mmp.xsd).\n\nAsegúrate de que:\n1. El archivo mmp.xsd existe en el mismo directorio\n2. Estás abriendo index.html desde un servidor web local\n\nPara desarrollo local, usa un servidor como:\n- python -m http.server 8000\n- npx serve\n- Live Server (extensión de VS Code)');
    }
  }
}

// Initialize schema on page load
loadXSDSchema();

// ================================================== 
// DOM Elements
// ================================================== 

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const selectFileBtn = document.getElementById('selectFileBtn');
const fileListContainer = document.getElementById('fileListContainer');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const clearAllBtn = document.getElementById('clearAllBtn');
const validateBtn = document.getElementById('validateBtn');
const resultsSection = document.getElementById('resultsSection');
const statusIcon = document.getElementById('statusIcon');
const resultsTitle = document.getElementById('resultsTitle');
const resultsSubtitle = document.getElementById('resultsSubtitle');
const resultsBody = document.getElementById('resultsBody');
const resetBtn = document.getElementById('resetBtn');

// Store multiple files with their validation status
let files = [];

// ================================================== 
// Event Listeners
// ================================================== 

// Click to select file (only the button triggers the file dialog)
selectFileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

// File input change
fileInput.addEventListener('change', handleFileSelect);

// Drag and drop (Global)
document.addEventListener('dragover', handleDragOver);
document.addEventListener('dragleave', handleDragLeave);
document.addEventListener('drop', handleDrop);

// Clear all files
clearAllBtn.addEventListener('click', clearAllFiles);

// Validate
validateBtn.addEventListener('click', validateFile);

// Reset
if (resetBtn) {
  resetBtn.addEventListener('click', clearAllFiles);
}

// ================================================== 
// File Handling Functions
// ================================================== 

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add('drag-over');
  // Visual feedback for global drag
  if (dropZone.style.display === 'none') {
    document.body.classList.add('dragging-file');
  }
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();

  // Only remove if we're leaving the window or the dropzone
  if (e.relatedTarget === null || e.target === dropZone) {
    dropZone.classList.remove('drag-over');
    document.body.classList.remove('dragging-file');
  }
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('drag-over');
  document.body.classList.remove('dragging-file');

  const droppedFiles = e.dataTransfer.files;
  if (droppedFiles.length > 0) {
    addFiles(droppedFiles);
  }
}

function handleFileSelect(e) {
  const selectedFiles = e.target.files;
  if (selectedFiles.length > 0) {
    addFiles(selectedFiles);
  }
}

function addFiles(newFiles) {
  const validExtensions = ['.mmp', '.xml'];
  let invalidCount = 0;

  for (const file of newFiles) {
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      invalidCount++;
      continue;
    }

    // Check if file already exists (by name and size)
    const exists = files.some(f => f.file.name === file.name && f.file.size === file.size);
    if (!exists) {
      files.push({
        file: file,
        status: 'pending', // pending, validating, valid, invalid
        errors: []
      });
    }
  }

  if (invalidCount > 0) {
    alert(`${invalidCount} archivo(s) ignorado(s). Solo se aceptan archivos .mmp o .xml`);
  }

  updateFileListUI();
}

function removeFile(index) {
  files.splice(index, 1);
  updateFileListUI();
}

function clearAllFiles() {
  files = [];
  fileInput.value = '';
  updateFileListUI();
}

function updateFileListUI() {
  if (files.length === 0) {
    dropZone.style.display = 'block';
    fileListContainer.style.display = 'none';
    resultsSection.style.display = 'none';
    return;
  }

  dropZone.style.display = 'none';
  fileListContainer.style.display = 'block';

  // Update file count
  fileCount.textContent = `${files.length} archivo${files.length !== 1 ? 's' : ''} seleccionado${files.length !== 1 ? 's' : ''}`;

  // Render file list
  fileList.innerHTML = files.map((item, index) => `
    <div class="file-item" data-index="${index}">
      <svg class="file-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V9L13 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M13 2V9H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div class="file-details ${item.status === 'invalid' ? 'clickable' : ''}" onclick="${item.status === 'invalid' ? `scrollToFileErrors(${index})` : ''}">
        <h4>${escapeHtml(item.file.name)}</h4>
        <span>${formatFileSize(item.file.size)}</span>
      </div>
      <span class="file-status ${item.status}">${getStatusText(item.status)}</span>
      <button class="btn-remove-file" onclick="removeFile(${index})">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  `).join('');
}

function getStatusText(status) {
  switch (status) {
    case 'pending': return 'Pendiente';
    case 'validating': return 'Validando...';
    case 'valid': return '✓ Válido';
    case 'invalid': return '✗ Inválido';
    default: return status;
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function scrollToFileErrors(fileIndex) {
  const errorSection = document.getElementById(`file-errors-${fileIndex}`);
  if (errorSection) {
    errorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Highlight briefly
    errorSection.classList.add('highlight');
    setTimeout(() => errorSection.classList.remove('highlight'), 1500);
  }
}

// ================================================== 
// Validation Functions
// ================================================== 

async function validateFile() {
  if (files.length === 0) return;

  // Check if XSD schema is loaded
  if (!XSD_SCHEMA) {
    alert('El esquema XSD aún no se ha cargado. Por favor, espera un momento e intenta de nuevo.');
    return;
  }

  // Show loading state
  showLoadingResults();

  // Validate all files
  for (let i = 0; i < files.length; i++) {
    files[i].status = 'validating';
    updateFileListUI();

    try {
      const xmlContent = await readFileAsText(files[i].file);
      const errors = validateXMLAgainstSchema(xmlContent);

      files[i].errors = errors;
      files[i].status = errors.length === 0 ? 'valid' : 'invalid';
    } catch (error) {
      files[i].errors = [{
        type: 'Error de Lectura',
        message: error.message,
        location: null
      }];
      files[i].status = 'invalid';
    }

    updateFileListUI();
  }

  // Show combined results
  showCombinedResults();
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Error al leer el archivo'));
    reader.readAsText(file);
  });
}

function validateXMLAgainstSchema(xmlString) {
  const errors = [];

  try {
    // First, perform strict well-formedness check
    const wellFormednessErrors = checkXMLWellFormedness(xmlString);
    if (wellFormednessErrors.length > 0) {
      errors.push(...wellFormednessErrors);
      return errors;
    }

    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      errors.push({
        type: 'Error de Sintaxis XML',
        message: 'El documento XML no está bien formado',
        location: parserError.textContent
      });
      return errors;
    }

    // Validate structure
    const validationErrors = validateStructure(xmlDoc, xmlString);
    errors.push(...validationErrors);

  } catch (error) {
    errors.push({
      type: 'Error de Validación',
      message: error.message,
      location: null
    });
  }

  return errors;
}

/**
 * Perform strict well-formedness check on XML string
 * This catches errors that DOMParser might silently fix
 */
function checkXMLWellFormedness(xmlString) {
  const errors = [];

  // Remove comments and CDATA sections for tag matching
  let cleanXml = xmlString
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ''); // Remove CDATA

  // Extract all tags (opening and closing)
  const tagRegex = /<\/?([a-zA-Z_][\w.-]*)[^>]*>/g;
  const stack = [];
  const tagPositions = [];
  let match;

  while ((match = tagRegex.exec(cleanXml)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    const position = match.index;

    console.log(`Tag found: ${fullTag}, Name: ${tagName}, Position: ${position}`);

    // Skip self-closing tags and XML declaration
    if (fullTag.startsWith('<?') || fullTag.endsWith('/>')) {
      continue;
    }

    // Check if it's a closing tag
    if (fullTag.startsWith('</')) {
      if (stack.length === 0) {
        errors.push({
          type: 'Error de Estructura XML',
          message: `Etiqueta de cierre sin apertura: </${tagName}>`,
          location: `Posición: ${position}`
        });
      } else {
        const lastOpened = stack.pop();
        if (lastOpened.name !== tagName) {
          errors.push({
            type: 'Error de Estructura XML',
            message: `Etiquetas no coinciden: se esperaba </${lastOpened.name}> pero se encontró </${tagName}>`,
            location: `Línea aproximada: ${getLineNumber(xmlString, position)}`
          });
        }
      }
    } else {
      // Opening tag
      stack.push({ name: tagName, position: position });
    }
  }

  // Check for unclosed tags
  if (stack.length > 0) {
    stack.forEach(tag => {
      errors.push({
        type: 'Error de Estructura XML',
        message: `Etiqueta sin cerrar: <${tag.name}>`,
        location: `Línea aproximada: ${getLineNumber(xmlString, tag.position)}`
      });
    });
  }

  return errors;
}

/**
 * Get approximate line number from string position
 */
function getLineNumber(text, position) {
  return text.substring(0, position).split('\n').length;
}

function validateStructure(xmlDoc, xmlString) {
  const errors = [];

  if (!PARSED_SCHEMA) {
    errors.push({
      type: 'Error del Sistema',
      message: 'El esquema XSD no ha sido parseado correctamente',
      location: null
    });
    return errors;
  }

  // Check root element
  const root = xmlDoc.documentElement;
  const expectedRoot = PARSED_SCHEMA.rootElement ? PARSED_SCHEMA.rootElement.name : 'POLYGONS';

  if (root.nodeName !== expectedRoot) {
    errors.push({
      type: 'Error de Estructura',
      message: `El elemento raíz debe ser <${expectedRoot}>`,
      location: `Encontrado: <${root.nodeName}>`
    });
    return errors;
  }

  // Validate root element structure using dynamic validation
  validateElementDynamic(root, expectedRoot, PARSED_SCHEMA, errors, expectedRoot, xmlString);

  // Check for unknown elements
  validateNoUnknownElements(root, PARSED_SCHEMA, errors);

  return errors;
}

/**
 * Validate that there are no unknown elements in the document
 */
function validateNoUnknownElements(root, schema, errors) {
  // Get all known element names from the schema
  const knownElements = new Set();
  
  // Add root element
  if (schema.rootElement) {
    knownElements.add(schema.rootElement.name);
    collectKnownElements(schema.rootElement.structure, knownElements);
  }
  
  // Add elements from complex types
  for (const [typeName, typeDef] of Object.entries(schema.complexTypes)) {
    for (const elemName of Object.keys(typeDef.elements)) {
      knownElements.add(elemName);
      // Check if element has inline structure
      if (typeDef.elements[elemName].structure) {
        collectKnownElements(typeDef.elements[elemName].structure, knownElements);
      }
    }
  }
  
  // Check all elements in the document
  const allElements = root.querySelectorAll('*');
  allElements.forEach(element => {
    const tagName = element.tagName;
    if (!knownElements.has(tagName)) {
      errors.push({
        type: 'Elemento Desconocido',
        message: `El elemento <${tagName}> no está definido en el esquema`,
        location: getElementPath(element)
      });
    }
  });
}

/**
 * Recursively collect known element names from a structure
 */
function collectKnownElements(structure, knownElements) {
  if (!structure || !structure.elements) return;
  
  for (const [elemName, elemDef] of Object.entries(structure.elements)) {
    knownElements.add(elemName);
    if (elemDef.structure) {
      collectKnownElements(elemDef.structure, knownElements);
    }
  }
}

/**
 * Get the path to an element for error reporting
 */
function getElementPath(element) {
  const path = [];
  let current = element;
  while (current && current.tagName) {
    path.unshift(current.tagName);
    current = current.parentElement;
  }
  return path.join(' > ');
}


/**
 * Dynamically validate an XML element based on parsed XSD schema
 */
function validateElementDynamic(element, elementName, schema, errors, path = '', xmlString = null) {
  // Find the complex type for this element
  let complexTypeName = null;

  // Check if it's the root element
  if (schema.rootElement && elementName === schema.rootElement.name) {
    // Validate root structure inline
    const rootStructure = schema.rootElement.structure;

    // Validate child elements based on root structure
    for (const [childName, childDef] of Object.entries(rootStructure.elements)) {
      const childElements = element.querySelectorAll(`:scope > ${childName}`);

      // Check if required element is missing
      if (childDef.required && childElements.length === 0) {
        // Try to find approximate location of parent
        // Since we are at root, we can just search for the child tag that is missing?
        // No, we want the location where it SHOULD be, which is inside the root.
        // We can search for the root tag.
        let locationStr = '';
        if (xmlString && typeof findLocation === 'function') {
          // We need to access findLocation from xsd-parser.js scope? 
          // It's not exported globally but we are in validator.js which uses xsd-parser.js functions.
          // Wait, findLocation is NOT exported globally in xsd-parser.js unless we attach it to window or export it.
          // In browser environment, if xsd-parser.js is loaded before, its functions might be global?
          // No, xsd-parser.js defines functions globally (not in a module/closure) in the browser.
          // Let's assume findLocation is available globally like parseXSDSchema.
          const loc = findLocation(xmlString, elementName, '');
          if (loc) locationStr = ` (${loc})`;
        }

        errors.push({
          type: 'Campo Requerido Faltante',
          message: `${path}: Falta el elemento requerido <${childName}>`,
          location: `${path}${locationStr}`
        });
      }

      // Validate each occurrence of the child element
      childElements.forEach((childElement, index) => {
        const childPath = `${path} > ${childName}${childElements.length > 1 ? `[${index}]` : ''}`;

        // Check for inline structure (like GROUPS which contains GROUP elements)
        console.log(`Validating child: ${childName}, has structure: ${!!childDef.structure}, has inlineType: ${!!childDef.inlineType}, has type: ${childDef.type}`);
        if (childDef.structure) {
          console.log(`  -> Entering inline structure for ${childName}`, childDef.structure);
          // Validate elements within the inline structure
          validateInlineStructure(childElement, childDef.structure, schema, errors, childPath, xmlString);
        } else if (childDef.inlineType) {
          const value = childElement.textContent.trim();

          // Check for empty required fields
          if (value === '') {
            if (childDef.required) {
              let locationStr = '';
              if (xmlString && typeof findLocation === 'function') {
                const loc = findLocation(xmlString, childName, '');
                if (loc) locationStr = ` (${loc})`;
              }

              errors.push({
                type: 'Valor Requerido Faltante',
                message: `${childPath}: El campo <${childName}> es obligatorio y no puede estar vacío`,
                location: `${childPath}${locationStr}`
              });
            }
            return;
          }

          validateValue(value, childDef.inlineType, errors, childPath, childName, xmlString);
        } else if (childDef.type) {
          const value = childElement.textContent.trim();

          // Check for empty required fields
          if (value === '') {
            if (childDef.required) {
              let locationStr = '';
              if (xmlString && typeof findLocation === 'function') {
                const loc = findLocation(xmlString, childName, '');
                if (loc) locationStr = ` (${loc})`;
              }

              errors.push({
                type: 'Valor Requerido Faltante',
                message: `${childPath}: El campo <${childName}> es obligatorio y no puede estar vacío`,
                location: `${childPath}${locationStr}`
              });
            }
            // If it's empty (whether required or not), we can't validate it further against types
            return;
          }

          // Check if it's a simple type
          const simpleType = schema.simpleTypes[childDef.type];
          if (simpleType) {
            // Skip validation for empty optional fields
            if (value !== '' || childDef.required) {
              validateValue(value, simpleType, errors, childPath, childName, xmlString);
            }
          } else if (childDef.type && childDef.type.startsWith('xs:')) {
            // Handle built-in XSD types
            if (value !== '' || childDef.required) {
              validateValue(value, { baseType: childDef.type, restrictions: {} }, errors, childPath, childName, xmlString);
            }
          } else if (schema.complexTypes[childDef.type]) {
            // It's a complex type
            validateAgainstComplexType(childElement, childDef.type, schema, errors, childPath, xmlString);
          }
        }
      });
    }

    return;
  }

  // For other elements, try to find their complex type
  complexTypeName = findComplexTypeForElement(elementName, schema);

  if (complexTypeName) {
    validateAgainstComplexType(element, complexTypeName, schema, errors, path, xmlString);
  }
}

/**
 * Validate elements within an inline structure (like GROUPS containing GROUP elements)
 */
function validateInlineStructure(element, structure, schema, errors, path, xmlString) {
  console.log(`validateInlineStructure called for ${element.tagName}, structure:`, structure);
  // Check required elements in the inline structure
  for (const [elemName, elemDef] of Object.entries(structure.elements)) {
    if (elemDef.required) {
      const childElement = element.querySelector(`:scope > ${elemName}`);
      if (!childElement) {
        let locationStr = '';
        if (xmlString && typeof findLocation === 'function') {
          const loc = findLocation(xmlString, element.tagName, '');
          if (loc) locationStr = ` (${loc})`;
        }

        errors.push({
          type: 'Campo Requerido Faltante',
          message: `${path}: Falta el campo requerido <${elemName}>`,
          location: `${path}${locationStr}`
        });
      }
    }
  }

  // Validate existing elements in the inline structure
  for (const [elemName, elemDef] of Object.entries(structure.elements)) {
    const childElements = element.querySelectorAll(`:scope > ${elemName}`);

    childElements.forEach((childElement, index) => {
      const childPath = `${path} > ${elemName}${childElements.length > 1 ? `[${index + 1}]` : ''}`;
      const value = childElement.textContent.trim();

      // Check empty required
      if (value === '' && !elemDef.type) {
        if (elemDef.required) {
          let locationStr = '';
          if (xmlString && typeof findLocation === 'function') {
            const loc = findLocation(xmlString, elemName, '');
            if (loc) locationStr = ` (${loc})`;
          }

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
      } else if (elemDef.type) {
        const simpleType = schema.simpleTypes[elemDef.type];
        if (simpleType) {
          validateValue(value, simpleType, errors, childPath, elemName, xmlString);
        } else if (elemDef.type.startsWith('xs:')) {
          validateValue(value, { baseType: elemDef.type, restrictions: {} }, errors, childPath, elemName, xmlString);
        } else {
          // It's a complex type - validate recursively
          const complexType = schema.complexTypes[elemDef.type];
          if (complexType) {
            validateAgainstComplexType(childElement, elemDef.type, schema, errors, childPath, xmlString);
          }
        }
      }
    });
  }
}

/**
 * Find the complex type name for a given element
 */
function findComplexTypeForElement(elementName, schema) {
  // Common mappings based on mmp.xsd
  const typeMap = {
    'GROUP': 'GroupType',
    'POLYGON': 'PolygonType',
    'SPOT': 'SpotType',
    'IMAGELAYER': 'ImageLayerType',
    'POINT': 'PointType',
    'PICTURE': 'PictureType',
    'GRID': 'GridType',
    'DESCPOINT': 'PointDescType',
    'DESCSPOT': 'SpotDescType'
  };

  return typeMap[elementName] || null;
}

// ================================================== 
// Helper Functions
// ================================================== 

function getElementText(parent, tagName) {
  const element = parent.querySelector(`:scope > ${tagName}`);
  if (!element) return null;
  // Empty elements like <DESCRIPTION/> are valid and should return empty string
  return element.textContent.trim();
}

function elementExists(parent, tagName) {
  return parent.querySelector(`:scope > ${tagName}`) !== null;
}

function isBinaryFlag(value) {
  // Empty string is not valid for binary flag
  if (value === '') return false;
  return value === '0' || value === '1';
}

function isInRange(value, min, max) {
  if (value === '') return false;
  const num = parseInt(value, 10);
  return !isNaN(num) && num >= min && num <= max;
}

function isInFloatRange(value, min, max) {
  if (value === '') return false;
  const num = parseFloat(value);
  return !isNaN(num) && num >= min && num <= max;
}

function isValidFloat(value) {
  return !isNaN(parseFloat(value));
}

function isValidHexColor(value) {
  return /^(#?[a-fA-F0-9]{6})$/.test(value);
}

// ================================================== 
// UI Update Functions
// ================================================== 

function showLoadingResults() {
  resultsSection.style.display = 'block';
  statusIcon.innerHTML = '<div class="loading"></div>';
  resultsTitle.textContent = 'Validando...';
  resultsSubtitle.textContent = `Procesando ${files.length} archivo${files.length !== 1 ? 's' : ''}`;
  resultsBody.innerHTML = '';

  // Scroll to results
  setTimeout(() => {
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function showCombinedResults() {
  const validFiles = files.filter(f => f.status === 'valid');
  const invalidFiles = files.filter(f => f.status === 'invalid');
  const totalErrors = invalidFiles.reduce((sum, f) => sum + f.errors.length, 0);

  if (invalidFiles.length === 0) {
    // All files valid
    statusIcon.className = 'status-icon success';
    statusIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    resultsTitle.textContent = '¡Validación Exitosa!';
    resultsSubtitle.textContent = `${validFiles.length} archivo${validFiles.length !== 1 ? 's' : ''} válido${validFiles.length !== 1 ? 's' : ''}`;
    resultsBody.innerHTML = `
      <div class="success-message">
        <p style="margin: 0; font-size: 1rem;">
          ✓ Todos los archivos son válidos y cumplen con las especificaciones del esquema XSD.
        </p>
      </div>
    `;
  } else {
    // Some or all files have errors
    statusIcon.className = 'status-icon error';
    statusIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 9V11M12 15H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    resultsTitle.textContent = 'Errores de Validación';
    resultsSubtitle.textContent = `${invalidFiles.length} archivo${invalidFiles.length !== 1 ? 's' : ''} con errores, ${validFiles.length} válido${validFiles.length !== 1 ? 's' : ''}`;

    // Build results HTML grouped by file
    let resultsHtml = '<div class="error-list">';
    
    for (const fileItem of invalidFiles) {
      // Find the original index in the files array
      const originalIndex = files.indexOf(fileItem);
      resultsHtml += `
        <div class="file-errors" id="file-errors-${originalIndex}">
          <div class="file-errors-header">
            <strong>${escapeHtml(fileItem.file.name)}</strong>
            <span class="error-count">${fileItem.errors.length} error${fileItem.errors.length !== 1 ? 'es' : ''}</span>
          </div>
          ${fileItem.errors.map(error => `
            <div class="error-item">
              <div class="error-item-header">
                <svg class="error-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div class="error-title">${escapeHtml(error.type)}</div>
              </div>
              <div class="error-message">${escapeHtml(error.message)}</div>
              ${error.location ? `<div class="error-location">${escapeHtml(error.location)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }
    
    resultsHtml += '</div>';
    resultsBody.innerHTML = resultsHtml;
  }
}

/**
 * Escape HTML special characters to prevent XSS and rendering issues
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ================================================== 
// Initialize
// ================================================== 

console.log('MMP Validator initialized');
if (XSD_SCHEMA) {
  console.log('XSD Schema loaded:', XSD_SCHEMA.length, 'characters');
} else {
  console.log('XSD Schema loading...');
}
