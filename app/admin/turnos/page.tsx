'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, parseISO, addDays, addWeeks, startOfMonth, endOfMonth, startOfWeek, eachDayOfInterval, getDay, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Clock, Check, X, Edit2, Video, MapPin, Calendar, LayoutList, MessageCircle, FileText } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { TurnoConPaciente, EstadoTurno, Configuracion, LoteHorario } from '@/lib/types'
import { formatHora, formatFecha, colorEstadoTurno, labelEstadoTurno, esDiaLaborable, timeToMinutes, minutesToTime, linkWhatsApp, getModalidadPorFecha } from '@/lib/utils'
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
const DURACION_SLOT = 20

export default function TurnosPage() {
  const [vista, setVista] = useState<Vista>('semana')
  const [fechaRef, setFechaRef] = useState(new Date())
  const [fechaSeleccionada, setFechaSeleccionada] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [turnos, setTurnos] = useState<TurnoConPaciente[]>([])
  const [turnosSemana, setTurnosSemana] = useState<TurnoConPaciente[]>([])
  const [lotesAll, setLotesAll] = useState<LoteHorario[]>([])
  const [diasConTurnos, setDiasConTurnos] = useState<Record<string, number>>({})
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [loading, setLoading] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [modalNuevoTurno, setModalNuevoTurno] = useState(false)
  const [horaSlot, setHoraSlot] = useState('')
  const [turnoEditar, setTurnoEditar] = useState<TurnoConPaciente | null>(null)
  const [notasEditar, setNotasEditar] = useState('')
  const [error, setError] = useState('')
  const [lotes, setLotes] = useState<LoteHorario[]>([])
  const [modalCancelar, setModalCancelar] = useState<{ modo: 'uno'; turno: TurnoConPaciente } | { modo: 'dia' } | null>(null)
  const [mensajeCancelar, setMensajeCancelar] = useState('')
  const [linksWA, setLinksWA] = useState<{ nombre: string; url: string }[]>([])
  const [turnoAcciones, setTurnoAcciones] = useState<TurnoConPaciente | null>(null)
  const [turnoModificar, setTurnoModificar] = useState<TurnoConPaciente | null>(null)
  const [turnosCancelados, setTurnosCancelados] = useState<TurnoConPaciente[]>([])
  const [bloqueando, setBloqueando] = useState(false)
  const [bloqueado, setBloqueado] = useState(false)

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

  // Cargar todos los lotes una sola vez
  useEffect(() => {
    supabase.from('lotes_horarios').select('*').order('dia').order('orden')
      .then(({ data }) => setLotesAll(data || []))
  }, [])

  useEffect(() => {
    if (vista === 'semana') {
      cargarTurnosSemana(fechaRef)
    } else {
      cargarDiasConTurnosMes(fechaRef)
      cargarTurnosDia(fechaSeleccionada)
    }
  }, [vista, fechaRef, fechaSeleccionada, cargarTurnosSemana, cargarDiasConTurnosMes, cargarTurnosDia])

  function iniciarCancelTurno(turno: TurnoConPaciente) {
    const nombre = `${turno.paciente?.nombre} ${turno.paciente?.apellido}`
    const fecha = formatFecha(turno.fecha)
    const hora = formatHora(turno.hora)
    setLinksWA([])
    setMensajeCancelar(`Hola ${nombre}! Tu turno del ${fecha} a las ${hora}hs fue cancelado. Disculpá los inconvenientes. Podés comunicarte con nosotros para reprogramarlo.`)
    setModalCancelar({ modo: 'uno', turno })
  }

  function iniciarCancelDia() {
    const activos = turnos.filter(t => t.estado !== 'cancelado' && t.estado !== 'completado')
    if (activos.length === 0) return
    const fecha = formatFecha(fechaSeleccionada)
    setLinksWA([])
    setMensajeCancelar(`Hola {nombre}! Tu turno del ${fecha} fue cancelado. Disculpá los inconvenientes. Podés comunicarte con nosotros para reprogramarlo.`)
    setModalCancelar({ modo: 'dia' })
  }

  async function confirmarCancelacion() {
    if (!modalCancelar) return
    const turnosACancelar = modalCancelar.modo === 'uno'
      ? [modalCancelar.turno]
      : turnos.filter(t => t.estado !== 'cancelado' && t.estado !== 'completado')

    for (const t of turnosACancelar) {
      await supabase.from('turnos').update({ estado: 'cancelado' }).eq('id', t.id)
    }

    const links = turnosACancelar
      .filter(t => t.paciente?.telefono)
      .map(t => {
        const nombre = `${t.paciente!.nombre} ${t.paciente!.apellido}`
        const msg = mensajeCancelar.replace('{nombre}', nombre)
        return { nombre, url: linkWhatsApp(t.paciente!.telefono!, msg) }
      })

    setTurnosCancelados(turnosACancelar)
    setBloqueado(false)
    setLinksWA(links)
    cargarTurnosDia(fechaSeleccionada)
    if (vista === 'semana') cargarTurnosSemana(fechaRef)
    else cargarDiasConTurnosMes(fechaRef)
  }

  async function bloquearHorariosCancelados() {
    setBloqueando(true)
    for (const t of turnosCancelados) {
      const horaIni = t.hora.substring(0, 5)
      const horaFinMins = timeToMinutes(horaIni) + t.duracion_minutos
      await supabase.from('bloqueos').insert({
        fecha: t.fecha,
        hora_inicio: horaIni,
        hora_fin: minutesToTime(horaFinMins),
        motivo: 'Turno cancelado',
      })
    }
    setBloqueando(false)
    setBloqueado(true)
  }

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

  async function seleccionarDia(fecha: string) {
    setFechaSeleccionada(fecha)
    cargarTurnosDia(fecha)
    const diaSemana = format(parseISO(fecha), 'EEEE', { locale: es }).toLowerCase()
    const { data } = await supabase.from('lotes_horarios').select('*').eq('dia', diaSemana).order('orden')
    setLotes(data || [])
  }

  // ── Grilla semanal ──────────────────────────────────────────────
  function GrillaSemana() {
    const hoyStr = format(new Date(), 'yyyy-MM-dd')
    const diasSemana = diasDeSemana(fechaRef)
    const diasLaborables = diasSemana.filter(d => {
      const fechaStr = format(d, 'yyyy-MM-dd')
      return config ? esDiaLaborable(fechaStr, config) : getDay(d) >= 1 && getDay(d) <= 5
    })

    const columnas = diasLaborables.map(dia => {
      const fechaStr = format(dia, 'yyyy-MM-dd')
      const diaNombre = format(dia, 'EEEE', { locale: es }).toLowerCase()
      const lotesDelDia = lotesAll
        .filter(l => l.dia === diaNombre)
        .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio))
      const turnosDelDia = turnosFiltrados(turnosSemana).filter(
        t => t.fecha === fechaStr && t.estado !== 'cancelado'
      )
      const esPresencial = config ? getModalidadPorFecha(fechaStr, config) === 'presencial' : false
      const esHoy = fechaStr === hoyStr

      const slots: { hora: string; turno: TurnoConPaciente | null; esContinuacion: boolean }[] = []
      for (const lote of lotesDelDia) {
        let actual = timeToMinutes(lote.hora_inicio)
        const fin = timeToMinutes(lote.hora_fin)
        while (actual + DURACION_SLOT <= fin) {
          const horaStr = minutesToTime(actual)
          const turno = turnosDelDia.find(t => t.hora.substring(0, 5) === horaStr) ?? null
          const esContinuacion = !turno && turnosDelDia.some(t => {
            const tStart = timeToMinutes(t.hora.substring(0, 5))
            return tStart < actual && actual < tStart + t.duracion_minutos
          })
          slots.push({ hora: horaStr, turno, esContinuacion })
          actual += DURACION_SLOT
        }
      }

      const libres = slots.filter(s => !s.turno && !s.esContinuacion).length
      const horasEnSlots = new Set(slots.map(s => s.hora))
      const turnosFuera = turnosDelDia
        .filter(t => !horasEnSlots.has(t.hora.substring(0, 5)))
        .sort((a, b) => timeToMinutes(a.hora.substring(0, 5)) - timeToMinutes(b.hora.substring(0, 5)))

      return { dia, fechaStr, esPresencial, esHoy, slots, libres, turnosFuera }
    })

    if (columnas.length === 0) {
      return (
        <Card className="text-center py-8">
          <p className="text-gray-500">No hay días laborables esta semana</p>
        </Card>
      )
    }

    return (
      <div className="overflow-x-auto">
        <div className="flex gap-2" style={{ minWidth: `${columnas.length * 140}px` }}>
          {columnas.map(({ dia, fechaStr, esPresencial, esHoy, slots, libres, turnosFuera }) => (
            <div key={fechaStr} className="flex-1 flex flex-col gap-1.5">
              {/* Encabezado del día */}
              <div className={`text-center p-2.5 rounded-xl ${
                esHoy
                  ? 'bg-blue-600 text-white'
                  : esPresencial
                  ? 'bg-green-50 border border-green-200 text-green-900'
                  : 'bg-blue-50 border border-blue-200 text-blue-900'
              }`}>
                <p className="text-xs font-semibold capitalize">
                  {format(dia, 'EEE', { locale: es })}
                </p>
                <p className="text-xl font-bold leading-tight">{format(dia, 'd')}</p>
                <p className="text-xs mt-0.5">{esPresencial ? '📍' : '💻'}</p>
                <p className={`text-xs font-semibold mt-1 ${esHoy ? 'text-blue-200' : 'text-gray-500'}`}>
                  {libres} libre{libres !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Slots + turnos fuera de horario mezclados y ordenados */}
              {slots.length === 0 && turnosFuera.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-4">Sin horarios</div>
              )}
              {[
                ...slots.map(s => ({ tipo: 'slot' as const, hora: s.hora, turno: s.turno, esContinuacion: s.esContinuacion })),
                ...turnosFuera.map(t => ({ tipo: 'extra' as const, hora: t.hora.substring(0, 5), turno: t, esContinuacion: false })),
              ]
                .sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora))
                .map(item =>
                item.tipo === 'extra' ? (
                  <div
                    key={item.turno.id}
                    className="px-2 py-2 bg-orange-100 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-200 transition-colors"
                    onClick={() => setTurnoAcciones(item.turno)}
                  >
                    <p className="text-xs font-bold text-orange-700 leading-none">{item.hora}</p>
                    <p className="text-xs text-orange-900 font-semibold truncate mt-0.5 leading-tight">
                      {item.turno.paciente?.nombre} {item.turno.paciente?.apellido?.charAt(0)}.
                    </p>
                    <p className="text-[10px] text-orange-600 mt-0.5">{item.turno.duracion_minutos}min</p>
                  </div>
                ) : item.turno ? (
                  <div
                    key={item.hora}
                    className={`px-2 py-2 rounded-lg cursor-pointer transition-colors border ${
                      item.turno.estado === 'completado'
                        ? 'bg-green-50 border-green-200 hover:bg-green-100'
                        : item.turno.estado === 'cancelado'
                        ? 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        : 'bg-blue-100 border-blue-200 hover:bg-blue-200'
                    }`}
                    onClick={() => setTurnoAcciones(item.turno!)}
                  >
                    <p className={`text-xs font-bold leading-none ${item.turno.estado === 'completado' ? 'text-green-700' : item.turno.estado === 'cancelado' ? 'text-gray-400' : 'text-blue-700'}`}>{item.hora}</p>
                    <p className={`text-xs font-semibold truncate mt-0.5 leading-tight ${item.turno.estado === 'cancelado' ? 'text-gray-400 line-through' : 'text-blue-900'}`}>
                      {item.turno.paciente?.nombre} {item.turno.paciente?.apellido}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${item.turno.estado === 'cancelado' ? 'text-gray-400' : 'text-blue-500'}`}>
                      {item.turno.paciente?.obra_social?.toLowerCase().includes('osde') ? 'OSDE' : 'Particular'}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${item.turno.estado === 'completado' ? 'text-green-600' : item.turno.estado === 'cancelado' ? 'text-gray-400' : 'text-blue-600'}`}>{item.turno.duracion_minutos}min</p>
                  </div>
                ) : item.esContinuacion ? (
                  <div
                    key={item.hora}
                    className="px-2 py-2 bg-gray-100 border border-gray-200 rounded-lg"
                  >
                    <p className="text-xs font-bold text-gray-400 leading-none">{item.hora}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">ocupado</p>
                  </div>
                ) : (
                  <button
                    key={item.hora}
                    className="px-2 py-2 bg-green-50 border border-dashed border-green-200 rounded-lg hover:bg-green-100 hover:border-green-400 transition-all text-left group"
                    onClick={() => {
                      setFechaSeleccionada(fechaStr)
                      setHoraSlot(item.hora)
                      setModalNuevoTurno(true)
                    }}
                  >
                    <p className="text-xs font-bold text-green-700 leading-none">{item.hora}</p>
                    <p className="text-[10px] text-green-500 group-hover:text-green-700 mt-0.5">+ Asignar</p>
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Tarjeta de turno (vista mes / día) ──────────────────────────
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
            <button onClick={() => setTurnoModificar(turno)}
              className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100">
              <Calendar className="w-3.5 h-3.5" /> Modificar
            </button>
            <button onClick={() => { setTurnoEditar(turno); setNotasEditar(turno.notas || '') }}
              className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200">
              <Edit2 className="w-3.5 h-3.5" /> Notas
            </button>
            <button onClick={() => iniciarCancelTurno(turno)}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )

  function AgendaDia() {
    const DURACION = 20
    const lotesOrdenados = [...lotes].sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio))
    const activos = turnosFiltrados(turnos).filter(t => t.estado !== 'cancelado')
    const slots: Array<{ hora: string; turno: TurnoConPaciente | null; esContinuacion: boolean }> = []

    for (const lote of lotesOrdenados) {
      let actual = timeToMinutes(lote.hora_inicio)
      const fin = timeToMinutes(lote.hora_fin)
      while (actual + DURACION <= fin) {
        const horaStr = minutesToTime(actual)
        const turnoEnSlot = activos.find(t => t.hora.substring(0, 5) === horaStr) ?? null
        const esContinuacion = !turnoEnSlot && activos.some(t => {
          const tStart = timeToMinutes(t.hora.substring(0, 5))
          return tStart < actual && actual < tStart + t.duracion_minutos
        })
        slots.push({ hora: horaStr, turno: turnoEnSlot, esContinuacion })
        actual += DURACION
      }
    }

    const horasEnSlots = new Set(slots.map(s => s.hora))
    const turnosFuera = activos.filter(t => !horasEnSlots.has(t.hora.substring(0, 5)))

    type ItemSlot = { tipo: 'slot'; hora: string; turno: TurnoConPaciente | null; esContinuacion: boolean }
    type ItemExtra = { tipo: 'extra'; hora: string; turno: TurnoConPaciente }
    const items: Array<ItemSlot | ItemExtra> = [
      ...slots.map(s => ({ tipo: 'slot' as const, hora: s.hora, turno: s.turno, esContinuacion: s.esContinuacion })),
      ...turnosFuera.map(t => ({ tipo: 'extra' as const, hora: t.hora.substring(0, 5), turno: t })),
    ].sort((a, b) => timeToMinutes(a.hora) - timeToMinutes(b.hora))

    if (items.length === 0) {
      return (
        <Card className="text-center py-8">
          <p className="text-gray-500">No hay horarios configurados para este día</p>
        </Card>
      )
    }

    return (
      <div className="flex flex-col gap-2">
        {items.map(item =>
          item.tipo === 'extra' ? (
            <TarjetaTurno key={item.turno.id} turno={item.turno} />
          ) : item.turno ? (
            <TarjetaTurno key={item.hora} turno={item.turno} />
          ) : item.esContinuacion ? (
            <div key={item.hora} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-12 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-gray-400">{item.hora}</span>
              </div>
              <span className="text-gray-400 text-sm">Ocupado</span>
            </div>
          ) : (
            <div key={item.hora} className="flex items-center gap-3 px-3 py-2.5 bg-green-50 rounded-xl border border-green-100">
              <div className="w-12 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-green-700">{item.hora}</span>
              </div>
              <span className="text-green-700 font-semibold text-sm flex-1">Disponible</span>
              <button
                onClick={() => { setHoraSlot(item.hora); setModalNuevoTurno(true) }}
                className="text-xs text-green-600 font-bold hover:text-green-800 px-2 py-1 rounded-lg hover:bg-green-100"
              >
                + Asignar
              </button>
            </div>
          )
        )}
      </div>
    )
  }

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

      {/* VISTA SEMANA — grilla */}
      {vista === 'semana' && (
        loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <GrillaSemana />
        )
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

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 capitalize">
                {format(parseISO(fechaSeleccionada), "EEEE d 'de' MMMM", { locale: es })}
              </h2>
              {turnos.some(t => t.estado !== 'cancelado' && t.estado !== 'completado') && (
                <button onClick={iniciarCancelDia}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-100">
                  <X className="w-3.5 h-3.5" /> Cancelar todos
                </button>
              )}
            </div>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full" />
              </div>
            ) : (
              <AgendaDia />
            )}
          </div>
        </div>
      )}

      {/* Modales */}
      {modalNuevoTurno && (
        <FormularioTurno
          isOpen={modalNuevoTurno}
          onClose={() => { setModalNuevoTurno(false); setHoraSlot('') }}
          onSuccess={() => {
            setModalNuevoTurno(false)
            setHoraSlot('')
            cargarTurnosSemana(fechaRef)
            cargarTurnosDia(fechaSeleccionada)
            if (vista === 'mes') cargarDiasConTurnosMes(fechaRef)
          }}
          config={config}
          fechaInicial={horaSlot ? fechaSeleccionada : undefined}
          horaInicial={horaSlot}
        />
      )}

      <Modal
        isOpen={!!modalCancelar}
        onClose={() => { setModalCancelar(null); setLinksWA([]); setTurnosCancelados([]); setBloqueado(false) }}
        title={modalCancelar?.modo === 'dia' ? 'Cancelar todos los turnos del día' : 'Cancelar turno'}
      >
        {linksWA.length === 0 ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              {modalCancelar?.modo === 'dia'
                ? `Se cancelarán ${turnos.filter(t => t.estado !== 'cancelado' && t.estado !== 'completado').length} turno(s). Editá el mensaje antes de enviar.`
                : 'Editá el mensaje antes de enviar al paciente.'}
            </p>
            {modalCancelar?.modo === 'dia' && (
              <p className="text-xs text-gray-400">Usá <span className="font-mono bg-gray-100 px-1 rounded">{'{nombre}'}</span> para insertar el nombre de cada paciente.</p>
            )}
            <Textarea
              label="Mensaje de cancelación"
              value={mensajeCancelar}
              onChange={e => setMensajeCancelar(e.target.value)}
              rows={4}
            />
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setModalCancelar(null)}>Volver</Button>
              <Button fullWidth onClick={confirmarCancelacion}>Confirmar cancelación</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-green-700 font-semibold">
              ✓ Turno(s) cancelado(s). Enviá el mensaje a cada paciente:
            </p>
            <div className="flex flex-col gap-2">
              {linksWA.map(({ nombre, url }) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 bg-green-50 text-green-800 rounded-xl font-semibold text-sm hover:bg-green-100 transition-colors">
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">Enviar a {nombre}</span>
                </a>
              ))}
            </div>
            {bloqueado ? (
              <p className="text-center text-sm text-green-700 font-semibold">✓ Horario bloqueado — no se puede reservar online</p>
            ) : (
              <Button variant="secondary" fullWidth onClick={bloquearHorariosCancelados} loading={bloqueando}>
                🔒 Bloquear {turnosCancelados.length > 1 ? 'estos horarios' : 'este horario'} para turnos online
              </Button>
            )}
            <Button fullWidth onClick={() => { setModalCancelar(null); setLinksWA([]); setTurnosCancelados([]); setBloqueado(false) }}>Listo</Button>
          </div>
        )}
      </Modal>

      {/* Modal acciones rápidas — click en turno de grilla semanal */}
      <Modal
        isOpen={!!turnoAcciones}
        onClose={() => setTurnoAcciones(null)}
        title="Turno"
      >
        {turnoAcciones && (
          <div className="flex flex-col gap-4">
            <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2 text-sm">
              <p className="font-bold text-gray-900 text-lg">
                {turnoAcciones.paciente?.nombre} {turnoAcciones.paciente?.apellido}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600">
                <span>📅 {formatFecha(turnoAcciones.fecha)}</span>
                <span>🕐 {formatHora(turnoAcciones.hora)} hs</span>
                <span>{turnoAcciones.modalidad === 'presencial' ? '📍 Presencial' : '💻 Videollamada'}</span>
                <span>{turnoAcciones.duracion_minutos} min</span>
                {turnoAcciones.paciente?.telefono && (
                  <span>📱 {turnoAcciones.paciente.telefono}</span>
                )}
              </div>
              <Badge className={colorEstadoTurno[turnoAcciones.estado]}>{labelEstadoTurno[turnoAcciones.estado]}</Badge>
            </div>

            {turnoAcciones.estado !== 'cancelado' && turnoAcciones.estado !== 'completado' && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={async () => {
                    await cambiarEstado(turnoAcciones.id, 'confirmado')
                    cargarTurnosSemana(fechaRef)
                    setTurnoAcciones(null)
                  }}
                  disabled={turnoAcciones.estado === 'confirmado'}
                  className="flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Check className="w-4 h-4" /> Marcar como confirmado
                </button>
                <button
                  onClick={async () => {
                    await cambiarEstado(turnoAcciones.id, 'completado')
                    cargarTurnosSemana(fechaRef)
                    setTurnoAcciones(null)
                  }}
                  className="flex items-center gap-2 px-4 py-3 bg-green-50 text-green-700 rounded-xl font-semibold text-sm hover:bg-green-100 transition-colors"
                >
                  <Check className="w-4 h-4" /> Marcar como completado
                </button>
                <button
                  onClick={() => {
                    setTurnoModificar(turnoAcciones)
                    setTurnoAcciones(null)
                  }}
                  className="flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-colors"
                >
                  <Edit2 className="w-4 h-4" /> Modificar turno
                </button>
                <button
                  onClick={() => {
                    setTurnoAcciones(null)
                    iniciarCancelTurno(turnoAcciones)
                  }}
                  className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl font-semibold text-sm hover:bg-red-100 transition-colors"
                >
                  <X className="w-4 h-4" /> Cancelar turno
                </button>
              </div>
            )}

            {turnoAcciones.paciente?.telefono && (
              <a
                href={linkWhatsApp(turnoAcciones.paciente.telefono)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-green-50 text-green-800 rounded-xl font-semibold text-sm hover:bg-green-100 transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> Escribir por WhatsApp
              </a>
            )}

            {turnoAcciones.paciente_id && (
              <Link
                href={`/admin/pacientes?open=${turnoAcciones.paciente_id}&historia=1`}
                className="flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-800 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-colors"
              >
                <FileText className="w-4 h-4" /> Ver historia clínica
              </Link>
            )}

            <Button variant="secondary" onClick={() => setTurnoAcciones(null)}>Cerrar</Button>
          </div>
        )}
      </Modal>

      {turnoModificar && (
        <FormularioTurno
          isOpen={!!turnoModificar}
          onClose={() => setTurnoModificar(null)}
          onSuccess={() => {
            setTurnoModificar(null)
            cargarTurnosSemana(fechaRef)
            cargarTurnosDia(fechaSeleccionada)
            if (vista === 'mes') cargarDiasConTurnosMes(fechaRef)
          }}
          config={config}
          turnoExistente={turnoModificar}
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
