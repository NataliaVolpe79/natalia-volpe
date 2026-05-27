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

function Campo({ label, value }: { label: string; value?: string }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-gray-900 min-h-[1.5rem] border-b border-gray-200 pb-1">
        {value || <span className="text-gray-400 italic">—</span>}
      </p>
    </div>
  )
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-8">{children}</div>
}

function SeccionTitulo({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <div className="mt-6 mb-3 flex items-center gap-3">
      <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
        {numero}
      </div>
      <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide">{titulo}</h3>
      <div className="flex-1 h-px bg-blue-100" />
    </div>
  )
}

function HistoriaImprimible({ pch }: { pch: PacienteConHistoria }) {
  const { paciente, historia, evoluciones } = pch
  const d: HistoriaClinicaDatos = historia?.datos || {}

  return (
    <div className="historia-paciente mb-16 print:mb-0 print:page-break-after-always">
      {/* Encabezado */}
      <div className="flex items-start justify-between mb-6 border-b-2 border-blue-600 pb-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Historia Clínica</p>
          <h2 className="text-2xl font-bold text-gray-900">
            {paciente.nombre} {paciente.apellido}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {paciente.telefono}
            {paciente.obra_social && ` · ${paciente.obra_social}`}
          </p>
        </div>
        <div className="text-right text-xs text-gray-400">
          <p>Dra. Natalia Hebe Volpe</p>
          <p>Médica Psiquiatra</p>
          <p className="mt-1">Impreso: {format(new Date(), "d/MM/yyyy", { locale: es })}</p>
        </div>
      </div>

      {/* Sección 1: Datos personales */}
      <SeccionTitulo numero={1} titulo="Datos personales" />
      <Grid2>
        <Campo label="Nombre" value={d.nombre || paciente.nombre} />
        <Campo label="Apellido" value={d.apellido || paciente.apellido} />
        <Campo label="DNI" value={d.dni} />
        <Campo label="Fecha de nacimiento" value={d.fecha_nacimiento || paciente.fecha_nacimiento} />
        <Campo label="Teléfono" value={d.telefono || paciente.telefono} />
        <Campo label="Email" value={d.email || paciente.email} />
        <Campo label="Obra social" value={d.obra_social || paciente.obra_social} />
        <Campo label="N° afiliado" value={d.numero_afiliado || paciente.numero_afiliado} />
        <Campo label="Ocupación" value={d.ocupacion} />
        <Campo label="Escolaridad" value={d.escolaridad} />
        <Campo label="Estado civil" value={d.estado_civil} />
        <Campo label="Hijos" value={d.hijos} />
      </Grid2>
      <Campo label="Domicilio" value={d.domicilio} />
      <Campo label="Con quién convive" value={d.convivencia} />

      {/* Sección 2: Motivo de consulta */}
      <SeccionTitulo numero={2} titulo="Motivo de consulta" />
      <div className="min-h-[80px] text-sm text-gray-900 leading-relaxed whitespace-pre-wrap border-b border-gray-200 pb-2">
        {d.motivo_consulta || <span className="text-gray-400 italic">—</span>}
      </div>

      {/* Sección 3: Examen semiológico */}
      <SeccionTitulo numero={3} titulo="Examen semiológico" />
      <Grid2>
        <Campo label="Conciencia" value={d.conciencia} />
        <Campo label="Atención" value={d.atencion} />
        <Campo label="Memoria" value={d.memoria} />
        <Campo label="Orientación" value={d.orientacion} />
        <Campo label="Pensamiento — Curso" value={d.pensamiento_curso} />
        <Campo label="Pensamiento — Contenido" value={d.pensamiento_contenido} />
        <Campo label="Afecto" value={d.afecto} />
        <Campo label="Conducta" value={d.conducta} />
      </Grid2>
      <Campo label="Lenguaje" value={d.lenguaje} />
      <Campo label="Percepciones" value={d.percepciones} />
      <Campo label="Crítica / Insight" value={d.critica_insight} />

      {/* Sección 4: Hábitos */}
      <SeccionTitulo numero={4} titulo="Hábitos" />
      <Grid2>
        <Campo label="Sueño" value={d.sueno} />
        <Campo label="Alimentación" value={d.alimentacion} />
        <Campo label="Actividad física" value={d.actividad_fisica} />
        <Campo label="Sustancias" value={d.sustancias} />
      </Grid2>

      {/* Sección 5: Enfermedad actual */}
      <SeccionTitulo numero={5} titulo="Enfermedad actual" />
      <Campo label="Antecedentes personales" value={d.antecedentes_personales} />
      <Campo label="Antecedentes familiares" value={d.antecedentes_familiares} />
      <Campo label="Tratamientos previos" value={d.tratamientos_previos} />
      <Campo label="Medicación actual" value={d.medicacion_actual} />
      <Campo label="Alergias / reacciones adversas" value={d.alergias} />

      {/* Evoluciones */}
      {evoluciones.length > 0 && (
        <>
          <div className="mt-8 mb-3 flex items-center gap-3">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Evoluciones</h3>
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">{evoluciones.length} registro{evoluciones.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex flex-col gap-4">
            {evoluciones.map(evo => (
              <div key={evo.id} className="border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-bold text-blue-700 mb-2 capitalize">
                  {format(parseISO(evo.fecha), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{evo.texto}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ImprimirContent() {
  const params = useSearchParams()
  const id = params.get('id')
  const todos = params.get('todos') === '1'

  const [datos, setDatos] = useState<PacienteConHistoria[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      let pacientesQuery = supabase.from('pacientes').select('*').order('apellido')
      if (id) pacientesQuery = pacientesQuery.eq('id', id)

      const { data: pacientes } = await pacientesQuery

      if (!pacientes || pacientes.length === 0) { setLoading(false); return }

      const ids = pacientes.map(p => p.id)

      const [{ data: historias }, { data: evoluciones }] = await Promise.all([
        supabase.from('historias_clinicas').select('*').in('paciente_id', ids),
        supabase.from('evoluciones').select('*').in('paciente_id', ids).order('fecha', { ascending: false }),
      ])

      const resultado: PacienteConHistoria[] = pacientes.map(p => ({
        paciente: p,
        historia: (historias || []).find(h => h.paciente_id === p.id) || null,
        evoluciones: (evoluciones || []).filter(e => e.paciente_id === p.id),
      }))

      setDatos(resultado)
      setLoading(false)
    }
    cargar()
  }, [id, todos])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (datos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        No se encontraron datos
      </div>
    )
  }

  return (
    <>
      {/* Barra de acción — oculta al imprimir */}
      <div className="print:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => window.close()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-semibold text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Cerrar
        </button>
        <p className="text-sm text-gray-600 font-medium">
          {datos.length === 1
            ? `${datos[0].paciente.nombre} ${datos[0].paciente.apellido}`
            : `${datos.length} pacientes`
          }
        </p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold text-sm transition-colors"
        >
          <Printer className="w-4 h-4" />
          Imprimir / PDF
        </button>
      </div>

      {/* Contenido */}
      <div className="print:p-0 max-w-3xl mx-auto px-8 pt-20 pb-12 print:pt-0 print:max-w-none">
        {datos.map(pch => (
          <HistoriaImprimible key={pch.paciente.id} pch={pch} />
        ))}
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
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    }>
      <ImprimirContent />
    </Suspense>
  )
}
