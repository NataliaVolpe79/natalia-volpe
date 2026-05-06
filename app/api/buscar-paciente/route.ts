import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// Busca un paciente por teléfono para el portal de autogestión.
// Usa service role pero devuelve solo los campos necesarios.
export async function POST(request: NextRequest) {
  try {
    const { telefono } = await request.json()
    if (!telefono || typeof telefono !== 'string') {
      return NextResponse.json({ error: 'Teléfono requerido' }, { status: 400 })
    }

    const tel = telefono.replace(/\D/g, '')
    if (tel.length < 8) {
      return NextResponse.json({ encontrado: false })
    }

    const supabase = createServerClient()

    const { data } = await supabase
      .from('pacientes')
      .select('id, nombre, apellido, telefono, duracion_seguimiento_minutos')
      .eq('telefono', tel)
      .maybeSingle()

    if (!data) {
      return NextResponse.json({ encontrado: false })
    }

    return NextResponse.json({
      encontrado: true,
      paciente: {
        id: data.id,
        nombre: data.nombre,
        apellido: data.apellido,
        telefono: data.telefono,
        duracion_seguimiento_minutos: data.duracion_seguimiento_minutos,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
