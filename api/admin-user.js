const SUPABASE_URL = 'https://rgfrupcyaqsjbyqbmsng.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;
const ADMIN_EMAIL  = 'gersonfabianparra@gmail.com';

async function getCallerUser(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!r.ok) return null;
  return r.json();
}

export default async function handler(req, res) {
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Servidor no configurado' });

  const caller = await getCallerUser(req.headers.authorization);
  if (!caller?.id) return res.status(401).json({ error: 'No autorizado' });

  const base = `${SUPABASE_URL}/auth/v1/admin/users`;
  const sh = { 'Content-Type': 'application/json', 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };

  // POST — crear usuario (admin panel o team)
  if (req.method === 'POST') {
    const r = await fetch(base, { method: 'POST', headers: sh, body: JSON.stringify(req.body) });
    const d = await r.json();
    return res.status(r.status).json(d);
  }

  // GET — buscar usuario por email/filter (solo admin o equipo del negocio)
  if (req.method === 'GET') {
    const { userId, email, filter, page = 1, per_page = 50 } = req.query;
    let url;
    if (userId)      url = `${base}/${userId}`;
    else if (email)  url = `${base}?email=${encodeURIComponent(email)}`;
    else if (filter) url = `${base}?filter=${encodeURIComponent(filter)}&page=${page}&per_page=${per_page}`;
    else {
      // Listar todos — solo super admin
      if (caller.email !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' });
      url = `${base}?page=${page}&per_page=${per_page}`;
    }
    const r = await fetch(url, { headers: sh });
    const d = await r.json();
    return res.status(r.status).json(d);
  }

  // PUT — actualizar contraseña
  if (req.method === 'PUT') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId requerido' });
    const r = await fetch(`${base}/${userId}`, { method: 'PUT', headers: sh, body: JSON.stringify(req.body) });
    const d = await r.json();
    return res.status(r.status).json(d);
  }

  // DELETE — eliminar usuario
  if (req.method === 'DELETE') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId requerido' });
    const r = await fetch(`${base}/${userId}`, { method: 'DELETE', headers: sh });
    if (r.status === 204) return res.status(204).end();
    const d = await r.json();
    return res.status(r.status).json(d);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}
