-- ══════════════════════════════════════════════════════════
-- COTIZACIONES — ejecutar en Supabase SQL Editor
-- Puede ejecutarse varias veces sin error (IF NOT EXISTS)
-- ══════════════════════════════════════════════════════════

-- 1. Tabla principal (si no existe)
CREATE TABLE IF NOT EXISTS cotizaciones (
  id                TEXT PRIMARY KEY,
  negocio_id        UUID REFERENCES negocios(id) ON DELETE CASCADE,
  numero            INTEGER NOT NULL,
  cliente           TEXT DEFAULT '',
  cliente_rut       TEXT DEFAULT '',
  cliente_tel       TEXT DEFAULT '',
  cliente_email     TEXT DEFAULT '',
  notas             TEXT DEFAULT '',
  validez           INTEGER DEFAULT 30,
  items             JSONB NOT NULL DEFAULT '[]',
  sub               INTEGER DEFAULT 0,
  iva               INTEGER DEFAULT 0,
  total             INTEGER DEFAULT 0,
  estado            TEXT DEFAULT 'pendiente',
  fecha             TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  -- Snapshot del negocio al momento de emisión
  negocio_nombre    TEXT DEFAULT '',
  negocio_rut       TEXT DEFAULT '',
  negocio_direccion TEXT DEFAULT '',
  negocio_contacto  TEXT DEFAULT '',
  negocio_logo_url  TEXT DEFAULT '',
  -- Soft delete (nunca se pierde, el admin puede recuperar)
  deleted_at        TIMESTAMPTZ DEFAULT NULL,
  deleted_by        TEXT DEFAULT NULL
);

-- 2. Columnas faltantes (si la tabla ya existe sin ellas)
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS cliente_rut       TEXT DEFAULT '';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS cliente_tel       TEXT DEFAULT '';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS cliente_email     TEXT DEFAULT '';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS negocio_nombre    TEXT DEFAULT '';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS negocio_rut       TEXT DEFAULT '';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS negocio_direccion TEXT DEFAULT '';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS negocio_contacto  TEXT DEFAULT '';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS negocio_logo_url  TEXT DEFAULT '';
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS deleted_by        TEXT DEFAULT NULL;

-- 3. RLS
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cotizaciones_rw" ON cotizaciones;
CREATE POLICY "cotizaciones_rw" ON cotizaciones FOR ALL USING (true) WITH CHECK (true);

-- 4. Contador de folio atómico en negocios
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS cot_folio_seq INTEGER DEFAULT 0;

-- 5. Función atómica: incrementa y retorna el folio único
CREATE OR REPLACE FUNCTION next_cot_folio(neg_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE next_num INTEGER;
BEGIN
  UPDATE negocios
    SET cot_folio_seq = cot_folio_seq + 1
    WHERE id = neg_id
    RETURNING cot_folio_seq INTO next_num;
  RETURN next_num;
END;
$$;

-- 6. Índices
CREATE INDEX IF NOT EXISTS cotizaciones_negocio_numero_idx ON cotizaciones(negocio_id, numero);
CREATE INDEX IF NOT EXISTS cotizaciones_deleted_idx ON cotizaciones(negocio_id, deleted_at);
