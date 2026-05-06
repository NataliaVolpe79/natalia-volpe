import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { differenceInHours, differenceInMinutes } from 'date-fns'

function verificarApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.RECORDATORIOS_API_KEY
}

export async function GET(request: NextRequest) {
  if (!verificarApiKey(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const ahora = new Date()

    // Ventana: próximas 26 horas
    const hasta = new Date(ahora.getTime() + 26 * 60 * 60 * 1000)

    const { data: turnos, error } = await supabase
      .from('turnos')
      .select(`
        id,
        fecha,
        hora,
        modalidad,
        recordatorio_24h_enviado,
        recordatorio_1h_enviado,
        paciente:pacientes (nombre, apellido, telefono)
      `)
      .in('estado', ['pendiente', 'confirmado'])
      .gte('fecha', ahora.toISOString().split('T')[0])
      .lte('fecha', hasta.toISOString().split('T')[0])

    if (error) throw error

    const pendientes = []

    for (const turno of (turnos || [])) {
      const fechaHoraTurno = new Date(`${turno.fecha}T${turno.hora}`)
      const minutosRestantes = differenceInMinutes(fechaHoraTurno, ahora)
      const horasRestantes = differenceInHours(fechaHoraTurno, ahora)
      const paciente = turno.paciente as unknown as { nombre: string; apellido: string; telefono: string }

      // Recordatorio 24h: entre 23 y 26 horas antes, no enviado aún
      if (horasRestantes >= 23 && horasRestantes <= 26 && !turno.recordatorio_24h_enviado) {
        pendientes.push({
          turno_id: turno.id,
          tipo_recordatorio: '24h',
          nombre: paciente.nombre,
          apellido: paciente.apellido,
          telefono: paciente.telefono,
          fecha: turno.fecha,
          hora: turno.hora,
          modalidad: turno.modalidad,
        })
      }

      // Recordatorio 1h: entre 45 y 90 minutos antes, no enviado aún
      if (minutosRestantes >= 45 && minutosRestantes <= 90 && !turno.recordatorio_1h_enviado) {
        pendientes.push({
          turno_id: turno.id,
          tipo_recordatorio: '1h',
          nombre: paciente.nombre,
          apellido: paciente.apellido,
          telefono: paciente.telefono,
          fecha: turno.fecha,
          hora: turno.hora,
          modalidad: turno.modalidad,
        })
      }
    }

    return NextResponse.json({ recordatorios: pendientes, total: pendientes.length })
  } catch (error) {
    console.error('Error en /api/recordatorios/pendientes:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
