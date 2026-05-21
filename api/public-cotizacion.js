const SUPABASE_URL = 'https://rgfrupcyaqsjbyqbmsng.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZnJ1cGN5YXFzamJ5cWJtc25nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYzMTc2NSwiZXhwIjoyMDkyMjA3NzY1fQ.oVqstMYdpMZajy0GDz9zjsNf98Rv6rLq5n3shIKZPJE';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID requerido' });

  // Buscar cotización en Supabase
  const r = await fetch(`${SUPABASE_URL}/rest/v1/cotizaciones?id=eq.${id}&select=*`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const data = await r.json();
  if (!data?.length) return res.status(404).json({ error: 'No encontrada' });

  const c = data[0];
  // Buscar datos del negocio
  const nr = await fetch(`${SUPABASE_URL}/rest/v1/negocios?id=eq.${c.negocio_id}&select=nombre,rut,direccion,contacto,logo_url`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
  });
  const neg = (await nr.json())[0] || {};

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ cotizacion: c, negocio: neg });
}
