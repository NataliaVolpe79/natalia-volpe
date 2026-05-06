'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, parseISO, differenceInHours } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bell, CheckCircle, Phone, Clock, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TurnoConPaciente } from '@/lib/types'
import { formatHora, linkWhatsApp } from '@/lib/utils'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function RecordatoriosPage() {
  const [proximos, setProximos] = useState<{ turno: TurnoConPaciente; tipo: '24h' | '1h' }[]>([])
  const [enviados, setEnviados] = useState<{ turno: TurnoConPaciente; tipo: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [marcando, setMarcando] = useState<string | null>(null)

  const cargarRecordatorios = useCallback(async () => {
    setLoading(true)
    try {
      const ahora = new Date()
      const en26h = new Date(ahora.getTime() + 26 * 60 * 60 * 1000)

      const { data } = await supabase
        .from('turnos')
        .select('*, paciente:pacientes(*)')
        .in('estado', ['pendiente', 'confirmado'])
        .gte('fecha', format(ahora, 'yyyy-MM-dd'))
        .lte('fecha', format(en26h, 'yyyy-MM-dd'))
        .order('fecha')
        .order('hora')

      const turnos = (data || []) as TurnoConPaciente[]
      const pendientes: typeof proximos = []

      for (const turno of turnos) {
        const fechaHoraTurno = new Date(`${turno.fecha}T${turno.hora}`)
        const horasRestantes = differenceInHours(fechaHoraTurno, ahora)

        if (horasRestantes >= 23 && horasRestantes <= 26 && !turno.recordatorio_24h_enviado) {
          pendientes.push({ turno, tipo: '24h' })
        }
        if (horasRestantes >= 0.5 && horasRestantes <= 2 && !turno.recordatorio_1h_enviado) {
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

    if (tipo === '24h') {
      return `Hola ${turno.paciente?.nombre}! Te recuerdo que mañana ${fecha} tenés turno con la Dra. Natalia Volpe a las ${hora} hs (atención ${mod}). Cualquier consulta escribime por acá. ¡Hasta mañana!`
    }
    return `Hola ${turno.paciente?.nombre}! Te recuerdo que en aprox. 1 hora, a las ${hora} hs, tenés tu turno con la Dra. Natalia Volpe (${mod}). ¡Nos vemos pronto!`
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Bell className="w-7 h-7 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Recordatorios</h1>
      </div>

      {/* Sección Make.com */}
      <Card className="border-blue-100 bg-blue-50">
        <div className="flex items-start gap-3">
          <Info className="w-6 h-6 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="font-bold text-blue-900 text-lg mb-2">Automatizar con Make.com</h2>
            <p className="text-blue-800 text-base mb-3">
              Podés automatizar el envío de recordatorios por WhatsApp usando Make.com.
              Configurá un escenario que llame al siguiente endpoint cada hora:
            </p>
            <code className="block bg-blue-100 text-blue-900 px-4 py-2 rounded-xl text-sm font-mono break-all mb-3">
              GET /api/recordatorios/pendientes
            </code>
            <p className="text-blue-800 text-sm">
              Enviá el header: <code className="bg-blue-100 px-1 rounded">x-api-key: TU_RECORDATORIOS_API_KEY</code>
            </p>
            <p className="text-blue-800 text-sm mt-2">
              La respuesta incluye nombre, teléfono, fecha, hora y modalidad de cada turno a recordar.
              Después marcá cada uno como enviado con:
            </p>
            <code className="block bg-blue-100 text-blue-900 px-4 py-2 rounded-xl text-sm font-mono break-all mt-2">
              PATCH /api/recordatorios/&#123;id&#125;/enviado
            </code>
          </div>
        </div>
      </Card>

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
