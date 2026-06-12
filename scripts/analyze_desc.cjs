const fs = require('fs');
const path = require('path');

const sqlPath = path.resolve(__dirname, '..', 'sql', 'data.sql');
const content = fs.readFileSync(sqlPath, 'utf-8');
const lines = content.split('\n');

const results = [];
for (const line of lines) {
  if (!line.startsWith("INSERT INTO `spot_place`")) continue;
  const deletedIdx = line.lastIndexOf(',0)');
  if (deletedIdx === -1) continue;
  const beforeDeleted = line.substring(0, deletedIdx);
  const lastQuote = beforeDeleted.lastIndexOf("'");
  const secondLastQuote = beforeDeleted.lastIndexOf("'", lastQuote - 1);
  if (lastQuote === -1 || secondLastQuote === -1) continue;
  const desc = beforeDeleted.substring(secondLastQuote + 1, lastQuote);
  const nameMatch = line.match(/VALUES \('place_\d+','([^']+)'/);
  const name = nameMatch ? nameMatch[1] : '?';
  const idMatch = line.match(/'(place_\d+)'/);
  const id = idMatch ? idMatch[1] : '?';
  results.push({ id, name, desc });
}

// Categorize
const good = [];       // > 20 chars
const short = [];      // 2-20 chars
const placeholder = []; // 0-1 char or just punctuation

for (const r of results) {
  const clean = r.desc.replace(/[，。、！？；：""''…—\s]/g, '').trim();
  if (clean.length >= 10) {
    good.push(r);
  } else if (clean.length >= 2) {
    short.push(r);
  } else {
    placeholder.push(r);
  }
}

console.log('=== ANALYSIS ===');
console.log('Good descriptions (>=10 meaningful chars):', good.length);
console.log('Short descriptions (2-9 meaningful chars):', short.length);
console.log('Placeholder/empty (0-1 meaningful chars):', placeholder.length);
console.log('Total:', results.length);

if (placeholder.length > 0 && placeholder.length <= 30) {
  console.log('\n=== Placeholder descriptions ===');
  placeholder.forEach(r => console.log(r.id + ': ' + r.name + ' -> "' + r.desc + '"'));
} else if (placeholder.length > 30) {
  console.log('\nFirst 30 placeholder:');
  placeholder.slice(0, 30).forEach(r => console.log(r.id + ': ' + r.name + ' -> "' + r.desc + '"'));
}

if (short.length > 0 && short.length <= 20) {
  console.log('\n=== Short descriptions ===');
  short.forEach(r => console.log(r.id + ': ' + r.name + ' -> "' + r.desc + '"'));
}
