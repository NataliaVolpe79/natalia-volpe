'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, parseISO, addDays, addWeeks, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, getDay, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Clock, Check, X, Edit2, Video, MapPin, Calendar, LayoutList } from 'lucide-react'
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

type Vista = 'semana' | 'mes'
type FiltroEstado = 'todos' | 'pendiente' | 'confirmado' | 'completado' | 'cancelado'

const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const FILTROS: { label: string; value: FiltroEstado }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Pendientes', value: 'pendiente' },
  { label: 'Confirmados', value: 'confirmado' },
  { label: 'Completados', value: 'completado' },
  { label: 'Cancelados', value: 'cancelado' },
]

export default function TurnosPage() {
  const [vista, setVista] = useState<Vista>('semana')
  const [fechaRef, setFechaRef] = useState(new Date())
  const [fechaSeleccionada, setFechaSeleccionada] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [turnos, setTurnos] = useState<TurnoConPaciente[]>([])
  const [turnosSemana, setTurnosSemana] = useState<TurnoConPaciente[]>([])
  const [diasConTurnos, setDiasConTurnos] = useState<Record<string, number>>({})
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [loading, setLoading] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [modalNuevoTurno, setModalNuevoTurno] = useState(false)
  const [turnoEditar, setTurnoEditar] = useState<TurnoConPaciente | null>(null)
  const [notasEditar, setNotasEditar] = useState('')
  const [error, setError] = useState('')

  const cargarConfig = useCallback(async () => {
    const { data } = await supabase.from('configuracion').select('*').single()
    if (data) setConfig(data)
  }, [])

  const diasDeSemana = useCallback((ref: Date) => {
    const lunes = startOfWeek(ref, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(lunes, i))
  }, [])

  const cargarTurnosSemana = useCallback(async (ref: Date) => {
    setLoading(true)
    try {
      const dias = diasDeSemana(ref)
      const inicio = format(dias[0], 'yyyy-MM-dd')
      const fin = format(dias[6], 'yyyy-MM-dd')
      const { data } = await supabase
        .from('turnos')
        .select('*, paciente:pacientes(*), pago:pagos(*)')
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('hora')
      const t = (data || []).map(x => ({ ...x, pago: Array.isArray(x.pago) ? x.pago[0] : x.pago })) as TurnoConPaciente[]
      setTurnosSemana(t)
      const conteo: Record<string, number> = {}
      t.forEach(x => { conteo[x.fecha] = (conteo[x.fecha] || 0) + 1 })
      setDiasConTurnos(prev => ({ ...prev, ...conteo }))
    } finally {
      setLoading(false)
    }
  }, [diasDeSemana])

  const cargarTurnosDia = useCallback(async (fecha: string) => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('turnos')
        .select('*, paciente:pacientes(*), pago:pagos(*)')
        .eq('fecha', fecha)
        .order('hora')
      setTurnos((data || []).map(t => ({ ...t, pago: Array.isArray(t.pago) ? t.pago[0] : t.pago })) as TurnoConPaciente[])
    } finally {
      setLoading(false)
    }
  }, [])

  const cargarDiasConTurnosMes = useCallback(async (ref: Date) => {
    const inicio = format(startOfMonth(ref), 'yyyy-MM-dd')
    const fin = format(endOfMonth(ref), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('turnos').select('fecha').gte('fecha', inicio).lte('fecha', fin).not('estado', 'eq', 'cancelado')
    const conteo: Record<string, number> = {}
    data?.forEach(t => { conteo[t.fecha] = (conteo[t.fecha] || 0) + 1 })
    setDiasConTurnos(prev => ({ ...prev, ...conteo }))
  }, [])

  useEffect(() => { cargarConfig() }, [cargarConfig])

  useEffect(() => {
    if (vista === 'semana') {
      cargarTurnosSemana(fechaRef)
    } else {
      cargarDiasConTurnosMes(fechaRef)
      cargarTurnosDia(fechaSeleccionada)
    }
  }, [vista, fechaRef, fechaSeleccionada, cargarTurnosSemana, cargarDiasConTurnosMes, cargarTurnosDia])

  async function cambiarEstado(id: string, estado: EstadoTurno) {
    const { error: e } = await supabase.from('turnos').update({ estado }).eq('id', id)
    if (e) setError('No se pudo actualizar el estado')
    else {
      cargarTurnosDia(fechaSeleccionada)
      if (vista === 'semana') cargarTurnosSemana(fechaRef)
    }
  }

  async function guardarNotas() {
    if (!turnoEditar) return
    const { error: e } = await supabase.from('turnos').update({ notas: notasEditar }).eq('id', turnoEditar.id)
    if (e) setError('No se pudo guardar las notas')
    else { setTurnoEditar(null); cargarTurnosDia(fechaSeleccionada) }
  }

  const turnosFiltrados = (lista: TurnoConPaciente[]) =>
    filtroEstado === 'todos' ? lista : lista.filter(t => t.estado === filtroEstado)

  function navegar(dir: number) {
    if (vista === 'semana') {
      const nueva = addWeeks(fechaRef, dir)
      setFechaRef(nueva)
    } else {
      setFechaRef(r => addDays(dir > 0 ? endOfMonth(r) : startOfMonth(r), dir))
    }
  }

  function seleccionarDia(fecha: string) {
    setFechaSeleccionada(fecha)
    cargarTurnosDia(fecha)
  }

  const TarjetaTurno = ({ turno }: { turno: TurnoConPaciente }) => (
    <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 transition-colors">
      <div className="flex flex-col items-center justify-center w-12 h-12 bg-blue-50 rounded-xl shrink-0">
        <Clock className="w-3.5 h-3.5 text-blue-600 mb-0.5" />
        <span className="text-xs font-bold text-blue-600">{formatHora(turno.hora)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900">{turno.paciente?.nombre} {turno.paciente?.apellido}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge className={colorEstadoTurno[turno.estado]}>{labelEstadoTurno[turno.estado]}</Badge>
          {turno.modalidad === 'presencial'
            ? <span className="text-xs text-green-700 flex items-center gap-1"><MapPin className="w-3 h-3" />Presencial</span>
            : <span className="text-xs text-blue-700 flex items-center gap-1"><Video className="w-3 h-3" />Video</span>
          }
          <span className="text-xs text-gray-400">{turno.duracion_minutos}min</span>
        </div>
        {turno.notas && <p className="text-xs text-gray-500 mt-1 italic">{turno.notas}</p>}
        {turno.estado !== 'cancelado' && turno.estado !== 'completado' && (
          <div className="flex gap-2 mt-2 flex-wrap">
            <button onClick={() => cambiarEstado(turno.id, 'completado')}
              className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100">
              <Check className="w-3.5 h-3.5" /> Completado
            </button>
            <button onClick={() => { setTurnoEditar(turno); setNotasEditar(turno.notas || '') }}
              className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200">
              <Edit2 className="w-3.5 h-3.5" /> Notas
            </button>
            <button onClick={() => cambiarEstado(turno.id, 'cancelado')}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )

  const tituloNav = vista === 'semana'
    ? (() => {
        const dias = diasDeSemana(fechaRef)
        return `${format(dias[0], 'd MMM', { locale: es })} – ${format(dias[6], 'd MMM yyyy', { locale: es })}`
      })()
    : format(fechaRef, 'MMMM yyyy', { locale: es })

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Turnos</h1>
        <Button onClick={() => setModalNuevoTurno(true)}>
          <Plus className="w-5 h-5" /> Nuevo turno
        </Button>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* Controles */}
      <Card padding="sm">
        {/* Vista switcher */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setVista('semana')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${vista === 'semana' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <LayoutList className="w-4 h-4" /> Semana
          </button>
          <button onClick={() => setVista('mes')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${vista === 'mes' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <Calendar className="w-4 h-4" /> Mes
          </button>
          <button onClick={() => { setFechaRef(new Date()); setFechaSeleccionada(format(new Date(), 'yyyy-MM-dd')) }}
            className="ml-auto px-3 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">
            Hoy
          </button>
        </div>

        {/* Filtro estado */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTROS.map(f => (
            <button key={f.value} onClick={() => setFiltroEstado(f.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filtroEstado === f.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Navegación */}
      <div className="flex items-center justify-between">
        <button onClick={() => navegar(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-gray-900 capitalize">{tituloNav}</span>
        <button onClick={() => navegar(1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* VISTA SEMANA */}
      {vista === 'semana' && (
        <div className="flex flex-col gap-4">
          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1">
            {diasDeSemana(fechaRef).map(dia => {
              const fechaStr = format(dia, 'yyyy-MM-dd')
              const sel = fechaStr === fechaSeleccionada
              const hoy = isToday(dia)
              const count = diasConTurnos[fechaStr] || 0
              const esLaboral = config ? esDiaLaborable(fechaStr, config) : true
              return (
                <button key={fechaStr} onClick={() => seleccionarDia(fechaStr)}
                  className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all ${sel ? 'bg-blue-600 text-white' : hoy ? 'bg-blue-50 text-blue-700' : esLaboral ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300'}`}>
                  <span className="text-xs font-semibold">{DIAS_CORTO[getDay(dia)]}</span>
                  <span className="text-lg font-bold">{format(dia, 'd')}</span>
                  {count > 0 && (
                    <span className={`text-xs font-bold mt-0.5 ${sel ? 'text-blue-200' : 'text-blue-600'}`}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Turnos del día seleccionado */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3 capitalize">
              {format(parseISO(fechaSeleccionada), "EEEE d 'de' MMMM", { locale: es })}
            </h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full" />
              </div>
            ) : turnosFiltrados(turnos).length === 0 ? (
              <Card className="text-center py-8">
                <p className="text-gray-500">No hay turnos para este día</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {turnosFiltrados(turnos).map(t => <TarjetaTurno key={t.id} turno={t} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA MES */}
      {vista === 'mes' && (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="grid grid-cols-7 mb-2">
              {DIAS_CORTO.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: getDay(startOfMonth(fechaRef)) === 0 ? 6 : getDay(startOfMonth(fechaRef)) - 1 }).map((_, i) => <div key={`e${i}`} />)}
              {eachDayOfInterval({ start: startOfMonth(fechaRef), end: endOfMonth(fechaRef) }).map(dia => {
                const fechaStr = format(dia, 'yyyy-MM-dd')
                const sel = fechaStr === fechaSeleccionada
                const hoy = isToday(dia)
                const count = diasConTurnos[fechaStr] || 0
                const esLaboral = config ? esDiaLaborable(fechaStr, config) : true
                return (
                  <button key={fechaStr} onClick={() => seleccionarDia(fechaStr)}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-semibold transition-all relative ${sel ? 'bg-blue-600 text-white' : hoy ? 'bg-blue-50 text-blue-700 ring-2 ring-blue-300' : esLaboral ? 'hover:bg-gray-100 text-gray-700' : 'text-gray-300'}`}>
                    {format(dia, 'd')}
                    {count > 0 && (
                      <span className={`absolute bottom-1 text-[9px] font-bold ${sel ? 'text-blue-200' : 'text-blue-600'}`}>{count}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Turnos del día seleccionado */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3 capitalize">
              {format(parseISO(fechaSeleccionada), "EEEE d 'de' MMMM", { locale: es })}
            </h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full" />
              </div>
            ) : turnosFiltrados(turnos).length === 0 ? (
              <Card className="text-center py-8">
                <p className="text-gray-500">No hay turnos para este día</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {turnosFiltrados(turnos).map(t => <TarjetaTurno key={t.id} turno={t} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modales */}
      {modalNuevoTurno && (
        <FormularioTurno
          isOpen={modalNuevoTurno}
          onClose={() => setModalNuevoTurno(false)}
          onSuccess={() => {
            setModalNuevoTurno(false)
            cargarTurnosDia(fechaSeleccionada)
            if (vista === 'semana') cargarTurnosSemana(fechaRef)
            else cargarDiasConTurnosMes(fechaRef)
          }}
          config={config}
          fechaInicial={fechaSeleccionada}
        />
      )}

      <Modal isOpen={!!turnoEditar} onClose={() => setTurnoEditar(null)} title="Editar notas del turno">
        <div className="flex flex-col gap-4">
          <Textarea label="Notas" value={notasEditar} onChange={e => setNotasEditar(e.target.value)} rows={4} placeholder="Notas del turno..." />
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setTurnoEditar(null)}>Cancelar</Button>
            <Button fullWidth onClick={guardarNotas}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
