CREATE TABLE IF NOT EXISTS cotizaciones (
  id TEXT PRIMARY KEY,
  negocio_id UUID REFERENCES negocios(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  cliente TEXT,
  notas TEXT,
  validez INTEGER DEFAULT 30,
  items JSONB NOT NULL DEFAULT '[]',
  sub INTEGER DEFAULT 0,
  iva INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  estado TEXT DEFAULT 'pendiente',
  fecha TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cotizaciones_rw" ON cotizaciones FOR ALL USING (true) WITH CHECK (true);
