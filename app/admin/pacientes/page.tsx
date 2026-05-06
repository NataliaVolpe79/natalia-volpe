'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, Phone, ChevronRight, ArrowLeft } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { Paciente, TurnoConPaciente } from '@/lib/types'
import { formatHora, colorEstadoTurno, labelEstadoTurno, colorEstadoPago, labelEstadoPago, linkWhatsApp, DURACIONES_SEGUIMIENTO } from '@/lib/utils'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import Alert from '@/components/ui/Alert'

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [pacienteDetalle, setPacienteDetalle] = useState<Paciente | null>(null)
  const [turnosPaciente, setTurnosPaciente] = useState<TurnoConPaciente[]>([])
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [form, setForm] = useState({
    nombre: '', apellido: '', telefono: '', email: '',
    fecha_nacimiento: '', obra_social: '', numero_afiliado: '', notas: '',
    duracion_seguimiento_minutos: '',
  })

  const cargarPacientes = useCallback(async () => {
    setLoading(true)
    const query = supabase.from('pacientes').select('*').order('apellido')
    if (busqueda.length >= 2) {
      query.or(`nombre.ilike.%${busqueda}%,apellido.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%`)
    }
    const { data } = await query
    setPacientes(data || [])
    setLoading(false)
  }, [busqueda])

  useEffect(() => {
    const timer = setTimeout(cargarPacientes, 300)
    return () => clearTimeout(timer)
  }, [cargarPacientes])

  async function verDetalle(paciente: Paciente) {
    setPacienteDetalle(paciente)
    setLoadingDetalle(true)
    const { data } = await supabase
      .from('turnos')
      .select('*, pago:pagos(*)')
      .eq('paciente_id', paciente.id)
      .order('fecha', { ascending: false })
      .limit(20)
    setTurnosPaciente(
      (data || []).map(t => ({
        ...t,
        paciente,
        pago: Array.isArray(t.pago) ? t.pago[0] : t.pago,
      })) as TurnoConPaciente[]
    )
    setLoadingDetalle(false)
  }

  async function guardarNotas(paciente: Paciente, notas: string) {
    await supabase.from('pacientes').update({ notas }).eq('id', paciente.id)
    setPacienteDetalle(p => p ? { ...p, notas } : null)
    cargarPacientes()
  }

  async function crearPaciente() {
    if (!form.nombre || !form.apellido || !form.telefono) {
      setError('Nombre, apellido y teléfono son obligatorios')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const { error: e } = await supabase.from('pacientes').insert({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        telefono: form.telefono.replace(/\D/g, ''),
        email: form.email || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        obra_social: form.obra_social || null,
        numero_afiliado: form.numero_afiliado || null,
        notas: form.notas || null,
        duracion_seguimiento_minutos: form.duracion_seguimiento_minutos ? parseInt(form.duracion_seguimiento_minutos) : null,
      })
      if (e) throw e
      setModalNuevo(false)
      setForm({ nombre: '', apellido: '', telefono: '', email: '', fecha_nacimiento: '', obra_social: '', numero_afiliado: '', notas: '', duracion_seguimiento_minutos: '' })
      cargarPacientes()
    } catch {
      setError('No se pudo crear el paciente')
    } finally {
      setGuardando(false)
    }
  }

  // Vista detalle de un paciente
  if (pacienteDetalle) {
    return (
      <PacienteDetalle
        paciente={pacienteDetalle}
        turnos={turnosPaciente}
        loading={loadingDetalle}
        onBack={() => setPacienteDetalle(null)}
        onGuardarNotas={(notas) => guardarNotas(pacienteDetalle, notas)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
        <Button onClick={() => setModalNuevo(true)}>
          <Plus className="w-5 h-5" />
          Nuevo
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, apellido o teléfono..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full pl-10 pr-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : pacientes.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-500 text-lg">No se encontraron pacientes</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {pacientes.map((paciente, i) => (
            <motion.div
              key={paciente.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <button
                onClick={() => verDetalle(paciente)}
                className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:border-blue-200 hover:shadow-md transition-all text-left"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-blue-700 font-bold text-lg">
                    {paciente.nombre[0]}{paciente.apellido[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-lg truncate">
                    {paciente.apellido}, {paciente.nombre}
                  </p>
                  <p className="text-gray-500 text-base">{paciente.telefono}
                    {paciente.obra_social && ` · ${paciente.obra_social}`}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal nuevo paciente */}
      <Modal isOpen={modalNuevo} onClose={() => setModalNuevo(false)} title="Nuevo paciente" maxWidth="md">
        {error && <Alert type="error" className="mb-4">{error}</Alert>}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            <Input label="Apellido *" value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} />
          </div>
          <Input label="Teléfono *" value={form.telefono} type="tel" hint="Sin el 15, solo números"
            onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          <Input label="Email" value={form.email} type="email"
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <Input label="Fecha de nacimiento" value={form.fecha_nacimiento} type="date"
            onChange={e => setForm(f => ({ ...f, fecha_nacimiento: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Obra social" value={form.obra_social}
              onChange={e => setForm(f => ({ ...f, obra_social: e.target.value }))} />
            <Input label="N° afiliado" value={form.numero_afiliado}
              onChange={e => setForm(f => ({ ...f, numero_afiliado: e.target.value }))} />
          </div>
          <div>
            <label className="text-base font-semibold text-gray-700 block mb-1.5">
              Duración de consulta de seguimiento
            </label>
            <div className="flex gap-2 flex-wrap">
              {[...DURACIONES_SEGUIMIENTO].map(d => (
                <button key={d}
                  onClick={() => setForm(f => ({ ...f, duracion_seguimiento_minutos: f.duracion_seguimiento_minutos === String(d) ? '' : String(d) }))}
                  className={[
                    'px-4 py-2 rounded-xl text-base font-semibold border-2 transition-all',
                    form.duracion_seguimiento_minutos === String(d)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300',
                  ].join(' ')}
                >
                  {d} min
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">Se usa para calcular los turnos disponibles en el portal.</p>
          </div>
          <Textarea label="Notas" value={form.notas}
            onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            placeholder="Notas privadas sobre el paciente..." />
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setModalNuevo(false)}>Cancelar</Button>
            <Button fullWidth onClick={crearPaciente} loading={guardando}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function PacienteDetalle({
  paciente, turnos, loading, onBack, onGuardarNotas
}: {
  paciente: Paciente
  turnos: TurnoConPaciente[]
  loading: boolean
  onBack: () => void
  onGuardarNotas: (notas: string) => void
}) {
  const [notas, setNotas] = useState(paciente.notas || '')
  const [editandoNotas, setEditandoNotas] = useState(false)
  const [duracion, setDuracion] = useState(paciente.duracion_seguimiento_minutos ?? null)
  const [guardandoDuracion, setGuardandoDuracion] = useState(false)

  async function guardarDuracion(nuevaDuracion: number | null) {
    setGuardandoDuracion(true)
    await supabase.from('pacientes').update({ duracion_seguimiento_minutos: nuevaDuracion }).eq('id', paciente.id)
    setDuracion(nuevaDuracion)
    setGuardandoDuracion(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {paciente.nombre} {paciente.apellido}
        </h1>
      </div>

      {/* Datos del paciente */}
      <Card>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-700 font-bold text-2xl">{paciente.nombre[0]}{paciente.apellido[0]}</span>
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{paciente.nombre} {paciente.apellido}</p>
            {paciente.fecha_nacimiento && (
              <p className="text-gray-500">
                Nacido/a el {format(parseISO(paciente.fecha_nacimiento), "d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-gray-400" />
            <a
              href={linkWhatsApp(paciente.telefono)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 font-semibold text-lg hover:underline"
            >
              {paciente.telefono}
            </a>
          </div>
          {paciente.email && (
            <p className="text-gray-700 text-base"><span className="text-gray-400">Email:</span> {paciente.email}</p>
          )}
          {paciente.obra_social && (
            <p className="text-gray-700 text-base">
              <span className="text-gray-400">Obra social:</span> {paciente.obra_social}
              {paciente.numero_afiliado && ` · N° ${paciente.numero_afiliado}`}
            </p>
          )}
        </div>
      </Card>

      {/* Duración de consulta */}
      <Card>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Duración de consulta de seguimiento</h2>
        <p className="text-sm text-gray-500 mb-4">
          Esta duración se usa para mostrar los horarios disponibles cuando el paciente saca turno online.
        </p>
        <div className="flex gap-2 flex-wrap">
          {[...DURACIONES_SEGUIMIENTO].map(d => (
            <button
              key={d}
              disabled={guardandoDuracion}
              onClick={() => guardarDuracion(duracion === d ? null : d)}
              className={[
                'px-4 py-2.5 rounded-xl text-base font-bold border-2 transition-all',
                duracion === d
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300',
              ].join(' ')}
            >
              {d} min
            </button>
          ))}
        </div>
        {duracion && (
          <p className="text-sm text-green-700 font-semibold mt-3">
            ✓ Consultas de seguimiento: {duracion} minutos
          </p>
        )}
        {!duracion && (
          <p className="text-sm text-gray-400 mt-3">
            Sin duración configurada. El portal le pedirá que contacte por WhatsApp.
          </p>
        )}
      </Card>

      {/* Notas privadas */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Notas privadas</h2>
          {!editandoNotas ? (
            <button onClick={() => setEditandoNotas(true)} className="text-blue-600 font-semibold text-sm hover:underline">
              Editar
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditandoNotas(false)} className="text-gray-500 font-semibold text-sm">Cancelar</button>
              <button
                onClick={() => { onGuardarNotas(notas); setEditandoNotas(false) }}
                className="text-blue-600 font-semibold text-sm"
              >
                Guardar
              </button>
            </div>
          )}
        </div>
        {editandoNotas ? (
          <Textarea value={notas} onChange={e => setNotas(e.target.value)} rows={4}
            placeholder="Notas privadas sobre el paciente..." />
        ) : (
          <p className="text-gray-600 text-base whitespace-pre-wrap">
            {notas || <span className="italic text-gray-400">Sin notas</span>}
          </p>
        )}
      </Card>

      {/* Historial de turnos */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-3">Historial de turnos</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : turnos.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-gray-500">Sin turnos registrados</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {turnos.map(turno => (
              <Card key={turno.id} padding="sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900 capitalize">
                      {format(parseISO(turno.fecha), "d 'de' MMMM yyyy", { locale: es })} · {formatHora(turno.hora)} hs
                    </p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge className={colorEstadoTurno[turno.estado]}>{labelEstadoTurno[turno.estado]}</Badge>
                      {turno.pago && (
                        <Badge className={colorEstadoPago[turno.pago.estado]}>{labelEstadoPago[turno.pago.estado]}</Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">
                    {turno.modalidad === 'presencial' ? '📍' : '💻'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
