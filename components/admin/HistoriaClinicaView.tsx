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

// ─── Constantes del formulario ───────────────────────────────────────────────

const ESTADO_CIVIL = ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión de hecho/Concubinato', 'Otro']
const EDUCACION = ['Primario', 'Secundario', 'Terciario', 'Universitario']
const ASPECTO_FISICO = ['Aseado', 'Alineado', 'Vestimenta adecuada']
const FACIES = ['Compuesta', 'Descompuesta']
const ACTITUD = ['Pasiva', 'Activa']
const PRESENTACION = ['Colaborador', 'Reticente', 'Otros (Especifique)']
const ASPECTO_PSIQUICO = ['Normal', 'Excitado', 'Deprimido', 'Indiferente']
const CONCIENCIA = ['Lúcida', 'Obnubilada', 'Confusión']
const CONDUCTAS_ROWS = ['Adaptadas', 'Desadaptadas', 'Pertinente']
const CONDUCTAS_COLS = ['Hostil', 'Distante', 'Negativismo', 'Antisociales', 'Retraído', 'Oposicionismo', 'Desenvuelto']
const ORIENTACION_ROWS = ['AUTOPSÍQUICA', 'AUTOPSÍQUICA TIEMPO', 'AUTOPSÍQUICA ESPACIO']
const ORIENTACION_COLS = ['SI', 'NO', 'Parcial']
const ATENCION = ['Euprosexia', 'Hiperprosexia', 'Hipoprosexia', 'Paraprosexia']
const MEM_SENSO_ROWS = ['MEMORIA', 'SENSOPERCEPCIÓN']
const MEM_SENSO_COLS = ['Conservada', 'Paramnesias', 'Normal', 'Alucinación', 'Fallas anterógradas', 'Fallas globales', 'Fallas retrógradas', 'Amnesia lacunar', 'Seudología fantástica', 'Fabulación de relleno', 'Ilusión', 'Palimpsesto', 'Alucinosis', 'Pseudoalucinación']
const FALLAS_ROWS = ['Retardo/Abolición', 'Aceleración']
const FALLAS_COLS = ['Visual', 'Auditiva', 'Cenestésica', 'Gustativa-Olfativa', 'Kinestésica', 'Táctil']
const PENSAMIENTO_ROWS = ['CURSO', 'CONTENIDO']
const PENSAMIENTO_COLS = ['Normal', 'Bradipsiquia', 'Taquipsiquia', 'Viscosidad', 'Minuciosidad', 'Disgregación', 'Función desplazamiento-desviación', 'Interpretación', 'Rigidez', 'Perseveración', 'Esterotipia', 'Verbigeración', 'Incoherencia', 'Verosímil', 'Inverosímil', 'Ideas fijas', 'Ideas obsesivas', 'Ideas sobrevaloradas', 'Ideas depresivas', 'Ideas auto heteroagresivas', 'Ideas delirantes', 'Autorreferencial', 'Paranoide', 'Celotipia', 'Mística', 'Hipocondríaca']
const DELIRIO_ROWS = ['Sistematización', 'Mecanismo']
const DELIRIO_COLS = ['Sistematizado', 'No Sistematizado', 'Interpretativo', 'Alucinatorio', 'Onírico', 'Sugestivo', 'Imaginativo', 'Ilusorio', 'Intuitivo']
const AFECTIVIDAD = ['Eutimia', 'Hipertimia displacentera', 'Hipertimia placentera', 'Distimia', 'Tenacidad', 'Labilidad', 'Incontinencia', 'Ambivalencia', 'Disforia', 'Perplejidad', 'Neotimia', 'Catatimia', 'Alexitimia', 'Aprosodia']
const ACTIVIDAD = ['Eubulia', 'Hipobulia', 'Compulsiones', 'Impulsiones', 'Apraxia', 'Ecopraxia', 'Amaneramiento', 'Extravagancias', 'Interpretación cinética', 'Negativismo', 'Obediencia automática', 'Catalepsia', 'Cataplexia']
const JUICIO = ['Conservado', 'Insuficiente', 'Debilitado', 'Suspendido', 'Desviado']
const CONCIENCIA_DE_ROWS = ['Situación', 'Enfermedad']
const CONCIENCIA_DE_COLS = ['SI', 'NO', 'PARCIAL']
const INTELIGENCIA = ['Superior', 'Normal', 'Inferior', 'Marcado déficit']
const RESOLUCION = ['Abordaje psicoterapéutico', 'Consultorios externos', 'Hospital de dia', 'Intervención policial', 'No ingresa al tratamiento', 'Internación psiquiátrica']

