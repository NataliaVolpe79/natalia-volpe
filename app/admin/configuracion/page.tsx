'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Plus, Trash2, Save, Settings, Clock, Edit2, X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Configuracion, LoteHorario } from '@/lib/types'
import { timeToMinutes } from '@/lib/utils'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Alert from '@/components/ui/Alert'

const DIAS_SEMANA = [
  { id: 'lunes', label: 'Lunes' },
  { id: 'martes', label: 'Martes' },
  { id: 'miércoles', label: 'Miércoles' },
  { id: 'jueves', label: 'Jueves' },
  { id: 'viernes', label: 'Viernes' },
  { id: 'sábado', label: 'Sábado' },
]

interface LoteForm {
  dia: string
  hora_inicio: string
  hora_fin: string
  horarios_primera_consulta: string[]
  orden: number
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [lotes, setLotes] = useState<LoteHorario[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState('')
  const [error, setError] = useState('')
  const [diaActivo, setDiaActivo] = useState('lunes')
  const [nuevoFeriado, setNuevoFeriado] = useState('')

  // Formulario para nuevo lote
  const [mostrarFormLote, setMostrarFormLote] = useState(false)
  const [formLote, setFormLote] = useState<LoteForm>({
    dia: 'lunes', hora_inicio: '09:00', hora_fin: '13:00',
    horarios_primera_consulta: [], orden: 0,
  })
  const [nuevaHoraPrimera, setNuevaHoraPrimera] = useState('')

  // Lote en edición
  const [editandoLote, setEditandoLote] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<LoteForm | null>(null)
  const [editNuevaHoraPrimera, setEditNuevaHoraPrimera] = useState('')

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    const [{ data: cfg }, { data: lotesData }] = await Promise.all([
      supabase.from('configuracion').select('*').single(),
      supabase.from('lotes_horarios').select('*').order('dia').order('orden'),
    ])
    if (cfg) setConfig(cfg)
    setLotes(lotesData || [])
    setLoading(false)
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ----------------------------------------------------------------
  // Configuración general
  // ----------------------------------------------------------------

  function toggleDiaAtencion(dia: string) {
    if (!config) return
    const dias = config.dias_atencion.includes(dia)
      ? config.dias_atencion.filter(d => d !== dia)
      : [...config.dias_atencion, dia]
    setConfig({ ...config, dias_atencion: dias })
  }

  function toggleDiaPresencial(dia: string) {
    if (!config) return
    const dias = config.dias_presencial.includes(dia)
      ? config.dias_presencial.filter(d => d !== dia)
      : [...config.dias_presencial, dia]
    setConfig({ ...config, dias_presencial: dias })
  }

  async function guardarConfig() {
    if (!config) return
    setGuardando(true)
    setError('')
    try {
      const { error: e } = await supabase.from('configuracion').update({
        dias_atencion: config.dias_atencion,
        dias_presencial: config.dias_presencial,
        feriados: config.feriados,
        buffer_minutos: config.buffer_minutos,
        duracion_primera_consulta_minutos: config.duracion_primera_consulta_minutos,
        updated_at: new Date().toISOString(),
      }).eq('id', config.id)
      if (e) throw e
      setExito('config')
      setTimeout(() => setExito(''), 3000)
    } catch {
      setError('No se pudo guardar la configuración')
    } finally {
      setGuardando(false)
    }
  }

  function agregarFeriado() {
    if (!config || !nuevoFeriado) return
    if (config.feriados.includes(nuevoFeriado)) return
    setConfig({ ...config, feriados: [...config.feriados, nuevoFeriado].sort() })
    setNuevoFeriado('')
  }

  // ----------------------------------------------------------------
  // Lotes
  // ----------------------------------------------------------------

  function lotesDelDia(dia: string): LoteHorario[] {
    return lotes.filter(l => l.dia === dia).sort(
      (a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio)
    )
  }

  // Valida que el rango no se solape con otros lotes del mismo día
  function validarRangoLote(dia: string, inicio: string, fin: string, excludeId?: string): string | null {
    if (timeToMinutes(inicio) >= timeToMinutes(fin))
      return 'La hora de fin debe ser mayor que la de inicio'
    const existentes = lotes.filter(l => l.dia === dia && l.id !== excludeId)
    for (const l of existentes) {
      const lIni = timeToMinutes(l.hora_inicio)
      const lFin = timeToMinutes(l.hora_fin)
      const nIni = timeToMinutes(inicio)
      const nFin = timeToMinutes(fin)
      if (nIni < lFin && lIni < nFin) {
        return `Se solapa con el lote ${l.hora_inicio.substring(0, 5)}-${l.hora_fin.substring(0, 5)}`
      }
    }
    return null
  }

  async function crearLote() {
    const errRange = validarRangoLote(formLote.dia, formLote.hora_inicio, formLote.hora_fin)
    if (errRange) { setError(errRange); return }
    setGuardando(true)
    setError('')
    try {
      const orden = lotesDelDia(formLote.dia).length + 1
      const { data, error: e } = await supabase.from('lotes_horarios').insert({
        dia: formLote.dia,
        hora_inicio: formLote.hora_inicio,
        hora_fin: formLote.hora_fin,
        horarios_primera_consulta: formLote.horarios_primera_consulta,
        orden,
      }).select().single()
      if (e) throw e
      setLotes(prev => [...prev, data])
      setMostrarFormLote(false)
      setFormLote({ dia: diaActivo, hora_inicio: '09:00', hora_fin: '13:00', horarios_primera_consulta: [], orden: 0 })
      setNuevaHoraPrimera('')
      setExito('lote')
      setTimeout(() => setExito(''), 3000)
    } catch {
      setError('No se pudo crear el lote')
    } finally {
      setGuardando(false)
    }
  }

  async function guardarEdicionLote(id: string) {
    if (!editForm) return
    const errRange = validarRangoLote(editForm.dia, editForm.hora_inicio, editForm.hora_fin, id)
    if (errRange) { setError(errRange); return }
    setGuardando(true)
    setError('')
    try {
      const { data, error: e } = await supabase.from('lotes_horarios').update({
        hora_inicio: editForm.hora_inicio,
        hora_fin: editForm.hora_fin,
        horarios_primera_consulta: editForm.horarios_primera_consulta,
      }).eq('id', id).select().single()
      if (e) throw e
      setLotes(prev => prev.map(l => l.id === id ? data : l))
      setEditandoLote(null)
      setEditForm(null)
    } catch {
      setError('No se pudo guardar el lote')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarLote(id: string) {
    if (!confirm('¿Eliminar este bloque de horario?')) return
    const { error: e } = await supabase.from('lotes_horarios').delete().eq('id', id)
    if (e) setError('No se pudo eliminar el lote')
    else setLotes(prev => prev.filter(l => l.id !== id))
  }

  // Helpers para horarios de primera consulta dentro de un rango
  function agregarHoraPrimera(form: LoteForm, nueva: string, setForm: (f: LoteForm) => void) {
    if (!nueva) return
    const ini = timeToMinutes(form.hora_inicio)
    const fin = timeToMinutes(form.hora_fin)
    const h = timeToMinutes(nueva)
    if (h < ini || h >= fin) { setError('El horario debe estar dentro del bloque'); return }
    if (form.horarios_primera_consulta.includes(nueva)) return
    setForm({ ...form, horarios_primera_consulta: [...form.horarios_primera_consulta, nueva].sort() })
    setError('')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!config) return null

  const diaActuales = lotesDelDia(diaActivo)

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="w-7 h-7 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
      </div>

      {exito === 'config' && <Alert type="success">¡Configuración guardada!</Alert>}
      {exito === 'lote' && <Alert type="success">¡Bloque de horario guardado!</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      {/* ============ SECCIÓN 1: Días de atención ============ */}
      <Card>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Días de atención</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {DIAS_SEMANA.map(dia => (
            <button key={dia.id} onClick={() => toggleDiaAtencion(dia.id)}
              className={[
                'px-4 py-3 rounded-xl text-base font-semibold border-2 transition-all',
                config.dias_atencion.includes(dia.id)
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300',
              ].join(' ')}>
              {dia.label}
            </button>
          ))}
        </div>

        <h3 className="text-base font-bold text-gray-700 mb-3">Días presenciales</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {DIAS_SEMANA.filter(d => config.dias_atencion.includes(d.id)).map(dia => (
            <button key={dia.id} onClick={() => toggleDiaPresencial(dia.id)}
              className={[
                'px-4 py-3 rounded-xl text-base font-semibold border-2 transition-all',
                config.dias_presencial.includes(dia.id)
                  ? 'bg-green-600 border-green-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-green-300',
              ].join(' ')}>
              {config.dias_presencial.includes(dia.id) ? '📍' : '💻'} {dia.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Duración primera consulta (min)"
            type="number" min={30} max={120}
            value={config.duracion_primera_consulta_minutos}
            onChange={e => setConfig({ ...config, duracion_primera_consulta_minutos: parseInt(e.target.value) || 60 })}
          />
          <Input
            label="Buffer entre turnos (min)"
            type="number" min={0} max={30}
            value={config.buffer_minutos}
            onChange={e => setConfig({ ...config, buffer_minutos: parseInt(e.target.value) || 0 })}
          />
        </div>

        <Button variant="success" className="mt-5 w-full sm:w-auto" onClick={guardarConfig} loading={guardando}>
          <Save className="w-5 h-5" /> Guardar configuración general
        </Button>
      </Card>

      {/* ============ SECCIÓN 2: Bloques de horario por día ============ */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Bloques de horario</h2>
        </div>
        <p className="text-gray-500 text-sm mb-4">
          Los turnos se generan dentro de cada bloque. Podés tener varios bloques por día (ej: mañana y tarde).
        </p>

        {/* Tabs de días */}
        <div className="flex gap-2 flex-wrap mb-5">
          {DIAS_SEMANA.filter(d => config.dias_atencion.includes(d.id)).map(dia => (
            <button
              key={dia.id}
              onClick={() => { setDiaActivo(dia.id); setMostrarFormLote(false); setEditandoLote(null) }}
              className={[
                'px-4 py-2 rounded-xl text-base font-semibold transition-colors',
                diaActivo === dia.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              ].join(' ')}
            >
              {dia.label}
            </button>
          ))}
        </div>

        {/* Lotes del día activo */}
        <div className="flex flex-col gap-3 mb-4">
          {diaActuales.length === 0 && (
            <p className="text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
              Sin bloques de horario para {diaActivo}
            </p>
          )}

          {diaActuales.map(lote => (
            <div key={lote.id} className="border border-gray-200 rounded-2xl overflow-hidden">
              {editandoLote === lote.id && editForm ? (
                /* ---- Modo edición ---- */
                <div className="p-4 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Inicio" type="time" value={editForm.hora_inicio}
                      onChange={e => setEditForm({ ...editForm, hora_inicio: e.target.value })} />
                    <Input label="Fin" type="time" value={editForm.hora_fin}
                      onChange={e => setEditForm({ ...editForm, hora_fin: e.target.value })} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      Horarios para primera consulta en este bloque
                    </p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {editForm.horarios_primera_consulta.map(h => (
                        <span key={h}
                          className="flex items-center gap-1 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                          {h}
                          <button onClick={() => setEditForm({
                            ...editForm,
                            horarios_primera_consulta: editForm.horarios_primera_consulta.filter(x => x !== h)
                          })}><X className="w-3.5 h-3.5" /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="time" value={editNuevaHoraPrimera}
                        onChange={e => setEditNuevaHoraPrimera(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      <button
                        onClick={() => {
                          agregarHoraPrimera(editForm, editNuevaHoraPrimera, setEditForm)
                          setEditNuevaHoraPrimera('')
                        }}
                        className="px-3 py-2 bg-purple-100 text-purple-700 rounded-xl text-sm font-semibold hover:bg-purple-200 transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => { setEditandoLote(null); setEditForm(null) }}>
                      Cancelar
                    </Button>
                    <Button size="sm" variant="success" onClick={() => guardarEdicionLote(lote.id)} loading={guardando}>
                      <Check className="w-4 h-4" /> Guardar
                    </Button>
                  </div>
                </div>
              ) : (
                /* ---- Vista normal ---- */
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold text-gray-900">
                        {lote.hora_inicio.substring(0, 5)} — {lote.hora_fin.substring(0, 5)}
                      </p>
                      {lote.horarios_primera_consulta.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="text-xs text-gray-500 mr-1">1ª consulta:</span>
                          {lote.horarios_primera_consulta.map(h => (
                            <span key={h} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                              {h}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditandoLote(lote.id)
                          setEditForm({
                            dia: lote.dia,
                            hora_inicio: lote.hora_inicio.substring(0, 5),
                            hora_fin: lote.hora_fin.substring(0, 5),
                            horarios_primera_consulta: [...lote.horarios_primera_consulta],
                            orden: lote.orden,
                          })
                          setEditNuevaHoraPrimera('')
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => eliminarLote(lote.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Formulario nuevo lote */}
        {mostrarFormLote ? (
          <div className="border-2 border-blue-200 bg-blue-50 rounded-2xl p-5 flex flex-col gap-4">
            <p className="font-bold text-blue-900">Nuevo bloque — {diaActivo}</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Hora de inicio" type="time" value={formLote.hora_inicio}
                onChange={e => setFormLote(f => ({ ...f, hora_inicio: e.target.value, dia: diaActivo }))} />
              <Input label="Hora de fin" type="time" value={formLote.hora_fin}
                onChange={e => setFormLote(f => ({ ...f, hora_fin: e.target.value }))} />
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">
                Horarios para primera consulta (opcional)
              </p>
              <div className="flex flex-wrap gap-2 mb-2">
                {formLote.horarios_primera_consulta.map(h => (
                  <span key={h}
                    className="flex items-center gap-1 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                    {h}
                    <button onClick={() => setFormLote(f => ({
                      ...f,
                      horarios_primera_consulta: f.horarios_primera_consulta.filter(x => x !== h)
                    }))}><X className="w-3.5 h-3.5" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input type="time" value={nuevaHoraPrimera}
                  onChange={e => setNuevaHoraPrimera(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button
                  onClick={() => {
                    agregarHoraPrimera({ ...formLote, dia: diaActivo }, nuevaHoraPrimera, f => setFormLote({ ...f, dia: diaActivo }))
                    setNuevaHoraPrimera('')
                  }}
                  className="px-3 py-2 bg-purple-100 text-purple-700 rounded-xl text-sm font-semibold hover:bg-purple-200 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Solo estos horarios aparecerán para primera consulta en el portal.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => { setMostrarFormLote(false); setError('') }}>
                Cancelar
              </Button>
              <Button variant="success" onClick={crearLote} loading={guardando}>
                <Check className="w-4 h-4" /> Guardar bloque
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setFormLote(f => ({ ...f, dia: diaActivo, horarios_primera_consulta: [] }))
              setNuevaHoraPrimera('')
              setMostrarFormLote(true)
            }}
            className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-blue-300 text-blue-600 rounded-2xl font-semibold text-base hover:bg-blue-50 transition-colors w-full"
          >
            <Plus className="w-5 h-5" />
            Agregar bloque para {diaActivo}
          </button>
        )}
      </Card>

      {/* ============ SECCIÓN 3: Feriados ============ */}
      <Card>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Feriados y días sin atención</h2>
        <div className="flex gap-3 mb-4">
          <input type="date" value={nuevoFeriado}
            onChange={e => setNuevoFeriado(e.target.value)}
            className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <Button onClick={agregarFeriado} disabled={!nuevoFeriado}>
            <Plus className="w-5 h-5" /> Agregar
          </Button>
        </div>
        {config.feriados.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No hay feriados cargados</p>
        ) : (
          <div className="flex flex-col gap-2">
            {config.feriados.map(f => (
              <div key={f} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="font-semibold text-gray-700">
                  {format(new Date(f + 'T00:00:00'), "d 'de' MMMM yyyy")}
                </span>
                <button onClick={() => setConfig({ ...config, feriados: config.feriados.filter(x => x !== f) })}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Button variant="success" className="mt-4 w-full sm:w-auto" onClick={guardarConfig} loading={guardando}>
          <Save className="w-5 h-5" /> Guardar feriados
        </Button>
      </Card>
    </div>
  )
}
