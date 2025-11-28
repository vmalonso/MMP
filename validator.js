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
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFileBtn');
const validateBtn = document.getElementById('validateBtn');
const resultsSection = document.getElementById('resultsSection');
const statusIcon = document.getElementById('statusIcon');
const resultsTitle = document.getElementById('resultsTitle');
const resultsSubtitle = document.getElementById('resultsSubtitle');
const resultsBody = document.getElementById('resultsBody');
const resetBtn = document.getElementById('resetBtn');

let currentFile = null;

// ================================================== 
// Event Listeners
// ================================================== 

// Click to select file
selectFileBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', () => fileInput.click());

// File input change
fileInput.addEventListener('change', handleFileSelect);

// Drag and drop (Global)
document.addEventListener('dragover', handleDragOver);
document.addEventListener('dragleave', handleDragLeave);
document.addEventListener('drop', handleDrop);

// Remove file
removeFileBtn.addEventListener('click', clearFile);

// Validate
validateBtn.addEventListener('click', validateFile);

// Reset
if (resetBtn) {
  resetBtn.addEventListener('click', clearFile);
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

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
}

function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
}

function processFile(file) {
  // Check file extension
  const validExtensions = ['.mmp', '.xml'];
  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

  if (!validExtensions.includes(fileExtension)) {
    alert('Por favor, selecciona un archivo .mmp o .xml válido');
    return;
  }

  currentFile = file;

  // Update UI
  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);

  // Show file info, hide upload card
  dropZone.style.display = 'none';
  fileInfo.style.display = 'block';
  resultsSection.style.display = 'none';
}

function clearFile() {
  currentFile = null;
  fileInput.value = '';

  // Reset UI
  dropZone.style.display = 'block';
  fileInfo.style.display = 'none';
  resultsSection.style.display = 'none';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ================================================== 
// Validation Functions
// ================================================== 

async function validateFile() {
  if (!currentFile) return;

  // Check if XSD schema is loaded
  if (!XSD_SCHEMA) {
    alert('El esquema XSD aún no se ha cargado. Por favor, espera un momento e intenta de nuevo.');
    return;
  }

  // Show loading state
  showLoadingResults();

  try {
    const xmlContent = await readFileAsText(currentFile);
    const errors = validateXMLAgainstSchema(xmlContent);

    if (errors.length === 0) {
      showSuccessResults();
    } else {
      showErrorResults(errors);
    }
  } catch (error) {
    showErrorResults([{
      type: 'Error de Lectura',
      message: error.message,
      location: null
    }]);
  }
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
    const validationErrors = validateStructure(xmlDoc);
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

function validateStructure(xmlDoc) {
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
  validateElementDynamic(root, expectedRoot, PARSED_SCHEMA, errors, expectedRoot);

  return errors;
}

/**
 * Dynamically validate an XML element based on parsed XSD schema
 */
function validateElementDynamic(element, elementName, schema, errors, path = '') {
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
        errors.push({
          type: 'Campo Requerido Faltante',
          message: `${path}: Falta el elemento requerido <${childName}>`,
          location: path
        });
      }

      // Validate each occurrence of the child element
      childElements.forEach((childElement, index) => {
        const childPath = `${path} > ${childName}${childElements.length > 1 ? `[${index}]` : ''}`;

        // Check for inline type first (like LINECOLOR, AREACOLOR with inline restrictions)
        if (childDef.inlineType) {
          const value = childElement.textContent.trim();

          // Check for empty required fields
          if (value === '') {
            if (childDef.required) {
              errors.push({
                type: 'Valor Requerido Faltante',
                message: `${childPath}: El campo <${childName}> es obligatorio y no puede estar vacío`,
                location: childPath
              });
            }
            return;
          }

          validateValue(value, childDef.inlineType, errors, childPath, childName);
        } else if (childDef.type) {
          const value = childElement.textContent.trim();

          // Check for empty required fields
          if (value === '') {
            if (childDef.required) {
              errors.push({
                type: 'Valor Requerido Faltante',
                message: `${childPath}: El campo <${childName}> es obligatorio y no puede estar vacío`,
                location: childPath
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
              validateValue(value, simpleType, errors, childPath, childName);
            }
          } else if (schema.complexTypes[childDef.type]) {
            // It's a complex type
            validateAgainstComplexType(childElement, childDef.type, schema, errors, childPath);
          }
        }
      });
    }

    return;
  }

  // For other elements, try to find their complex type
  complexTypeName = findComplexTypeForElement(elementName, schema);

  if (complexTypeName) {
    validateAgainstComplexType(element, complexTypeName, schema, errors, path);
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
  resultsSubtitle.textContent = 'Procesando el documento';
  resultsBody.innerHTML = '';

  // Scroll to results
  setTimeout(() => {
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function showSuccessResults() {
  statusIcon.className = 'status-icon success';
  statusIcon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
  resultsTitle.textContent = '¡Validación Exitosa!';
  resultsSubtitle.textContent = 'El documento cumple con el esquema MMP';
  resultsBody.innerHTML = `
        <div class="success-message">
            <p style="margin: 0; font-size: 1rem;">
                ✓ El archivo <strong>${currentFile.name}</strong> es válido y cumple con todas las especificaciones del esquema XSD.
            </p>
        </div>
    `;
}

function showErrorResults(errors) {
  statusIcon.className = 'status-icon error';
  statusIcon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 9V11M12 15H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
  resultsTitle.textContent = 'Errores de Validación';
  resultsSubtitle.textContent = `Se encontraron ${errors.length} problemas en el documento`;

  resultsBody.innerHTML = `
        <div class="error-list">
            ${errors.map(error => `
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
