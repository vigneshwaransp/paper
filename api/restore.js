import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
let sql = null;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  if (!connectionString) {
    return res.status(500).json({ status: 'error', message: 'DATABASE_URL environment variable is missing on Vercel.' });
  }

  const { key } = req.query;
  if (!key) {
    return res.status(400).json({ status: 'error', message: 'Missing key parameter.' });
  }

  try {
    if (!sql) {
      sql = postgres(connectionString);
    }

    const result = await sql`
      SELECT data FROM friday_sync WHERE key = ${key}
    `;

    if (result.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Record not found' });
    }

    return res.status(200).json({ status: 'success', data: result[0].data });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
