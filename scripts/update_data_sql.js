const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function main() {
  // 1. Get all descriptions from MySQL
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '608052',
    database: 'tourism_db', charset: 'utf8mb4'
  });

  const [rows] = await conn.query('SELECT id, detail_description FROM spot_place ORDER BY id');
  await conn.end();

  const descMap = {};
  for (const r of rows) {
    descMap[r.id] = r.detail_description || '';
  }
  console.log('Fetched ' + Object.keys(descMap).length + ' descriptions from DB');

  // 2. Read data.sql as a single string
  const dataPath = path.join(__dirname, '..', 'sql', 'data.sql');
  const content = fs.readFileSync(dataPath, 'utf-8');

  // 3. Find each INSERT statement and replace the detail_description
  // The pattern: INSERT ... VALUES (...);
  // We need to be careful because the detail_description can contain newlines
  // Let's find each INSERT into spot_place and replace that entire statement

  // Build a map of id -> new INSERT line (single line with escaped newlines)
  let updated = 0;

  // We'll rebuild the file by replacing each INSERT statement
  // Strategy: find each spot_place INSERT, extract id, rebuild with new desc

  // Split by INSERT INTO `spot_place`
  const parts = content.split(/(INSERT INTO `spot_place` \([^)]+\) VALUES \()/);

  // parts[0] = before first INSERT
  // parts[1] = prefix 1, parts[2] = values 1, parts[3] = prefix 2, parts[4] = values 2, ...

  let result = parts[0] || '';
  for (let i = 1; i < parts.length; i += 2) {
    const prefix = parts[i];
    const valuesAndRest = parts[i + 1] || '';

    // Find where the VALUES end (matching );)
    // The ) is the 16th field (deleted), followed by );
    // But since detail_description can contain parentheses and semicolons,
    // we need to find the actual end of the INSERT

    // Extract id from the first field in values
    const idMatch = valuesAndRest.match(/^'([^']+)'/);
    if (!idMatch) {
      result += prefix + valuesAndRest;
      continue;
    }

    const id = idMatch[1];
    const newDesc = descMap[id];
    if (newDesc === undefined) {
      result += prefix + valuesAndRest;
      continue;
    }

    // Find the end of the INSERT statement: the pattern is ',0);\n (last field is 0)
    // The tricky part: detail_description might contain ',0); as part of the text
    // So we need to be more careful. Let's find the closing ); where the 0 before it
    // is NOT inside a string.

    // Since the deleted field is always 0 followed by );\n, and the line after an INSERT
    // is either another INSERT or something else, let's search for the pattern:
    // the closing ); that's preceded by ',0) or just 0)

    // Actually, looking at the format: VALUES (...detail_description...',0);\n
    // Let's find the last occurrence of ',0); after the VALUES start
    // This is risky but should work since deleted=0 is always the final field

    // Better approach: search from the end - find the last ',0); in the values part
    // Actually the more reliable way is to count single quotes to find string boundaries

    // Let's use a different approach: parse the values part to extract fields
    // We know there are exactly 16 fields

    function parseField(str, startIdx) {
      while (startIdx < str.length && str[startIdx] === ' ') startIdx++;
      if (startIdx >= str.length) return { value: '', end: startIdx, isString: false };

      if (str[startIdx] === "'") {
        // String field - handle escaped single quotes
        let val = '';
        let j = startIdx + 1;
        while (j < str.length) {
          if (str[j] === "'") {
            if (j + 1 < str.length && str[j + 1] === "'") {
              val += "'";
              j += 2;
            } else {
              j++; // skip closing quote
              break;
            }
          } else {
            val += str[j];
            j++;
          }
        }
        return { value: val, end: j, isString: true };
      } else {
        // Numeric field
        let val = '';
        let j = startIdx;
        while (j < str.length && str[j] !== ',' && str[j] !== ')') {
          val += str[j];
          j++;
        }
        return { value: val.trim(), end: j, isString: false };
      }
    }

    let idx = 0;
    const fields = [];
    for (let fi = 0; fi < 16; fi++) {
      const result2 = parseField(valuesAndRest, idx);
      fields.push(result2.value);
      idx = result2.end;
      // Skip whitespace
      while (idx < valuesAndRest.length && valuesAndRest[idx] === ' ') idx++;
      if (idx < valuesAndRest.length && valuesAndRest[idx] === ',') {
        idx++; // skip comma
      }
    }

    if (fields.length < 15) {
      console.log('  WARN: only ' + fields.length + ' fields for ' + id);
      result += prefix + valuesAndRest;
      continue;
    }

    fields[14] = newDesc.replace(/'/g, "''");

    // Rebuild the VALUES part
    const strFields = new Set([0, 1, 2, 3, 4, 10, 11, 12, 13, 14]);
    const fieldStrs = fields.map((f, fi) => {
      if (strFields.has(fi)) return "'" + f + "'";
      return String(f);
    });

    const newValues = fieldStrs.join(',') + ')';

    // Find what comes after the INSERT statement (after ',0);')
    // We need to find the closing ',0);' and everything after
    // The closing is: fields[14] ends with ' then ,0);
    // But we already parsed it, so we know idx ends at the start of ',0)'
    // Let's scan forward from idx to find '); and then the rest
    while (idx < valuesAndRest.length && valuesAndRest[idx] === ' ') idx++;
    if (idx < valuesAndRest.length && valuesAndRest[idx] === ',') {
      idx++; // skip comma before 0
      while (idx < valuesAndRest.length && valuesAndRest[idx] === ' ') idx++;
      if (idx < valuesAndRest.length && valuesAndRest[idx] === '0') {
        idx++;
        while (idx < valuesAndRest.length && valuesAndRest[idx] === ' ') idx++;
        if (idx < valuesAndRest.length && valuesAndRest[idx] === ')') {
          idx++;
          while (idx < valuesAndRest.length && valuesAndRest[idx] === ' ') idx++;
          if (idx < valuesAndRest.length && valuesAndRest[idx] === ';') {
            idx++;
          }
        }
      }
    }

    const afterInsert = valuesAndRest.substring(idx);
    result += prefix + newValues + ';' + afterInsert;
    updated++;
  }

  fs.writeFileSync(dataPath, result, 'utf-8');
  console.log('Updated ' + updated + ' rows in data.sql');
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
