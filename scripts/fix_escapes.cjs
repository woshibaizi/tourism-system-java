const fs = require('fs');
const path = require('path');

const sqlPath = path.resolve(__dirname, '..', 'sql', 'data.sql');
let content = fs.readFileSync(sqlPath, 'utf-8');

// Count occurrences before
const beforeCount = (content.match(/\\'/g) || []).length;
console.log('Backslash-quote occurrences before:', beforeCount);

// Replace backslash-single-quote with doubled single quotes (standard SQL escaping)
// Only match literal backslash followed by single quote
content = content.replace(/\\'/g, "''");

// Verify
const afterCount = (content.match(/\\'/g) || []).length;
console.log('Backslash-quote occurrences after:', afterCount);

if (afterCount === 0) {
  fs.writeFileSync(sqlPath, content, 'utf-8');
  console.log('Successfully replaced all', beforeCount, 'occurrences.');
  console.log('File updated.');
} else {
  console.log('ERROR: Some occurrences were not replaced!');
}
