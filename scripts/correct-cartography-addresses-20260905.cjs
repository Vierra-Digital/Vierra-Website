// Fixed, source-verified corrections. Dry run by default; --apply commits the transaction.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const directory = path.resolve(__dirname, '../docs/audits');
const changes = require('../docs/audits/cartography-address-corrections-20260905.json');
const apply = process.argv.includes('--apply');
const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 10000 });

(async () => {
  try {
    await db.connect();
    await db.query('BEGIN');
    const before = [];
    for (const change of changes) {
      const result = await db.query('SELECT id, name, domain, address, lat, lng, updated_at FROM cartography_companies WHERE id=$1 FOR UPDATE', [change.id]);
      const row = result.rows[0];
      if (!row || row.name !== change.name || row.domain !== change.domain || row.address !== change.oldAddress) {
        throw new Error(`Precondition failed for ${change.name}; no changes committed.`);
      }
      before.push({ ...row, newAddress: change.newAddress, source: change.source });
    }
    if (!apply) {
      await db.query('ROLLBACK');
      console.log(JSON.stringify({ dryRun: true, verifiedRows: before.length }));
      return;
    }
    const backup = path.join(directory, `cartography-address-backup-${Date.now()}.json`);
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n', { flag: 'wx' });
    for (const change of changes) {
      // Old coordinates point at the wrong address. Do not invent replacement coordinates.
      const result = await db.query('UPDATE cartography_companies SET address=$1, lat=NULL, lng=NULL, updated_at=now() WHERE id=$2 RETURNING id, address, lat, lng', [change.newAddress, change.id]);
      if (result.rowCount !== 1 || result.rows[0].address !== change.newAddress) throw new Error('Update verification failed');
    }
    await db.query('COMMIT');
    const result = await db.query('SELECT id, address, lat, lng FROM cartography_companies WHERE id=ANY($1::uuid[])', [changes.map(c => c.id)]);
    console.log(JSON.stringify({ committed: result.rowCount, backup, rows: result.rows }, null, 2));
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
