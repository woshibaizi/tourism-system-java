const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'sql', 'data.sql');
const enrichPath = path.join(__dirname, '..', 'sql', 'migration_enrich_descriptions.sql');

let dataSql = fs.readFileSync(dataPath, 'utf-8');
const enrichSql = fs.readFileSync(enrichPath, 'utf-8');

// Parse UPDATE statements to get id → description mapping
const descMap = {};
const updateRegex = /UPDATE spot_place SET detail_description = '([^']*(?:''[^']*)*)' WHERE id = '([^']+)';/g;
let match;
while ((match = updateRegex.exec(enrichSql)) !== null) {
  descMap[match[2]] = match[1].replace(/''/g, "'");
}

console.log(`Parsed ${Object.keys(descMap).length} descriptions from migration file.`);

// Replace NULL with the actual description in each spot_place INSERT
const lines = dataSql.split(/\r?\n/);
const newLines = lines.map(line => {
  if (!line.includes("INSERT INTO `spot_place`")) return line;

  const idMatch = line.match(/'place_\d+'/);
  if (!idMatch) return line;

  const id = idMatch[0].replace(/'/g, '');
  const desc = descMap[id];
  if (!desc) return line;

  // Replace the NULL placeholder with the actual description
  // The pattern is: ...old_description',NULL,0);
  // We need to find the NULL between detail_description and deleted
  const escaped = desc.replace(/'/g, "''");
  return line.replace(/',NULL,0\);$/, `','${escaped}',0);`);
});

fs.writeFileSync(dataPath, newLines.join('\n'), 'utf-8');

const embedded = newLines.filter(l => l.includes("INSERT INTO `spot_place`") && !l.includes("',NULL,0)")).length;
console.log(`Embedded ${embedded} descriptions into data.sql`);
