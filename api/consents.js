import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!databaseUrl) {
    return res.status(500).json({
      error: 'Neon Database URL not configured in Vercel environment variables (DATABASE_URL / POSTGRES_URL).'
    });
  }

  try {
    const sql = neon(databaseUrl);

    // Auto-create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS signed_consents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_name VARCHAR(100) NOT NULL,
        birth_date VARCHAR(20),
        phone VARCHAR(50),
        is_minor BOOLEAN DEFAULT FALSE,
        representative_name VARCHAR(100),
        representative_relation VARCHAR(50),
        agreed_items JSONB NOT NULL DEFAULT '{}'::jsonb,
        signed_date VARCHAR(20) NOT NULL,
        signed_at TIMESTAMPTZ DEFAULT NOW(),
        pdf_path TEXT,
        pdf_url TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 1. GET: Fetch list with optional search query
    if (req.method === 'GET') {
      const q = req.query?.q ? String(req.query.q).trim() : '';

      let rows;
      if (q) {
        const searchPattern = `%${q}%`;
        rows = await sql`
          SELECT * FROM signed_consents 
          WHERE patient_name ILIKE ${searchPattern} 
             OR phone ILIKE ${searchPattern} 
             OR birth_date ILIKE ${searchPattern} 
             OR signed_date ILIKE ${searchPattern}
          ORDER BY created_at DESC 
          LIMIT 200;
        `;
      } else {
        rows = await sql`
          SELECT * FROM signed_consents 
          ORDER BY created_at DESC 
          LIMIT 200;
        `;
      }

      return res.status(200).json({ success: true, data: rows });
    }

    // 2. POST: Insert new consent record
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const {
        patient_name,
        birth_date,
        phone,
        is_minor = false,
        representative_name = '',
        representative_relation = '',
        agreed_items = {},
        signed_date,
        signed_at,
        pdf_path = '',
        pdf_url
      } = body;

      if (!patient_name || !pdf_url) {
        return res.status(400).json({ error: 'patient_name and pdf_url are required.' });
      }

      const inserted = await sql`
        INSERT INTO signed_consents (
          patient_name,
          birth_date,
          phone,
          is_minor,
          representative_name,
          representative_relation,
          agreed_items,
          signed_date,
          signed_at,
          pdf_path,
          pdf_url
        ) VALUES (
          ${patient_name},
          ${birth_date || ''},
          ${phone || ''},
          ${Boolean(is_minor)},
          ${representative_name || ''},
          ${representative_relation || ''},
          ${JSON.stringify(agreed_items)},
          ${signed_date || new Date().toISOString().slice(0, 10)},
          ${signed_at ? new Date(signed_at) : new Date()},
          ${pdf_path || ''},
          ${pdf_url}
        )
        RETURNING *;
      `;

      return res.status(200).json({ success: true, data: inserted[0] });
    }

    // 3. DELETE: Delete record by id
    if (req.method === 'DELETE') {
      const id = req.query?.id || (req.body && (typeof req.body === 'string' ? JSON.parse(req.body).id : req.body.id));
      if (!id) {
        return res.status(400).json({ error: 'id is required for deletion.' });
      }

      await sql`DELETE FROM signed_consents WHERE id = ${id};`;
      return res.status(200).json({ success: true, message: 'Deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Neon API Error:', error);
    return res.status(500).json({ error: error.message || 'Database error occurred' });
  }
}
