'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Clock, Check, X, Edit2, Video, MapPin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TurnoConPaciente, EstadoTurno, Configuracion } from '@/lib/types'
import { formatHora, colorEstadoTurno, labelEstadoTurno, esDiaLaborable } from '@/lib/utils'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Alert from '@/components/ui/Alert'
import FormularioTurno from '@/components/admin/FormularioTurno'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export default function TurnosPage() {
  const [mesActual, setMesActual] = useState(new Date())
  const [fechaSeleccionada, setFechaSeleccionada] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [turnos, setTurnos] = useState<TurnoConPaciente[]>([])
  const [diasConTurnos, setDiasConTurnos] = useState<Set<string>>(new Set())
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [loading, setLoading] = useState(false)
  const [modalNuevoTurno, setModalNuevoTurno] = useState(false)
  const [turnoEditar, setTurnoEditar] = useState<TurnoConPaciente | null>(null)
  const [notasEditar, setNotasEditar] = useState('')
  const [error, setError] = useState('')

  const cargarConfig = useCallback(async () => {
    const { data } = await supabase.from('configuracion').select('*').single()
    if (data) setConfig(data)
  }, [])

  const cargarDiasConTurnos = useCallback(async () => {
    const inicio = format(startOfMonth(mesActual), 'yyyy-MM-dd')
    const fin = format(endOfMonth(mesActual), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('turnos')
      .select('fecha')
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .not('estado', 'eq', 'cancelado')
    const dias = new Set(data?.map(t => t.fecha) || [])
    setDiasConTurnos(dias)
  }, [mesActual])

  const cargarTurnos = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('turnos')
        .select('*, paciente:pacientes(*), pago:pagos(*)')
        .eq('fecha', fechaSeleccionada)
        .order('hora')
      setTurnos(
        (data || []).map(t => ({
          ...t,
          pago: Array.isArray(t.pago) ? t.pago[0] : t.pago,
        })) as TurnoConPaciente[]
      )
    } finally {
      setLoading(false)
    }
  }, [fechaSeleccionada])

  useEffect(() => { cargarConfig(); cargarDiasConTurnos() }, [cargarConfig, cargarDiasConTurnos])
  useEffect(() => { cargarTurnos() }, [cargarTurnos])

  async function cambiarEstado(id: string, estado: EstadoTurno) {
    const { error: e } = await supabase.from('turnos').update({ estado }).eq('id', id)
    if (e) setError('No se pudo actualizar el estado')
    else cargarTurnos()
  }

  async function guardarNotas() {
    if (!turnoEditar) return
    const { error: e } = await supabase
      .from('turnos')
      .update({ notas: notasEditar })
      .eq('id', turnoEditar.id)
    if (e) setError('No se pudo guardar las notas')
    else { setTurnoEditar(null); cargarTurnos() }
  }

  // Render calendario
  const inicio = startOfMonth(mesActual)
  const fin = endOfMonth(mesActual)
  const dias = eachDayOfInterval({ start: inicio, end: fin })
  const primerDia = getDay(inicio)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Turnos</h1>
        <Button onClick={() => setModalNuevoTurno(true)}>
          <Plus className="w-5 h-5" />
          Nuevo turno
        </Button>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* Calendario */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMesActual(m => addDays(startOfMonth(m), -1))} className="p-2 rounded-xl hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-gray-900 capitalize text-lg">
            {format(mesActual, 'MMMM yyyy', { locale: es })}
          </span>
          <button onClick={() => setMesActual(m => addDays(endOfMonth(m), 1))} className="p-2 rounded-xl hover:bg-gray-100">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-2">
          {DIAS.map(d => (
            <div key={d} className="text-center text-sm font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: primerDia }).map((_, i) => <div key={`e${i}`} />)}
          {dias.map(dia => {
            const fechaStr = format(dia, 'yyyy-MM-dd')
            const tieneTurnos = diasConTurnos.has(fechaStr)
            const esLaboral = config ? esDiaLaborable(fechaStr, config) : true
            const seleccionado = fechaStr === fechaSeleccionada
            return (
              <button
                key={fechaStr}
                onClick={() => setFechaSeleccionada(fechaStr)}
                className={[
                  'aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-semibold transition-all relative',
                  seleccionado ? 'bg-blue-600 text-white' :
                  esLaboral ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300',
                ].join(' ')}
              >
                {format(dia, 'd')}
                {tieneTurnos && (
                  <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${seleccionado ? 'bg-white' : 'bg-blue-500'}`} />
                )}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Lista de turnos del día */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-3 capitalize">
          {format(parseISO(fechaSeleccionada), "EEEE d 'de' MMMM", { locale: es })}
        </h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : turnos.length === 0 ? (
          <Card className="text-center py-10">
            <p className="text-gray-500 text-lg">No hay turnos para este día</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {turnos.map(turno => (
              <Card key={turno.id} padding="sm">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center justify-center w-14 h-14 bg-blue-50 rounded-xl shrink-0">
                    <Clock className="w-4 h-4 text-blue-600 mb-0.5" />
                    <span className="text-sm font-bold text-blue-600">{formatHora(turno.hora)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-gray-900 text-lg">
                          {turno.paciente?.nombre} {turno.paciente?.apellido}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge className={colorEstadoTurno[turno.estado]}>
                            {labelEstadoTurno[turno.estado]}
                          </Badge>
                          {turno.modalidad === 'presencial'
                            ? <span className="text-sm text-green-700 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />Presencial</span>
                            : <span className="text-sm text-blue-700 flex items-center gap-1"><Video className="w-3.5 h-3.5" />Video</span>
                          }
                        </div>
                        {turno.notas && (
                          <p className="text-sm text-gray-500 mt-1 italic">{turno.notas}</p>
                        )}
                      </div>
                    </div>

                    {/* Acciones */}
                    {turno.estado !== 'cancelado' && turno.estado !== 'completado' && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <button
                          onClick={() => cambiarEstado(turno.id, 'completado')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-semibold hover:bg-green-100 transition-colors"
                        >
                          <Check className="w-4 h-4" /> Completado
                        </button>
                        <button
                          onClick={() => { setTurnoEditar(turno); setNotasEditar(turno.notas || '') }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" /> Notas
                        </button>
                        <button
                          onClick={() => cambiarEstado(turno.id, 'cancelado')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors"
                        >
                          <X className="w-4 h-4" /> Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modales */}
      {modalNuevoTurno && (
        <FormularioTurno
          isOpen={modalNuevoTurno}
          onClose={() => setModalNuevoTurno(false)}
          onSuccess={() => { setModalNuevoTurno(false); cargarTurnos(); cargarDiasConTurnos() }}
          config={config}
          fechaInicial={fechaSeleccionada}
        />
      )}

      <Modal
        isOpen={!!turnoEditar}
        onClose={() => setTurnoEditar(null)}
        title="Editar notas del turno"
      >
        <div className="flex flex-col gap-4">
          <Textarea
            label="Notas"
            value={notasEditar}
            onChange={e => setNotasEditar(e.target.value)}
            rows={4}
            placeholder="Notas del turno..."
          />
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setTurnoEditar(null)}>Cancelar</Button>
            <Button fullWidth onClick={guardarNotas}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
