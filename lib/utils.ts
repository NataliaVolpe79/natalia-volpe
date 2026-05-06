import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Configuracion, HorarioDisponible, LoteHorario, ModalidadTurno, TurnoOcupado } from './types'

// ============================================================
// Fechas y horas
// ============================================================

export function formatFecha(fecha: string | Date): string {
  const date = typeof fecha === 'string' ? parseISO(fecha) : fecha
  return format(date, 'dd/MM/yyyy', { locale: es })
}

export function formatHora(hora: string): string {
  return hora.substring(0, 5)
}

export function formatFechaHora(fecha: string, hora: string): string {
  return `${formatFecha(fecha)} a las ${formatHora(hora)}`
}

export function diaSemanaDeDate(fecha: string | Date): string {
  const date = typeof fecha === 'string' ? parseISO(fecha) : fecha
  return format(date, 'EEEE', { locale: es }).toLowerCase()
}

export function nombreDiaCorto(fecha: string | Date): string {
  const date = typeof fecha === 'string' ? parseISO(fecha) : fecha
  return format(date, 'EEE dd/MM', { locale: es })
}

export function fechaHoy(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function fechaHoyFormateada(): string {
  return format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
}

// Convierte 'HH:MM' o 'HH:MM:SS' a minutos desde medianoche
export function timeToMinutes(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ============================================================
// Modalidad según día
// ============================================================

export function getModalidadPorFecha(
  fecha: string | Date,
  config: Configuracion
): ModalidadTurno {
  const diaSemana = diaSemanaDeDate(fecha)
  return config.dias_presencial.includes(diaSemana) ? 'presencial' : 'videollamada'
}

// ============================================================
// Sistema de lotes — algoritmo de disponibilidad
// ============================================================

// Verifica si un nuevo turno en [hora, hora+duracion) choca con algún turno existente
function hayConflicto(
  hora: string,
  duracionNueva: number,
  ocupados: TurnoOcupado[]
): boolean {
  const inicio = timeToMinutes(hora)
  const fin = inicio + duracionNueva
  return ocupados.some(occ => {
    const occInicio = timeToMinutes(occ.hora)
    const occFin = occInicio + occ.duracion
    return inicio < occFin && occInicio < fin
  })
}

/**
 * Calcula los horarios disponibles usando el sistema de lotes.
 *
 * - Para 'primera_consulta': devuelve solo los horarios_primera_consulta de cada lote.
 * - Para 'seguimiento': genera slots dentro de cada lote a intervalos de duracionNueva + buffer.
 *
 * Ambos usan detección de conflictos por solapamiento de intervalos.
 */
export function calcularHorariosEnLotes(
  lotes: LoteHorario[],
  ocupados: TurnoOcupado[],
  duracionNueva: number,
  tipo: 'primera_consulta' | 'seguimiento',
  bufferMinutos: number = 0,
  llenadoSecuencial: boolean = false
): HorarioDisponible[] {
  const lotesOrdenados = [...lotes].sort(
    (a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio)
  )

  const slotsDeLote = (lote: LoteHorario): HorarioDisponible[] => {
    const slots: HorarioDisponible[] = []
    if (tipo === 'primera_consulta') {
      for (const horaStr of lote.horarios_primera_consulta) {
        const hMins = timeToMinutes(horaStr)
        const loteIni = timeToMinutes(lote.hora_inicio)
        const loteFin = timeToMinutes(lote.hora_fin)
        if (hMins < loteIni || hMins + duracionNueva > loteFin) continue
        slots.push({ hora: horaStr, disponible: !hayConflicto(horaStr, duracionNueva, ocupados) })
      }
    } else {
      const loteIni = timeToMinutes(lote.hora_inicio)
      const loteFin = timeToMinutes(lote.hora_fin)
      const step = duracionNueva + bufferMinutos
      let actual = loteIni
      while (actual + duracionNueva <= loteFin) {
        const horaStr = minutesToTime(actual)
        slots.push({ hora: horaStr, disponible: !hayConflicto(horaStr, duracionNueva, ocupados) })
        actual += step
      }
    }
    return slots
  }

  // Modo secuencial: mostrar solo el primer bloque con turnos disponibles
  if (llenadoSecuencial) {
    for (const lote of lotesOrdenados) {
      const slots = slotsDeLote(lote)
      if (slots.some(s => s.disponible)) return slots
    }
    return []
  }

  // Modo normal: todos los bloques juntos
  const vistos = new Set<string>()
  const result: HorarioDisponible[] = []
  for (const lote of lotesOrdenados) {
    for (const slot of slotsDeLote(lote)) {
      if (!vistos.has(slot.hora)) {
        vistos.add(slot.hora)
        result.push(slot)
      }
    }
  }
  return result
}

// ============================================================
// Validaciones de días
// ============================================================

export function esDiaLaborable(
  fecha: string | Date,
  config: Configuracion
): boolean {
  const date = typeof fecha === 'string' ? parseISO(fecha) : fecha
  const dia = format(date, 'EEEE', { locale: es }).toLowerCase()
  const fechaStr = format(date, 'yyyy-MM-dd')
  const esFeriado = config.feriados.some(f => f.startsWith(fechaStr))
  return config.dias_atencion.includes(dia) && !esFeriado
}

// ============================================================
// Teléfono argentino
// ============================================================

export function formatTelefono(tel: string): string {
  const limpio = tel.replace(/\D/g, '')
  return limpio.startsWith('54') ? limpio : `54${limpio}`
}

export function linkWhatsApp(telefono: string, mensaje?: string): string {
  const tel = formatTelefono(telefono)
  const base = `https://wa.me/${tel}`
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base
}

// ============================================================
// Clases condicionales
// ============================================================

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ============================================================
// Colores y labels por estado
// ============================================================

export const colorEstadoTurno: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  confirmado: 'bg-blue-100 text-blue-800',
  completado: 'bg-green-100 text-green-800',
  cancelado: 'bg-gray-100 text-gray-500',
}

export const colorEstadoPago: Record<string, string> = {
  pagado: 'bg-green-100 text-green-800',
  pendiente: 'bg-yellow-100 text-yellow-800',
  debe: 'bg-red-100 text-red-800',
}

export const labelEstadoTurno: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  completado: 'Completado',
  cancelado: 'Cancelado',
}

export const labelEstadoPago: Record<string, string> = {
  pagado: 'Pagado',
  pendiente: 'Pendiente',
  debe: 'Debe',
}

export const labelTipoTurno: Record<string, string> = {
  primera_consulta: 'Primera consulta',
  seguimiento: 'Seguimiento',
}

export const DURACIONES_SEGUIMIENTO = [15, 20, 30, 40, 50] as const
