const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '608052',
    database: 'tourism_db', charset: 'utf8mb4'
  });

  const [places] = await conn.query('SELECT * FROM spot_place ORDER BY id');
  await conn.end();

  const columns = ['id', 'name', 'type', 'keywords', 'features', 'rating', 'rating_count',
    'click_count', 'lat', 'lng', 'address', 'open_time', 'image', 'description',
    'detail_description', 'deleted'];

  const stringCols = new Set(['id', 'name', 'type', 'keywords', 'features',
    'address', 'open_time', 'image', 'description', 'detail_description']);

  // Re-read the original data.sql to get non-place INSERTs and other content
  const dataPath = path.join(__dirname, '..', 'sql', 'data.sql');
  const original = fs.readFileSync(dataPath, 'utf-8');

  // Extract everything before the first spot_place INSERT
  const firstInsert = original.indexOf('INSERT INTO `spot_place`');
  const header = firstInsert >= 0 ? original.substring(0, firstInsert) : '';

  // Extract everything after the last spot_place INSERT
  // Find all spot_place INSERTs in the original (they're already corrupted but we just need boundaries)
  // Actually let's just find the last occurrence of a spot_place INSERT and get what's after
  const lastIdx = original.lastIndexOf('INSERT INTO `spot_place`');
  let footer = '';
  if (lastIdx >= 0) {
    // Find the end of this last INSERT - the pattern is ');\n
    let searchFrom = lastIdx;
    let endIdx = original.indexOf(');\n', searchFrom);
    while (endIdx >= 0) {
      // Check if this is the actual end (the next non-whitespace is another INSERT or end of file)
      const after = original.substring(endIdx + 3);
      const trimmed = after.trimStart();
      if (trimmed.startsWith('--') || trimmed.startsWith('INSERT INTO') || trimmed.startsWith('USE') || trimmed.startsWith('SET') || trimmed.startsWith('/*') || trimmed.startsWith('ALTER') || trimmed.length === 0) {
        footer = after;
        break;
      }
      searchFrom = endIdx + 1;
      endIdx = original.indexOf(');\n', searchFrom);
    }
  }

  // Generate place INSERTs
  const colList = columns.map(c => '`' + c + '`').join(',');

  const insertLines = places.map(p => {
    const vals = columns.map(col => {
      let val = p[col];
      if (val === null || val === undefined) return 'NULL';
      if (stringCols.has(col)) {
        // mysql2 auto-parses JSON strings; convert back to JSON string
        let strVal;
        if (typeof val === 'object' && val !== null) {
          strVal = JSON.stringify(val);
        } else {
          strVal = String(val);
        }
        // Escape single quotes
        const escaped = strVal.replace(/'/g, "''");
        // Escape backslashes
        const escaped2 = escaped.replace(/\\/g, '\\\\');
        return "'" + escaped2 + "'";
      }
      return String(val);
    });
    return 'INSERT INTO `spot_place` (' + colList + ') VALUES (' + vals.join(',') + ');';
  });

  const newContent = header + insertLines.join('\n') + '\n' + footer;
  fs.writeFileSync(dataPath, newContent, 'utf-8');
  console.log('Generated ' + insertLines.length + ' INSERT statements');
  console.log('Done rebuilding data.sql');
}

main().catch(err => { console.error(err); process.exit(1); });