const DATOS_VACIOS: HistoriaClinicaDatos = {
  apellido_nombres: '', fecha_nacimiento: '', argentino: '', dni: '', osde_plan: '',
  estado_civil: '', vive_con: '', domicilio: '', localidad_cp: '', tel_fijo: '', tel_celular: '',
  educacion: '', contacto_asignado: '', contacto_nombre: '', contacto_parentesco: '',
  contacto_telefono: '', contacto_convive: '', motivo_consulta: '',
  aspecto_fisico: [], facies: '', actitud: '', presentacion: [], presentacion_otros: '',
  aspecto_psiquico: '', conciencia: '', conductas: {}, orientacion: {}, atencion: '',
  memoria_sensopercepcion: {}, tipos_fallas: {}, pensamiento: {}, delirio: {},
  afectividad: [], actividad: [], juicio: '', conciencia_de: {}, inteligencia: '',
  conducta_alimentaria: '', sueno: '', sexualidad: '', relacion_sustancias: '', agresividad: '',
  antecedentes_enfermedad: '', antecedentes_psiquiatricos: '', antecedentes_medicos: '',
  medicacion: '', familigrama: '', diagnostico_presuntivo: '', codigo_dsmiv: '',
  resolucion: [], plan_farmacologico: '',
}

// ─── Componentes UI del formulario ───────────────────────────────────────────

function SecTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{n}</div>
      <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide">{children}</h3>
      <div className="flex-1 h-px bg-blue-100" />
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-bold text-gray-700 mb-2">{children}</p>
}

function RadioGroup({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-3">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={value === opt} onChange={() => onChange(opt)} className="w-4 h-4 accent-blue-600" />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function CheckboxGroup({ label, options, values, onChange }: {
  label: string; options: string[]; values: string[]; onChange: (v: string[]) => void
}) {
  function toggle(opt: string) {
    if (values.includes(opt)) {
      onChange(values.filter(v => v !== opt))
    } else {
      onChange([...values, opt])
    }
  }
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-3">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={values.includes(opt)} onChange={() => toggle(opt)} className="w-4 h-4 accent-blue-600 rounded" />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function SelectGroup({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
      >
        <option value="">Elegir...</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  )
}

