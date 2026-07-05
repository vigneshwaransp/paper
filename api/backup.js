import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
let sql = null;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  if (!connectionString) {
    return res.status(500).json({ status: 'error', message: 'DATABASE_URL environment variable is missing on Vercel.' });
  }

  try {
    if (!sql) {
      sql = postgres(connectionString);
    }

    // Auto-create Friday sync table on startup
    await sql`
      CREATE TABLE IF NOT EXISTS friday_sync (
        key VARCHAR(50) PRIMARY KEY,
        data JSONB
      );
    `;

    const { key, data } = req.body;
    if (!key) throw new Error("Missing sync key.");

    await sql`
      INSERT INTO friday_sync (key, data)
      VALUES (${key}, ${JSON.stringify(data)})
      ON CONFLICT (key)
      DO UPDATE SET data = EXCLUDED.data
    `;

    return res.status(200).json({ status: 'success', message: 'Saved to Supabase!' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
