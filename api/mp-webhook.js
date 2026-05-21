const SUPABASE_URL = 'https://rgfrupcyaqsjbyqbmsng.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZnJ1cGN5YXFzamJ5cWJtc25nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjYzMTc2NSwiZXhwIjoyMDkyMjA3NzY1fQ.oVqstMYdpMZajy0GDz9zjsNf98Rv6rLq5n3shIKZPJE';
const MP_TOKEN = 'APP_USR-2880738120535215-042223-df8ca141899c84d0e2a9bf090c30113d-222695931';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const topic = req.query.topic || req.query.type;
    const id = req.query.id || req.query['data.id'];
    console.log('[webhook] topic:', topic, 'id:', id);
    if (!topic || !id) return res.status(200).json({ ok: true });
    if (topic !== 'payment' && topic !== 'merchant_order') return res.status(200).json({ skipped: true });

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${MP_TOKEN}` }
    });
    if (!mpRes.ok) return res.status(200).json({ ok: false });
    const payment = await mpRes.json();
    console.log('[webhook] status:', payment.status, 'ref:', payment.external_reference);
    if (payment.status !== 'approved') return res.status(200).json({ status: payment.status });

    const parts = (payment.external_reference || '').split('|');
    const negocioId = parts[0];
    const plan = parts[1];
    if (!negocioId || !plan) return res.status(200).json({ error: 'ref invalida' });

    const vence = new Date();
    vence.setDate(vence.getDate() + 30);

    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/negocios?id=eq.${negocioId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ plan, plan_activo: true, plan_vence: vence.toISOString() })
    });
    const sbText = await sbRes.text();
    console.log('[webhook] Supabase:', sbRes.status, sbText);
    if (!sbRes.ok) return res.status(500).json({ error: 'sb error', detail: sbText });

    await fetch(`${SUPABASE_URL}/rest/v1/pagos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ negocio_id: negocioId, plan, monto: payment.transaction_amount || 0, mp_payment_id: String(payment.id), mp_status: payment.status, fecha: new Date().toISOString() })
    }).catch(e => console.warn(e.message));

    console.log(`[webhook] Plan ${plan} activado para ${negocioId}`);
    return res.status(200).json({ ok: true, plan, negocioId });
  } catch (err) {
    console.error('[webhook] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
