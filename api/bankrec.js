/* =====================================================================
   api/bankrec.js — Vercel Serverless Function (the "server" the static
   site otherwise lacks). Stores the parsed ledger in a single Vercel Blob
   so EVERY browser hitting the live site sees the same upload.

   GET    -> returns the stored JSON (or null)
   POST   -> overwrites the stored JSON
   DELETE -> removes it

   Mirrors the /api/bankrec endpoint in server.js used for local dev, so the
   client (js/ledger.js) is identical in both environments.
   Auth: @vercel/blob reads BLOB_READ_WRITE_TOKEN from the environment, which
   was wired to the project when the "yardi-ledger" blob store was linked.
   ===================================================================== */
const PATHNAME = 'bankrec.json';

function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    var body = '';
    req.on('data', function (c) { body += c; if (body.length > 8e6) req.destroy(); });   // 8 MB guard
    req.on('end', function () { resolve(body); });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { put, list, del } = await import('@vercel/blob');   // dynamic import works from CommonJS

    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: PATHNAME, limit: 1 });
      if (!blobs.length) return res.status(200).json(null);
      const r = await fetch(blobs[0].url, { cache: 'no-store' });
      const text = await r.text();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(text || 'null');
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // Vercel may pre-parse a JSON body into req.body; fall back to raw stream.
      let data = req.body;
      if (data === undefined) data = await readRawBody(req);
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { return res.status(400).json({ error: 'invalid json' }); }
      }
      if (!data || typeof data !== 'object') return res.status(400).json({ error: 'invalid json' });
      await put(PATHNAME, JSON.stringify(data), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 0
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { blobs } = await list({ prefix: PATHNAME, limit: 1 });
      if (blobs.length) await del(blobs[0].url);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: String((err && err.message) || err) });
  }
};
