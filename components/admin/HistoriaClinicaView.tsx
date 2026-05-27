'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, FileText, ClipboardList, Plus, Printer, Save, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Paciente, HistoriaClinica, HistoriaClinicaDatos, Evolucion } from '@/lib/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Alert from '@/components/ui/Alert'

type Tab = 'formulario' | 'evoluciones'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold text-blue-700 uppercase tracking-wide border-b border-blue-100 pb-2 mb-4">
      {children}
    </h3>
  )
}

function Campo({ label, value, onChange, multiline = false, rows = 3 }: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  rows?: number
}) {
  if (multiline) {
    return (
      <Textarea
        label={label}
        value={value}
        rows={rows}
        onChange={e => onChange(e.target.value)}
        placeholder="..."
      />
    )
  }
  return (
    <Input
      label={label}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}

const DATOS_VACIOS: HistoriaClinicaDatos = {
  nombre: '', apellido: '', dni: '', fecha_nacimiento: '', domicilio: '',
  telefono: '', email: '', obra_social: '', numero_afiliado: '', ocupacion: '',
  escolaridad: '', estado_civil: '', hijos: '', convivencia: '',
  motivo_consulta: '',
  conciencia: '', atencion: '', memoria: '', orientacion: '', lenguaje: '',
  pensamiento_curso: '', pensamiento_contenido: '', percepciones: '', afecto: '',
  conducta: '', critica_insight: '',
  sueno: '', alimentacion: '', actividad_fisica: '', sustancias: '',
  antecedentes_personales: '', antecedentes_familiares: '', tratamientos_previos: '',
  medicacion_actual: '', alergias: '',
}

export default function HistoriaClinicaView({
  paciente,
  onBack,
}: {
  paciente: Paciente
  onBack: () => void
}) {
  const [tab, setTab] = useState<Tab>('formulario')
  const [historia, setHistoria] = useState<HistoriaClinica | null>(null)
  const [form, setForm] = useState<HistoriaClinicaDatos>(DATOS_VACIOS)
  const [evoluciones, setEvoluciones] = useState<Evolucion[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [error, setError] = useState('')

  // Nueva evolución
  const [nuevaEvo, setNuevaEvo] = useState('')
  const [fechaNuevaEvo, setFechaNuevaEvo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [guardandoEvo, setGuardandoEvo] = useState(false)
  const [editandoEvo, setEditandoEvo] = useState<Evolucion | null>(null)
  const [textoEditEvo, setTextoEditEvo] = useState('')
  const [evolucionesExpandidas, setEvolucionesExpandidas] = useState<Set<string>>(new Set())

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: hc }, { data: evos }] = await Promise.all([
        supabase.from('historias_clinicas').select('*').eq('paciente_id', paciente.id).maybeSingle(),
        supabase.from('evoluciones').select('*').eq('paciente_id', paciente.id).order('fecha', { ascending: false }),
      ])
      if (hc) {
        setHistoria(hc)
        setForm({ ...DATOS_VACIOS, ...(hc.datos || {}) })
      } else {
        setForm({
          ...DATOS_VACIOS,
          nombre: paciente.nombre,
          apellido: paciente.apellido,
          telefono: paciente.telefono,
          email: paciente.email || '',
          fecha_nacimiento: paciente.fecha_nacimiento || '',
          obra_social: paciente.obra_social || '',
          numero_afiliado: paciente.numero_afiliado || '',
        })
      }
      setEvoluciones(evos || [])
    } catch (e) {
      console.error('Error cargando historia:', e)
      setError('No se pudo cargar la historia clínica. Verificá que las tablas estén creadas en Supabase.')
    } finally {
      setLoading(false)
    }
  }, [paciente])

  useEffect(() => { cargar() }, [cargar])

  const set = (key: keyof HistoriaClinicaDatos) => (v: string) =>
    setForm(f => ({ ...f, [key]: v }))

  async function guardarFormulario() {
    setGuardando(true)
    setError('')
    setGuardadoOk(false)
    try {
      if (historia) {
        const { error: e } = await supabase
          .from('historias_clinicas')
          .update({ datos: form, updated_at: new Date().toISOString() })
          .eq('id', historia.id)
        if (e) throw e
      } else {
        const { data, error: e } = await supabase
          .from('historias_clinicas')
          .insert({ paciente_id: paciente.id, datos: form })
          .select()
          .single()
        if (e) throw e
        setHistoria(data)
      }
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 3000)
    } catch {
      setError('No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function agregarEvolucion() {
    if (!nuevaEvo.trim()) return
    setGuardandoEvo(true)
    const { data, error: e } = await supabase
      .from('evoluciones')
      .insert({ paciente_id: paciente.id, fecha: fechaNuevaEvo, texto: nuevaEvo.trim() })
      .select()
      .single()
    if (!e && data) {
      setEvoluciones(prev => [data, ...prev])
      setNuevaEvo('')
      setFechaNuevaEvo(format(new Date(), 'yyyy-MM-dd'))
      // Auto-expand new entry
      setEvolucionesExpandidas(prev => { const n = new Set(prev); n.add(data.id); return n })
    }
    setGuardandoEvo(false)
  }

  async function guardarEdicionEvo() {
    if (!editandoEvo || !textoEditEvo.trim()) return
    const { error: e } = await supabase
      .from('evoluciones')
      .update({ texto: textoEditEvo.trim() })
      .eq('id', editandoEvo.id)
    if (!e) {
      setEvoluciones(prev => prev.map(ev => ev.id === editandoEvo.id ? { ...ev, texto: textoEditEvo.trim() } : ev))
      setEditandoEvo(null)
    }
  }

  async function eliminarEvo(id: string) {
    if (!confirm('¿Eliminar esta evolución?')) return
    await supabase.from('evoluciones').delete().eq('id', id)
    setEvoluciones(prev => prev.filter(ev => ev.id !== id))
  }

  function toggleExpand(id: string) {
    setEvolucionesExpandidas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exportar() {
    window.open(`/admin/pacientes/imprimir?id=${paciente.id}`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 font-medium">Historia clínica</p>
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {paciente.nombre} {paciente.apellido}
          </h1>
        </div>
        <button
          onClick={exportar}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold text-sm transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar PDF</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTab('formulario')}
          className={[
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all',
            tab === 'formulario' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700',
          ].join(' ')}
        >
          <FileText className="w-4 h-4" />
          Formulario de ingreso
        </button>
        <button
          onClick={() => setTab('evoluciones')}
          className={[
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all',
            tab === 'evoluciones' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700',
          ].join(' ')}
        >
          <ClipboardList className="w-4 h-4" />
          Evoluciones
          {evoluciones.length > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
              {evoluciones.length}
            </span>
          )}
        </button>
      </div>

      {/* ── FORMULARIO DE INGRESO ── */}
      {tab === 'formulario' && (
        <div className="flex flex-col gap-6">
          {error && <Alert type="error">{error}</Alert>}
          {guardadoOk && <Alert type="success">Guardado correctamente</Alert>}

          {/* Sección 1: Datos personales */}
          <Card>
            <SectionTitle>1. Datos personales</SectionTitle>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Nombre" value={form.nombre || ''} onChange={set('nombre')} />
                <Campo label="Apellido" value={form.apellido || ''} onChange={set('apellido')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Campo label="DNI" value={form.dni || ''} onChange={set('dni')} />
                <Campo label="Fecha de nacimiento" value={form.fecha_nacimiento || ''} onChange={set('fecha_nacimiento')} />
              </div>
              <Campo label="Domicilio" value={form.domicilio || ''} onChange={set('domicilio')} />
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Teléfono" value={form.telefono || ''} onChange={set('telefono')} />
                <Campo label="Email" value={form.email || ''} onChange={set('email')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Obra social" value={form.obra_social || ''} onChange={set('obra_social')} />
                <Campo label="N° afiliado" value={form.numero_afiliado || ''} onChange={set('numero_afiliado')} />
              </div>
              <Campo label="Ocupación" value={form.ocupacion || ''} onChange={set('ocupacion')} />
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Escolaridad" value={form.escolaridad || ''} onChange={set('escolaridad')} />
                <Campo label="Estado civil" value={form.estado_civil || ''} onChange={set('estado_civil')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Hijos" value={form.hijos || ''} onChange={set('hijos')} />
                <Campo label="Con quién convive" value={form.convivencia || ''} onChange={set('convivencia')} />
              </div>
            </div>
          </Card>

          {/* Sección 2: Motivo de consulta */}
          <Card>
            <SectionTitle>2. Motivo de consulta</SectionTitle>
            <Campo label="" value={form.motivo_consulta || ''} onChange={set('motivo_consulta')} multiline rows={5} />
          </Card>

          {/* Sección 3: Examen semiológico */}
          <Card>
            <SectionTitle>3. Examen semiológico</SectionTitle>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Conciencia" value={form.conciencia || ''} onChange={set('conciencia')} />
                <Campo label="Atención" value={form.atencion || ''} onChange={set('atencion')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Memoria" value={form.memoria || ''} onChange={set('memoria')} />
                <Campo label="Orientación" value={form.orientacion || ''} onChange={set('orientacion')} />
              </div>
              <Campo label="Lenguaje" value={form.lenguaje || ''} onChange={set('lenguaje')} />
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Pensamiento — Curso" value={form.pensamiento_curso || ''} onChange={set('pensamiento_curso')} />
                <Campo label="Pensamiento — Contenido" value={form.pensamiento_contenido || ''} onChange={set('pensamiento_contenido')} />
              </div>
              <Campo label="Percepciones" value={form.percepciones || ''} onChange={set('percepciones')} />
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Afecto" value={form.afecto || ''} onChange={set('afecto')} />
                <Campo label="Conducta" value={form.conducta || ''} onChange={set('conducta')} />
              </div>
              <Campo label="Crítica / Insight" value={form.critica_insight || ''} onChange={set('critica_insight')} />
            </div>
          </Card>

          {/* Sección 4: Hábitos */}
          <Card>
            <SectionTitle>4. Hábitos</SectionTitle>
            <div className="flex flex-col gap-4">
              <Campo label="Sueño" value={form.sueno || ''} onChange={set('sueno')} multiline rows={2} />
              <Campo label="Alimentación" value={form.alimentacion || ''} onChange={set('alimentacion')} multiline rows={2} />
              <Campo label="Actividad física" value={form.actividad_fisica || ''} onChange={set('actividad_fisica')} multiline rows={2} />
              <Campo label="Sustancias (alcohol, tabaco, otras)" value={form.sustancias || ''} onChange={set('sustancias')} multiline rows={2} />
            </div>
          </Card>

          {/* Sección 5: Enfermedad actual */}
          <Card>
            <SectionTitle>5. Enfermedad actual</SectionTitle>
            <div className="flex flex-col gap-4">
              <Campo label="Antecedentes personales" value={form.antecedentes_personales || ''} onChange={set('antecedentes_personales')} multiline rows={3} />
              <Campo label="Antecedentes familiares" value={form.antecedentes_familiares || ''} onChange={set('antecedentes_familiares')} multiline rows={3} />
              <Campo label="Tratamientos previos" value={form.tratamientos_previos || ''} onChange={set('tratamientos_previos')} multiline rows={3} />
              <Campo label="Medicación actual" value={form.medicacion_actual || ''} onChange={set('medicacion_actual')} multiline rows={2} />
              <Campo label="Alergias / reacciones adversas" value={form.alergias || ''} onChange={set('alergias')} multiline rows={2} />
            </div>
          </Card>

          <Button onClick={guardarFormulario} loading={guardando} size="lg" fullWidth>
            <Save className="w-5 h-5" />
            Guardar formulario
          </Button>
        </div>
      )}

      {/* ── EVOLUCIONES ── */}
      {tab === 'evoluciones' && (
        <div className="flex flex-col gap-4">
          {/* Nueva evolución */}
          <Card>
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Nueva evolución
            </h3>
            <div className="flex flex-col gap-3">
              <Input
                label="Fecha"
                type="date"
                value={fechaNuevaEvo}
                onChange={e => setFechaNuevaEvo(e.target.value)}
              />
              <Textarea
                label="Nota de evolución"
                value={nuevaEvo}
                onChange={e => setNuevaEvo(e.target.value)}
                rows={5}
                placeholder="Descripción de la consulta, estado del paciente, indicaciones..."
              />
              <Button onClick={agregarEvolucion} loading={guardandoEvo} disabled={!nuevaEvo.trim()}>
                <Plus className="w-5 h-5" />
                Agregar evolución
              </Button>
            </div>
          </Card>

          {/* Lista de evoluciones */}
          {evoluciones.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-gray-500">Sin evoluciones registradas</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {evoluciones.map(evo => {
                const expandida = evolucionesExpandidas.has(evo.id)
                const editando = editandoEvo?.id === evo.id
                return (
                  <Card key={evo.id} padding="sm">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <button
                        onClick={() => toggleExpand(evo.id)}
                        className="flex items-center gap-2 text-left flex-1"
                      >
                        <span className="font-bold text-gray-900 text-base capitalize">
                          {format(parseISO(evo.fecha), "d 'de' MMMM yyyy", { locale: es })}
                        </span>
                        {expandida
                          ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                        }
                      </button>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditandoEvo(evo)
                            setTextoEditEvo(evo.texto)
                            setEvolucionesExpandidas(prev => { const n = new Set(prev); n.add(evo.id); return n })
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => eliminarEvo(evo.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {(expandida || editando) && (
                      editando ? (
                        <div className="flex flex-col gap-2 mt-2">
                          <Textarea
                            value={textoEditEvo}
                            onChange={e => setTextoEditEvo(e.target.value)}
                            rows={5}
                          />
                          <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setEditandoEvo(null)}>Cancelar</Button>
                            <Button onClick={guardarEdicionEvo}>Guardar</Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-700 whitespace-pre-wrap text-base mt-2 leading-relaxed">
                          {evo.texto}
                        </p>
                      )
                    )}

                    {!expandida && !editando && (
                      <p className="text-gray-500 text-sm truncate mt-1">{evo.texto}</p>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
