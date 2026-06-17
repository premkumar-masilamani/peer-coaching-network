import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const FIREBASE_SERVICE_PATH = path.join(ROOT_DIR, 'src/services/firebaseService.ts');
const CALENDAR_SERVICE_PATH = path.join(ROOT_DIR, 'src/services/googleCalendar.ts');
const OUTPUT_PATH = path.join(ROOT_DIR, 'docs/schema-erd.md');

/**
 * Maps a TypeScript type signature to a simple, Mermaid-friendly primitive type.
 */
function mapType(tsType) {
  let type = tsType.trim();

  // 1. Map arrays (e.g. type[] or (options)[])
  if (type.endsWith('[]')) {
    if (type.includes('attendees') || type.includes('email')) {
      return 'attendee_array';
    }
    return 'string_array';
  }

  // 2. Remove optional union suffixes like ' | null' or ' | undefined'
  if (type.includes('|')) {
    const parts = type.split('|').map(p => p.trim());
    const filtered = parts.filter(p => p !== 'null' && p !== 'undefined');
    
    const isLiteralUnion = filtered.every(p => (p.startsWith("'") && p.endsWith("'")) || (p.startsWith('"') && p.endsWith('"')));
    if (isLiteralUnion) {
      return 'string';
    }
    
    if (filtered.length === 1) {
      type = filtered[0];
    } else {
      type = filtered[0];
    }
  }

  // 3. Map inline structures (e.g. { dateTime: string })
  if (type.startsWith('{') && type.endsWith('}')) {
    if (type.includes('dateTime')) {
      return 'string';
    }
    return 'object';
  }

  // 4. Map single string literals to string
  if ((type.startsWith("'") && type.endsWith("'")) || (type.startsWith('"') && type.endsWith('"'))) {
    return 'string';
  }

  // Standard primitives
  if (type === 'Timestamp') return 'Timestamp';
  if (type === 'boolean') return 'boolean';
  if (type === 'string') return 'string';
  if (type === 'number') return 'number';

  return type;
}

/**
 * Searches the files to find the declaration of a variable and attempts to extract its type.
 */
function findVariableType(filesContent, varName) {
  // Try to find declaration with character-by-character parsing to support complex types with semicolons (e.g. inline objects)
  const regex = new RegExp(`\\b${varName}\\??\\s*:\\s*`, 'g');
  for (const content of filesContent) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      let index = match.index + match[0].length;
      let braceCount = 0;
      let bracketCount = 0;
      let parenCount = 0;
      let typeStr = '';
      
      while (index < content.length) {
        const char = content[index];
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
        else if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
        
        // If we exit the nesting level we started in, stop immediately
        if (braceCount < 0 || bracketCount < 0 || parenCount < 0) {
          break;
        }
        
        // Stop on semicolon, comma, equals, or newline, but only at top level (balance === 0)
        if (braceCount === 0 && bracketCount === 0 && parenCount === 0) {
          if (char === ';' || char === '=' || char === ',' || char === '\n') {
            break;
          }
        }
        
        typeStr += char;
        index++;
      }
      
      const cleaned = typeStr.trim();
      if (cleaned) {
        return cleaned;
      }
    }
  }

  // Heuristics based on variable name suffixes
  const nameLower = varName.toLowerCase();
  if (nameLower.endsWith('uid') || nameLower.endsWith('id') || nameLower.endsWith('email') || 
      nameLower.endsWith('name') || nameLower.endsWith('link') || nameLower.endsWith('iso') || 
      nameLower.endsWith('url') || nameLower.endsWith('topic') || nameLower.endsWith('summary') || 
      nameLower.endsWith('description') || nameLower.endsWith('timezone') || nameLower.endsWith('country') ||
      nameLower.endsWith('gender') || nameLower.endsWith('bio') || nameLower.endsWith('theme') ||
      nameLower.endsWith('role') || nameLower.endsWith('status')) {
    return 'string';
  }
  if (nameLower.endsWith('synced') || nameLower.endsWith('enabled')) {
    return 'boolean';
  }
  if (nameLower.endsWith('slots') || nameLower.endsWith('dates') || nameLower.endsWith('qualifications')) {
    return 'string_array';
  }
  if (nameLower.endsWith('createdat') || nameLower.endsWith('cancelledat') || nameLower.endsWith('start') || nameLower.endsWith('end')) {
    return 'Timestamp';
  }

  return 'string'; // Default fallback
}

