import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

function verificarApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.RECORDATORIOS_API_KEY
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!verificarApiKey(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const tipo: '24h' | '1h' = body.tipo || '24h'

    const supabase = createServerClient()
    const campo = tipo === '24h' ? 'recordatorio_24h_enviado' : 'recordatorio_1h_enviado'

    const { error } = await supabase
      .from('turnos')
      .update({ [campo]: true })
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({
      ok: true,
      message: `Recordatorio ${tipo} marcado como enviado`,
    })
  } catch (error) {
    console.error('Error en PATCH /api/recordatorios/[id]/enviado:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
