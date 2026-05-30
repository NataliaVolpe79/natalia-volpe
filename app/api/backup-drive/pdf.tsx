import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { HistoriaClinicaDatos, Evolucion, Paciente } from '@/lib/types'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 40, color: '#111' },
  header: { borderBottom: '2px solid #1d4ed8', paddingBottom: 8, marginBottom: 12 },
  headerTitle: { fontSize: 7, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  headerName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#111' },
  headerSub: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  headerRight: { position: 'absolute', right: 0, top: 0, textAlign: 'right' },
  headerDoc: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151' },
  secRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 6 },
  secBadge: { width: 14, height: 14, backgroundColor: '#1d4ed8', borderRadius: 7, marginRight: 6, alignItems: 'center', justifyContent: 'center' },
  secBadgeText: { color: '#fff', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  secTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.5 },
  secLine: { flex: 1, height: 1, backgroundColor: '#dbeafe', marginLeft: 6 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap' },
  fieldWrap: { marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #f3f4f6' },
  fieldWrapHalf: { width: '50%', paddingRight: 10, marginBottom: 8 },
  label: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  value: { fontSize: 9, color: '#1f2937', lineHeight: 1.4 },
  valueMuted: { fontSize: 9, color: '#9ca3af', fontFamily: 'Helvetica-Oblique' },
  evoBox: { border: '1px solid #e5e7eb', borderRadius: 3, padding: 8, marginBottom: 6 },
  evoDate: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1d4ed8', marginBottom: 3 },
  evoText: { fontSize: 9, color: '#1f2937', lineHeight: 1.5 },
  evoHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 6 },
  evoHeaderText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 },
  evoHeaderLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb', marginLeft: 6 },
  contactBox: { border: '1px solid #f3f4f6', borderRadius: 3, padding: 8, backgroundColor: '#f9fafb', marginBottom: 8 },
  contactTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 },
})

function val(v?: string | string[] | null) {
  if (!v || (Array.isArray(v) && v.length === 0)) return null
  return Array.isArray(v) ? v.join(', ') : v
}

