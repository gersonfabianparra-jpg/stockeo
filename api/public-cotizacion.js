const SUPABASE_URL = 'https://rgfrupcyaqsjbyqbmsng.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (!SUPABASE_KEY) return res.status(500).json({ error: 'Configuración del servidor incompleta' });
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID requerido' });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/cotizaciones?id=eq.${id}&select=*`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const data = await r.json();
  if (!data?.length) return res.status(404).json({ error: 'No encontrada' });

  const c = data[0];
  const nr = await fetch(`${SUPABASE_URL}/rest/v1/negocios?id=eq.${c.negocio_id}&select=nombre,rut,direccion,contacto,logo_url`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const neg = (await nr.json())[0] || {};

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ cotizacion: c, negocio: neg });
}
