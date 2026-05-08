'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { format, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isBefore, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CheckCircle, ArrowLeft, Phone, MessageCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Alert from '@/components/ui/Alert'
import { supabase } from '@/lib/supabase'
import { calcularHorariosEnLotes, getModalidadPorFecha, esDiaLaborable, formatHora } from '@/lib/utils'
import { Configuracion } from '@/lib/types'

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_CONTACTO || '549XXXXXXXXXX'
const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const DURACION = 20

// paso 0: buscar teléfono
// paso 1: registrar (solo si no existe)
// paso 2: elegir día
// paso 3: elegir hora
// paso 4: confirmación

type Paciente = { id: string; nombre: string; apellido: string }

export default function SacarTurnoPage() {
  const router = useRouter()
  const [paso, setPaso] = useState<0 | 1 | 2 | 3 | 4>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Datos del paciente
  const [telefono, setTelefono] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [dni, setDni] = useState('')
  const [credencial, setCredencial] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [esPrimeraTurno, setEsPrimeraTurno] = useState(false)

  // Calendario / horarios
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [fechaSeleccionada, setFechaSeleccionada] = useState('')
  const [horaSeleccionada, setHoraSeleccionada] = useState('')
  const [horarios, setHorarios] = useState<{ hora: string; disponible: boolean }[]>([])
  const [modalidad, setModalidad] = useState<'presencial' | 'videollamada'>('videollamada')
  const [mesActual, setMesActual] = useState(new Date())

  // ----------------------------------------------------------------
  // Paso 0 — buscar teléfono
  // ----------------------------------------------------------------

  async function buscarTelefono() {
    const tel = telefono.replace(/\D/g, '')
    if (tel.length < 8) { setError('Ingresá tu teléfono completo (sin el 15)'); return }
    setLoading(true)
    setError('')
    try {
      // Cargar config y buscar paciente en paralelo
      const [configRes, pacienteRes] = await Promise.all([
        supabase.from('configuracion').select('*').single(),
        fetch('/api/buscar-paciente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telefono: tel }),
        }),
      ])

      if (configRes.data) setConfig(configRes.data)

      const data = await pacienteRes.json()
      if (data.encontrado) {
        setPaciente(data.paciente as Paciente)
        setEsPrimeraTurno(false)
        setPaso(2)
      } else {
        setEsPrimeraTurno(true)
        setPaso(1)
      }
    } catch {
      setError('Hubo un error. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ----------------------------------------------------------------
  // Paso 1 — registrar paciente nuevo
  // ----------------------------------------------------------------

  async function registrarYContinuar() {
    const e: Record<string, string> = {}
    if (!nombre.trim()) e.nombre = 'Ingresá tu nombre'
    if (!apellido.trim()) e.apellido = 'Ingresá tu apellido'
    if (!dni.trim()) e.dni = 'Ingresá tu DNI'
    else if (!/^\d{7,8}$/.test(dni.replace(/\D/g, ''))) e.dni = 'DNI inválido (7 u 8 dígitos)'
    if (!credencial.trim()) e.credencial = 'Ingresá tu número de credencial OSDE'
    setErrores(e)
    if (Object.keys(e).length > 0) return

    setLoading(true)
    setError('')
    try {
      const tel = telefono.replace(/\D/g, '')
      const { data, error: err } = await supabase
        .from('pacientes')
        .insert({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          telefono: tel,
          dni: dni.replace(/\D/g, ''),
          obra_social: 'OSDE',
          numero_afiliado: credencial.trim(),
        })
        .select('id, nombre, apellido')
        .single()
      if (err || !data) throw new Error('No se pudo crear tu cuenta')
      setPaciente(data)
      setPaso(4) // redirige a WhatsApp, no al calendario
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hubo un error. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // ----------------------------------------------------------------
  // Paso 2 → elegir fecha
  // ----------------------------------------------------------------

  async function seleccionarFecha(fecha: string) {
    if (!config) return
    setFechaSeleccionada(fecha)
    setHoraSeleccionada('')
    setLoading(true)
    try {
      const diaSemana = format(parseISO(fecha), 'EEEE', { locale: es }).toLowerCase()
      setModalidad(getModalidadPorFecha(fecha, config))

      const [{ data: lotesData }, { data: turnosData }] = await Promise.all([
        supabase.from('lotes_horarios').select('*').eq('dia', diaSemana).order('orden'),
        supabase.from('turnos').select('hora, duracion_minutos')
          .eq('fecha', fecha).in('estado', ['pendiente', 'confirmado']),
      ])

      const ocupados = (turnosData || []).map(t => ({
        hora: t.hora.substring(0, 5),
        duracion: t.duracion_minutos,
      }))

      setHorarios(calcularHorariosEnLotes(lotesData || [], ocupados, DURACION, 'seguimiento', 0, false))
      setPaso(3)
    } finally {
      setLoading(false)
    }
  }

  // ----------------------------------------------------------------
  // Paso 3 → confirmar turno
  // ----------------------------------------------------------------

  async function confirmarTurno() {
    if (!horaSeleccionada || !fechaSeleccionada || !paciente) return
    setLoading(true)
    setError('')
    try {
      const { error: e } = await supabase.from('turnos').insert({
        paciente_id: paciente.id,
        fecha: fechaSeleccionada,
        hora: horaSeleccionada,
        duracion_minutos: DURACION,
        modalidad,
        estado: 'pendiente',
        tipo_turno: esPrimeraTurno ? 'primera_consulta' : 'seguimiento',
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
            const disponible = esDiaLaborable(fechaStr, config) && !isBefore(dia, hoy)
            const sel = fechaStr === fechaSeleccionada
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

  const nombreCompleto = paciente
    ? `${paciente.nombre} ${paciente.apellido}`
    : `${nombre} ${apellido}`.trim()

  const totalPasos = 3
  const pasoDisplay = Math.min(paso, totalPasos)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => paso === 0 || paso === 4 ? router.push('/') : setPaso(p => (p - 1) as typeof paso)}
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

          {/* ======= PASO 0: Teléfono ======= */}
          {paso === 0 && (
            <motion.div key="paso0"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-6"
            >
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Sacar turno</h1>
                <p className="text-gray-500 text-lg">Ingresá tu número de WhatsApp para continuar.</p>
              </div>

              {error && <Alert type="error">{error}</Alert>}

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
                <Input
                  label="Tu teléfono de WhatsApp"
                  placeholder="1154321234"
                  type="tel"
                  inputMode="numeric"
                  hint="Sin el 15, solo números"
                  value={telefono}
                  onChange={e => { setTelefono(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && buscarTelefono()}
                />
                <Button onClick={buscarTelefono} loading={loading} fullWidth size="lg">
                  <Phone className="w-5 h-5" />
                  Continuar
                </Button>
              </div>

              <p className="text-center text-sm text-gray-400">
                Si ya sacaste un turno antes, te reconocemos automáticamente.
              </p>
            </motion.div>
          )}

          {/* ======= PASO 1: Registro (paciente nuevo) ======= */}
          {paso === 1 && (
            <motion.div key="paso1"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="flex flex-col gap-6"
            >
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Completá tus datos</h1>
                <p className="text-gray-500">
                  Primera vez en el sistema. Completá tu información para registrarte.
                </p>
              </div>

              {error && <Alert type="error">{error}</Alert>}

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-5">
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
                  📱 WhatsApp: <strong>{telefono}</strong>
                </div>
                <Input label="Nombre" placeholder="María"
                  value={nombre} error={errores.nombre}
                  onChange={e => { setNombre(e.target.value); setErrores(p => ({ ...p, nombre: '' })) }} />
                <Input label="Apellido" placeholder="García"
                  value={apellido} error={errores.apellido}
                  onChange={e => { setApellido(e.target.value); setErrores(p => ({ ...p, apellido: '' })) }} />
                <Input label="DNI" placeholder="12345678"
                  type="tel" inputMode="numeric"
                  value={dni} error={errores.dni}
                  onChange={e => { setDni(e.target.value); setErrores(p => ({ ...p, dni: '' })) }} />
                <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-3 text-sm text-cyan-800 font-semibold">
                  🏥 Obra social: OSDE
                </div>
                <Input label="Número de credencial OSDE" placeholder="Ej: 123456789"
                  value={credencial} error={errores.credencial}
                  onChange={e => { setCredencial(e.target.value); setErrores(p => ({ ...p, credencial: '' })) }} />
              </div>

              <Button size="lg" fullWidth onClick={registrarYContinuar} loading={loading}>
                Registrarme y ver turnos →
              </Button>
            </motion.div>
          )}

          {/* ======= PASO 2: Elegir día ======= */}
          {paso === 2 && (
            <motion.div key="paso2"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="flex flex-col gap-6"
            >
              <div>
                {paciente && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 mb-4">
                    <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                    <span className="text-green-800 font-semibold">
                      Hola, {paciente.nombre} {paciente.apellido}
                    </span>
                  </div>
                )}
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Elegí el día</h1>
                <p className="text-gray-500">Los días resaltados tienen turnos disponibles.</p>
              </div>

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

          {/* ======= PASO 3: Elegir hora ======= */}
          {paso === 3 && (
            <motion.div key="paso3"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
              className="flex flex-col gap-6"
            >
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Elegí el horario</h1>
                <div className="flex items-center gap-2 text-gray-600 mt-1 flex-wrap">
                  <span className="capitalize">
                    {fechaSeleccionada ? format(parseISO(fechaSeleccionada), "EEEE d 'de' MMMM", { locale: es }) : ''}
                  </span>
                  <span className="text-sm font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {modalidad === 'presencial' ? '📍 Presencial' : '💻 Videollamada'}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">Duración: {DURACION} min</p>
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
                loading={loading}
              >
                Confirmar turno
              </Button>
            </motion.div>
          )}

          {/* ======= PASO 4a: WhatsApp — paciente nuevo ======= */}
          {paso === 4 && esPrimeraTurno && (
            <motion.div key="paso4a"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center gap-8 py-8"
            >
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.15, stiffness: 200 }}
                className="w-28 h-28 bg-green-100 rounded-full flex items-center justify-center"
              >
                <MessageCircle className="w-16 h-16 text-green-600" />
              </motion.div>

              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-3">¡Registrado!</h1>
                <p className="text-gray-500 text-lg">
                  Escribile a la Dra. Volpe por WhatsApp para coordinar el día y horario de tu primera consulta.
                </p>
              </div>

              <div className="w-full bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left flex flex-col gap-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-500">Nombre</span>
                  <span className="font-bold text-gray-900">{nombreCompleto}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-500">WhatsApp</span>
                  <span className="font-bold text-gray-900">{telefono}</span>
                </div>
              </div>

              <a
                href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola! Soy ${nombreCompleto} y me acabo de registrar. Quisiera coordinar mi primera consulta.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button size="lg" fullWidth variant="success">
                  <MessageCircle className="w-6 h-6" />
                  Escribir a la Dra. por WhatsApp
                </Button>
              </a>

              <Button size="lg" fullWidth variant="secondary" onClick={() => router.push('/')}>
                Volver al inicio
              </Button>
            </motion.div>
          )}

          {/* ======= PASO 4b: Confirmación — paciente existente ======= */}
          {paso === 4 && !esPrimeraTurno && (
            <motion.div key="paso4b"
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
                  <span className="font-bold text-gray-900 text-lg">{nombreCompleto}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">Fecha</span>
                  <span className="font-bold text-gray-900 text-lg capitalize">
                    {fechaSeleccionada ? format(parseISO(fechaSeleccionada), "EEEE d 'de' MMMM", { locale: es }) : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">Hora</span>
                  <span className="font-bold text-gray-900 text-lg">{formatHora(horaSeleccionada)} hs</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-gray-500">Duración</span>
                  <span className="font-bold text-gray-900 text-lg">{DURACION} minutos</span>
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

              <div className="w-full flex flex-col gap-3">
                <Button size="lg" fullWidth onClick={() => router.push('/mis-turnos')}>
                  Ver mis turnos
                </Button>
                <Button size="lg" fullWidth variant="secondary" onClick={() => router.push('/')}>
                  Volver al inicio
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  )
}