function Campo({ label, value, half }: { label: string; value?: string | string[] | null; half?: boolean }) {
  const v = val(value)
  return (
    <View style={half ? s.fieldWrapHalf : s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      {v ? <Text style={s.value}>{v}</Text> : <Text style={s.valueMuted}>—</Text>}
    </View>
  )
}

function Seccion({ n, title }: { n: string | number; title: string }) {
  return (
    <View style={s.secRow}>
      <View style={s.secBadge}><Text style={s.secBadgeText}>{n}</Text></View>
      <Text style={s.secTitle}>{title}</Text>
      <View style={s.secLine} />
    </View>
  )
}

function gridVal(v?: Record<string, string> | Record<string, string[]> | null): string | null {
  if (!v || Object.keys(v).length === 0) return null
  const lines: string[] = []
  for (const [k, val] of Object.entries(v)) {
    if (Array.isArray(val)) {
      if (val.length > 0) lines.push(`${k}: ${val.join(', ')}`)
    } else {
      lines.push(`${k}: ${val}`)
    }
  }
  return lines.length > 0 ? lines.join('\n') : null
}

interface Props {
  paciente: Paciente
  datos: HistoriaClinicaDatos
  evoluciones: Evolucion[]
  fecha: string
}

export function HistoriaPDF({ paciente, datos: d, evoluciones, fecha }: Props) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Encabezado */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Historia Clínica · MVN</Text>
          <Text style={s.headerName}>{d.apellido_nombres || `${paciente.apellido}, ${paciente.nombre}`}</Text>
          <Text style={s.headerSub}>
            {d.tel_celular || paciente.telefono}{paciente.obra_social ? ` · ${paciente.obra_social}` : ''}
          </Text>
          <View style={s.headerRight}>
            <Text style={s.headerDoc}>Dra. Natalia Hebe Volpe</Text>
            <Text style={{ fontSize: 8, color: '#6b7280' }}>Médica Psiquiatra</Text>
            <Text style={{ fontSize: 8, color: '#9ca3af', marginTop: 2 }}>Actualizado: {fecha}</Text>
          </View>
        </View>

        {/* Sección 1 */}
        <Seccion n={1} title="Datos personales" />
        <View style={s.grid2}>
          <Campo half label="Apellido y nombres" value={d.apellido_nombres} />
          <Campo half label="Fecha de nacimiento" value={d.fecha_nacimiento} />
          <Campo half label="DNI" value={d.dni} />
          <Campo half label="¿Argentino/a?" value={d.argentino} />
          <Campo half label="OSDE Plan" value={d.osde_plan} />
          <Campo half label="Estado civil" value={d.estado_civil} />
          <Campo half label="Vive con" value={d.vive_con} />
          <Campo half label="Localidad y CP" value={d.localidad_cp} />
          <Campo half label="Teléfono fijo" value={d.tel_fijo} />
          <Campo half label="Teléfono celular" value={d.tel_celular} />
        </View>
        <Campo label="Domicilio" value={d.domicilio} />
        <Campo label="Educación" value={d.educacion} />

        <View style={s.contactBox}>
          <Text style={s.contactTitle}>Contacto de emergencia</Text>
          <View style={s.grid2}>
            <Campo half label="Nombre" value={d.contacto_nombre} />
            <Campo half label="Parentesco" value={d.contacto_parentesco} />
            <Campo half label="Teléfono" value={d.contacto_telefono} />
            <Campo half label="¿Convive?" value={d.contacto_convive} />
          </View>
        </View>

        {/* Sección 2 */}
        <Seccion n={2} title="Motivo de consulta" />
        <Campo label="" value={d.motivo_consulta} />

        {/* Sección 3 */}
        <Seccion n={3} title="Examen semiológico" />
        <Campo label="Aspecto físico" value={d.aspecto_fisico} />
        <View style={s.grid2}>
          <Campo half label="Facies" value={d.facies} />
          <Campo half label="Actitud" value={d.actitud} />
          <Campo half label="Presentación" value={d.presentacion} />
          <Campo half label="Aspecto psíquico" value={d.aspecto_psiquico} />
          <Campo half label="Conciencia" value={d.conciencia} />
          <Campo half label="Atención" value={d.atencion} />
          <Campo half label="Juicio" value={d.juicio} />
          <Campo half label="Inteligencia" value={d.inteligencia} />
        </View>
        <Campo label="Conductas" value={gridVal(d.conductas)} />
        <Campo label="Orientación" value={gridVal(d.orientacion)} />
        <Campo label="Memoria y Sensopercepción" value={gridVal(d.memoria_sensopercepcion)} />
        <Campo label="Pensamiento" value={gridVal(d.pensamiento)} />
        <Campo label="Afectividad" value={d.afectividad} />
        <Campo label="Actividad" value={d.actividad} />
        <Campo label="Conciencia de" value={gridVal(d.conciencia_de)} />

        {/* Sección 4 */}
        <Seccion n={4} title="Hábitos personales" />
        <View style={s.grid2}>
          <Campo half label="Conducta alimentaria" value={d.conducta_alimentaria} />
          <Campo half label="Sueño" value={d.sueno} />
          <Campo half label="Sexualidad" value={d.sexualidad} />
          <Campo half label="Relación con sustancias" value={d.relacion_sustancias} />
        </View>
        <Campo label="Agresividad" value={d.agresividad} />

        {/* Sección 5 */}
        <Seccion n={5} title="Enfermedad actual" />
        <Campo label="Antecedentes de enfermedad actual" value={d.antecedentes_enfermedad} />
        <Campo label="Antecedentes psiquiátricos" value={d.antecedentes_psiquiatricos} />
        <Campo label="Antecedentes médicos" value={d.antecedentes_medicos} />
        <Campo label="Medicación" value={d.medicacion} />
        <Campo label="Familigrama" value={d.familigrama} />
        <View style={s.grid2}>
          <Campo half label="Diagnóstico presuntivo" value={d.diagnostico_presuntivo} />
          <Campo half label="Código DSMIV" value={d.codigo_dsmiv} />
        </View>
        <Campo label="Resolución / Tipo de abordaje" value={d.resolucion} />
        <Campo label="Plan de tratamiento farmacológico" value={d.plan_farmacologico} />

        {/* Evoluciones */}
        {evoluciones.length > 0 && (
          <>
            <View style={s.evoHeader}>
              <Text style={s.evoHeaderText}>Evoluciones ({evoluciones.length})</Text>
              <View style={s.evoHeaderLine} />
            </View>
            {evoluciones.map(evo => (
              <View key={evo.id} style={s.evoBox}>
                <Text style={s.evoDate}>{evo.fecha}</Text>
                <Text style={s.evoText}>{evo.texto}</Text>
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  )
}
