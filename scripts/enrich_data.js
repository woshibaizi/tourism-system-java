const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'sql', 'data.sql');
let content = fs.readFileSync(dataPath, 'utf-8');

// 1. Add detail_description to column list in spot_place INSERTs
content = content.replace(
  /(`image`,`description`,`deleted`)/g,
  '`image`,`description`,`detail_description`,`deleted`'
);

// 2. For each spot_place INSERT line, add NULL before the deleted value
const lines = content.split(/\r?\n/);
const newLines = lines.map(line => {
  if (line.includes("INSERT INTO `spot_place`")) {
    return line.replace(/',0\);\r?$/, "',NULL,0);");
  }
  return line;
});

fs.writeFileSync(dataPath, newLines.join('\n'), 'utf-8');
console.log(`Done! Processed ${newLines.filter(l => l.includes('spot_place')).length} spot_place lines.`);
