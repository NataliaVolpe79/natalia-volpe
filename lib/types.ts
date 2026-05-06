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
