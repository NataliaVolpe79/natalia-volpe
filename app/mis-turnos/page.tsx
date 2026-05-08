'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, isFuture, isToday, addDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isBefore, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { Phone, Calendar, Clock, Video, MapPin, ArrowLeft, X, CheckCircle, ChevronLeft, ChevronRight, Edit2, MessageCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Alert from '@/components/ui/Alert'
import { supabase } from '@/lib/supabase'
import { calcularHorariosEnLotes, esDiaLaborable, formatFecha } from '@/lib/utils'
import { Configuracion } from '@/lib/types'

const LS_KEY = 'nv_paciente_tel'
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_CONTACTO || '549XXXXXXXXXX'
const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const DURACION = 20

type Turno = {
  id: string
  fecha: string
  hora: string
  duracion_minutos: number
  modalidad: 'presencial' | 'videollamada'
  estado: string
  tipo_turno: string
}

export default function MisTurnosPage() {
  const router = useRouter()
  const [telefono, setTelefono] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [nombrePaciente, setNombrePaciente] = useState('')
  const [encontrado, setEncontrado] = useState(false)
  const [cancelando, setCancelando] = useState<string | null>(null)
  const [canceladoWA, setCanceladoWA] = useState<string | null>(null)

  // Modificar turno
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [modificando, setModificando] = useState<string | null>(null)
  const [modFecha, setModFecha] = useState('')
  const [modHora, setModHora] = useState('')
  const [modHorarios, setModHorarios] = useState<{ hora: string; disponible: boolean }[]>([])
  const [modCargando, setModCargando] = useState(false)
  const [modMes, setModMes] = useState(new Date())
  const [modificadoWA, setModificadoWA] = useState<string | null>(null)

  useEffect(() => {
    const telGuardado = localStorage.getItem(LS_KEY)
    if (telGuardado) {
      setTelefono(telGuardado)
      buscarTurnos(telGuardado)
    }
  }, [])

  async function buscarTurnos(tel: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/buscar-paciente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: tel }),
      })
      const data = await res.json()

      if (!data.encontrado) {
        setError('No encontramos ese número. Verificá que sea el mismo con el que te registraste.')
        localStorage.removeItem(LS_KEY)
        return
      }

      const paciente = data.paciente
      setNombrePaciente(`${paciente.nombre} ${paciente.apellido}`)

      const hoy = format(new Date(), 'yyyy-MM-dd')
      const { data: turnosData } = await supabase
        .from('turnos')
        .select('id, fecha, hora, duracion_minutos, modalidad, estado, tipo_turno')
        .eq('paciente_id', paciente.id)
        .gte('fecha', hoy)
        .in('estado', ['pendiente', 'confirmado'])
        .order('fecha')
        .order('hora')

      setTurnos(turnosData || [])
      setEncontrado(true)
      localStorage.setItem(LS_KEY, tel.replace(/\D/g, ''))
    } catch {
      setError('Error al buscar tus turnos. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function cancelarTurno(id: string) {
    const turno = turnos.find(t => t.id === id)
    if (!turno) return
    setCancelando(id)
    try {
      await supabase.from('turnos').update({ estado: 'cancelado' }).eq('id', id)
      setTurnos(t => t.filter(x => x.id !== id))
      const msg = `Hola Dra. Volpe! ${nombrePaciente} canceló su turno del ${formatFecha(turno.fecha)} a las ${turno.hora.substring(0, 5)} hs.`
      setCanceladoWA(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`)
      setModificadoWA(null)
    } finally {
      setCancelando(null)
    }
  }

  async function iniciarModificacion(turnoId: string) {
    if (modificando === turnoId) { setModificando(null); return }
    if (!config) {
      const { data } = await supabase.from('configuracion').select('*').single()
      if (data) setConfig(data)
    }
    setModificando(turnoId)
    setModFecha('')
    setModHora('')
    setModHorarios([])
    setModMes(new Date())
    setCanceladoWA(null)
    setModificadoWA(null)
  }

  async function cargarHorariosModificacion(fecha: string, turnoId: string) {
    setModCargando(true)
    setModFecha(fecha)
    setModHora('')
    try {
      const diaSemana = format(parseISO(fecha), 'EEEE', { locale: es }).toLowerCase()
      const [{ data: lotes }, { data: ocupados }] = await Promise.all([
        supabase.from('lotes_horarios').select('*').eq('dia', diaSemana).order('orden'),
        supabase.from('turnos').select('hora, duracion_minutos')
          .eq('fecha', fecha)
          .neq('id', turnoId)
          .in('estado', ['pendiente', 'confirmado']),
      ])
      setModHorarios(calcularHorariosEnLotes(
        lotes || [],
        (ocupados || []).map(t => ({ hora: t.hora.substring(0, 5), duracion: t.duracion_minutos })),
        DURACION, 'seguimiento', 0, false
      ))
    } finally {
      setModCargando(false)
    }
  }

  async function confirmarModificacion(turnoId: string, turnoOriginal: Turno) {
    if (!modFecha || !modHora) return
    try {
      await supabase.from('turnos').update({ fecha: modFecha, hora: modHora }).eq('id', turnoId)
      setTurnos(t => t.map(x => x.id === turnoId ? { ...x, fecha: modFecha, hora: modHora } : x))
      const msg = `Hola Dra. Volpe! ${nombrePaciente} modificó su turno del ${formatFecha(turnoOriginal.fecha)} ${turnoOriginal.hora.substring(0, 5)} hs al ${formatFecha(modFecha)} ${modHora} hs.`
      setModificadoWA(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`)
      setModificando(null)
    } catch {
      setError('No se pudo modificar el turno. Intentá de nuevo.')
    }
  }

  function cerrarSesion() {
    localStorage.removeItem(LS_KEY)
    setEncontrado(false)
    setTurnos([])
    setNombrePaciente('')
    setTelefono('')
  }

  // Mini-calendario para modificar
  function MiniCalendario({ turnoId }: { turnoId: string }) {
    if (!config) return null
    const hoy = startOfDay(new Date())
    const inicio = startOfMonth(modMes)
    const fin = endOfMonth(modMes)
    const dias = eachDayOfInterval({ start: inicio, end: fin })
    const primerDia = getDay(inicio)
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setModMes(m => addDays(startOfMonth(m), -1))} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm font-bold text-gray-800 capitalize">
            {format(modMes, 'MMMM yyyy', { locale: es })}
          </span>
          <button onClick={() => setModMes(m => addDays(endOfMonth(m), 1))} className="p-1.5 rounded-lg hover:bg-gray-100">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d[0]}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: primerDia }).map((_, i) => <div key={`e${i}`} />)}
          {dias.map(dia => {
            const fechaStr = format(dia, 'yyyy-MM-dd')
            const disponible = esDiaLaborable(fechaStr, config) && !isBefore(dia, hoy)
            const sel = fechaStr === modFecha
            return (
              <button
                key={fechaStr}
                disabled={!disponible || modCargando}
                onClick={() => disponible && cargarHorariosModificacion(fechaStr, turnoId)}
                className={[
                  'aspect-square rounded-lg text-xs font-semibold transition-all',
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.push('/')} className="p-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex-1">
            <p className="text-lg font-bold text-gray-900">Mis turnos</p>
            {nombrePaciente && <p className="text-sm text-gray-500">{nombrePaciente}</p>}
          </div>
          {encontrado && (
            <button onClick={cerrarSesion} className="text-sm text-gray-400 hover:text-gray-600 underline">
              Salir
            </button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        <AnimatePresence mode="wait">

          {/* Buscar por teléfono */}
          {!encontrado && (
            <motion.div key="buscar"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-6"
            >
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Mis turnos</h1>
                <p className="text-gray-500">Ingresá tu número para ver tus próximos turnos.</p>
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
                  onChange={e => setTelefono(e.target.value)}
                />
                <Button onClick={() => buscarTurnos(telefono)} loading={loading} fullWidth size="lg">
                  <Phone className="w-5 h-5" />
                  Ver mis turnos
                </Button>
              </div>
            </motion.div>
          )}

          {/* Lista de turnos */}
          {encontrado && (
            <motion.div key="turnos"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              {/* Notificación de cancelación */}
              {canceladoWA && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-green-50 border border-green-200 rounded-2xl p-4 flex flex-col gap-3"
                >
                  <p className="text-green-800 font-semibold flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> Turno cancelado correctamente.
                  </p>
                  <a href={canceladoWA} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Avisarle a la Dra. por WhatsApp
                  </a>
                </motion.div>
              )}

              {/* Notificación de modificación */}
              {modificadoWA && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col gap-3"
                >
                  <p className="text-blue-800 font-semibold flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" /> Turno modificado correctamente.
                  </p>
                  <a href={modificadoWA} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Avisarle a la Dra. por WhatsApp
                  </a>
                </motion.div>
              )}

              {turnos.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
                  <Calendar className="w-14 h-14 text-gray-300 mx-auto mb-4" />
                  <p className="text-xl font-bold text-gray-700 mb-2">No tenés turnos próximos</p>
                  <p className="text-gray-500 mb-6">¿Querés reservar uno?</p>
                  <Button onClick={() => router.push('/sacar-turno')} fullWidth>
                    Sacar turno
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 font-medium">
                    {turnos.length === 1 ? '1 turno próximo' : `${turnos.length} turnos próximos`}
                  </p>

                  {turnos.map(turno => {
                    const fecha = parseISO(turno.fecha)
                    const esHoy = isToday(fecha)
                    const puedeModificar = isFuture(fecha) && !esHoy
                    return (
                      <motion.div
                        key={turno.id}
                        layout
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`bg-white rounded-2xl p-5 shadow-sm border ${esHoy ? 'border-blue-300' : 'border-gray-100'}`}
                      >
                        {esHoy && (
                          <div className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 text-sm font-semibold px-3 py-1 rounded-full mb-3">
                            <CheckCircle className="w-4 h-4" /> Hoy
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-gray-900">
                            <Calendar className="w-5 h-5 text-blue-500 shrink-0" />
                            <span className="text-lg font-bold capitalize">
                              {format(fecha, "EEEE d 'de' MMMM", { locale: es })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <Clock className="w-5 h-5 text-blue-500 shrink-0" />
                            <span className="text-lg font-semibold">
                              {turno.hora.substring(0, 5)} hs · {turno.duracion_minutos} min
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-500">
                            {turno.modalidad === 'presencial'
                              ? <><MapPin className="w-5 h-5 shrink-0" /><span>Presencial</span></>
                              : <><Video className="w-5 h-5 shrink-0" /><span>Videollamada</span></>
                            }
                          </div>
                        </div>

                        {/* Botones cancelar / modificar */}
                        {puedeModificar && (
                          <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
                            <button
                              onClick={() => cancelarTurno(turno.id)}
                              disabled={cancelando === turno.id}
                              className="flex items-center gap-1.5 text-red-500 hover:text-red-700 text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                              {cancelando === turno.id ? 'Cancelando...' : 'Cancelar'}
                            </button>
                            <button
                              onClick={() => iniciarModificacion(turno.id)}
                              className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${modificando === turno.id ? 'text-gray-500' : 'text-blue-500 hover:text-blue-700'}`}
                            >
                              <Edit2 className="w-4 h-4" />
                              {modificando === turno.id ? 'Cancelar cambio' : 'Modificar'}
                            </button>
                          </div>
                        )}

                        {/* Panel de modificación inline */}
                        <AnimatePresence>
                          {modificando === turno.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                {!modFecha ? (
                                  <>
                                    <p className="text-sm font-semibold text-gray-700 mb-3">Elegí el nuevo día:</p>
                                    <MiniCalendario turnoId={turno.id} />
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between mb-3">
                                      <p className="text-sm font-semibold text-gray-700">
                                        Nuevo día: <span className="capitalize text-blue-700">
                                          {format(parseISO(modFecha), "EEE d 'de' MMM", { locale: es })}
                                        </span>
                                      </p>
                                      <button onClick={() => { setModFecha(''); setModHora('') }}
                                        className="text-xs text-blue-500 underline">
                                        cambiar
                                      </button>
                                    </div>

                                    {modCargando ? (
                                      <div className="flex justify-center py-4">
                                        <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full" />
                                      </div>
                                    ) : (
                                      <>
                                        <p className="text-xs text-gray-500 mb-2">Elegí el nuevo horario:</p>
                                        <div className="grid grid-cols-3 gap-2">
                                          {modHorarios.filter(h => h.disponible).map(h => (
                                            <button key={h.hora} onClick={() => setModHora(h.hora)}
                                              className={[
                                                'py-2.5 rounded-xl text-sm font-bold transition-all',
                                                modHora === h.hora
                                                  ? 'bg-blue-600 text-white shadow'
                                                  : 'bg-blue-50 text-blue-800 hover:bg-blue-100',
                                              ].join(' ')}
                                            >
                                              {h.hora}
                                            </button>
                                          ))}
                                          {modHorarios.filter(h => h.disponible).length === 0 && (
                                            <p className="col-span-3 text-gray-500 text-sm py-2 text-center">
                                              Sin horarios disponibles para ese día.
                                            </p>
                                          )}
                                        </div>
                                        {modHora && (
                                          <Button fullWidth size="sm" className="mt-3"
                                            onClick={() => confirmarModificacion(turno.id, turno)}
                                          >
                                            Confirmar: mover al {modHora} hs
                                          </Button>
                                        )}
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}

                  <Button onClick={() => router.push('/sacar-turno')} variant="secondary" fullWidth size="lg">
                    Sacar otro turno
                  </Button>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  )
}
