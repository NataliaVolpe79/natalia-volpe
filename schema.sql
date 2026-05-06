-- ============================================================
-- Schema SQL — Dra. Natalia Hebe Volpe
-- Ejecutar en el SQL Editor de Supabase (proyecto nuevo)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE estado_turno AS ENUM ('pendiente', 'confirmado', 'completado', 'cancelado');
CREATE TYPE modalidad_turno AS ENUM ('presencial', 'videollamada');
CREATE TYPE estado_pago AS ENUM ('pagado', 'pendiente', 'debe');
CREATE TYPE metodo_pago_tipo AS ENUM ('transferencia', 'obra_social');
CREATE TYPE tipo_turno_tipo AS ENUM ('primera_consulta', 'seguimiento');

-- ============================================================
-- TABLA: configuracion
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dias_atencion TEXT[] DEFAULT ARRAY['lunes','martes','miércoles','jueves','viernes'],
  dias_presencial TEXT[] DEFAULT ARRAY['viernes'],
  feriados DATE[] DEFAULT ARRAY[]::DATE[],
  buffer_minutos INTEGER DEFAULT 0,
  duracion_primera_consulta_minutos INTEGER DEFAULT 60,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO configuracion (id) VALUES (uuid_generate_v4()) ON CONFLICT DO NOTHING;

-- ============================================================
-- TABLA: lotes_horarios
-- Un lote define un bloque de atención para un día de la semana.
-- Los turnos se generan dentro de cada lote, no entre lotes.
-- ============================================================
CREATE TABLE IF NOT EXISTS lotes_horarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dia TEXT NOT NULL,  -- 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  horarios_primera_consulta TEXT[] DEFAULT ARRAY[]::TEXT[],  -- ej: ['09:00', '15:00']
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lotes_dia ON lotes_horarios (dia);

-- Lotes por defecto (lunes a jueves 09:00-13:00 y 15:00-18:00; viernes 09:00-13:00)
INSERT INTO lotes_horarios (dia, hora_inicio, hora_fin, horarios_primera_consulta, orden) VALUES
  ('lunes',     '09:00', '13:00', ARRAY['09:00'], 1),
  ('lunes',     '15:00', '18:00', ARRAY['15:00'], 2),
  ('martes',    '09:00', '13:00', ARRAY['09:00'], 1),
  ('martes',    '15:00', '18:00', ARRAY['15:00'], 2),
  ('miércoles', '09:00', '13:00', ARRAY['09:00'], 1),
  ('miércoles', '15:00', '18:00', ARRAY['15:00'], 2),
  ('jueves',    '09:00', '13:00', ARRAY['09:00'], 1),
  ('jueves',    '15:00', '18:00', ARRAY['15:00'], 2),
  ('viernes',   '09:00', '13:00', ARRAY['09:00'], 1);

-- ============================================================
-- TABLA: pacientes
-- ============================================================
CREATE TABLE IF NOT EXISTS pacientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  telefono TEXT NOT NULL,
  email TEXT,
  fecha_nacimiento DATE,
  obra_social TEXT,
  numero_afiliado TEXT,
  notas TEXT,
  duracion_seguimiento_minutos INTEGER,  -- 15, 20, 30, 40 o 50 minutos
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pacientes_apellido ON pacientes (apellido);
CREATE INDEX IF NOT EXISTS idx_pacientes_telefono ON pacientes (telefono);

-- ============================================================
-- TABLA: turnos
-- ============================================================
CREATE TABLE IF NOT EXISTS turnos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  duracion_minutos INTEGER NOT NULL,
  estado estado_turno DEFAULT 'pendiente',
  modalidad modalidad_turno NOT NULL,
  tipo_turno tipo_turno_tipo DEFAULT 'seguimiento',
  notas TEXT,
  recordatorio_24h_enviado BOOLEAN DEFAULT FALSE,
  recordatorio_1h_enviado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos (fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_paciente ON turnos (paciente_id);
CREATE INDEX IF NOT EXISTS idx_turnos_estado ON turnos (estado);

-- ============================================================
-- TABLA: pagos
-- ============================================================
CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  turno_id UUID NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  monto DECIMAL(10,2),
  estado estado_pago DEFAULT 'pendiente',
  metodo_pago metodo_pago_tipo,
  codigo_obra_social TEXT,
  comprobante_url TEXT,
  fecha_pago DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_turno ON pagos (turno_id);
CREATE INDEX IF NOT EXISTS idx_pagos_paciente ON pagos (paciente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos (estado);

-- ============================================================
-- FUNCIÓN: crear pago automático al crear turno
-- ============================================================
CREATE OR REPLACE FUNCTION crear_pago_automatico()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO pagos (turno_id, paciente_id, estado)
  VALUES (NEW.id, NEW.paciente_id, 'pendiente');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_crear_pago
  AFTER INSERT ON turnos
  FOR EACH ROW
  EXECUTE FUNCTION crear_pago_automatico();

-- ============================================================
-- STORAGE
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Admin (autenticado)
CREATE POLICY "Admin configuracion" ON configuracion FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin lotes" ON lotes_horarios FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin pacientes" ON pacientes FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin turnos" ON turnos FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin pagos" ON pagos FOR ALL TO authenticated USING (true);

-- Anónimo: solo lo necesario para el portal del paciente
CREATE POLICY "Anon ver lotes" ON lotes_horarios FOR SELECT TO anon USING (true);
CREATE POLICY "Anon ver turnos ocupados" ON turnos FOR SELECT TO anon
  USING (estado IN ('pendiente', 'confirmado'));
CREATE POLICY "Anon crear turno" ON turnos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon crear paciente" ON pacientes FOR INSERT TO anon WITH CHECK (true);

-- Storage
CREATE POLICY "Admin subir comprobantes"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'comprobantes');
CREATE POLICY "Admin ver comprobantes"
  ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'comprobantes');


-- ============================================================
-- MIGRACIÓN (para bases de datos existentes del proyecto)
-- Ejecutar solo si ya tenías el schema anterior
-- ============================================================
/*
-- Eliminar columnas viejas de configuracion
ALTER TABLE configuracion
  DROP COLUMN IF EXISTS hora_inicio,
  DROP COLUMN IF EXISTS hora_fin,
  DROP COLUMN IF EXISTS duracion_turno_minutos;

-- Agregar columnas nuevas
ALTER TABLE configuracion
  ADD COLUMN IF NOT EXISTS buffer_minutos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duracion_primera_consulta_minutos INTEGER DEFAULT 60;

-- Agregar a pacientes
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS duracion_seguimiento_minutos INTEGER;

-- Agregar a turnos
ALTER TABLE turnos
  ADD COLUMN IF NOT EXISTS tipo_turno tipo_turno_tipo DEFAULT 'seguimiento';

-- Crear tabla lotes (ver definición arriba)

-- Insertar lotes por defecto
INSERT INTO lotes_horarios (dia, hora_inicio, hora_fin, horarios_primera_consulta, orden) VALUES ...
*/
