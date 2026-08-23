// Vercel Function segura para operaciones que requieren service role
const SUPABASE_URL = 'https://rgfrupcyaqsjbyqbmsng.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = 'sb_publishable_Zcymc3VefibnpxZhKoVxNQ_4bWjAMBK';
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
  // Usar service key si está disponible, anon key como fallback para entornos locales
  const apiKey = SUPABASE_KEY || SUPABASE_ANON_KEY;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': apiKey, 'Authorization': `Bearer ${token}` }
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
  const adminActions = ['delete_user', 'change_plan', 'change_password', 'list_negocios', 'generate_magic_link', 'load_negocio'];
  if (adminActions.includes(action)) {
    const isAdmin = await verificarAdmin(authHeader);
    if (!isAdmin) return res.status(403).json({ error: 'No autorizado' });
  }

  try {
    // ── GENERAR MAGIC LINK (impersonación admin) ──
    if (action === 'generate_magic_link') {
      const { email, redirect_to } = payload;
      if (!email) return res.status(400).json({ error: 'Email requerido' });
      if (!SUPABASE_KEY) return res.status(503).json({ error: 'sin_service_key' });
      const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ type: 'magiclink', email, redirect_to: redirect_to || 'https://stockeo.cl' })
      });
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: data?.message || data?.msg || 'Error generando link' });
      // Supabase puede devolver el link en distintos lugares según versión
      const link = data?.action_link || data?.properties?.action_link;
      if (!link) return res.status(500).json({ error: 'Link no retornado por Supabase', debug: Object.keys(data||{}) });
      return res.status(200).json({ ok: true, link });
    }

    // ── CARGAR DATOS COMPLETOS DE UN NEGOCIO (bypass RLS) ──
    if (action === 'load_negocio') {
      const { negocio_id } = payload;
      if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
      if (!SUPABASE_KEY) return res.status(503).json({ error: 'solo_produccion' });
      const base = `${SUPABASE_URL}/rest/v1`;
      const h = { ...sbHeaders, 'Prefer': 'return=representation' };
      const [rNeg, rInv, rVts, rBols, rCats, rCots] = await Promise.all([
        fetch(`${base}/negocios?id=eq.${negocio_id}&select=nombre,rut,direccion,contacto,logo_url,email,plan,plan_activo`, { headers: h }),
        fetch(`${base}/inventario?negocio_id=eq.${negocio_id}&order=created_at.desc&limit=500`, { headers: h }),
        fetch(`${base}/ventas?negocio_id=eq.${negocio_id}&order=fecha.desc&limit=200`, { headers: h }),
        fetch(`${base}/boletas?negocio_id=eq.${negocio_id}&eliminada=eq.false&order=fecha.desc&limit=200`, { headers: h }),
        fetch(`${base}/categorias?negocio_id=eq.${negocio_id}&order=nombre`, { headers: h }),
        fetch(`${base}/cotizaciones?negocio_id=eq.${negocio_id}&deleted_at=is.null&order=fecha.desc&limit=200`, { headers: h }),
      ]);
      const [negArr, inv, vts, bols, cats, cots] = await Promise.all([
        rNeg.json(), rInv.json(), rVts.json(), rBols.json(), rCats.json(), rCots.json()
      ]);
      return res.status(200).json({
        ok: true,
        negocio: negArr?.[0] || null,
        inventario: Array.isArray(inv) ? inv : [],
        ventas: Array.isArray(vts) ? vts : [],
        boletas: Array.isArray(bols) ? bols : [],
        categorias: Array.isArray(cats) ? cats : [],
        cotizaciones: Array.isArray(cots) ? cots : [],
      });
    }

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
      const { negocio_id, plan, activo, vence } = payload;
      if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
      const r = await fetch(`${SUPABASE_URL}/rest/v1/negocios?id=eq.${negocio_id}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({ plan, plan_activo: activo !== false, plan_vence: vence || null })
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        return res.status(500).json({ error: d?.message || 'Error actualizando plan' });
      }
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
