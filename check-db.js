import fs from 'fs';
import path from 'path';

// Load local .env variables
if (fs.existsSync('.env')) {
  const envText = fs.readFileSync('.env', 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.trim().match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = value;
    }
  });
}

async function checkDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not defined in .env file.");
    return;
  }

  console.log("Connecting to Supabase PostgreSQL database...");
  try {
    const dbModule = await import('./db.js');
    const sql = dbModule.default;

    // Check table records
    const result = await sql`
      SELECT key, data FROM friday_sync;
    `;

    console.log("====================================================");
    console.log(`📊 Supabase Records Found: ${result.length}`);
    console.log("====================================================");
    
    result.forEach(row => {
      console.log(`Key: "${row.key}"`);
      console.log(`Data Preview:`, JSON.stringify(row.data, null, 2).substring(0, 250) + "...\n");
    });
    
    // Close connection
    await sql.end();
  } catch (err) {
    console.error("❌ Database query failed:", err.message);
  }
}

checkDatabase();
