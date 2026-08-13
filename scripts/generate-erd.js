import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const COLLECTIONS_PATH = path.join(ROOT_DIR, 'packages/shared/src/config/collections.ts');
const OUTPUT_PATH = path.join(ROOT_DIR, 'architecture/schema.png');
const SRC_DIRS = [
  path.join(ROOT_DIR, 'packages/shared/src'),
  path.join(ROOT_DIR, 'functions/src'),
  path.join(ROOT_DIR, 'web/src'),
];

// ─────────────────────────────────────────────────────────────────────────────
// Generic source scanning
//
// The schema is inferred, not hardcoded, so any future collection or field is
// picked up automatically:
//   1. Collections come from the canonical `COLLECTIONS` map in collections.ts.
//   2. Every non-test file under the workspaces' src/ folders is scanned for Firestore writes.
//   3. Write targets are resolved through `COLLECTIONS.*`, reference variables,
//      and inline `doc()/collection()` calls (last collection segment wins, so
//      subcollections resolve correctly).
//   4. Fields come from write payloads (object literals incl. `...spreads`),
//      typed variables, and interface casts.
// ─────────────────────────────────────────────────────────────────────────────

/** Recursively collect .ts/.tsx source files, skipping tests and declarations. */
function collectSourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Parse the canonical COLLECTIONS constant into a { KEY: 'collectionName' } map. */
function parseCollectionsConstant(content) {
  const keyToName = {};
  const block = content.match(/COLLECTIONS\s*=\s*\{([\s\S]*?)\}/);
  if (!block) return keyToName;
  const entryRegex = /(\w+)\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = entryRegex.exec(block[1])) !== null) {
    keyToName[m[1]] = m[2];
  }
  return keyToName;
}

/**
 * Reads the argument list of a call, given the index of its opening '('.
 * Returns the top-level args (split on commas outside nested brackets) and the
 * index just past the closing ')'.
 */
