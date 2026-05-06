'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, isFuture, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { Phone, Calendar, Clock, Video, MapPin, ArrowLeft, X, CheckCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Alert from '@/components/ui/Alert'
import { supabase } from '@/lib/supabase'

const LS_KEY = 'nv_paciente_tel'

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
  const [cancelado, setCancelado] = useState<string | null>(null)

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
    setCancelando(id)
    try {
      await supabase.from('turnos').update({ estado: 'cancelado' }).eq('id', id)
      setTurnos(t => t.filter(x => x.id !== id))
      setCancelado(id)
      setTimeout(() => setCancelado(null), 3000)
    } finally {
      setCancelando(null)
    }
  }

  function cerrarSesion() {
    localStorage.removeItem(LS_KEY)
    setEncontrado(false)
    setTurnos([])
    setNombrePaciente('')
    setTelefono('')
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
                <Button
                  onClick={() => buscarTurnos(telefono)}
                  loading={loading}
                  fullWidth
                  size="lg"
                >
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
              {cancelado && (
                <Alert type="success">Turno cancelado correctamente.</Alert>
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
                        <div className="flex items-start justify-between gap-3">
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
                        </div>

                        {isFuture(fecha) && !esHoy && (
                          <button
                            onClick={() => cancelarTurno(turno.id)}
                            disabled={cancelando === turno.id}
                            className="mt-4 flex items-center gap-2 text-red-500 hover:text-red-700 text-sm font-semibold transition-colors disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            {cancelando === turno.id ? 'Cancelando...' : 'Cancelar turno'}
                          </button>
                        )}
                      </motion.div>
                    )
                  })}

                  <Button
                    onClick={() => router.push('/sacar-turno')}
                    variant="secondary"
                    fullWidth
                    size="lg"
                  >
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
