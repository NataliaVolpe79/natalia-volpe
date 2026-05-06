'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, CreditCard, Users, Plus, Video, MapPin, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TurnoConPaciente, Configuracion } from '@/lib/types'
import { formatHora, colorEstadoPago, colorEstadoTurno, labelEstadoTurno, labelEstadoPago } from '@/lib/utils'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import FormularioTurno from '@/components/admin/FormularioTurno'

export default function AdminDashboard() {
  const [turnosHoy, setTurnosHoy] = useState<TurnoConPaciente[]>([])
  const [pagosPendientes, setPagosPendientes] = useState(0)
  const [pacientesDeudores, setPacientesDeudores] = useState(0)
  const [config, setConfig] = useState<Configuracion | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalTurno, setModalTurno] = useState(false)

  const hoy = format(new Date(), 'yyyy-MM-dd')
  const hoyFormateado = format(new Date(), "EEEE d 'de' MMMM", { locale: es })
  const diaHoy = format(new Date(), 'EEEE', { locale: es }).toLowerCase()

  const cargarDatos = useCallback(async function () {
    setLoading(true)
    try {
      const [{ data: cfg }, { data: turnos }, { data: pagos }, { data: deudores }] = await Promise.all([
        supabase.from('configuracion').select('*').single(),
        supabase
          .from('turnos')
          .select('*, paciente:pacientes(*), pago:pagos(*)')
          .eq('fecha', hoy)
          .not('estado', 'eq', 'cancelado')
          .order('hora'),
        supabase.from('pagos').select('id').eq('estado', 'pendiente'),
        supabase.from('pagos').select('paciente_id').eq('estado', 'debe'),
      ])
      if (cfg) setConfig(cfg)
      setTurnosHoy(
        (turnos || []).map(t => ({
          ...t,
          pago: Array.isArray(t.pago) ? t.pago[0] : t.pago,
        })) as TurnoConPaciente[]
      )
      setPagosPendientes(pagos?.length || 0)
      const uniqueDeudores = new Set(deudores?.map(d => d.paciente_id) || [])
      setPacientesDeudores(uniqueDeudores.size)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const esPresencial = config?.dias_presencial.includes(diaHoy)

  return (
    <div className="flex flex-col gap-6">
      {/* Fecha y modalidad del día */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className={`rounded-2xl p-5 text-white ${esPresencial ? 'bg-green-600' : 'bg-blue-600'}`}>
          <p className="text-sm opacity-80 uppercase tracking-wide mb-1">Hoy</p>
          <p className="text-2xl font-bold capitalize">{hoyFormateado}</p>
          <div className="flex items-center gap-2 mt-3">
            {esPresencial ? (
              <><MapPin className="w-5 h-5" /> <span className="text-lg font-semibold">Atención presencial</span></>
            ) : (
              <><Video className="w-5 h-5" /> <span className="text-lg font-semibold">Videollamadas</span></>
            )}
          </div>
        </div>
      </motion.div>

      {/* Contadores */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Turnos hoy', value: turnosHoy.length, Icon: Calendar, color: 'bg-blue-50 text-blue-600' },
          { label: 'Pagos pendientes', value: pagosPendientes, Icon: CreditCard, color: 'bg-yellow-50 text-yellow-600' },
          { label: 'Deben', value: pacientesDeudores, Icon: Users, color: 'bg-red-50 text-red-600' },
        ].map(({ label, value, Icon, color }) => (
          <Card key={label} padding="sm" className="text-center">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mx-auto mb-2`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{loading ? '—' : value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      {/* Botón agregar turno */}
      <Button size="lg" fullWidth onClick={() => setModalTurno(true)}>
        <Plus className="w-6 h-6" />
        Agregar turno
      </Button>

      {/* Turnos de hoy */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-gray-900">Turnos de hoy</h2>
          <Link href="/admin/turnos" className="text-blue-600 font-semibold text-base">
            Ver todos →
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : turnosHoy.length === 0 ? (
          <Card className="text-center py-10">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-lg">No hay turnos para hoy</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {turnosHoy.map((turno, i) => (
              <motion.div
                key={turno.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card padding="sm">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center w-14 h-14 bg-blue-50 rounded-xl shrink-0">
                      <Clock className="w-4 h-4 text-blue-600 mb-0.5" />
                      <span className="text-base font-bold text-blue-600">{formatHora(turno.hora)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-lg truncate">
                        {turno.paciente?.nombre} {turno.paciente?.apellido}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={colorEstadoTurno[turno.estado]}>
                          {labelEstadoTurno[turno.estado]}
                        </Badge>
                        {turno.pago && (
                          <Badge className={colorEstadoPago[turno.pago.estado]}>
                            {labelEstadoPago[turno.pago.estado]}
                          </Badge>
                        )}
                        {turno.modalidad === 'presencial' ? (
                          <span className="text-sm text-green-700">📍 Presencial</span>
                        ) : (
                          <span className="text-sm text-blue-700">💻 Video</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nuevo turno */}
      {modalTurno && (
        <FormularioTurno
          isOpen={modalTurno}
          onClose={() => setModalTurno(false)}
          onSuccess={() => { setModalTurno(false); cargarDatos() }}
          config={config}
        />
      )}
    </div>
  )
}
