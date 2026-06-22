// ============================================================
// Tipos TypeScript — Dra. Natalia Hebe Volpe
// ============================================================

export type EstadoTurno = 'pendiente' | 'confirmado' | 'completado' | 'cancelado'
export type ModalidadTurno = 'presencial' | 'videollamada'
export type EstadoPago = 'pagado' | 'pendiente' | 'debe'
export type MetodoPago = 'transferencia' | 'obra_social'
export type TipoTurno = 'primera_consulta' | 'seguimiento'

export interface Configuracion {
  id: string
  dias_atencion: string[]
  dias_presencial: string[]
  feriados: string[]
  buffer_minutos: number
  duracion_primera_consulta_minutos: number
  copago_osde?: number
  alias_pago?: string
  dni_credencial?: string
  valor_consulta_particular?: number
  updated_at: string
}

// Un lote es un bloque horario dentro del cual se generan turnos
export interface LoteHorario {
  id: string
  dia: string  // 'lunes', 'martes', etc.
  hora_inicio: string  // 'HH:MM:SS' o 'HH:MM'
  hora_fin: string
  horarios_primera_consulta: string[]  // ej: ['09:00', '15:00']
  orden: number
  created_at: string
}

export interface Paciente {
  id: string
  nombre: string
  apellido: string
  telefono: string
  dni?: string
  email?: string
  fecha_nacimiento?: string
  obra_social?: string
  numero_afiliado?: string
  notas?: string
  duracion_seguimiento_minutos?: number | null  // 15, 20, 30, 40 o 50
  created_at: string
}

export interface Turno {
  id: string
  paciente_id: string
  fecha: string
  hora: string
  duracion_minutos: number
  estado: EstadoTurno
  modalidad: ModalidadTurno
  tipo_turno: TipoTurno
  notas?: string
  recordatorio_24h_enviado: boolean
  recordatorio_1h_enviado: boolean
  created_at: string
  paciente?: Paciente
}

export interface Pago {
  id: string
  turno_id: string
  paciente_id: string
  monto?: number
  estado: EstadoPago
  metodo_pago?: MetodoPago
  codigo_obra_social?: string
  comprobante_url?: string
  fecha_pago?: string
  notas?: string
  created_at: string
  turno?: Turno
  paciente?: Paciente
}

export interface TurnoConPaciente extends Turno {
  paciente: Paciente
  pago?: Pago
}

export interface HorarioDisponible {
  hora: string
  disponible: boolean
}

// Turno ocupado para cálculo de disponibilidad
export interface TurnoOcupado {
  hora: string        // 'HH:MM'
  duracion: number    // minutos
}

export interface HistoriaClinicaDatos {
  // Sección 1: Datos personales
  apellido_nombres?: string
  fecha_nacimiento?: string
  argentino?: string
  dni?: string
  osde_plan?: string
  estado_civil?: string
  vive_con?: string
  domicilio?: string
  localidad_cp?: string
  tel_fijo?: string
  tel_celular?: string
  educacion?: string
  contacto_asignado?: string
  contacto_nombre?: string
  contacto_parentesco?: string
  contacto_telefono?: string
  contacto_convive?: string
  // Sección 2: Motivo de consulta
  motivo_consulta?: string
  // Sección 3: Examen semiológico
  aspecto_fisico?: string[]
  facies?: string
  actitud?: string
  presentacion?: string[]
  presentacion_otros?: string
  aspecto_psiquico?: string
  conciencia?: string
  conductas?: Record<string, string[]>
  orientacion?: Record<string, string>
  atencion?: string
  memoria_sensopercepcion?: Record<string, string[]>
  tipos_fallas?: Record<string, string[]>
  pensamiento?: Record<string, string[]>
  delirio?: Record<string, string[]>
  afectividad?: string[]
  actividad?: string[]
  juicio?: string
  conciencia_de?: Record<string, string>
  inteligencia?: string
  // Sección 4: Hábitos personales
  conducta_alimentaria?: string
  sueno?: string
  sexualidad?: string
  relacion_sustancias?: string
  agresividad?: string
  // Sección 5: Enfermedad actual
  antecedentes_enfermedad?: string
  antecedentes_psiquiatricos?: string
  antecedentes_medicos?: string
  medicacion?: string
  familigrama?: string
  diagnostico_presuntivo?: string
  codigo_dsmiv?: string
  resolucion?: string[]
  plan_farmacologico?: string
}

export interface HistoriaClinica {
  id: string
  paciente_id: string
  datos: HistoriaClinicaDatos
  created_at: string
  updated_at: string
}

export interface Evolucion {
  id: string
  paciente_id: string
  fecha: string
  texto: string
  created_at: string
}

export interface Bloqueo {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  motivo?: string
  created_at: string
}

export interface RecordatorioPendiente {
  turno_id: string
  nombre: string
  apellido: string
  telefono: string
  fecha: string
  hora: string
  modalidad: ModalidadTurno
  tipo_recordatorio: '24h' | '1h'
}
