import postgres from 'postgres'

let connectionString = process.env.DATABASE_URL
if (connectionString) {
  connectionString = connectionString.replace(/\[|\]/g, '').trim();
}

const sql = postgres(connectionString)

export default sql
