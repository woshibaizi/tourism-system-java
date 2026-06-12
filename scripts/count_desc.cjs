const fs = require('fs');
const lines = fs.readFileSync(
  'C:/Users/19374/Desktop/code/tour/tourism-system-java/scripts/places_dump.txt',
  'utf-8'
).trim().split('\n');

let withDesc = 0, withoutDesc = 0;
const missing = [];

for (const line of lines) {
  const beforeDeleted = line.substring(0, line.lastIndexOf(',0)'));
  const lastQuote = beforeDeleted.lastIndexOf("'");
  const secondLastQuote = beforeDeleted.lastIndexOf("'", lastQuote - 1);
  if (lastQuote === -1 || secondLastQuote === -1) {
    withoutDesc++;
    continue;
  }
  const desc = beforeDeleted.substring(secondLastQuote + 1, lastQuote);
  if (desc.trim()) {
    withDesc++;
  } else {
    withoutDesc++;
    const nameMatch = line.match(/VALUES \('place_\d+','([^']+)'/);
    missing.push(nameMatch ? nameMatch[1] : 'unknown');
  }
}

console.log('With description:', withDesc);
console.log('Without description:', withoutDesc);
if (missing.length <= 30) {
  console.log('Missing:', missing.join(', '));
} else if (missing.length > 0) {
  console.log('First 30 missing:', missing.slice(0, 30).join(', '));
}
