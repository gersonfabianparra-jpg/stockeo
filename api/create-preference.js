const SUPABASE_URL = 'https://rgfrupcyaqsjbyqbmsng.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZnJ1cGN5YXFzamJ5cWJtc25nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYzMTc2NSwiZXhwIjoyMDkyMjA3NzY1fQ.oVqstMYdpMZajy0GDz9zjsNf98Rv6rLq5n3shIKZPJE';
const MP_TOKEN = 'APP_USR-2880738120535215-042223-df8ca141899c84d0e2a9bf090c30113d-222695931';
const SITE_URL = 'https://stockeo.cl';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { plan, negocio_id, email } = req.body;
    if (!negocio_id) return res.status(400).json({ error: 'negocio_id requerido' });
    const negRes = await fetch(`${SUPABASE_URL}/rest/v1/negocios?id=eq.${negocio_id}&select=id,nombre,email`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const negocios = await negRes.json();
    if (!negocios || negocios.length === 0) return res.status(400).json({ error: 'Negocio no encontrado' });
    const emailFinal = email || negocios[0].email || '';
    const PLANES = { pro: { title: 'Stockeo Pro', price: 9990 }, business: { title: 'Stockeo Business', price: 19990 } };
    const planData = PLANES[plan];
    if (!planData) return res.status(400).json({ error: 'Plan inválido' });
    const preference = {
      items: [{ title: planData.title, quantity: 1, currency_id: 'CLP', unit_price: planData.price }],
      payer: { email: emailFinal },
      external_reference: `${negocio_id}|${plan}`,
      back_urls: { success: `${SITE_URL}?pago=success&plan=${plan}`, failure: `${SITE_URL}?pago=failure`, pending: `${SITE_URL}?pago=pending` },
      auto_return: 'all',
      notification_url: `${SITE_URL}/api/mp-webhook`,
      statement_descriptor: 'STOCKEO',
    };
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MP_TOKEN}` },
      body: JSON.stringify(preference),
    });
    const data = await mpRes.json();
    if (!mpRes.ok) return res.status(500).json({ error: data.message || 'Error MP' });
    return res.status(200).json({ id: data.id, init_point: data.init_point, sandbox_init_point: data.sandbox_init_point });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
