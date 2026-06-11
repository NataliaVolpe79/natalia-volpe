'use client'

import { useEffect, useState, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { History, Filter, Phone, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TurnoConPaciente } from '@/lib/types'
import { formatHora } from '@/lib/utils'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

const colorEstado: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  confirmado: 'bg-blue-100 text-blue-800',
  completado: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-800',
}

const labelEstado: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  completado: 'Completado',
  cancelado: 'Cancelado',
}

export default function HistorialPage() {
  const [turnos, setTurnos] = useState<TurnoConPaciente[]>([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'))
  const [busqueda, setBusqueda] = useState('')

  const cargarHistorial = useCallback(async () => {
    setLoading(true)
    try {
      const [anoStr, mesStr] = mes.split('-')
      const inicio = `${anoStr}-${mesStr}-01`
      const finMes = new Date(parseInt(anoStr), parseInt(mesStr), 0)
      const fin = format(finMes, 'yyyy-MM-dd')

      const { data } = await supabase
        .from('turnos')
        .select('*, paciente:pacientes(id,nombre,apellido,telefono,obra_social)')
        .gte('created_at', `${inicio}T00:00:00`)
        .lte('created_at', `${fin}T23:59:59`)
        .order('created_at', { ascending: false })

      setTurnos((data || []) as TurnoConPaciente[])
    } finally {
      setLoading(false)
    }
  }, [mes])

  useEffect(() => { cargarHistorial() }, [cargarHistorial])

  const turnosFiltrados = turnos.filter(t => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    const nombre = `${t.paciente?.nombre} ${t.paciente?.apellido}`.toLowerCase()
    const tel = t.paciente?.telefono || ''
    return nombre.includes(q) || tel.includes(q)
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Historial de reservas</h1>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <Card padding="sm" className="text-center">
          <p className="text-xs text-gray-500 mb-1">Reservas en el mes</p>
          <p className="text-2xl font-bold text-blue-700">{turnos.length}</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-xs text-gray-500 mb-1">Cancelados</p>
          <p className="text-2xl font-bold text-red-600">
            {turnos.filter(t => t.estado === 'cancelado').length}
          </p>
        </Card>
      </div>

      {/* Filtros */}
      <Card padding="sm">
        <div className="flex gap-3 flex-wrap items-center">
          <Filter className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            type="month"
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : turnosFiltrados.length === 0 ? (
        <Card className="text-center py-12">
          <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">No hay reservas para este período</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {turnosFiltrados.map(turno => (
            <Card key={turno.id} padding="sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Paciente */}
                  <p className="font-bold text-gray-900 text-lg">
                    {turno.paciente?.apellido}, {turno.paciente?.nombre}
                  </p>

                  {/* Teléfono */}
                  <div className="flex items-center gap-1.5 text-gray-500 text-base mt-0.5">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{turno.paciente?.telefono}</span>
                    {turno.paciente?.obra_social && (
                      <span className="ml-2 text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-medium">
                        {turno.paciente.obra_social}
                      </span>
                    )}
                  </div>

                  {/* Turno: fecha y hora */}
                  <div className="flex items-center gap-1.5 text-gray-600 text-base mt-1">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>
                      Turno: {format(parseISO(turno.fecha), "EEEE d 'de' MMMM", { locale: es })} · {formatHora(turno.hora)} hs
                    </span>
                  </div>

                  {/* Modalidad y tipo */}
                  <div className="flex gap-2 mt-1 flex-wrap text-sm text-gray-500">
                    <span>{turno.modalidad === 'presencial' ? '📍 Presencial' : '💻 Videollamada'}</span>
                    <span>·</span>
                    <span>{turno.tipo_turno === 'primera_consulta' ? 'Primera consulta' : 'Seguimiento'}</span>
                  </div>
                </div>

                {/* Lado derecho: estado + cuándo reservó */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge className={colorEstado[turno.estado]}>
                    {labelEstado[turno.estado]}
                  </Badge>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Reservado el</p>
                    <p className="text-sm font-semibold text-gray-600">
                      {format(parseISO(turno.created_at), "d MMM", { locale: es })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(parseISO(turno.created_at), "HH:mm 'hs'")}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
