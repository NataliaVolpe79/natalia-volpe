'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { format, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isBefore, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CheckCircle, ArrowLeft, UserCheck, UserPlus, Phone } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Alert from '@/components/ui/Alert'
import { supabase } from '@/lib/supabase'
import {
  calcularHorariosEnLotes,
  getModalidadPorFecha,
  esDiaLaborable,
  formatHora,
} from '@/lib/utils'
import { Configuracion, TipoTurno } from '@/lib/types'

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_CONTACTO || '549XXXXXXXXXX'
const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const DURACION_PRIMERA_CONSULTA_DEFAULT = 60

type FlujoPaciente = 'nueva' | 'existente' | null

type DatosNuevo = { nombre: string; apellido: string; telefono: string }
type PacienteEncontrado = {
  id: string; nombre: string; apellido: string; telefono: string
  duracion_seguimiento_minutos: number | null
}

export default function SacarTurnoPage() {
  const router = useRouter()
  const [paso, setPaso] = useState<0 | 1 | 2 | 3 | 4>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Flujo
  const [flujo, setFlujo] = useState<FlujoPaciente>(null)

  // Paso 1a — nuevo paciente
  const [datosNuevo, setDatosNuevo] = useState<DatosNuevo>({ nombre: '', apellido: '', telefono: '' })
  const [erroresDatos, setErroresDatos] = useState<Partial<DatosNuevo>>({})

  // Paso 1b — paciente existente
  const [telefonoBusqueda, setTelefonoBusqueda] = useState('')
  const [pacienteEncontrado, setPacienteEncontrado] = useState<PacienteEncontrado | null>(null)
  const [noEncontrado, setNoEncontrado] = useState(false)

  // Datos calculados
  const [config, setConfig] = useState<Configuracion | null>(null)
  // lotes se usa localmente dentro de cargarHorarios
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [horaSeleccionada, setHoraSeleccionada] = useState('')
  const [horarios, setHorarios] = useState<{ hora: string; disponible: boolean }[]>([])
  const [modalidad, setModalidad] = useState<'presencial' | 'videollamada'>('videollamada')
  const [mesActual, setMesActual] = useState(new Date())
  const [tipoTurno, setTipoTurno] = useState<TipoTurno>('primera_consulta')
  const [duracionTurno, setDuracionTurno] = useState(DURACION_PRIMERA_CONSULTA_DEFAULT)

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  async function cargarConfig() {
    const { data } = await supabase.from('configuracion').select('*').single()
    if (data) setConfig(data)
    return data as Configuracion | null
  }

  async function cargarHorarios(fecha: string, cfg: Configuracion, duracion: number, tipo: TipoTurno) {
    setLoading(true)
    try {
      const diaSemana = format(parseISO(fecha), 'EEEE', { locale: es }).toLowerCase()
      const mod = getModalidadPorFecha(fecha, cfg)
      setModalidad(mod)

      const [{ data: lotesData }, { data: turnosData }] = await Promise.all([
        supabase.from('lotes_horarios').select('*').eq('dia', diaSemana).order('orden'),
        supabase
          .from('turnos')
          .select('hora, duracion_minutos')
          .eq('fecha', fecha)
          .in('estado', ['pendiente', 'confirmado']),
      ])

      const ocupados = (turnosData || []).map(t => ({
        hora: t.hora.substring(0, 5),
        duracion: t.duracion_minutos,
      }))

      const h = calcularHorariosEnLotes(lotesData || [], ocupados, duracion, tipo, cfg.buffer_minutos)
      setHorarios(h)
      setPaso(3)
    } finally {
      setLoading(false)
    }
  }

  // ----------------------------------------------------------------
  // Paso 0 → elegir flujo
  // ----------------------------------------------------------------

  async function elegirPrimeraConsulta() {
    setFlujo('nueva')
    setTipoTurno('primera_consulta')
    const cfg = await cargarConfig()
    setDuracionTurno(cfg?.duracion_primera_consulta_minutos ?? DURACION_PRIMERA_CONSULTA_DEFAULT)
    setPaso(1)
  }

  async function elegirPacienteExistente() {
    setFlujo('existente')
    setTipoTurno('seguimiento')
    await cargarConfig()
    setPaso(1)
  }

  // ----------------------------------------------------------------
  // Paso 1a — validar datos nuevo paciente
  // ----------------------------------------------------------------

  function validarDatos(): boolean {
    const e: Partial<DatosNuevo> = {}
    if (!datosNuevo.nombre.trim()) e.nombre = 'Ingresá tu nombre'
    if (!datosNuevo.apellido.trim()) e.apellido = 'Ingresá tu apellido'
    if (!datosNuevo.telefono.trim()) e.telefono = 'Ingresá tu teléfono'
    else if (!/^\d{8,12}$/.test(datosNuevo.telefono.replace(/\s/g, '')))
      e.telefono = 'Solo números, sin el 15 (ej: 1154321234)'
    setErroresDatos(e)
    return Object.keys(e).length === 0
  }

  function avanzarDesdeNuevo() {
    if (validarDatos()) setPaso(2)
  }

  // ----------------------------------------------------------------
  // Paso 1b — buscar paciente existente
  // ----------------------------------------------------------------

  async function buscarPaciente() {
    const tel = telefonoBusqueda.replace(/\D/g, '')
    if (tel.length < 8) {
      setError('Ingresá tu teléfono completo (sin el 15)')
      return
    }
    setLoading(true)
    setError('')
    setPacienteEncontrado(null)
    setNoEncontrado(false)
    try {
      const res = await fetch('/api/buscar-paciente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: tel }),
      })
      const data = await res.json()
      if (data.encontrado) {
        const p = data.paciente as PacienteEncontrado
        setPacienteEncontrado(p)
        const duracion = p.duracion_seguimiento_minutos ?? 30
        setDuracionTurno(duracion)
      } else {
        setNoEncontrado(true)
      }
    } catch {
      setError('No se pudo verificar tu teléfono. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function confirmarPacienteExistente() {
    if (!pacienteEncontrado) return
    setPaso(2)
  }

  // ----------------------------------------------------------------
  // Paso 2 → seleccionar fecha
  // ----------------------------------------------------------------

  async function seleccionarFecha(fecha: string) {
    if (!config) return
    setFechaSeleccionada(fecha)
    setHoraSeleccionada('')
    await cargarHorarios(fecha, config, duracionTurno, tipoTurno)
  }

  // ----------------------------------------------------------------
  // Paso 3 → confirmar turno
  // ----------------------------------------------------------------

  async function confirmarTurno() {
    if (!horaSeleccionada || !fechaSeleccionada || !config) return
    setLoading(true)
    setError('')
    try {
      let pacienteId: string

      if (flujo === 'existente' && pacienteEncontrado) {
        pacienteId = pacienteEncontrado.id
      } else {
        // Buscar o crear paciente nuevo
        const tel = datosNuevo.telefono.replace(/\D/g, '')
        const { data: existente } = await supabase
          .from('pacientes')
          .select('id')
          .eq('telefono', tel)
          .maybeSingle()

        if (existente) {
          pacienteId = existente.id
        } else {
          const { data: nuevo, error: e } = await supabase
            .from('pacientes')
            .insert({
              nombre: datosNuevo.nombre.trim(),
              apellido: datosNuevo.apellido.trim(),
              telefono: tel,
            })
            .select('id')
            .single()
          if (e || !nuevo) throw new Error('No se pudo crear el paciente')
          pacienteId = nuevo.id
        }
      }

      const { error: e } = await supabase.from('turnos').insert({
        paciente_id: pacienteId,
        fecha: fechaSeleccionada,
        hora: horaSeleccionada,
        duracion_minutos: duracionTurno,
        modalidad,
        estado: 'pendiente',
        tipo_turno: tipoTurno,
      })
      if (e) throw new Error('No se pudo reservar el turno')
      setPaso(4)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hubo un error. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ----------------------------------------------------------------
  // Calendario
  // ----------------------------------------------------------------

  function Calendario() {
    if (!config) return null
    const hoy = startOfDay(new Date())
    const inicio = startOfMonth(mesActual)
    const fin = endOfMonth(mesActual)
    const dias = eachDayOfInterval({ start: inicio, end: fin })
    const primerDia = getDay(inicio)

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMesActual(m => addDays(startOfMonth(m), -1))} className="p-3 rounded-xl hover:bg-gray-100">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span className="text-lg font-bold text-gray-900 capitalize">
            {format(mesActual, 'MMMM yyyy', { locale: es })}
          </span>
          <button onClick={() => setMesActual(m => addDays(endOfMonth(m), 1))} className="p-3 rounded-xl hover:bg-gray-100">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-2">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="text-center text-sm font-semibold text-gray-400 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: primerDia }).map((_, i) => <div key={`e${i}`} />)}
          {dias.map(dia => {
            const fechaStr = format(dia, 'yyyy-MM-dd')
            const esLaboral = esDiaLaborable(fechaStr, config)
            const esPasado = isBefore(dia, hoy)
            const sel = fechaStr === fechaSeleccionada
            const disponible = esLaboral && !esPasado
            return (
              <button
                key={fechaStr}
                disabled={!disponible || loading}
                onClick={() => disponible && seleccionarFecha(fechaStr)}
                className={[
                  'aspect-square rounded-xl text-base font-semibold transition-all',
                  sel ? 'bg-blue-600 text-white shadow-md' :
                  disponible ? 'bg-blue-50 text-blue-800 hover:bg-blue-100 active:scale-95' :
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

  const nombrePaciente = flujo === 'existente' && pacienteEncontrado
    ? `${pacienteEncontrado.nombre} ${pacienteEncontrado.apellido}`
    : `${datosNuevo.nombre} ${datosNuevo.apellido}`.trim()

  const totalPasos = 3
  const pasoDisplay = paso === 0 ? 0 : Math.min(paso, totalPasos)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => paso > 0 ? setPaso(p => (p - 1) as typeof paso) : router.push('/')}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <p className="text-sm text-gray-500">Reservar turno</p>
            {paso > 0 && paso < 4 && (
              <p className="text-base font-bold text-gray-900">Paso {pasoDisplay} de {totalPasos}</p>
            )}
          </div>
        </div>
        {paso > 0 && paso < 4 && (
          <div className="h-1 bg-gray-100">
            <div className="h-full bg-blue-600 transition-all duration-500"
              style={{ width: `${(pasoDisplay / totalPasos) * 100}%` }} />
          </div>
        )}
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <AnimatePresence mode="wait">

          {/* ============ PASO 0: Tipo de paciente ============ */}
          {paso === 0 && (
            <motion.div key="paso0"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-6"
            >
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">¿Cómo es tu consulta?</h1>
                <p className="text-gray-500 text-lg">Elegí una opción para ver los horarios disponibles.</p>
              </div>

              <button
                onClick={elegirPrimeraConsulta}
                disabled={loading}
                className="w-full bg-white rounded-2xl border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 p-6 text-left transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                    <UserPlus className="w-7 h-7 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">Es mi primera consulta</p>
                    <p className="text-base text-gray-500 mt-1">
                      Nunca consulté con la Dra. Volpe antes.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={elegirPacienteExistente}
                disabled={loading}
                className="w-full bg-white rounded-2xl border-2 border-green-200 hover:border-green-500 hover:bg-green-50 p-6 text-left transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
                    <UserCheck className="w-7 h-7 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">Ya soy paciente</p>
                    <p className="text-base text-gray-500 mt-1">
                      Tengo consultas previas con la Dra. Volpe.
                    </p>
                  </div>
                </div>
              </button>
            </motion.div>
          )}

          {/* ============ PASO 1a: Datos (primera consulta) ============ */}
          {paso === 1 && flujo === 'nueva' && (
            <motion.div key="paso1a"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="flex flex-col gap-6"
            >
              <div>
                <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-semibold mb-3">
                  <UserPlus className="w-4 h-4" /> Primera consulta
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Tus datos</h1>
                <p className="text-gray-500">Ingresá tus datos para reservar el turno.</p>
              </div>

              {error && <Alert type="error">{error}</Alert>}

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-5">
                <Input label="Nombre" placeholder="María"
                  value={datosNuevo.nombre} error={erroresDatos.nombre}
                  onChange={e => setDatosNuevo(d => ({ ...d, nombre: e.target.value }))} />
                <Input label="Apellido" placeholder="García"
                  value={datosNuevo.apellido} error={erroresDatos.apellido}
                  onChange={e => setDatosNuevo(d => ({ ...d, apellido: e.target.value }))} />
                <Input label="Teléfono de WhatsApp" placeholder="1154321234" type="tel"
                  inputMode="numeric" hint="Sin el 15, solo números"
                  value={datosNuevo.telefono} error={erroresDatos.telefono}
                  onChange={e => setDatosNuevo(d => ({ ...d, telefono: e.target.value }))} />
              </div>

              <Button size="lg" fullWidth onClick={avanzarDesdeNuevo}>Siguiente →</Button>
            </motion.div>
          )}

          {/* ============ PASO 1b: Buscar paciente existente ============ */}
          {paso === 1 && flujo === 'existente' && (
            <motion.div key="paso1b"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="flex flex-col gap-6"
            >
              <div>
                <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-sm font-semibold mb-3">
                  <UserCheck className="w-4 h-4" /> Paciente existente
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Buscá tu número</h1>
                <p className="text-gray-500">Ingresá el mismo teléfono con el que te registraste.</p>
              </div>

              {error && <Alert type="error">{error}</Alert>}

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
                <Input
                  label="Tu teléfono de WhatsApp"
                  placeholder="1154321234"
                  type="tel"
                  inputMode="numeric"
                  hint="Sin el 15, solo números"
                  value={telefonoBusqueda}
                  onChange={e => {
                    setTelefonoBusqueda(e.target.value)
                    setPacienteEncontrado(null)
                    setNoEncontrado(false)
                  }}
                />
                <Button onClick={buscarPaciente} loading={loading} fullWidth>
                  <Phone className="w-5 h-5" />
                  Buscar mi número
                </Button>
              </div>

              {/* Paciente encontrado */}
              {pacienteEncontrado && (
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                      <p className="font-bold text-green-900 text-lg">¡Te encontramos!</p>
                    </div>
                    <p className="text-green-800 text-lg font-semibold">
                      {pacienteEncontrado.nombre} {pacienteEncontrado.apellido}
                    </p>
                    {pacienteEncontrado.duracion_seguimiento_minutos && (
                      <p className="text-green-700 text-base mt-1">
                        Duración de tu consulta: {pacienteEncontrado.duracion_seguimiento_minutos} minutos
                      </p>
                    )}
                  </div>
                  <Button size="lg" fullWidth className="mt-4" onClick={confirmarPacienteExistente}>
                    Continuar →
                  </Button>
                </motion.div>
              )}

              {/* No encontrado */}
              {noEncontrado && (
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
                  <Alert type="warning">
                    <p className="font-bold mb-2">No encontramos tu número en el sistema</p>
                    <p className="mb-3">
                      Para tu primera consulta escribinos por WhatsApp y te damos un turno:
                    </p>
                    <a
                      href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, quisiera sacar un turno para una primera consulta con la Dra. Volpe')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-green-500 text-white px-5 py-3 rounded-xl font-bold text-base hover:bg-green-600 transition-colors"
                    >
                      Escribir por WhatsApp
                    </a>
                  </Alert>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ============ PASO 2: Elegir día ============ */}
          {paso === 2 && (
            <motion.div key="paso2"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="flex flex-col gap-6"
            >
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Elegí el día</h1>
                <p className="text-gray-500">Los días resaltados en azul tienen turnos disponibles.</p>
              </div>

              {error && <Alert type="error">{error}</Alert>}

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                ) : <Calendario />}
              </div>

              <div className="bg-blue-50 rounded-xl p-4 text-base text-blue-800">
                <p className="font-semibold mb-1">Modalidades:</p>
                <p>📍 <strong>Viernes:</strong> presencial</p>
                <p>💻 <strong>Lunes a jueves:</strong> videollamada</p>
              </div>
            </motion.div>
          )}

          {/* ============ PASO 3: Elegir hora ============ */}
          {paso === 3 && (
            <motion.div key="paso3"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="flex flex-col gap-6"
            >
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Elegí el horario</h1>
                <div className="flex items-center gap-2 text-gray-600 mt-1">
                  <span className="capitalize">
                    {fechaSeleccionada
                      ? format(parseISO(fechaSeleccionada), "EEEE d 'de' MMMM", { locale: es })
                      : ''}
                  </span>
                  <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {modalidad === 'presencial' ? '📍 Presencial' : '💻 Videollamada'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Duración: {duracionTurno} minutos
                  {tipoTurno === 'primera_consulta' && ' · Primera consulta'}
                </p>
              </div>

              {error && <Alert type="error">{error}</Alert>}

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {horarios.filter(h => h.disponible).map(h => (
                      <button
                        key={h.hora}
                        onClick={() => setHoraSeleccionada(h.hora)}
                        className={[
                          'py-4 rounded-xl text-lg font-bold transition-all active:scale-95',
                          horaSeleccionada === h.hora
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-blue-50 text-blue-800 hover:bg-blue-100',
                        ].join(' ')}
                      >
                        {h.hora}
                      </button>
                    ))}
                    {horarios.filter(h => h.disponible).length === 0 && (
                      <div className="col-span-3 text-center py-8 text-gray-500">
                        No hay horarios disponibles para este día.
                        <br />
                        <button className="text-blue-600 font-semibold mt-2 underline"
                          onClick={() => { setHoraSeleccionada(''); setPaso(2) }}>
                          Elegir otro día
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button size="lg" fullWidth variant="success"
                disabled={!horaSeleccionada}
                onClick={confirmarTurno}
                loading={loading}>
                Confirmar turno
              </Button>
            </motion.div>
          )}

          {/* ============ PASO 4: Confirmación ============ */}
          {paso === 4 && (
            <motion.div key="paso4"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center gap-8 py-8"
            >
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.15, stiffness: 200 }}
                className="w-28 h-28 bg-green-100 rounded-full flex items-center justify-center"
              >
                <CheckCircle className="w-16 h-16 text-green-600" />
              </motion.div>

              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-3">¡Tu turno está reservado!</h1>
                <p className="text-gray-500 text-lg">Ya anotamos tu turno. Te esperamos.</p>
              </div>

              <div className="w-full bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left flex flex-col gap-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">Nombre</span>
                  <span className="font-bold text-gray-900 text-lg">{nombrePaciente}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">Fecha</span>
                  <span className="font-bold text-gray-900 text-lg capitalize">
                    {fechaSeleccionada
                      ? format(parseISO(fechaSeleccionada), "EEEE d 'de' MMMM", { locale: es })
                      : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">Hora</span>
                  <span className="font-bold text-gray-900 text-lg">{formatHora(horaSeleccionada)} hs</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">Duración</span>
                  <span className="font-bold text-gray-900 text-lg">{duracionTurno} minutos</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-500">Modalidad</span>
                  <span className="font-bold text-gray-900 text-lg">
                    {modalidad === 'presencial' ? '📍 Presencial' : '💻 Videollamada'}
                  </span>
                </div>
              </div>

              <Alert type="info">
                Te avisamos por WhatsApp <strong>24 horas antes</strong> y{' '}
                <strong>1 hora antes</strong> de tu turno.
              </Alert>

              <Button size="lg" fullWidth variant="secondary" onClick={() => router.push('/')}>
                Volver al inicio
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  )
}