/**
 * Parses a TS interface block from the files.
 */
function parseInterfaceFromFiles(filesContent, interfaceName) {
  // Sanitize interfaceName to prevent Regex errors and ensure it's a valid identifier
  const safeName = interfaceName.replace(/[^a-zA-Z0-9_]/g, '').trim();
  if (!safeName) return null;

  const regex = new RegExp(`export\\s+interface\\s+${safeName}\\s*\\{([^}]*)\\}`, 's');
  for (const content of filesContent) {
    const match = content.match(regex);
    if (match) {
      const body = match[1];
      const fields = [];
      const lines = body.split('\n');
      const propRegex = /^\s*(\w+)(\??)\s*:\s*([^;]+);?/;
      for (const line of lines) {
        const m = line.match(propRegex);
        if (m) {
          fields.push({
            name: m[1],
            type: mapType(m[3])
          });
        }
      }
      return fields;
    }
  }
  return null;
}

/**
 * Splits an object literal string by commas at the top nesting level.
 */
function splitByTopLevelCommas(str) {
  const parts = [];
  let current = '';
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '{') braceDepth++;
    else if (char === '}') braceDepth--;
    else if (char === '[') bracketDepth++;
    else if (char === ']') bracketDepth--;
    else if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;
    
    const depth = braceDepth + bracketDepth + parenDepth;
    
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

/**
 * Parses fields from an object literal block.
 */
function parseObjectLiteral(filesContent, objectBody) {
  const fields = [];
  const parts = splitByTopLevelCommas(objectBody);
  
  // Matches name: value or just name
  const propRegex = /^\s*(\w+)\s*(?::\s*([\s\S]*))?$/;
  
  for (const part of parts) {
    const m = part.match(propRegex);
    if (m) {
      const name = m[1];
      const valExpr = m[2] ? m[2].trim() : null;
      let type = 'string';

      if (valExpr) {
        if (valExpr.includes('Timestamp')) {
          type = 'Timestamp';
        } else if (valExpr.includes('Date().toISOString()') || valExpr.includes('startIso') || valExpr.includes('endIso')) {
          type = 'string';
        } else if (valExpr.startsWith("'") || valExpr.startsWith('"')) {
          type = 'string';
        } else if (valExpr === 'true' || valExpr === 'false') {
          type = 'boolean';
        } else if (!isNaN(Number(valExpr))) {
          type = 'number';
        } else {
          type = mapType(findVariableType(filesContent, valExpr));
        }
      } else {
        type = mapType(findVariableType(filesContent, name));
      }

      fields.push({ name, type });
    }
  }
  return fields;
}

/**
 * Extracts the second argument of database write calls robustly (tracking brace and parenthesis depth).
 */
function extractWritePayload(content, writeRegex) {
  let match;
  const payloads = [];

  while ((match = writeRegex.exec(content)) !== null) {
    let index = match.index + match[0].length;
    
    // Skip whitespace
    while (index < content.length && /\s/.test(content[index])) {
      index++;
    }

    if (index >= content.length) continue;

    if (content[index] === '{') {
      // Object literal: parse matching braces
      let braceCount = 0;
      let startIdx = index;
      while (index < content.length) {
        const char = content[index];
        if (char === '{') braceCount++;
        else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            payloads.push(content.substring(startIdx, index + 1));
            break;
          }
        }
        index++;
      }
    } else {
      // Variable or expression: parse until top-level comma or closing parenthesis of the call
      let parenCount = 0;
      let startIdx = index;
      while (index < content.length) {
        const char = content[index];
        if (char === '(') parenCount++;
        else if (char === ')') {
          if (parenCount === 0) {
            payloads.push(content.substring(startIdx, index).trim());
            break;
          }
          parenCount--;
        } else if (char === ',' && parenCount === 0) {
          payloads.push(content.substring(startIdx, index).trim());
          break;
        }
        index++;
      }
    }
  }

  return payloads;
}

