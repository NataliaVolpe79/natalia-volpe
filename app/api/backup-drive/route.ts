import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { pdf } from '@react-pdf/renderer'
import React from 'react'
import { HistoriaPDF } from './pdf'

export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAIN_FOLDER = 'Backup Historias Clínicas MVN'

async function getOrCreateFolder(drive: ReturnType<typeof google.drive>, name: string, parentId?: string) {
  const q = parentId
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`

  const res = await drive.files.list({ q, fields: 'files(id)', pageSize: 1 })
  if (res.data.files && res.data.files.length > 0) return res.data.files[0].id!

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: 'id',
  })
  return folder.data.id!
}

async function uploadPDF(
  drive: ReturnType<typeof google.drive>,
  name: string,
  folderId: string,
  buffer: Buffer
) {
  // Buscar si ya existe para actualizar en lugar de duplicar
  const res = await drive.files.list({
    q: `name='${name}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id)',
    pageSize: 1,
  })

  const { Readable } = await import('stream')
  const stream = Readable.from(buffer)

  if (res.data.files && res.data.files.length > 0) {
    await drive.files.update({
      fileId: res.data.files[0].id!,
      media: { mimeType: 'application/pdf', body: stream },
    })
  } else {
    await drive.files.create({
      requestBody: { name, mimeType: 'application/pdf', parents: [folderId] },
      media: { mimeType: 'application/pdf', body: stream },
      fields: 'id',
    })
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://natalia-volpe.vercel.app/api/auth-drive/callback'
    )
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN })
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // Obtener datos
    const [{ data: pacientes }, { data: historias }, { data: evoluciones }] = await Promise.all([
      supabaseAdmin.from('pacientes').select('*').order('apellido'),
      supabaseAdmin.from('historias_clinicas').select('*'),
      supabaseAdmin.from('evoluciones').select('*').order('fecha', { ascending: false }),
    ])

    if (!pacientes) return NextResponse.json({ error: 'No data' }, { status: 500 })

    // Carpeta principal
    const mainFolderId = await getOrCreateFolder(drive, MAIN_FOLDER)

    const fecha = new Date().toISOString().slice(0, 10)
    let ok = 0
    let errors = 0

    // Procesar en lotes de 10 para no saturar
    const BATCH = 10
    for (let i = 0; i < pacientes.length; i += BATCH) {
      const lote = pacientes.slice(i, i + BATCH)
      await Promise.all(lote.map(async (p) => {
        try {
          const historia = (historias || []).find((h: { paciente_id: string }) => h.paciente_id === p.id) || null
          const evos = (evoluciones || []).filter((e: { paciente_id: string }) => e.paciente_id === p.id)

          const folderName = `${p.apellido}, ${p.nombre}`
          const patientFolderId = await getOrCreateFolder(drive, folderName, mainFolderId)

          const datos = historia?.datos || {}
          const element = React.createElement(HistoriaPDF, { paciente: p, datos, evoluciones: evos, fecha })
          const pdfBuffer = await pdf(element as unknown as Parameters<typeof pdf>[0]).toBuffer()

          await uploadPDF(drive, 'historia-clinica.pdf', patientFolderId, Buffer.from(pdfBuffer))
          ok++
        } catch {
          errors++
        }
      }))
    }

    return NextResponse.json({ ok: true, procesados: ok, errores: errors, fecha })
  } catch (err) {
    console.error('Error backup:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
