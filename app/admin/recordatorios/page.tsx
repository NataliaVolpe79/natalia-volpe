'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, parseISO, addDays, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bell, CheckCircle, Phone, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Configuracion, TurnoConPaciente } from '@/lib/types'
import { formatHora, linkWhatsApp } from '@/lib/utils'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function RecordatoriosPage() {
  const [proximos, setProximos] = useState<{ turno: TurnoConPaciente; tipo: '24h' | '1h' }[]>([])
  const [enviados, setEnviados] = useState<{ turno: TurnoConPaciente; tipo: string }[]>([])
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [loading, setLoading] = useState(true)
  const [marcando, setMarcando] = useState<string | null>(null)

  const cargarRecordatorios = useCallback(async () => {
    setLoading(true)
    try {
      const { data: cfg } = await supabase.from('configuracion').select('*').single()
      if (cfg) setConfig(cfg)

      const ahora = new Date()
      const hoy = format(ahora, 'yyyy-MM-dd')
      const en3dias = format(addDays(startOfDay(ahora), 7), 'yyyy-MM-dd')

      const { data } = await supabase
        .from('turnos')
        .select('*, paciente:pacientes(*)')
        .in('estado', ['pendiente', 'confirmado'])
        .gte('fecha', hoy)
        .lte('fecha', en3dias)
        .order('fecha')
        .order('hora')

      const turnos = (data || []) as TurnoConPaciente[]
      const pendientes: typeof proximos = []

      for (const turno of turnos) {
        const fechaHoraTurno = new Date(`${turno.fecha}T${turno.hora}`)
        const yapasoElTurno = fechaHoraTurno < ahora

        // 24h: cualquier turno de los próximos 3 días que no se envió y no pasó
        if (!turno.recordatorio_24h_enviado && !yapasoElTurno) {
          pendientes.push({ turno, tipo: '24h' })
        }
        // 1h: solo turnos de hoy que no pasaron y no se enviaron
        if (turno.fecha === hoy && !turno.recordatorio_1h_enviado && !yapasoElTurno) {
          pendientes.push({ turno, tipo: '1h' })
        }
      }

      setProximos(pendientes)

      // Enviados recientes (últimos 2 días)
      const hace2dias = format(new Date(ahora.getTime() - 48 * 60 * 60 * 1000), 'yyyy-MM-dd')
      const { data: dataEnviados } = await supabase
        .from('turnos')
        .select('*, paciente:pacientes(*)')
        .gte('fecha', hace2dias)
        .or('recordatorio_24h_enviado.eq.true,recordatorio_1h_enviado.eq.true')
        .order('fecha', { ascending: false })
        .limit(20)

      const logEnviados: typeof enviados = []
      for (const t of (dataEnviados || []) as TurnoConPaciente[]) {
        if (t.recordatorio_24h_enviado) {
          logEnviados.push({ turno: t, tipo: '24 horas antes' })
        }
        if (t.recordatorio_1h_enviado) {
          logEnviados.push({ turno: t, tipo: '1 hora antes' })
        }
      }
      setEnviados(logEnviados)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarRecordatorios() }, [cargarRecordatorios])

  async function marcarEnviado(turnoId: string, tipo: '24h' | '1h') {
    setMarcando(`${turnoId}-${tipo}`)
    const campo = tipo === '24h' ? 'recordatorio_24h_enviado' : 'recordatorio_1h_enviado'
    await supabase.from('turnos').update({ [campo]: true }).eq('id', turnoId)
    await cargarRecordatorios()
    setMarcando(null)
  }

  function mensajeWpp(turno: TurnoConPaciente, tipo: '24h' | '1h'): string {
    const fecha = format(parseISO(turno.fecha), "EEEE d 'de' MMMM", { locale: es })
    const hora = formatHora(turno.hora)
    const mod = turno.modalidad === 'presencial' ? 'presencial' : 'por videollamada'
    const nombre = turno.paciente?.nombre ?? ''
    const esOsde = (turno.paciente?.obra_social ?? '').toLowerCase().includes('osde')

    const alias = config?.alias_pago ?? 'nat.wert'

    if (esOsde) {
      const copago = config?.copago_osde ? `$${config.copago_osde}` : '$8900'
      if (tipo === '24h') {
        return `Hola ${nombre}! Te recuerdo que mañana ${fecha} tenés turno con la Dra. Natalia Volpe a las ${hora} hs (${mod}).\nEl copago de OSDE es ${copago} — transferí al alias *${alias}* antes de la consulta.\nEnviá tu credencial de OSDE antes de la consulta. ¡Hasta mañana!`
      }
      return `Hola ${nombre}! En aprox. 1 hora, a las ${hora} hs, tenés tu turno con la Dra. Natalia Volpe (${mod}).\nCopago OSDE: ${copago} al alias *${alias}*. Enviá tu credencial de OSDE antes de la consulta. ¡Nos vemos pronto!`
    }

    // Particular
    const total = config?.valor_consulta_particular
    const mitad = total ? `$${Math.round(total / 2)}` : ''
    const pagoLinea = mitad ? `\nTransferí ${mitad} al alias *${alias}* antes de la consulta.` : ''
    if (tipo === '24h') {
      return `Hola ${nombre}! Te recuerdo que mañana ${fecha} tenés turno con la Dra. Natalia Volpe a las ${hora} hs (${mod}).${pagoLinea} ¡Hasta mañana!`
    }
    return `Hola ${nombre}! En aprox. 1 hora, a las ${hora} hs, tenés tu turno con la Dra. Natalia Volpe (${mod}).${pagoLinea} ¡Nos vemos pronto!`
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Bell className="w-7 h-7 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Recordatorios</h1>
      </div>

      {/* Recordatorios pendientes */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-3">
          Próximos a enviar
          {proximos.length > 0 && (
            <span className="ml-2 bg-red-500 text-white text-sm rounded-full px-2 py-0.5">{proximos.length}</span>
          )}
        </h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : proximos.length === 0 ? (
          <Card className="text-center py-8">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="text-gray-500">No hay recordatorios pendientes por ahora</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {proximos.map(({ turno, tipo }) => {
              const key = `${turno.id}-${tipo}`
              const wppLink = linkWhatsApp(turno.paciente?.telefono || '', mensajeWpp(turno, tipo))
              return (
                <Card key={key} padding="sm" className="border-orange-100">
                  <div className="flex items-start gap-3">
                    <div className={`px-2 py-1 rounded-lg text-xs font-bold shrink-0 ${tipo === '24h' ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'}`}>
                      {tipo === '24h' ? '24 hs' : '1 hs'}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">
                        {turno.paciente?.nombre} {turno.paciente?.apellido}
                      </p>
                      <div className="flex items-center gap-2 text-gray-500 text-sm mt-0.5">
                        <Clock className="w-4 h-4" />
                        <span className="capitalize">
                          {format(parseISO(turno.fecha), "EEEE d/MM", { locale: es })} · {formatHora(turno.hora)} hs
                        </span>
                        <span>· {turno.modalidad === 'presencial' ? '📍' : '💻'}</span>
                      </div>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <a
                          href={wppLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors"
                        >
                          <Phone className="w-4 h-4" /> Enviar por WP
                        </a>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={marcando === key}
                          onClick={() => marcarEnviado(turno.id, tipo)}
                        >
                          <CheckCircle className="w-4 h-4" /> Marcar enviado
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Log de enviados */}
      {enviados.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">Enviados recientemente</h2>
          <div className="flex flex-col gap-2">
            {enviados.map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">
                    {item.turno.paciente?.nombre} {item.turno.paciente?.apellido}
                  </p>
                  <p className="text-gray-500 text-xs">
                    Recordatorio de {item.tipo} · {format(parseISO(item.turno.fecha), "d/MM", { locale: es })} {formatHora(item.turno.hora)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
