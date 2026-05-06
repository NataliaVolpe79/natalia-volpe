'use client'

import { useState, useEffect } from 'react'
import { format, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isBefore, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Search, UserPlus } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Alert from '@/components/ui/Alert'
import { supabase } from '@/lib/supabase'
import { Configuracion, LoteHorario, Paciente, TipoTurno } from '@/lib/types'
import {
  calcularHorariosEnLotes,
  getModalidadPorFecha,
  esDiaLaborable,
  DURACIONES_SEGUIMIENTO,
} from '@/lib/utils'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  config: Configuracion | null
  fechaInicial?: string
}

const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export default function FormularioTurno({ isOpen, onClose, onSuccess, config, fechaInicial }: Props) {
  const [paso, setPaso] = useState<'paciente' | 'tipo' | 'fecha' | 'hora'>('paciente')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Paciente
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Paciente[]>([])
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(null)
  const [creandoPaciente, setCreandoPaciente] = useState(false)
  const [nuevoPaciente, setNuevoPaciente] = useState({ nombre: '', apellido: '', telefono: '' })

  // Tipo de turno y duración
  const [tipoTurno, setTipoTurno] = useState<TipoTurno>('seguimiento')
  const [duracionManual, setDuracionManual] = useState<number | null>(null)

  // Fecha y hora
  const [mesActual, setMesActual] = useState(new Date())
  const [fechaSeleccionada, setFechaSeleccionada] = useState(fechaInicial || '')
  const [horaSeleccionada, setHoraSeleccionada] = useState('')
  const [horarios, setHorarios] = useState<{ hora: string; disponible: boolean }[]>([])
  const [modalidad, setModalidad] = useState<'presencial' | 'videollamada'>('videollamada')
  const [notas, setNotas] = useState('')

  // Duracion efectiva
  const duracionEfectiva = (): number => {
    if (tipoTurno === 'primera_consulta') return config?.duracion_primera_consulta_minutos ?? 60
    if (duracionManual) return duracionManual
    return pacienteSeleccionado?.duracion_seguimiento_minutos ?? 30
  }

  // Buscar pacientes
  useEffect(() => {
    if (busqueda.length < 2) { setResultados([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('*')
        .or(`nombre.ilike.%${busqueda}%,apellido.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%`)
        .order('apellido')
        .limit(8)
      setResultados(data || [])
    }, 300)
    return () => clearTimeout(timer)
  }, [busqueda])

  async function cargarHorarios(fecha: string, tipo: TipoTurno, duracion: number) {
    if (!config) return
    setLoading(true)
    try {
      const diaSemana = format(parseISO(fecha), 'EEEE', { locale: es }).toLowerCase()
      const mod = getModalidadPorFecha(fecha, config)
      setModalidad(mod)

      const [{ data: lotesData }, { data: turnosData }] = await Promise.all([
        supabase.from('lotes_horarios').select('*').eq('dia', diaSemana).order('orden'),
        supabase.from('turnos').select('hora, duracion_minutos')
          .eq('fecha', fecha).in('estado', ['pendiente', 'confirmado']),
      ])

      const ocupados = (turnosData || []).map((t: { hora: string; duracion_minutos: number }) => ({
        hora: t.hora.substring(0, 5),
        duracion: t.duracion_minutos,
      }))

      const h = calcularHorariosEnLotes(
        (lotesData || []) as LoteHorario[],
        ocupados,
        duracion,
        tipo,
        config.buffer_minutos
      )
      setHorarios(h)
    } finally {
      setLoading(false)
    }
  }

  async function seleccionarFecha(fecha: string) {
    setFechaSeleccionada(fecha)
    setHoraSeleccionada('')
    await cargarHorarios(fecha, tipoTurno, duracionEfectiva())
    setPaso('hora')
  }

  async function seleccionarPaciente(p: Paciente) {
    setPacienteSeleccionado(p)
    setDuracionManual(null)
    setPaso('tipo')
  }

  async function confirmarTipo() {
    if (fechaInicial) {
      await cargarHorarios(fechaInicial, tipoTurno, duracionEfectiva())
      setPaso('hora')
    } else {
      setPaso('fecha')
    }
  }

  async function crearPaciente() {
    if (!nuevoPaciente.nombre || !nuevoPaciente.apellido || !nuevoPaciente.telefono) {
      setError('Nombre, apellido y teléfono son obligatorios')
      return
    }
    setLoading(true)
    try {
      const { data, error: e } = await supabase
        .from('pacientes')
        .insert({
          nombre: nuevoPaciente.nombre.trim(),
          apellido: nuevoPaciente.apellido.trim(),
          telefono: nuevoPaciente.telefono.replace(/\D/g, ''),
        })
        .select()
        .single()
      if (e) throw e
      setPacienteSeleccionado(data)
      setCreandoPaciente(false)
      setPaso('tipo')
    } catch {
      setError('No se pudo crear el paciente')
    } finally {
      setLoading(false)
    }
  }

  async function guardarTurno() {
    if (!pacienteSeleccionado || !fechaSeleccionada || !horaSeleccionada) return
    setLoading(true)
    setError('')
    try {
      const { error: e } = await supabase.from('turnos').insert({
        paciente_id: pacienteSeleccionado.id,
        fecha: fechaSeleccionada,
        hora: horaSeleccionada,
        duracion_minutos: duracionEfectiva(),
        modalidad,
        estado: 'confirmado',
        tipo_turno: tipoTurno,
        notas: notas || null,
      })
      if (e) throw e
      onSuccess()
    } catch {
      setError('No se pudo guardar el turno. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function renderCalendario() {
    if (!config) return null
    const hoy = startOfDay(new Date())
    const inicio = startOfMonth(mesActual)
    const fin = endOfMonth(mesActual)
    const dias = eachDayOfInterval({ start: inicio, end: fin })
    const primerDia = getDay(inicio)

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMesActual(m => addDays(startOfMonth(m), -1))} className="p-2 rounded-xl hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-gray-900 capitalize">
            {format(mesActual, 'MMMM yyyy', { locale: es })}
          </span>
          <button onClick={() => setMesActual(m => addDays(endOfMonth(m), 1))} className="p-2 rounded-xl hover:bg-gray-100">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: primerDia }).map((_, i) => <div key={`e${i}`} />)}
          {dias.map(dia => {
            const fechaStr = format(dia, 'yyyy-MM-dd')
            const disponible = esDiaLaborable(fechaStr, config) && !isBefore(dia, hoy)
            const sel = fechaStr === fechaSeleccionada
            return (
              <button key={fechaStr} disabled={!disponible}
                onClick={() => disponible && seleccionarFecha(fechaStr)}
                className={[
                  'aspect-square rounded-lg text-sm font-semibold transition-all',
                  sel ? 'bg-blue-600 text-white' :
                  disponible ? 'bg-blue-50 text-blue-800 hover:bg-blue-100' :
                  'text-gray-300 cursor-not-allowed',
                ].join(' ')}
              >
                {format(dia, 'd')}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const titulos = {
    paciente: 'Buscar paciente',
    tipo: 'Tipo de consulta',
    fecha: 'Elegir fecha',
    hora: 'Elegir horario',
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Nuevo turno — ${titulos[paso]}`} maxWidth="md">
      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      {/* ====== PACIENTE ====== */}
      {paso === 'paciente' && !creandoPaciente && (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Nombre, apellido o teléfono..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {resultados.map(p => (
            <button key={p.id} onClick={() => seleccionarPaciente(p)}
              className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-blue-50 rounded-xl text-left transition-colors">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-blue-700 font-bold">{p.nombre[0]}{p.apellido[0]}</span>
              </div>
              <div>
                <p className="font-bold text-gray-900">{p.nombre} {p.apellido}</p>
                <p className="text-sm text-gray-500">
                  {p.telefono}
                  {p.duracion_seguimiento_minutos && ` · ${p.duracion_seguimiento_minutos} min`}
                </p>
              </div>
            </button>
          ))}
          {busqueda.length >= 2 && resultados.length === 0 && (
            <p className="text-gray-500 text-center py-3">Sin resultados</p>
          )}
          <button onClick={() => setCreandoPaciente(true)}
            className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl font-semibold text-base hover:bg-blue-50 transition-colors">
            <UserPlus className="w-5 h-5" /> Nuevo paciente
          </button>
        </div>
      )}

      {/* ====== NUEVO PACIENTE ====== */}
      {paso === 'paciente' && creandoPaciente && (
        <div className="flex flex-col gap-4">
          <Input label="Nombre *" value={nuevoPaciente.nombre}
            onChange={e => setNuevoPaciente(p => ({ ...p, nombre: e.target.value }))} />
          <Input label="Apellido *" value={nuevoPaciente.apellido}
            onChange={e => setNuevoPaciente(p => ({ ...p, apellido: e.target.value }))} />
          <Input label="Teléfono *" type="tel" inputMode="numeric" hint="Sin el 15"
            value={nuevoPaciente.telefono}
            onChange={e => setNuevoPaciente(p => ({ ...p, telefono: e.target.value }))} />
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => { setCreandoPaciente(false); setError('') }}>Cancelar</Button>
            <Button fullWidth onClick={crearPaciente} loading={loading}>Crear</Button>
          </div>
        </div>
      )}

      {/* ====== TIPO DE TURNO ====== */}
      {paso === 'tipo' && pacienteSeleccionado && (
        <div className="flex flex-col gap-5">
          <div className="bg-blue-50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-200 rounded-full flex items-center justify-center shrink-0">
              <span className="text-blue-800 font-bold text-sm">
                {pacienteSeleccionado.nombre[0]}{pacienteSeleccionado.apellido[0]}
              </span>
            </div>
            <p className="font-semibold text-blue-900">
              {pacienteSeleccionado.nombre} {pacienteSeleccionado.apellido}
            </p>
          </div>

          <div>
            <p className="font-bold text-gray-800 mb-3">Tipo de consulta:</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setTipoTurno('primera_consulta')}
                className={[
                  'p-4 rounded-xl border-2 text-left transition-all',
                  tipoTurno === 'primera_consulta'
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-white border-gray-200 hover:border-purple-300',
                ].join(' ')}>
                <p className="font-bold text-base">Primera consulta</p>
                <p className={`text-sm mt-0.5 ${tipoTurno === 'primera_consulta' ? 'text-purple-100' : 'text-gray-500'}`}>
                  {config?.duracion_primera_consulta_minutos ?? 60} minutos
                </p>
              </button>
              <button onClick={() => setTipoTurno('seguimiento')}
                className={[
                  'p-4 rounded-xl border-2 text-left transition-all',
                  tipoTurno === 'seguimiento'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-200 hover:border-blue-300',
                ].join(' ')}>
                <p className="font-bold text-base">Seguimiento</p>
                <p className={`text-sm mt-0.5 ${tipoTurno === 'seguimiento' ? 'text-blue-100' : 'text-gray-500'}`}>
                  {duracionManual ?? pacienteSeleccionado.duracion_seguimiento_minutos ?? 30} min
                </p>
              </button>
            </div>
          </div>

          {tipoTurno === 'seguimiento' && (
            <div>
              <p className="font-semibold text-gray-700 mb-2">Duración de seguimiento:</p>
              <div className="flex gap-2 flex-wrap">
                {[...DURACIONES_SEGUIMIENTO].map(d => (
                  <button key={d}
                    onClick={() => setDuracionManual(d)}
                    className={[
                      'px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all',
                      (duracionManual ?? pacienteSeleccionado.duracion_seguimiento_minutos) === d
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-200 hover:border-blue-300',
                    ].join(' ')}
                  >
                    {d} min
                  </button>
                ))}
              </div>
              {!pacienteSeleccionado.duracion_seguimiento_minutos && !duracionManual && (
                <p className="text-sm text-yellow-600 mt-2">
                  Este paciente no tiene duración configurada. Seleccioná una.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setPaso('paciente'); setPacienteSeleccionado(null) }}>
              ← Paciente
            </Button>
            <Button fullWidth onClick={confirmarTipo}
              disabled={tipoTurno === 'seguimiento' && !duracionManual && !pacienteSeleccionado.duracion_seguimiento_minutos}>
              Siguiente →
            </Button>
          </div>
        </div>
      )}

      {/* ====== FECHA ====== */}
      {paso === 'fecha' && (
        <div className="flex flex-col gap-4">
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
            <span className="font-semibold">{pacienteSeleccionado?.nombre} {pacienteSeleccionado?.apellido}</span>
            {' · '}
            <span className="capitalize">{tipoTurno === 'primera_consulta' ? 'Primera consulta' : 'Seguimiento'}</span>
            {' · '}
            <span>{duracionEfectiva()} min</span>
          </div>
          {renderCalendario()}
          <Button variant="secondary" onClick={() => setPaso('tipo')}>← Tipo de consulta</Button>
        </div>
      )}

      {/* ====== HORA ====== */}
      {paso === 'hora' && (
        <div className="flex flex-col gap-4">
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
            <span className="font-semibold">{pacienteSeleccionado?.nombre} {pacienteSeleccionado?.apellido}</span>
            {fechaSeleccionada && (
              <span className="ml-2 capitalize">
                · {format(parseISO(fechaSeleccionada), "d 'de' MMMM", { locale: es })}
              </span>
            )}
            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {modalidad === 'presencial' ? '📍' : '💻'} {duracionEfectiva()} min
            </span>
          </div>

          <div>
            <p className="font-semibold text-gray-700 mb-3">Horario:</p>
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {horarios.filter(h => h.disponible).map(h => (
                  <button key={h.hora} onClick={() => setHoraSeleccionada(h.hora)}
                    className={[
                      'py-3 rounded-xl text-base font-bold transition-all',
                      horaSeleccionada === h.hora
                        ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-800 hover:bg-blue-100',
                    ].join(' ')}>
                    {h.hora}
                  </button>
                ))}
                {/* Admin puede también ver horarios ocupados */}
                {horarios.filter(h => !h.disponible).map(h => (
                  <div key={h.hora}
                    className="py-3 rounded-xl text-base font-bold text-gray-300 bg-gray-50 text-center line-through">
                    {h.hora}
                  </div>
                ))}
                {horarios.length === 0 && (
                  <p className="col-span-4 text-center text-gray-500 py-4">
                    Sin horarios disponibles para este tipo de consulta
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-base font-semibold text-gray-700 block mb-1.5">Notas (opcional)</label>
            <textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Notas del turno..." />
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setPaso(fechaInicial ? 'tipo' : 'fecha')}>← Atrás</Button>
            <Button fullWidth disabled={!horaSeleccionada} onClick={guardarTurno}
              loading={loading} variant="success">
              Guardar turno
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