function readArgs(content, openIdx) {
  let depth = 0;
  let cur = '';
  const args = [];
  let i = openIdx;
  for (; i < content.length; i++) {
    const c = content[i];
    if (c === '(') { depth++; if (depth === 1) continue; cur += c; continue; }
    if (c === ')') { depth--; if (depth === 0) { if (cur.trim()) args.push(cur.trim()); return { args, end: i + 1 }; } cur += c; continue; }
    if (c === '{' || c === '[') { depth++; cur += c; continue; }
    if (c === '}' || c === ']') { depth--; cur += c; continue; }
    if (c === ',' && depth === 1) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  return { args, end: i };
}

/** Resolve a single call argument to a collection name, if it is one. */
function resolveCollectionToken(token, keyToName) {
  const t = token.trim();
  const constMatch = t.match(/^COLLECTIONS\.(\w+)$/);
  if (constMatch) return keyToName[constMatch[1]] || null;
  const litMatch = t.match(/^['"]([^'"]+)['"]$/);
  if (litMatch) return litMatch[1];
  return null;
}

/** The deepest collection referenced by a doc()/collection() arg list. */
function lastCollectionToken(args, keyToName) {
  let found = null;
  for (const a of args) {
    const resolved = resolveCollectionToken(a, keyToName);
    if (resolved) found = resolved;
  }
  return found;
}

/** Resolve a string to find any canonical collection/subcollection name referenced within. */
function extractCollectionFromAssignment(expr, keyToName) {
  const matches = [];
  
  // Match COLLECTIONS.X
  const collRegex = /COLLECTIONS\.(\w+)/g;
  let m;
  while ((m = collRegex.exec(expr)) !== null) {
    const colName = keyToName[m[1]];
    if (colName) matches.push(colName);
  }
  
  // Match literal strings like "bookings" or 'availableDays'
  const litRegex = /['"]([^'"]+)['"]/g;
  while ((m = litRegex.exec(expr)) !== null) {
    const val = m[1];
    if (Object.values(keyToName).includes(val)) {
      matches.push(val);
    }
  }
  
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

/** Helper to extract target expression preceding a dot method call on the same line. */
function getPrecedingExpression(content, dotIdx) {
  let idx = dotIdx - 1;
  let expr = '';
  while (idx >= 0) {
    const char = content[idx];
    if (char === ';' || char === '{' || char === '}' || char === '(' || char === '\n') {
      break;
    }
    expr = char + expr;
    idx--;
  }
  return expr.replace(/\bawait\b/g, '').trim();
}

/** Map a reference variable (const x = doc/collection(...)) to its collection. */
function findRefVars(content, keyToName) {
  const map = {};
  const declRegex = /\b(?:const|let|var)\s+(\w+)\s*=\s*([^;]+)/g;
  let m;
  while ((m = declRegex.exec(content)) !== null) {
    const varName = m[1];
    const expr = m[2];
    if (expr.includes('collection') || expr.includes('doc')) {
      const col = extractCollectionFromAssignment(expr, keyToName);
      if (col) {
        map[varName] = col;
      }
    }
  }
  return map;
}

/** Resolve the target (first arg) of a write call to a collection name. */
function resolveWriteTarget(target, refVarMap, keyToName) {
  const t = target.trim();
  if (/^(?:doc|collection)\s*\(/.test(t)) {
    const { args } = readArgs(t, t.indexOf('('));
    return lastCollectionToken(args, keyToName);
  }
  const ident = t.match(/^([A-Za-z_$][\w$]*)/);
  if (ident && refVarMap[ident[1]]) return refVarMap[ident[1]];
  return extractCollectionFromAssignment(t, keyToName);
}

/** Find every Firestore write (setDoc/updateDoc/addDoc/set/update/add) as {target, payload}. */
function findWrites(content) {
  const writes = [];
  const verbRegex = /\b(setDoc|updateDoc|addDoc)\s*\(|\.(set|update|add)\s*\(/g;
  let m;
  while ((m = verbRegex.exec(content)) !== null) {
    const verb = m[1] || m[2];
    const parenIdx = content.indexOf('(', m.index);
    const { args, end } = readArgs(content, parenIdx);
    verbRegex.lastIndex = end;
    
    if (verb === 'setDoc' || verb === 'updateDoc' || verb === 'addDoc') {
      if (args.length >= 2) {
        writes.push({ target: args[0], payload: args[1] });
      }
    } else {
      const preceding = getPrecedingExpression(content, m.index);
      if (preceding === 't' || preceding === 'batch') {
        if (args.length >= 2) {
          writes.push({ target: args[0], payload: args[1] });
        }
      } else if (preceding !== 'res' && preceding !== 'response' && preceding !== 'router' && preceding !== 'express') {
        if (args.length >= 1) {
          writes.push({ target: preceding, payload: args[0] });
        }
      }
    }
  }
  return writes;
}

// ─────────────────────────────────────────────────────────────────────────────
// Field & type inference
// ─────────────────────────────────────────────────────────────────────────────

/** Maps a TypeScript type signature to a simple, Mermaid-friendly primitive type. */
function mapType(tsType) {
  let type = (tsType || '').trim();
  if (!type) return 'string';

  if (type.includes('`') || type.includes('${') || type.includes('.') || type.includes(' ') || type.includes('\n')) {
    return 'string';
  }
  if (type.endsWith('[]')) {
    if (type.includes('attendees') || type.includes('email')) return 'object_array';
    const inner = type.slice(0, -2);
    if (inner.startsWith('{')) return 'object_array';
    return `${mapType(inner)}_array`;
  }
  if (type.includes('|')) {
    const filtered = type.split('|').map(p => p.trim()).filter(p => p !== 'null' && p !== 'undefined');
    const isLiteralUnion = filtered.every(p => /^['"].*['"]$/.test(p));
    if (isLiteralUnion) return 'string';
    type = filtered[0] || 'string';
  }
  if (type.startsWith('{') && type.endsWith('}')) return 'object';
  if (/^['"].*['"]$/.test(type)) return 'string';
  if (type === 'Timestamp') return 'Timestamp';
  if (type === 'boolean' || type === 'string' || type === 'number') return type;
  return type;
}

/** Best-effort type from a variable/field name and its declaration. */
function findVariableType(filesContent, varName) {
  const nameLower = varName.toLowerCase();
  if (/(uid|id|email|name|link|iso|url|topic|summary|description|timezone|country|gender|bio|theme|role|status|category|subject|content)$/.test(nameLower)) return 'string';
  if (/(synced|enabled|complete|acc|pcc|mcc|actc)$/.test(nameLower)) return 'boolean';
  if (/(slots|dates|qualifications|credentials|messages|ids)$/.test(nameLower)) return 'string_array';
  if (/(createdat|updatedat|cancelledat|expireat|lastupdated|start|end)$/.test(nameLower)) return 'Timestamp';

  const regex = new RegExp(`\\b${varName.replace(/[^\w$]/g, '')}\\??\\s*:\\s*`, 'g');
  for (const content of filesContent) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      let index = match.index + match[0].length;
      let brace = 0, bracket = 0, paren = 0, typeStr = '';
      while (index < content.length) {
        const char = content[index];
        if (char === '{') brace++;
        else if (char === '}') brace--;
        else if (char === '[') bracket++;
        else if (char === ']') bracket--;
        else if (char === '(') paren++;
        else if (char === ')') paren--;
        if (brace < 0 || bracket < 0 || paren < 0) break;
        if (brace === 0 && bracket === 0 && paren === 0 && (char === ';' || char === '=' || char === ',' || char === '\n')) break;
        typeStr += char;
        index++;
      }
      const cleaned = typeStr.trim();
      if (cleaned) return cleaned;
    }
  }
  return 'string';
}

/** Parse the body of an `export interface X { ... }` block into fields. */
function parseInterfaceFromFiles(filesContent, interfaceName) {
  const safeName = (interfaceName || '').replace(/[^a-zA-Z0-9_]/g, '').trim();
  if (!safeName) return null;
  const regex = new RegExp(`(?:export\\s+)?interface\\s+${safeName}\\s*\\{([^}]*)\\}`, 's');
  for (const content of filesContent) {
    const match = content.match(regex);
    if (match) {
      const fields = [];
      const propRegex = /^\s*(\w+)(\??)\s*:\s*([^;]+);?/;
      for (const line of match[1].split('\n')) {
        const m = line.match(propRegex);
        if (m) fields.push({ name: m[1], type: mapType(m[3]) });
      }
      return fields;
    }
  }
  return null;
}

/** Split an object-literal body by commas at the top nesting level. */
function splitByTopLevelCommas(str) {
  const parts = [];
  let current = '', depth = 0;
  for (const char of str) {
    if (char === '{' || char === '[' || char === '(') depth++;
    else if (char === '}' || char === ']' || char === ')') depth--;
    if (char === ',' && depth === 0) { parts.push(current.trim()); current = ''; }
    else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Infer a field type from the value expression on the right of `name:`. */
function typeFromValueExpr(valExpr, filesContent) {
  const v = valExpr.trim();
  if (v.startsWith('{')) return 'object';
  if (v.startsWith('[')) return 'object_array';
  if (v.startsWith('!!') || v === 'true' || v === 'false') return 'boolean';
  if (v.includes('Timestamp')) return 'Timestamp';
  if (v.includes('toISOString()') || /Iso\b/.test(v)) return 'string';
  if (/^['"]/.test(v)) return 'string';
  if (/^\[/.test(v)) return 'object_array';
  if (!isNaN(Number(v))) return 'number';
  return mapType(findVariableType(filesContent, v));
}

/** Parse fields from an object-literal body, resolving `...spread` references. */
function parseObjectLiteral(filesContent, combinedContent, objectBody) {
  const fields = [];
  const propRegex = /^\s*(\w+)\s*(?::\s*([\s\S]*))?$/;

  for (const part of splitByTopLevelCommas(objectBody)) {
    if (part.startsWith('...')) {
      const id = part.slice(3).trim().match(/^[\w$]+/);
      if (id) {
        const decl = combinedContent.match(new RegExp(`\\b${id[0]}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*;`));
        if (decl) fields.push(...parseObjectLiteral(filesContent, combinedContent, decl[1]));
      }
      continue;
    }
    const m = part.match(propRegex);
    if (!m) continue;
    const name = m[1];
    const valExpr = m[2] ? m[2].trim() : null;
    fields.push({ name, type: valExpr ? typeFromValueExpr(valExpr, filesContent) : mapType(findVariableType(filesContent, name)) });
  }
  return fields;
}

/** Infer the fields written by a single payload expression. */
function fieldsFromPayload(payload, filesContent, combinedContent) {
  if (!payload) return [];
  const p = payload.trim();
  if (p.startsWith('{') && p.endsWith('}')) {
    return parseObjectLiteral(filesContent, combinedContent, p.slice(1, -1));
  }
  const fields = [];
  const varName = (p.match(/^([A-Za-z_$][\w$]*)/) || [])[1];
  if (varName) {
    const decl = combinedContent.match(new RegExp(`\\b${varName}\\s*(?::[^=;]+)?=\\s*\\{([\\s\\S]*?)\\}\\s*;`));
    if (decl) fields.push(...parseObjectLiteral(filesContent, combinedContent, decl[1]));
    const type = findVariableType(filesContent, varName);
    if (type && /^[A-Z]/.test(type)) {
      const intf = parseInterfaceFromFiles(filesContent, type.replace(/Partial<|>|;/g, '').trim());
      if (intf) fields.push(...intf);
    }
  }
  const castMatch = p.match(/\bas\s+([A-Za-z_$][\w$]*)/);
  if (castMatch && !['DocumentData', 'Partial', 'any', 'unknown'].includes(castMatch[1])) {
    const intf = parseInterfaceFromFiles(filesContent, castMatch[1]);
    if (intf) fields.push(...intf);
  }
  return fields;
}

/** Merge fields by name, preferring more specific (non-string) types. */
function mergeFields(fieldList) {
  const map = new Map();
  for (const f of fieldList) {
    const name = f.name;
    let type = (f.type || 'string').replace(/;$/, '').trim() || 'string';
    if (!map.has(name) || (map.get(name) === 'string' && type !== 'string')) {
      map.set(name, type);
    }
  }
  return Array.from(map.entries()).map(([name, type]) => ({ name, type }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Relationship inference
// ─────────────────────────────────────────────────────────────────────────────

/** Guess the collection a foreign-key-looking field points at. */
function foreignKeyTarget(fieldName, collectionNames) {
  const lower = fieldName.toLowerCase();
  if (lower === 'uid' || lower === 'id') return null; // primary key, not a relation
  if (lower === 'userid' || lower.endsWith('uid')) {
    return collectionNames.includes('users') ? 'users' : null;
  }
  if (lower.endsWith('id')) {
    const base = fieldName.slice(0, -2); // strip "Id"
    const candidates = [base, `${base}s`, base.toLowerCase(), `${base.toLowerCase()}s`];
    return collectionNames.find(c => candidates.includes(c)) || null;
  }
  return null;
}

/** A mermaid-safe attribute type token (single word). */
function sanitizeType(type) {
  const t = (type || 'string').replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  return t || 'string';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Inferring Firestore schema from source...');

  const collectionsSrc = fs.readFileSync(COLLECTIONS_PATH, 'utf8');
  const keyToName = parseCollectionsConstant(collectionsSrc);
  console.log(`Canonical collections: ${Object.values(keyToName).join(', ') || '(none)'}`);

  const sourceFiles = SRC_DIRS.flatMap(dir => fs.existsSync(dir) ? collectSourceFiles(dir) : []);
  const filesContent = sourceFiles.map(f => fs.readFileSync(f, 'utf8'));
  const combinedContent = filesContent.join('\n');

  // Accumulate raw fields per collection from every write in every file.
  const rawSchemas = {};
  sourceFiles.forEach((file, i) => {
    const content = filesContent[i];
    const refVarMap = findRefVars(content, keyToName);
    for (const write of findWrites(content)) {
      const col = resolveWriteTarget(write.target, refVarMap, keyToName);
      if (!col) continue;
      (rawSchemas[col] ||= []).push(...fieldsFromPayload(write.payload, filesContent, combinedContent));
    }
  });

  // Supplement each collection with a matching interface, if one exists. Only
  // persistence interfaces (defined in .ts service/config files) are considered —
  // .tsx components define UI view-models (e.g. rows holding a snapshot) that are
  // not the stored document shape.
  const persistenceContent = filesContent.filter((_, i) => !sourceFiles[i].endsWith('.tsx'));
  for (const col of Object.keys(rawSchemas)) {
    const singular = col.endsWith('s') ? col.slice(0, -1) : col;
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    for (const intf of [cap(col), `${cap(singular)}Profile`, cap(singular)]) {
      const fields = parseInterfaceFromFiles(persistenceContent, intf);
      if (fields) rawSchemas[col].push(...fields);
    }
  }

  // Finalize: merge fields and drop collections that are only path segments.
  const schemas = {};
  for (const [col, fields] of Object.entries(rawSchemas)) {
    const merged = mergeFields(fields);
    if (merged.length > 0) schemas[col] = merged;
  }
  const collectionNames = Object.keys(schemas).sort();
  console.log(`Collections with inferred fields: ${collectionNames.join(', ')}`);

  // Entity blocks.
  let entityBlocks = '';
  for (const col of collectionNames) {
    entityBlocks += `    ${col} {\n`;
    for (const f of schemas[col]) {
      const lower = f.name.toLowerCase();
      const isPK = f.name === 'uid' || f.name === 'id';
      const isFK = !isPK && (lower.endsWith('uid') || lower.endsWith('id'));
      const suffix = isPK ? ' PK' : (isFK ? ' FK' : '');
      entityBlocks += `        ${sanitizeType(f.type)} ${f.name}${suffix}\n`;
    }
    entityBlocks += `    }\n\n`;
  }

  // Relationships inferred from foreign-key-looking fields.
  const relSet = new Set();
  for (const col of collectionNames) {
    for (const f of schemas[col]) {
      const target = foreignKeyTarget(f.name, collectionNames);
      if (target && target !== col) relSet.add(`    ${target} ||--o{ ${col} : "${f.name}"`);
    }
  }
  const relationships = Array.from(relSet).sort().join('\n');

  // Collection descriptions (generated, not hand-maintained).
  let descriptions = '';
  collectionNames.forEach((col, idx) => {
    const pk = schemas[col].find(f => f.name === 'uid' || f.name === 'id');
    const fks = schemas[col]
      .map(f => ({ f, target: foreignKeyTarget(f.name, collectionNames) }))
      .filter(x => x.target && x.target !== col);
    descriptions += `### ${idx + 1}. \`${col}\`\n`;
    descriptions += `* **Fields**: ${schemas[col].length} (\`${schemas[col].map(f => f.name).join('`, `')}\`)\n`;
    descriptions += `* **Primary key**: ${pk ? `\`${pk.name}\`` : '_(document-scoped / composite id)_'}\n`;
    if (fks.length) {
      descriptions += `* **References**: ${fks.map(x => `\`${x.f.name}\` → \`${x.target}\``).join(', ')}\n`;
    }
    descriptions += '\n';
  });

  const mermaidDiagram = `erDiagram\n${relationships ? relationships + '\n\n' : ''}${entityBlocks.trimEnd()}`;

  console.log('Rendering diagram locally using mermaid-cli...');
  
  // Ensure architecture folder exists
  const archDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(archDir)) {
    fs.mkdirSync(archDir, { recursive: true });
  }

  const tempMmdPath = path.join(archDir, 'temp-schema.mmd');
  
  try {
    // Write temporary Mermaid file
    fs.writeFileSync(tempMmdPath, mermaidDiagram, 'utf8');

    // Run local mmdc CLI
    const mmdcPath = path.join(ROOT_DIR, 'node_modules/.bin/mmdc');
    execSync(`"${mmdcPath}" -i "${tempMmdPath}" -o "${OUTPUT_PATH}"`, { stdio: 'inherit' });

    console.log(`ERD successfully generated locally as PNG image and written to ${OUTPUT_PATH}`);
  } catch (err) {
    console.error('Error generating PNG locally via mermaid-cli:', err);
    process.exit(1);
  } finally {
    // Clean up temporary Mermaid file
    if (fs.existsSync(tempMmdPath)) {
      try {
        fs.unlinkSync(tempMmdPath);
      } catch (_e) {
        // Ignore cleanup errors
      }
    }
  }
}

main();