// Grilla radio: filas × cols (SI/NO/Parcial)
function GridRadio({ label, rows, cols, value, onChange }: {
  label: string; rows: string[]; cols: string[]
  value: Record<string, string>; onChange: (v: Record<string, string>) => void
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 text-gray-500 font-medium"></th>
              {cols.map(c => <th key={c} className="text-center px-4 py-2 text-gray-600 font-semibold">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                <td className="px-3 py-2 text-xs font-bold text-gray-700">{row}</td>
                {cols.map(col => (
                  <td key={col} className="text-center px-4 py-2">
                    <input
                      type="radio"
                      name={`${label}-${row}`}
                      checked={value[row] === col}
                      onChange={() => onChange({ ...value, [row]: col })}
                      className="w-4 h-4 accent-blue-600"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Grilla checkboxes: filas, cada fila muestra sus columnas como chips
function GridCheckbox({ label, rows, cols, value, onChange, rowColors }: {
  label: string; rows: string[]; cols: string[]
  value: Record<string, string[]>; onChange: (v: Record<string, string[]>) => void
  rowColors?: string[]
}) {
  function toggle(row: string, col: string) {
    const cur = value[row] || []
    const next = cur.includes(col) ? cur.filter(v => v !== col) : [...cur, col]
    onChange({ ...value, [row]: next })
  }
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-col gap-2">
        {rows.map((row, ri) => (
          <div key={row} className="border border-gray-200 rounded-xl p-3">
            <p className={`text-xs font-bold mb-2 ${rowColors?.[ri] || 'text-gray-700'}`}>{row}</p>
            <div className="flex flex-wrap gap-1.5">
              {cols.map(col => {
                const checked = (value[row] || []).includes(col)
                return (
                  <label key={col} className={`flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-lg border text-xs font-medium transition-all select-none ${checked ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(row, col)} className="hidden" />
                    {col}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Tab = 'formulario' | 'evoluciones'

export default function HistoriaClinicaView({ paciente, onBack }: {
  paciente: Paciente; onBack: () => void
}) {
  const [tab, setTab] = useState<Tab>('formulario')
  const [historia, setHistoria] = useState<HistoriaClinica | null>(null)
  const [form, setForm] = useState<HistoriaClinicaDatos>(DATOS_VACIOS)
  const [evoluciones, setEvoluciones] = useState<Evolucion[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [error, setError] = useState('')

  const [nuevaEvo, setNuevaEvo] = useState('')
  const [fechaNuevaEvo, setFechaNuevaEvo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [guardandoEvo, setGuardandoEvo] = useState(false)
  const [editandoEvo, setEditandoEvo] = useState<Evolucion | null>(null)
  const [textoEditEvo, setTextoEditEvo] = useState('')
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())

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
          apellido_nombres: `${paciente.apellido} ${paciente.nombre}`,
          fecha_nacimiento: paciente.fecha_nacimiento || '',
          tel_celular: paciente.telefono,
          osde_plan: paciente.obra_social?.toLowerCase().includes('osde') ? (paciente.numero_afiliado || '') : '',
        })
      }
      setEvoluciones(evos || [])
    } catch (e) {
      console.error('Error cargando historia:', e)
      setError('No se pudo cargar la historia clínica.')
    } finally {
      setLoading(false)
    }
  }, [paciente])

  useEffect(() => { cargar() }, [cargar])

  function upd(patch: Partial<HistoriaClinicaDatos>) {
    setForm(f => ({ ...f, ...patch }))
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    setGuardadoOk(false)
    try {
      if (historia) {
        const { error: e } = await supabase.from('historias_clinicas')
          .update({ datos: form, updated_at: new Date().toISOString() }).eq('id', historia.id)
        if (e) throw e
      } else {
        const { data, error: e } = await supabase.from('historias_clinicas')
          .insert({ paciente_id: paciente.id, datos: form }).select().single()
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
    const { data, error: e } = await supabase.from('evoluciones')
      .insert({ paciente_id: paciente.id, fecha: fechaNuevaEvo, texto: nuevaEvo.trim() })
      .select().single()
    if (!e && data) {
      setEvoluciones(prev => [data, ...prev])
      setNuevaEvo('')
      setFechaNuevaEvo(format(new Date(), 'yyyy-MM-dd'))
      setExpandidas(prev => { const n = new Set(prev); n.add(data.id); return n })
    }
    setGuardandoEvo(false)
  }

  async function guardarEdicionEvo() {
    if (!editandoEvo || !textoEditEvo.trim()) return
    const { error: e } = await supabase.from('evoluciones').update({ texto: textoEditEvo.trim() }).eq('id', editandoEvo.id)
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

  function toggleExpandida(id: string) {
    setExpandidas(prev => {
      const n = new Set(prev)
      if (n.has(id)) { n.delete(id) } else { n.add(id) }
      return n
    })
  }

  if (loading) {
    return <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Historia clínica</p>
          <h1 className="text-xl font-bold text-gray-900 truncate">{paciente.nombre} {paciente.apellido}</h1>
        </div>
        <button
          onClick={() => window.open(`/admin/pacientes/imprimir?id=${paciente.id}`, '_blank')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold text-sm transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar PDF</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['formulario', 'evoluciones'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={['flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all', tab === t ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'].join(' ')}>
            {t === 'formulario' ? <><FileText className="w-4 h-4" />Formulario</> : <><ClipboardList className="w-4 h-4" />Evoluciones {evoluciones.length > 0 && <span className="bg-blue-600 text-white text-xs rounded-full px-1.5 min-w-[20px] text-center">{evoluciones.length}</span>}</>}
          </button>
        ))}
      </div>

      {/* ── FORMULARIO ── */}
      {tab === 'formulario' && (
        <div className="flex flex-col gap-6">
          {error && <Alert type="error">{error}</Alert>}
          {guardadoOk && <Alert type="success">Guardado correctamente</Alert>}

          {/* SECCIÓN 1 */}
          <Card>
            <SecTitle n={1}>Datos personales</SecTitle>
            <div className="flex flex-col gap-5">
              <Input label="1. Apellido y nombres" value={form.apellido_nombres || ''} onChange={e => upd({ apellido_nombres: e.target.value })} />
              <Input label="2. Fecha de nacimiento" type="date" value={form.fecha_nacimiento || ''} onChange={e => upd({ fecha_nacimiento: e.target.value })} />
              <RadioGroup label="3. ¿Argentino/a?" options={['SI', 'NO']} value={form.argentino || ''} onChange={v => upd({ argentino: v })} />
              <Input label="4. DNI" value={form.dni || ''} onChange={e => upd({ dni: e.target.value })} />
              <Input label="5. Solo pacientes OSDE — Plan (Nro)" value={form.osde_plan || ''} onChange={e => upd({ osde_plan: e.target.value })} />
              <SelectGroup label="6. Estado civil" options={ESTADO_CIVIL} value={form.estado_civil || ''} onChange={v => upd({ estado_civil: v })} />
              <Input label="7. Vive con..." value={form.vive_con || ''} onChange={e => upd({ vive_con: e.target.value })} />
              <Input label="8. Domicilio" value={form.domicilio || ''} onChange={e => upd({ domicilio: e.target.value })} />
              <Input label="9. Localidad y CP" value={form.localidad_cp || ''} onChange={e => upd({ localidad_cp: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="10. Teléfono fijo" value={form.tel_fijo || ''} onChange={e => upd({ tel_fijo: e.target.value })} />
                <Input label="11. Teléfono celular" value={form.tel_celular || ''} onChange={e => upd({ tel_celular: e.target.value })} />
              </div>
              <RadioGroup label="12. Educación (máximo nivel alcanzado)" options={EDUCACION} value={form.educacion || ''} onChange={v => upd({ educacion: v })} />
              <div className="border border-gray-100 rounded-xl p-4 flex flex-col gap-4 bg-gray-50">
                <p className="text-sm font-bold text-gray-700">13. Contacto de emergencia</p>
                <Input label="Contacto asignado por el paciente" value={form.contacto_asignado || ''} onChange={e => upd({ contacto_asignado: e.target.value })} />
                <Input label="Apellido y nombre del contacto" value={form.contacto_nombre || ''} onChange={e => upd({ contacto_nombre: e.target.value })} />
                <Input label="Parentesco del contacto" value={form.contacto_parentesco || ''} onChange={e => upd({ contacto_parentesco: e.target.value })} />
                <Input label="Teléfono celular del contacto" value={form.contacto_telefono || ''} onChange={e => upd({ contacto_telefono: e.target.value })} />
                <RadioGroup label="¿El paciente convive con el contacto?" options={['SI', 'NO']} value={form.contacto_convive || ''} onChange={v => upd({ contacto_convive: v })} />
              </div>
            </div>
          </Card>

          {/* SECCIÓN 2 */}
          <Card>
            <SecTitle n={2}>Motivo de consulta</SecTitle>
            <Textarea value={form.motivo_consulta || ''} onChange={e => upd({ motivo_consulta: e.target.value })} rows={5} placeholder="Describa el motivo de consulta..." />
          </Card>

          {/* SECCIÓN 3 */}
          <Card>
            <SecTitle n={3}>Examen semiológico</SecTitle>
            <div className="flex flex-col gap-6">
              <CheckboxGroup label="1. ASPECTO FÍSICO (Marque las opciones que apliquen)" options={ASPECTO_FISICO} values={form.aspecto_fisico || []} onChange={v => upd({ aspecto_fisico: v })} />
              <RadioGroup label="2. FACIES" options={FACIES} value={form.facies || ''} onChange={v => upd({ facies: v })} />
              <RadioGroup label="3. ACTITUD" options={ACTITUD} value={form.actitud || ''} onChange={v => upd({ actitud: v })} />
              <div>
                <CheckboxGroup label="4. PRESENTACIÓN (Marque las opciones que apliquen)" options={PRESENTACION} values={form.presentacion || []} onChange={v => upd({ presentacion: v })} />
                {(form.presentacion || []).includes('Otros (Especifique)') && (
                  <div className="mt-3">
                    <Input label="Especifique 'Otros' en Presentación" value={form.presentacion_otros || ''} onChange={e => upd({ presentacion_otros: e.target.value })} />
                  </div>
                )}
              </div>
              <RadioGroup label="5. ASPECTO PSÍQUICO" options={ASPECTO_PSIQUICO} value={form.aspecto_psiquico || ''} onChange={v => upd({ aspecto_psiquico: v })} />
              <RadioGroup label="6. CONCIENCIA" options={CONCIENCIA} value={form.conciencia || ''} onChange={v => upd({ conciencia: v })} />
              <GridCheckbox
                label="7. CONDUCTAS (Marque las opciones que apliquen)"
                rows={CONDUCTAS_ROWS} cols={CONDUCTAS_COLS}
                value={form.conductas || {}} onChange={v => upd({ conductas: v })}
              />
              <GridRadio
                label="8. ORIENTACIÓN (Marque la opción adecuada para cada tipo)"
                rows={ORIENTACION_ROWS} cols={ORIENTACION_COLS}
                value={form.orientacion || {}} onChange={v => upd({ orientacion: v })}
              />
              <RadioGroup label="9. ATENCIÓN" options={ATENCION} value={form.atencion || ''} onChange={v => upd({ atencion: v })} />
              <GridCheckbox
                label="10. MEMORIA Y SENSOPERCEPCIÓN (Marque las opciones que apliquen)"
                rows={MEM_SENSO_ROWS} cols={MEM_SENSO_COLS}
                value={form.memoria_sensopercepcion || {}} onChange={v => upd({ memoria_sensopercepcion: v })}
                rowColors={['text-blue-700', 'text-purple-700']}
              />
              <GridCheckbox
                label="Tipos de Fallas/Alteraciones (Marque las opciones que apliquen)"
                rows={FALLAS_ROWS} cols={FALLAS_COLS}
                value={form.tipos_fallas || {}} onChange={v => upd({ tipos_fallas: v })}
              />
              <GridCheckbox
                label="11. PENSAMIENTO (Marque las opciones que apliquen para Curso y Contenido)"
                rows={PENSAMIENTO_ROWS} cols={PENSAMIENTO_COLS}
                value={form.pensamiento || {}} onChange={v => upd({ pensamiento: v })}
                rowColors={['text-blue-700', 'text-orange-700']}
              />
              <GridCheckbox
                label="12. DELIRIO (Marque la sistematización y los mecanismos que apliquen)"
                rows={DELIRIO_ROWS} cols={DELIRIO_COLS}
                value={form.delirio || {}} onChange={v => upd({ delirio: v })}
              />
              <CheckboxGroup label="13. AFECTIVIDAD (Marque las opciones que apliquen)" options={AFECTIVIDAD} values={form.afectividad || []} onChange={v => upd({ afectividad: v })} />
              <CheckboxGroup label="14. ACTIVIDAD (Marque las opciones que apliquen)" options={ACTIVIDAD} values={form.actividad || []} onChange={v => upd({ actividad: v })} />
              <RadioGroup label="15. JUICIO (Marque la alteración que corresponda)" options={JUICIO} value={form.juicio || ''} onChange={v => upd({ juicio: v })} />
              <GridRadio
                label="Conciencia de (Marque SI, NO o PARCIAL según corresponda)"
                rows={CONCIENCIA_DE_ROWS} cols={CONCIENCIA_DE_COLS}
                value={form.conciencia_de || {}} onChange={v => upd({ conciencia_de: v })}
              />
              <RadioGroup label="16. INTELIGENCIA" options={INTELIGENCIA} value={form.inteligencia || ''} onChange={v => upd({ inteligencia: v })} />
            </div>
          </Card>

          {/* SECCIÓN 4 */}
          <Card>
            <SecTitle n={4}>Hábitos personales</SecTitle>
            <div className="flex flex-col gap-4">
              <Textarea label="1. Conducta alimentaria" value={form.conducta_alimentaria || ''} onChange={e => upd({ conducta_alimentaria: e.target.value })} rows={2} />
              <Textarea label="2. Sueño" value={form.sueno || ''} onChange={e => upd({ sueno: e.target.value })} rows={2} />
              <Textarea label="3. Sexualidad" value={form.sexualidad || ''} onChange={e => upd({ sexualidad: e.target.value })} rows={2} />
              <Textarea label="4. Relación con sustancias" value={form.relacion_sustancias || ''} onChange={e => upd({ relacion_sustancias: e.target.value })} rows={2} />
              <Textarea label="5. Agresividad" value={form.agresividad || ''} onChange={e => upd({ agresividad: e.target.value })} rows={2} />
            </div>
          </Card>

          {/* SECCIÓN 5 */}
          <Card>
            <SecTitle n={5}>Enfermedad actual</SecTitle>
            <div className="flex flex-col gap-4">
              <Textarea label="Antecedentes de enfermedad actual" value={form.antecedentes_enfermedad || ''} onChange={e => upd({ antecedentes_enfermedad: e.target.value })} rows={3} />
              <Textarea label="Antecedentes psiquiátricos-psicoterapéuticos-psicofarmacológicos" value={form.antecedentes_psiquiatricos || ''} onChange={e => upd({ antecedentes_psiquiatricos: e.target.value })} rows={3} />
              <Textarea label="Antecedentes médicos clínicos" value={form.antecedentes_medicos || ''} onChange={e => upd({ antecedentes_medicos: e.target.value })} rows={3} />
              <Textarea label="Medicación que recibe (marca, droga, dosis, frecuencia)" value={form.medicacion || ''} onChange={e => upd({ medicacion: e.target.value })} rows={3} />
              <Textarea label="Familigrama" value={form.familigrama || ''} onChange={e => upd({ familigrama: e.target.value })} rows={3} />
              <Input label="Diagnóstico presuntivo" value={form.diagnostico_presuntivo || ''} onChange={e => upd({ diagnostico_presuntivo: e.target.value })} />
              <Input label="Código DSMIV" value={form.codigo_dsmiv || ''} onChange={e => upd({ codigo_dsmiv: e.target.value })} />
              <CheckboxGroup label="Resolución (Seleccione el tipo de abordaje)" options={RESOLUCION} values={form.resolucion || []} onChange={v => upd({ resolucion: v })} />
              <Textarea label="Plan de tratamiento farmacológico" value={form.plan_farmacologico || ''} onChange={e => upd({ plan_farmacologico: e.target.value })} rows={3} />
            </div>
          </Card>

          <Button onClick={guardar} loading={guardando} size="lg" fullWidth>
            <Save className="w-5 h-5" />
            Guardar formulario
          </Button>
        </div>
      )}

      {/* ── EVOLUCIONES ── */}
      {tab === 'evoluciones' && (
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />Nueva evolución
            </h3>
            <div className="flex flex-col gap-3">
              <Input label="Fecha" type="date" value={fechaNuevaEvo} onChange={e => setFechaNuevaEvo(e.target.value)} />
              <Textarea label="Nota de evolución" value={nuevaEvo} onChange={e => setNuevaEvo(e.target.value)} rows={5} placeholder="Descripción de la consulta, estado del paciente, indicaciones..." />
              <Button onClick={agregarEvolucion} loading={guardandoEvo} disabled={!nuevaEvo.trim()}>
                <Plus className="w-5 h-5" />Agregar evolución
              </Button>
            </div>
          </Card>

          {evoluciones.length === 0 ? (
            <Card className="text-center py-8"><p className="text-gray-500">Sin evoluciones registradas</p></Card>
          ) : (
            <div className="flex flex-col gap-3">
              {evoluciones.map(evo => {
                const exp = expandidas.has(evo.id)
                const editando = editandoEvo?.id === evo.id
                return (
                  <Card key={evo.id} padding="sm">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <button onClick={() => toggleExpandida(evo.id)} className="flex items-center gap-2 text-left flex-1">
                        <span className="font-bold text-gray-900 text-base capitalize">
                          {format(parseISO(evo.fecha), "d 'de' MMMM yyyy", { locale: es })}
                        </span>
                        {exp ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                      </button>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditandoEvo(evo); setTextoEditEvo(evo.texto); setExpandidas(prev => { const n = new Set(prev); n.add(evo.id); return n }) }} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => eliminarEvo(evo.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {(exp || editando) ? (
                      editando ? (
                        <div className="flex flex-col gap-2 mt-2">
                          <Textarea value={textoEditEvo} onChange={e => setTextoEditEvo(e.target.value)} rows={5} />
                          <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setEditandoEvo(null)}>Cancelar</Button>
                            <Button onClick={guardarEdicionEvo}>Guardar</Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-gray-700 whitespace-pre-wrap text-sm mt-2 leading-relaxed">{evo.texto}</p>
                      )
                    ) : (
                      <p className="text-gray-500 text-sm truncate">{evo.texto}</p>
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
