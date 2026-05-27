'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Printer, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Paciente, HistoriaClinica, HistoriaClinicaDatos, Evolucion } from '@/lib/types'

interface PacienteConHistoria {
  paciente: Paciente
  historia: HistoriaClinica | null
  evoluciones: Evolucion[]
}

// ─── Helpers de impresión ─────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">{children}</p>
}

function Valor({ v }: { v?: string | string[] | null }) {
  if (!v || (Array.isArray(v) && v.length === 0)) {
    return <p className="text-xs text-gray-400 italic border-b border-gray-100 pb-1 mb-3">—</p>
  }
  const texto = Array.isArray(v) ? v.join(', ') : v
  return <p className="text-xs text-gray-800 border-b border-gray-100 pb-1 mb-3 leading-relaxed">{texto}</p>
}

function Campo({ label, value }: { label: string; value?: string | string[] | null }) {
  return <div><Label>{label}</Label><Valor v={value} /></div>
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-6">{children}</div>
}

function SecTitle({ n, title }: { n: number | string; title: string }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-3">
      <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{n}</div>
      <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wide">{title}</h3>
      <div className="flex-1 h-px bg-blue-100" />
    </div>
  )
}

function GridRadioPrint({ label, rows, value }: {
  label: string
  rows: string[]
  value?: Record<string, string>
}) {
  if (!value || Object.keys(value).length === 0) return null
  return (
    <div className="mb-3">
      <Label>{label}</Label>
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left px-2 py-1 text-gray-500 font-medium border border-gray-200"></th>
            {['SI', 'NO', 'Parcial'].map(c => <th key={c} className="px-3 py-1 text-gray-600 font-semibold border border-gray-200">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row}>
              <td className="px-2 py-1 font-medium text-gray-700 border border-gray-200">{row}</td>
              {['SI', 'NO', 'Parcial'].map(col => (
                <td key={col} className="text-center px-3 py-1 border border-gray-200">
                  {value[row] === col ? '●' : '○'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GridCheckboxPrint({ label, rows, value }: {
  label: string
  rows: string[]
  value?: Record<string, string[]>
}) {
  if (!value) return null
  const hasData = rows.some(r => (value[r] || []).length > 0)
  if (!hasData) return null
  return (
    <div className="mb-3">
      <Label>{label}</Label>
      <div className="flex flex-col gap-1">
        {rows.map(row => {
          const items = value[row] || []
          if (items.length === 0) return null
          return (
            <div key={row} className="flex gap-2">
              <span className="text-[10px] font-bold text-gray-600 min-w-[90px] shrink-0">{row}:</span>
              <span className="text-xs text-gray-800">{items.join(', ')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Historia imprimible ──────────────────────────────────────────────────────

function HistoriaImprimible({ pch }: { pch: PacienteConHistoria }) {
  const { paciente, historia, evoluciones } = pch
  const d: HistoriaClinicaDatos = historia?.datos || {}

  return (
    <div className="historia-paciente mb-16 print:mb-0">
      {/* Encabezado */}
      <div className="flex items-start justify-between mb-4 border-b-2 border-blue-600 pb-3">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">Historia Clínica · MVN</p>
          <h2 className="text-xl font-bold text-gray-900">{d.apellido_nombres || `${paciente.apellido} ${paciente.nombre}`}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{d.tel_celular || paciente.telefono}{paciente.obra_social ? ` · ${paciente.obra_social}` : ''}</p>
        </div>
        <div className="text-right text-[10px] text-gray-400">
          <p className="font-semibold text-gray-600">Dra. Natalia Hebe Volpe</p>
          <p>Médica Psiquiatra</p>
          <p className="mt-1">Impreso: {format(new Date(), "d/MM/yyyy")}</p>
        </div>
      </div>

      {/* Sección 1 */}
      <SecTitle n={1} title="Datos personales" />
      <Grid2>
        <Campo label="Apellido y nombres" value={d.apellido_nombres} />
        <Campo label="Fecha de nacimiento" value={d.fecha_nacimiento} />
        <Campo label="¿Argentino/a?" value={d.argentino} />
        <Campo label="DNI" value={d.dni} />
        <Campo label="OSDE Plan (Nro)" value={d.osde_plan} />
        <Campo label="Estado civil" value={d.estado_civil} />
        <Campo label="Vive con" value={d.vive_con} />
        <Campo label="Localidad y CP" value={d.localidad_cp} />
        <Campo label="Teléfono fijo" value={d.tel_fijo} />
        <Campo label="Teléfono celular" value={d.tel_celular} />
      </Grid2>
      <Campo label="Domicilio" value={d.domicilio} />
      <Campo label="Educación" value={d.educacion} />
      <div className="border border-gray-100 rounded-lg p-3 bg-gray-50 mb-3">
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-2">Contacto de emergencia</p>
        <Grid2>
          <Campo label="Contacto asignado" value={d.contacto_asignado} />
          <Campo label="Apellido y nombre" value={d.contacto_nombre} />
          <Campo label="Parentesco" value={d.contacto_parentesco} />
          <Campo label="Teléfono" value={d.contacto_telefono} />
        </Grid2>
        <Campo label="¿Convive con el paciente?" value={d.contacto_convive} />
      </div>

      {/* Sección 2 */}
      <SecTitle n={2} title="Motivo de consulta" />
      <div className="min-h-[60px] text-xs text-gray-800 leading-relaxed whitespace-pre-wrap border-b border-gray-100 pb-2 mb-3">
        {d.motivo_consulta || <span className="text-gray-400 italic">—</span>}
      </div>

      {/* Sección 3 */}
      <SecTitle n={3} title="Examen semiológico" />
      <Campo label="1. Aspecto físico" value={d.aspecto_fisico} />
      <Grid2>
        <Campo label="2. Facies" value={d.facies} />
        <Campo label="3. Actitud" value={d.actitud} />
        <Campo label="4. Presentación" value={d.presentacion} />
        {(d.presentacion || []).includes('Otros (Especifique)') && <Campo label="Especificación presentación" value={d.presentacion_otros} />}
        <Campo label="5. Aspecto psíquico" value={d.aspecto_psiquico} />
        <Campo label="6. Conciencia" value={d.conciencia} />
      </Grid2>
      <GridCheckboxPrint label="7. Conductas" rows={['Adaptadas', 'Desadaptadas', 'Pertinente']} value={d.conductas} />
      <GridRadioPrint label="8. Orientación" rows={['AUTOPSÍQUICA', 'AUTOPSÍQUICA TIEMPO', 'AUTOPSÍQUICA ESPACIO']} value={d.orientacion} />
      <Campo label="9. Atención" value={d.atencion} />
      <GridCheckboxPrint label="10. Memoria y Sensopercepción" rows={['MEMORIA', 'SENSOPERCEPCIÓN']} value={d.memoria_sensopercepcion} />
      <GridCheckboxPrint label="Tipos de Fallas/Alteraciones" rows={['Retardo/Abolición', 'Aceleración']} value={d.tipos_fallas} />
      <GridCheckboxPrint label="11. Pensamiento" rows={['CURSO', 'CONTENIDO']} value={d.pensamiento} />
      <GridCheckboxPrint label="12. Delirio" rows={['Sistematización', 'Mecanismo']} value={d.delirio} />
      <Campo label="13. Afectividad" value={d.afectividad} />
      <Campo label="14. Actividad" value={d.actividad} />
      <Grid2>
        <Campo label="15. Juicio" value={d.juicio} />
        <Campo label="16. Inteligencia" value={d.inteligencia} />
      </Grid2>
      <GridRadioPrint label="Conciencia de" rows={['Situación', 'Enfermedad']} value={d.conciencia_de} />

      {/* Sección 4 */}
      <SecTitle n={4} title="Hábitos personales" />
      <Grid2>
        <Campo label="1. Conducta alimentaria" value={d.conducta_alimentaria} />
        <Campo label="2. Sueño" value={d.sueno} />
        <Campo label="3. Sexualidad" value={d.sexualidad} />
        <Campo label="4. Relación con sustancias" value={d.relacion_sustancias} />
      </Grid2>
      <Campo label="5. Agresividad" value={d.agresividad} />

      {/* Sección 5 */}
      <SecTitle n={5} title="Enfermedad actual" />
      <Campo label="Antecedentes de enfermedad actual" value={d.antecedentes_enfermedad} />
      <Campo label="Antecedentes psiquiátricos-psicoterapéuticos-psicofarmacológicos" value={d.antecedentes_psiquiatricos} />
      <Campo label="Antecedentes médicos clínicos" value={d.antecedentes_medicos} />
      <Campo label="Medicación que recibe (marca, droga, dosis, frecuencia)" value={d.medicacion} />
      <Campo label="Familigrama" value={d.familigrama} />
      <Grid2>
        <Campo label="Diagnóstico presuntivo" value={d.diagnostico_presuntivo} />
        <Campo label="Código DSMIV" value={d.codigo_dsmiv} />
      </Grid2>
      <Campo label="Resolución / Tipo de abordaje" value={d.resolucion} />
      <Campo label="Plan de tratamiento farmacológico" value={d.plan_farmacologico} />

      {/* Evoluciones */}
      {evoluciones.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-6 mb-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Evoluciones</h3>
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] text-gray-400">{evoluciones.length} registro{evoluciones.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex flex-col gap-3">
            {evoluciones.map(evo => (
              <div key={evo.id} className="border border-gray-200 rounded-lg p-3">
                <p className="text-[10px] font-bold text-blue-700 mb-1 capitalize">
                  {format(parseISO(evo.fecha), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
                <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">{evo.texto}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

function ImprimirContent() {
  const params = useSearchParams()
  const id = params.get('id')

  const [datos, setDatos] = useState<PacienteConHistoria[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      let q = supabase.from('pacientes').select('*').order('apellido')
      if (id) q = q.eq('id', id)

      const { data: pacientes } = await q
      if (!pacientes || pacientes.length === 0) { setLoading(false); return }

      const ids = pacientes.map((p: Paciente) => p.id)
      const [{ data: historias }, { data: evoluciones }] = await Promise.all([
        supabase.from('historias_clinicas').select('*').in('paciente_id', ids),
        supabase.from('evoluciones').select('*').in('paciente_id', ids).order('fecha', { ascending: false }),
      ])

      setDatos(pacientes.map((p: Paciente) => ({
        paciente: p,
        historia: (historias || []).find((h: HistoriaClinica) => h.paciente_id === p.id) || null,
        evoluciones: (evoluciones || []).filter((e: Evolucion) => e.paciente_id === p.id),
      })))
      setLoading(false)
    }
    cargar()
  }, [id])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
  }

  if (datos.length === 0) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">No se encontraron datos</div>
  }

  return (
    <>
      {/* Barra de acción */}
      <div className="print:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50 px-6 py-3 flex items-center justify-between">
        <button onClick={() => window.close()} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-semibold text-sm">
          <ArrowLeft className="w-4 h-4" />Cerrar
        </button>
        <p className="text-sm text-gray-600 font-medium">
          {datos.length === 1 ? `${datos[0].paciente.apellido}, ${datos[0].paciente.nombre}` : `${datos.length} pacientes`}
        </p>
        <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold text-sm transition-colors">
          <Printer className="w-4 h-4" />Imprimir / PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-8 pt-20 pb-12 print:pt-4 print:px-6 print:max-w-none">
        {datos.map(pch => <HistoriaImprimible key={pch.paciente.id} pch={pch} />)}
      </div>

      <style jsx global>{`
        @media print {
          body { font-size: 11px; }
          .historia-paciente { page-break-after: always; }
          .historia-paciente:last-child { page-break-after: avoid; }
        }
      `}</style>
    </>
  )
}

export default function ImprimirPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>}>
      <ImprimirContent />
    </Suspense>
  )
}
