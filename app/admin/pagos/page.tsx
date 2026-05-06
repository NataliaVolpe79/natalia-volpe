'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CreditCard, Upload, Eye, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Pago, EstadoPago } from '@/lib/types'
import { formatHora, colorEstadoPago, labelEstadoPago } from '@/lib/utils'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Alert from '@/components/ui/Alert'

type PagoConDetalle = Pago & {
  turno: { fecha: string; hora: string; modalidad: string }
  paciente: { nombre: string; apellido: string; telefono: string }
}

export default function PagosPage() {
  const [pagos, setPagos] = useState<PagoConDetalle[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState<EstadoPago | 'todos'>('todos')
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'))
  const [pagoActivo, setPagoActivo] = useState<PagoConDetalle | null>(null)
  const [modalPago, setModalPago] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Formulario de pago
  const [formPago, setFormPago] = useState({
    estado: 'pagado' as EstadoPago,
    metodo_pago: 'transferencia' as 'transferencia' | 'obra_social',
    monto: '',
    codigo_obra_social: '',
    notas: '',
    fecha_pago: format(new Date(), 'yyyy-MM-dd'),
  })
  const [archivo, setArchivo] = useState<File | null>(null)

  const cargarPagos = useCallback(async () => {
    setLoading(true)
    try {
      const [anoStr, mesStr] = mes.split('-')
      const inicio = `${anoStr}-${mesStr}-01`
      const finMes = new Date(parseInt(anoStr), parseInt(mesStr), 0)
      const fin = format(finMes, 'yyyy-MM-dd')

      let query = supabase
        .from('pagos')
        .select('*, turno:turnos(fecha,hora,modalidad), paciente:pacientes(nombre,apellido,telefono)')
        .order('created_at', { ascending: false })

      // Filtrar por mes usando los turnos
      query = query.gte('created_at', `${inicio}T00:00:00`)
        .lte('created_at', `${fin}T23:59:59`)

      if (filtroEstado !== 'todos') {
        query = query.eq('estado', filtroEstado)
      }

      const { data } = await query
      setPagos((data || []) as PagoConDetalle[])
    } finally {
      setLoading(false)
    }
  }, [mes, filtroEstado])

  useEffect(() => { cargarPagos() }, [cargarPagos])

  function abrirModalPago(pago: PagoConDetalle) {
    setPagoActivo(pago)
    setFormPago({
      estado: pago.estado === 'pagado' ? 'pagado' : 'pagado',
      metodo_pago: pago.metodo_pago || 'transferencia',
      monto: pago.monto?.toString() || '',
      codigo_obra_social: pago.codigo_obra_social || '',
      notas: pago.notas || '',
      fecha_pago: format(new Date(), 'yyyy-MM-dd'),
    })
    setArchivo(null)
    setModalPago(true)
  }

  async function guardarPago() {
    if (!pagoActivo) return
    setGuardando(true)
    setError('')
    try {
      let comprobanteUrl = pagoActivo.comprobante_url

      // Subir comprobante si hay archivo
      if (archivo) {
        if (archivo.size > 5 * 1024 * 1024) {
          setError('El archivo no puede superar los 5MB')
          setGuardando(false)
          return
        }
        const ext = archivo.name.split('.').pop()
        const path = `comprobantes/${pagoActivo.id}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('comprobantes')
          .upload(path, archivo, { upsert: true })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path)
        comprobanteUrl = urlData.publicUrl
      }

      const { error: e } = await supabase.from('pagos').update({
        estado: formPago.estado,
        metodo_pago: formPago.metodo_pago,
        monto: formPago.monto ? parseFloat(formPago.monto) : null,
        codigo_obra_social: formPago.metodo_pago === 'obra_social' ? formPago.codigo_obra_social : null,
        notas: formPago.notas || null,
        fecha_pago: formPago.estado === 'pagado' ? formPago.fecha_pago : null,
        comprobante_url: comprobanteUrl,
      }).eq('id', pagoActivo.id)

      if (e) throw e
      setModalPago(false)
      cargarPagos()
    } catch {
      setError('No se pudo guardar el pago')
    } finally {
      setGuardando(false)
    }
  }

  async function marcarEstado(pago: PagoConDetalle, estado: EstadoPago) {
    await supabase.from('pagos').update({ estado }).eq('id', pago.id)
    cargarPagos()
  }

  // Resumen del mes
  const totalCobrado = pagos
    .filter(p => p.estado === 'pagado' && p.monto)
    .reduce((sum, p) => sum + (p.monto || 0), 0)
  const totalPendiente = pagos.filter(p => p.estado === 'pendiente').length
  const totalDebe = pagos.filter(p => p.estado === 'debe').length

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>

      {/* Resumen del mes */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding="sm" className="text-center">
          <p className="text-xs text-gray-500 mb-1">Cobrado</p>
          <p className="text-xl font-bold text-green-700">${totalCobrado.toLocaleString('es-AR')}</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-xs text-gray-500 mb-1">Pendientes</p>
          <p className="text-xl font-bold text-yellow-600">{totalPendiente}</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-xs text-gray-500 mb-1">Deben</p>
          <p className="text-xl font-bold text-red-600">{totalDebe}</p>
        </Card>
      </div>

      {/* Filtros */}
      <Card padding="sm">
        <div className="flex gap-3 flex-wrap items-center">
          <Filter className="w-5 h-5 text-gray-400" />
          <input
            type="month"
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex gap-2 flex-wrap">
            {(['todos', 'pendiente', 'debe', 'pagado'] as const).map(estado => (
              <button
                key={estado}
                onClick={() => setFiltroEstado(estado)}
                className={[
                  'px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
                  filtroEstado === estado
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                ].join(' ')}
              >
                {estado === 'todos' ? 'Todos' : labelEstadoPago[estado]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Lista de pagos */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : pagos.length === 0 ? (
        <Card className="text-center py-12">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">No hay pagos para este período</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {pagos.map(pago => (
            <Card key={pago.id} padding="sm">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-900 text-lg">
                        {pago.paciente?.apellido}, {pago.paciente?.nombre}
                      </p>
                      {pago.turno && (
                        <p className="text-gray-500 text-base">
                          {format(parseISO(pago.turno.fecha), "d 'de' MMMM", { locale: es })} · {formatHora(pago.turno.hora)} hs
                        </p>
                      )}
                    </div>
                    <Badge className={colorEstadoPago[pago.estado]}>
                      {labelEstadoPago[pago.estado]}
                    </Badge>
                  </div>

                  {pago.monto && (
                    <p className="text-green-700 font-bold text-lg mt-1">
                      ${pago.monto.toLocaleString('es-AR')}
                    </p>
                  )}

                  {pago.metodo_pago && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {pago.metodo_pago === 'transferencia' ? '💸 Transferencia' : '🏥 Obra social'}
                      {pago.codigo_obra_social && ` · ${pago.codigo_obra_social}`}
                    </p>
                  )}

                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button
                      onClick={() => abrirModalPago(pago)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      {pago.estado === 'pagado' ? 'Ver/Editar' : 'Registrar pago'}
                    </button>
                    {pago.comprobante_url && (
                      <a
                        href={pago.comprobante_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
                      >
                        <Eye className="w-4 h-4" /> Comprobante
                      </a>
                    )}
                    {pago.estado !== 'debe' && (
                      <button
                        onClick={() => marcarEstado(pago, 'debe')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors"
                      >
                        Marcar que debe
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal registrar/editar pago */}
      <Modal isOpen={modalPago} onClose={() => setModalPago(false)} title="Registrar pago" maxWidth="md">
        {error && <Alert type="error" className="mb-4">{error}</Alert>}
        {pagoActivo && (
          <div className="flex flex-col gap-4">
            <div className="bg-gray-50 rounded-xl p-3 text-base">
              <span className="font-bold">{pagoActivo.paciente?.nombre} {pagoActivo.paciente?.apellido}</span>
              {pagoActivo.turno && (
                <span className="text-gray-500 ml-2">
                  · {format(parseISO(pagoActivo.turno.fecha), "d 'de' MMMM", { locale: es })} {formatHora(pagoActivo.turno.hora)} hs
                </span>
              )}
            </div>

            <Select
              label="Estado del pago"
              value={formPago.estado}
              onChange={e => setFormPago(f => ({ ...f, estado: e.target.value as EstadoPago }))}
              options={[
                { value: 'pagado', label: 'Pagado' },
                { value: 'pendiente', label: 'Pendiente' },
                { value: 'debe', label: 'Debe' },
              ]}
            />

            {formPago.estado === 'pagado' && (
              <>
                <Select
                  label="Método de pago"
                  value={formPago.metodo_pago}
                  onChange={e => setFormPago(f => ({ ...f, metodo_pago: e.target.value as 'transferencia' | 'obra_social' }))}
                  options={[
                    { value: 'transferencia', label: '💸 Transferencia' },
                    { value: 'obra_social', label: '🏥 Obra social' },
                  ]}
                />

                <Input
                  label="Monto (opcional)"
                  type="number"
                  placeholder="Ej: 15000"
                  value={formPago.monto}
                  onChange={e => setFormPago(f => ({ ...f, monto: e.target.value }))}
                />

                {formPago.metodo_pago === 'obra_social' && (
                  <Input
                    label="Código de obra social"
                    value={formPago.codigo_obra_social}
                    onChange={e => setFormPago(f => ({ ...f, codigo_obra_social: e.target.value }))}
                    placeholder="Código de autorización..."
                  />
                )}

                {formPago.metodo_pago === 'transferencia' && (
                  <div>
                    <label className="text-base font-semibold text-gray-700 block mb-1.5">
                      Comprobante (imagen o PDF, máx. 5MB)
                    </label>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={e => setArchivo(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center"
                    >
                      <Upload className="w-5 h-5" />
                      {archivo ? archivo.name : 'Seleccionar archivo'}
                    </button>
                    {pagoActivo.comprobante_url && !archivo && (
                      <a href={pagoActivo.comprobante_url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 text-sm underline mt-1 block">
                        Ver comprobante actual
                      </a>
                    )}
                  </div>
                )}

                <Input
                  label="Fecha de pago"
                  type="date"
                  value={formPago.fecha_pago}
                  onChange={e => setFormPago(f => ({ ...f, fecha_pago: e.target.value }))}
                />
              </>
            )}

            <Input
              label="Notas (opcional)"
              value={formPago.notas}
              onChange={e => setFormPago(f => ({ ...f, notas: e.target.value }))}
              placeholder="Notas sobre el pago..."
            />

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setModalPago(false)}>Cancelar</Button>
              <Button fullWidth onClick={guardarPago} loading={guardando}>Guardar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
