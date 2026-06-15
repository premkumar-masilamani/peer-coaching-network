import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname in ES Modules scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to script location
const ROOT_DIR = path.resolve(__dirname, '..');
const FIREBASE_SERVICE_PATH = path.join(ROOT_DIR, 'src/services/firebaseService.ts');
const CALENDAR_SERVICE_PATH = path.join(ROOT_DIR, 'src/services/googleCalendar.ts');
const OUTPUT_PATH = path.join(ROOT_DIR, 'docs/schema-erd.md');

/**
 * Dynamically parses an interface from a TypeScript file.
 * Finds the interface definition and extracts field names and raw types.
 */
function parseInterface(filePath, interfaceName) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Regex block-matching to locate the interface
  const regex = new RegExp(`export\\s+interface\\s+${interfaceName}\\s*\\{([^}]*)\\}`, 's');
  const match = content.match(regex);
  if (!match) {
    throw new Error(`Could not find interface '${interfaceName}' in ${filePath}`);
  }
  
  const body = match[1];
  const fields = [];
  
  // Match each property line: name?: type; or name: type;
  const lines = body.split('\n');
  const propRegex = /^\s*(\w+)(\??)\s*:\s*([^;]+);?/;
  
  for (const line of lines) {
    const m = line.match(propRegex);
    if (m) {
      const fieldName = m[1];
      const isOptional = m[2] === '?';
      const rawType = m[3].trim();
      fields.push({ fieldName, isOptional, rawType });
    }
  }
  
  return fields;
}

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
    
    // Check if the remaining parts are purely string literal options (e.g. 'user' | 'admin')
    const isLiteralUnion = filtered.every(p => (p.startsWith("'") && p.endsWith("'")) || (p.startsWith('"') && p.endsWith('"')));
    if (isLiteralUnion) {
      return 'string';
    }
    
    if (filtered.length === 1) {
      type = filtered[0];
    } else {
      type = filtered[0]; // fallback to first type
    }
  }

  // 3. Map inline structures (e.g. { dateTime: string })
  if (type.startsWith('{') && type.endsWith('}')) {
    if (type.includes('dateTime')) {
      return 'string'; // simplify start/end dateTimes
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

function main() {
  console.log('Generating ERD from TypeScript service interfaces...');

  // Parse interfaces
  const userProfileFields = parseInterface(FIREBASE_SERVICE_PATH, 'UserProfile');
  const calendarEventFields = parseInterface(CALENDAR_SERVICE_PATH, 'CalendarEvent');

  // 1. users fields
  const userFieldsMermaid = userProfileFields.map(f => {
    const mapped = mapType(f.rawType);
    const suffix = f.fieldName === 'uid' ? 'PK' : '';
    return `        ${mapped} ${f.fieldName}${suffix ? ' ' + suffix : ''}`;
  }).join('\n');

  // 2. bookings fields
  const bookingFieldsMap = new Map();
  calendarEventFields.forEach(f => {
    bookingFieldsMap.set(f.fieldName, mapType(f.rawType));
  });

  // Supplement with database-specific booking collection fields
  bookingFieldsMap.set('id', 'string PK');
  bookingFieldsMap.set('googleEventId', 'string');
  bookingFieldsMap.set('status', 'string');
  bookingFieldsMap.set('topic', 'string');
  bookingFieldsMap.set('hostEmail', 'string');
  bookingFieldsMap.set('hostName', 'string');
  bookingFieldsMap.set('clientEmail', 'string');
  bookingFieldsMap.set('clientName', 'string');
  bookingFieldsMap.set('coachUid', 'string FK');
  bookingFieldsMap.set('menteeUid', 'string FK');
  bookingFieldsMap.set('createdAt', 'Timestamp');
  bookingFieldsMap.set('cancelledAt', 'Timestamp');
  
  // Override start and end as Timestamp in database
  bookingFieldsMap.set('start', 'Timestamp');
  bookingFieldsMap.set('end', 'Timestamp');

  const bookingFieldsMermaid = Array.from(bookingFieldsMap.entries()).map(([name, type]) => {
    const isPK = type.includes('PK');
    const isFK = type.includes('FK');
    const cleanType = type.split(' ')[0];
    const suffix = isPK ? 'PK' : (isFK ? 'FK' : '');
    return `        ${cleanType} ${name}${suffix ? ' ' + suffix : ''}`;
  }).join('\n');

  // 3. slotHolds fields (defined statically)
  const slotHoldsFieldsMermaid = [
    '        string menteeUid FK',
    '        string coachUid FK',
    '        string bookingId FK',
    '        string startIso',
    '        Timestamp createdAt'
  ].join('\n');

  // 4. availability fields (defined statically)
  const availabilityFieldsMermaid = [
    '        string uid PK, FK',
    '        string lastUpdated',
    '        string_array busySlots'
  ].join('\n');

  // Construct Markdown
  const markdownContent = `# Database Schema ERD

This document contains the Entity-Relationship Diagram (ERD) for the Peer Coaching Network database schema.

> [!NOTE]
> This file is auto-generated by running \`make erd\`. Do not edit this file directly.

## Entity-Relationship Diagram

\`\`\`mermaid
erDiagram
    users ||--o{ bookings : "hosts"
    users ||--o{ bookings : "attends"
    users ||--|| availability : "defines"
    users ||--o{ slotHolds : "holds"

    users {
${userFieldsMermaid}
    }

    bookings {
${bookingFieldsMermaid}
    }

    slotHolds {
${slotHoldsFieldsMermaid}
    }

    availability {
${availabilityFieldsMermaid}
    }
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

### 3. \`slotHolds\`
Temporary holdings created during scheduling to prevent a mentee from double-booking themselves.
* **Primary Key**: \`\${menteeUid}_\${startIso}\`.
* **Foreign Keys**:
  - \`menteeUid\` references \`users.uid\`.
  - \`coachUid\` references \`users.uid\`.
  - \`bookingId\` references \`bookings.id\`.

### 4. \`availability\`
Cached busy slot records for each coach, derived dynamically to avoid expensive runtime calculations on every query.
* **Primary Key**: \`uid\` (references \`users.uid\`).
* **Busy Slots**: Aggregated array of busy time windows representing all active host and client bookings for the coach.
`;

  // Write file
  const docsDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_PATH, markdownContent, 'utf8');
  console.log(`ERD successfully generated and written to ${OUTPUT_PATH}`);
}

main();
