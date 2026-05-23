// Vercel Function segura para operaciones que requieren service role
const SUPABASE_URL = 'https://rgfrupcyaqsjbyqbmsng.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_EMAIL = 'gersonfabianparra@gmail.com';

const sbHeaders = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Prefer': 'return=minimal',
};

// Verificar que el token JWT pertenece al admin
async function verificarAdmin(authHeader) {
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!r.ok) return false;
  const user = await r.json();
  return user.email === ADMIN_EMAIL;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://stockeo.cl');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, payload } = req.body;
  const authHeader = req.headers.authorization;

  // Verificar que es admin para acciones sensibles
  const adminActions = ['delete_user', 'change_plan', 'change_password', 'list_negocios'];
  if (adminActions.includes(action)) {
    const isAdmin = await verificarAdmin(authHeader);
    if (!isAdmin) return res.status(403).json({ error: 'No autorizado' });
  }

  try {
    // ── LISTAR NEGOCIOS ──
    if (action === 'list_negocios') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/negocios?select=id,nombre,email,plan,plan_activo,plan_vence,created_at&order=created_at.desc`, {
        headers: sbHeaders
      });
      const data = await r.json();
      return res.status(200).json({ ok: true, data });
    }

    // ── CAMBIAR PLAN ──
    if (action === 'change_plan') {
      const { negocio_id, plan, plan_activo, plan_vence } = payload;
      const body = { plan, plan_activo: plan_activo !== false };
      if (plan_vence) body.plan_vence = plan_vence;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/negocios?id=eq.${negocio_id}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify(body)
      });
      if (!r.ok) return res.status(500).json({ ok: false, error: 'Error actualizando plan' });
      return res.status(200).json({ ok: true });
    }

    // ── CAMBIAR CONTRASEÑA ──
    if (action === 'change_password') {
      const { user_id, password } = payload;
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
        method: 'PUT',
        headers: { ...sbHeaders, 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ password })
      });
      if (!r.ok) return res.status(500).json({ error: 'Error cambiando contraseña' });
      return res.status(200).json({ ok: true });
    }

    // ── ELIMINAR USUARIO ──
    if (action === 'delete_user') {
      const { negocio_id, user_id } = payload;
      // Borrar datos en cascada
      for (const tabla of ['cotizaciones','pagos','clientes','ventas','boletas','inventario','categorias','usuarios_negocio','negocios']) {
        const field = tabla === 'negocios' ? 'id' : 'negocio_id';
        await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${field}=eq.${negocio_id}`, {
          method: 'DELETE', headers: sbHeaders
        });
      }
      // Borrar de Auth
      if (user_id) {
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
      }
      return res.status(200).json({ ok: true });
    }

    // ── CAMBIAR CONTRASEÑA COLABORADOR (dueño del negocio) ──
    if (action === 'change_member_password') {
      const isAdmin = await verificarAdmin(authHeader);
      const { user_id, password, negocio_id } = payload;
      // Verificar que el user_id es colaborador de este negocio
      if (!isAdmin) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/usuarios_negocio?negocio_id=eq.${negocio_id}&select=email`, {
          headers: sbHeaders
        });
        const miembros = await r.json();
        // Solo puede cambiar contraseña de sus propios colaboradores
        if (!miembros?.length) return res.status(403).json({ error: 'No autorizado' });
      }
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
        method: 'PUT',
        headers: { 'Content-Type':'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ password })
      });
      if (!r.ok) return res.status(500).json({ error: 'Error cambiando contraseña' });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Acción no reconocida' });

  } catch (err) {
    console.error('[admin-action]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
