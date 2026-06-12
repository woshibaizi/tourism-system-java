const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function apply() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '608052',
    database: 'tourism_db',
    charset: 'utf8mb4',
    multipleStatements: true
  });

  const sqlDir = path.join(__dirname, '..', 'sql');
  const batches = [
    'descriptions_batch1.sql',
    'descriptions_batch2.sql',
    'descriptions_batch3.sql',
    'descriptions_batch4.sql'
  ];

  for (const file of batches) {
    const filePath = path.join(sqlDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`SKIP ${file} (not found)`);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf-8');
    console.log(`Running ${file} (${sql.length} chars)...`);
    try {
      await conn.query(sql);
      console.log(`  OK ${file}`);
    } catch (err) {
      console.error(`  ERROR ${file}: ${err.message}`);
    }
  }

  // Verify
  const [rows] = await conn.query(
    "SELECT id, name, type, CHAR_LENGTH(detail_description) as len FROM spot_place ORDER BY id"
  );
  let emptyCount = 0;
  for (const r of rows) {
    if (!r.len || r.len < 50) {
      console.log(`  SHORT: ${r.id} ${r.name} (${r.len} chars)`);
      emptyCount++;
    }
  }
  console.log(`Verified: ${rows.length} rows, ${emptyCount} with short/empty description`);

  await conn.end();
  console.log('Done.');
}

apply().catch(err => { console.error(err); process.exit(1); });
