'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Calendar, Phone, MessageCircle, Star, ClipboardList } from 'lucide-react'
import Button from '@/components/ui/Button'

const NOMBRE_DOCTORA = process.env.NEXT_PUBLIC_NOMBRE_DOCTORA || 'Dra. Natalia Hebe Volpe'
const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_CONTACTO || '549XXXXXXXXXX'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xl font-bold">N</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Médica Psiquiatra</p>
              <p className="text-base font-bold text-gray-900 leading-tight">{NOMBRE_DOCTORA}</p>
            </div>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </a>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 max-w-lg mx-auto px-6 py-10 flex flex-col items-center text-center gap-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
            <Calendar className="w-12 h-12 text-blue-600" />
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Sacá tu turno
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">
              Reservá tu consulta de manera fácil y rápida.
              Te avisamos por WhatsApp antes de tu cita.
            </p>
          </div>

          <Link href="/sacar-turno" className="w-full">
            <Button size="lg" fullWidth className="text-xl py-5 shadow-lg shadow-blue-200">
              <Calendar className="w-6 h-6" />
              Sacar turno
            </Button>
          </Link>

          <Link href="/mis-turnos" className="w-full">
            <Button size="lg" fullWidth variant="secondary" className="text-xl py-5">
              <ClipboardList className="w-6 h-6" />
              Ver mis turnos
            </Button>
          </Link>
        </motion.div>

        {/* Info cards */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full grid gap-4"
        >
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <Star className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-900 text-lg">Recordatorio automático</p>
              <p className="text-gray-500 text-base mt-1">
                Te avisamos por WhatsApp 24 horas y 1 hora antes de tu turno.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <span className="text-2xl">💻</span>
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-900 text-lg">Presencial o videollamada</p>
              <p className="text-gray-500 text-base mt-1">
                Viernes: atención presencial. Lunes a jueves: por videollamada.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Contacto */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full"
        >
          <p className="text-gray-500 mb-3 text-base">¿Preferís contactarte directamente?</p>
          <a
            href={`https://wa.me/${WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-green-50 hover:bg-green-100 border border-green-200 text-green-800 font-semibold px-6 py-4 rounded-2xl text-lg w-full justify-center transition-colors"
          >
            <Phone className="w-5 h-5" />
            Escribir por WhatsApp
          </a>
        </motion.div>
      </main>

      <footer className="text-center py-6 text-sm text-gray-400">
        <p>{NOMBRE_DOCTORA}</p>
        <p>Médica Psiquiatra · Buenos Aires</p>
      </footer>
    </div>
  )
}
