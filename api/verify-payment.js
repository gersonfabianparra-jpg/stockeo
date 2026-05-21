const SUPABASE_URL = 'https://rgfrupcyaqsjbyqbmsng.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZnJ1cGN5YXFzamJ5cWJtc25nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYzMTc2NSwiZXhwIjoyMDkyMjA3NzY1fQ.oVqstMYdpMZajy0GDz9zjsNf98Rv6rLq5n3shIKZPJE';
const MP_TOKEN = 'APP_USR-2880738120535215-042223-df8ca141899c84d0e2a9bf090c30113d-222695931';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { negocio_id, plan, payment_id } = req.body;
    if (!negocio_id || !plan) return res.status(400).json({ error: 'Faltan parámetros' });
    if (payment_id) {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
        headers: { 'Authorization': `Bearer ${MP_TOKEN}` }
      });
      if (mpRes.ok) {
        const payment = await mpRes.json();
        if (payment.status !== 'approved') return res.status(200).json({ ok: false, status: payment.status });
        const ref = (payment.external_reference || '').split('|');
        if (ref[0] !== negocio_id) return res.status(400).json({ error: 'Negocio no coincide' });
      }
    }
    const vence = new Date();
    vence.setDate(vence.getDate() + 30);
    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/negocios?id=eq.${negocio_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ plan, plan_activo: true, plan_vence: vence.toISOString() })
    });
    if (!sbRes.ok) {
      const t = await sbRes.text();
      return res.status(500).json({ error: 'Error actualizando plan', detail: t });
    }
    if (payment_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ negocio_id, plan, monto: plan === 'pro' ? 9990 : 19990, mp_payment_id: String(payment_id), mp_status: 'approved', fecha: new Date().toISOString() })
      }).catch(e => console.warn(e.message));
    }
    return res.status(200).json({ ok: true, plan });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
