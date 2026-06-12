import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, '..', 'sql', 'data.sql');
const content = fs.readFileSync(filePath, 'utf-8');

const lines = content.split('\n');
const places = [];

for (const line of lines) {
  if (!line.startsWith("INSERT INTO `spot_place`")) continue;

  // Match: VALUES ('id','name','type',...)
  const valuesIdx = line.indexOf('VALUES (');
  if (valuesIdx === -1) continue;
  const rest = line.substring(valuesIdx + 8); // after "VALUES ("

  // Split by quoted strings to get fields
  const fields = [];
  let i = 0;
  while (i < rest.length && fields.length < 15) {
    if (rest[i] === "'") {
      const end = rest.indexOf("'", i + 1);
      if (end === -1) break;
      fields.push(rest.substring(i + 1, end));
      i = end + 1;
    } else if (rest[i] === ',' || rest[i] === ' ' || rest[i] === '\t') {
      i++;
    } else {
      // Number
      const comma = rest.indexOf(',', i);
      const paren = rest.indexOf(')', i);
      const end = comma === -1 ? paren : (paren === -1 ? comma : Math.min(comma, paren));
      if (end === -1) break;
      fields.push(rest.substring(i, end).trim());
      i = end + 1;
    }
  }

  if (fields.length >= 14) {
    const id = fields[0];
    const name = fields[1];
    const type = fields[2];
    const desc = fields[13] || '';
    places.push({ id, name, type, desc });
  }
}

console.log('Total places:', places.length);
const withDesc = places.filter(p => p.desc.trim().length > 0);
const withoutDesc = places.filter(p => !p.desc.trim());
console.log('With description:', withDesc.length);
console.log('Without description:', withoutDesc.length);
console.log('');
console.log('=== Places WITHOUT description ===');
withoutDesc.forEach(p => console.log(`${p.id}: ${p.name} (${p.type})`));
console.log('');
console.log('=== Places WITH description (sample) ===');
withDesc.slice(0, 5).forEach(p => console.log(`${p.id}: ${p.name} - "${p.desc.substring(0, 60)}..."`));