/**
 * Merges field definitions by name, cleaning types and prioritizing more specific types.
 */
function mergeFields(fieldList) {
  const map = new Map();
  for (const f of fieldList) {
    const name = f.name;
    let type = f.type ? f.type.replace(/;$/, '').trim() : 'string';
    if (!type) type = 'string';

    if (map.has(name)) {
      const existingType = map.get(name);
      if (existingType === 'string' && type !== 'string') {
        map.set(name, type);
      }
    } else {
      map.set(name, type);
    }
  }
  return Array.from(map.entries()).map(([name, type]) => ({ name, type }));
}

function main() {
  console.log('Starting dynamic collection & schema inference...');

  const files = [FIREBASE_SERVICE_PATH, CALENDAR_SERVICE_PATH];
  const filesContent = files.map(f => fs.readFileSync(f, 'utf8'));
  const combinedContent = filesContent.join('\n');

  // 1. Discover all collections from code
  const collectionSet = new Set();
  const collectionRegex = /(?:collection|doc)\(\s*(?:db|activeDb)\s*,\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = collectionRegex.exec(combinedContent)) !== null) {
    collectionSet.add(match[1]);
  }

  const collections = Array.from(collectionSet);
  console.log(`Discovered collections: ${collections.join(', ')}`);

  const inferredSchemas = {};

  for (const col of collections) {
    console.log(`Inferring schema for collection: ${col}...`);
    let fields = [];

    // Find reference variables representing the collection
    const refRegex = new RegExp(`const\\s+(\\w+)\\s*=\\s*(?:doc|collection)\\(\\s*(?:db|activeDb)\\s*,\\s*'${col}'`, 'g');
    const refVars = [];
    let refMatch;
    while ((refMatch = refRegex.exec(combinedContent)) !== null) {
      refVars.push(refMatch[1]);
    }

    // Attempt to locate writes referencing this collection or its variables
    let resolved = false;
    let payloads = [];

    // Search for writes referencing the variables
    for (const refVar of refVars) {
      const writeRegex = new RegExp(`(?:setDoc|tx\\.set|updateDoc|addDoc)\\(\\s*${refVar}\\s*,`, 'g');
      payloads = payloads.concat(extractWritePayload(combinedContent, writeRegex));
    }

    // Direct inline write check
    const inlineWriteRegex = new RegExp(`(?:setDoc|tx\\.set|updateDoc|addDoc)\\(\\s*(?:doc|collection)\\(\\s*(?:db|activeDb)\\s*,\\s*'${col}'[^\\)]*\\)\\s*,`, 'g');
    payloads = payloads.concat(extractWritePayload(combinedContent, inlineWriteRegex));

    const allFields = [];

    // Process extracted payloads
    for (const payload of payloads) {
      if (payload.startsWith('{') && payload.endsWith('}')) {
        const body = payload.slice(1, -1);
        const parsed = parseObjectLiteral(filesContent, body);
        allFields.push(...parsed);
      } else {
        const varDeclRegex = new RegExp(`const\\s+${payload}\\s*=\\s*\\{([\\s\\S]*?)\\}\\;`);
        const declMatch = combinedContent.match(varDeclRegex);
        if (declMatch) {
          const parsed = parseObjectLiteral(filesContent, declMatch[1]);
          allFields.push(...parsed);
        }

        const castRegex = new RegExp(`\\b${payload}\\s+as\\s+(\\w+)`);
        const castMatch = combinedContent.match(castRegex);
        if (castMatch) {
          const interfaceFields = parseInterfaceFromFiles(filesContent, castMatch[1]);
          if (interfaceFields) {
            allFields.push(...interfaceFields);
          }
        }

        const type = findVariableType(filesContent, payload);
        if (type && type !== 'string') {
          const cleanType = type.replace('Partial<', '').replace('>', '').replace(';', '').trim();
          const interfaceFields = parseInterfaceFromFiles(filesContent, cleanType);
          if (interfaceFields) {
            allFields.push(...interfaceFields);
          }
        }
      }
    }

    // Check possible interfaces as a supplement
    const singularCol = col.endsWith('s') ? col.slice(0, -1) : col;
    const possibleInterfaces = [
      col.charAt(0).toUpperCase() + col.slice(1),
      singularCol.charAt(0).toUpperCase() + singularCol.slice(1) + 'Profile',
      singularCol.charAt(0).toUpperCase() + singularCol.slice(1),
    ];

    for (const intf of possibleInterfaces) {
      const interfaceFields = parseInterfaceFromFiles(filesContent, intf);
      if (interfaceFields) {
        allFields.push(...interfaceFields);
      }
    }

    if (allFields.length > 0) {
      fields = mergeFields(allFields);
      resolved = true;
    }

    if (resolved && fields.length > 0) {
      inferredSchemas[col] = fields;
      console.log(`Inferred fields for ${col}:`, fields);
    } else {
      console.warn(`Could not infer fields for collection: ${col}. Using empty schema.`);
      inferredSchemas[col] = [];
    }
  }

  // Generate Mermaid entities blocks dynamically
  let mermaidBlocks = '';
  for (const [col, fields] of Object.entries(inferredSchemas)) {
    mermaidBlocks += `    ${col} {\n`;
    for (const f of fields) {
      const isPK = f.name === 'uid' || f.name === 'id';
      const isFK = f.name.toLowerCase().endsWith('uid') || f.name.toLowerCase().endsWith('id');
      const suffix = isPK ? 'PK' : (isFK ? 'FK' : '');
      
      let cleanType = f.type;
      
      // Ensure start and end in bookings are outputted as Timestamp in the ERD
      if (col === 'bookings' && (f.name === 'start' || f.name === 'end')) {
        cleanType = 'Timestamp';
      }

      mermaidBlocks += `        ${cleanType} ${f.name}${suffix ? ' ' + suffix : ''}\n`;
    }
    mermaidBlocks += `    }\n\n`;
  }

  const markdownContent = `# Database Schema ERD

This document contains the Entity-Relationship Diagram (ERD) for the Peer Coaching Network database schema.

> [!NOTE]
> This file is auto-generated by running \`make erd\`. Do not edit this file directly.

## Entity-Relationship Diagram

\`\`\`mermaid
erDiagram
    users ||--o{ bookings : "hosts"
    users ||--o{ bookings : "attends"
    users ||--|| busySlotsCache : "defines"
    users ||--o{ clientBookingCache : "holds"

${mermaidBlocks.trimEnd()}
\`\`\`

## Collection Descriptions

### 1. \`users\`
Stores the profiles and preferences of the ICF-credentialed coaches.
* **Primary Key**: \`uid\` (matches the Firebase Authentication User ID).
* **Availability Template**: Defines the weekly default availability (e.g. 9:00 AM - 5:00 PM on weekdays) and any blocked dates.

### 2. \`bookings\`
Contains the confirmed peer coaching sessions scheduled between coaches.
* **Primary Key**: \`id\` (formatted as \`\${coachUid}_\${startIso}\` to prevent double-booking of a coach at the same slot).
* **Foreign Keys**: 
  - \`coachUid\` references \`users.uid\` (the host).
  - \`menteeUid\` references \`users.uid\` (the client).
* **Google Integration**: Stores \`googleEventId\` and \`meetLink\` for synced calendar events.

### 3. \`clientBookingCache\`
Temporary holdings created during scheduling to prevent a mentee from double-booking themselves.
* **Primary Key**: \`\${menteeUid}_\${startIso}\`.
* **Foreign Keys**:
  - \`menteeUid\` references \`users.uid\`.
  - \`coachUid\` references \`users.uid\`.
  - \`bookingId\` references \`bookings.id\`.

### 4. \`busySlotsCache\`
Cached busy slot records for each coach, derived dynamically to avoid expensive runtime calculations on every query.
* **Primary Key**: \`uid\` (references \`users.uid\`).
* **Busy Slots**: Aggregated array of busy time windows representing all active host and client bookings for the coach.
`;

  fs.writeFileSync(OUTPUT_PATH, markdownContent, 'utf8');
  console.log(`ERD successfully generated and written to ${OUTPUT_PATH}`);
}

main();
