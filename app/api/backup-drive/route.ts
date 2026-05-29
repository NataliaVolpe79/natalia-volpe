import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID

    if (!credentialsJson || !folderId) {
      return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
    }

    const credentials = JSON.parse(credentialsJson)
    const googleAuth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
    const drive = google.drive({ version: 'v3', auth: googleAuth })

    // Verificar que la carpeta es accesible
    await drive.files.get({
      fileId: folderId,
      fields: 'id',
      supportsAllDrives: true,
    })

    // Obtener todos los datos de Supabase
    const [{ data: pacientes }, { data: historias }, { data: evoluciones }] = await Promise.all([
      supabaseAdmin.from('pacientes').select('*').order('apellido'),
      supabaseAdmin.from('historias_clinicas').select('*'),
      supabaseAdmin.from('evoluciones').select('*').order('fecha', { ascending: false }),
    ])

    const backup = {
      fecha_backup: new Date().toISOString(),
      total_pacientes: pacientes?.length ?? 0,
      pacientes: (pacientes ?? []).map(p => ({
        ...p,
        historia: (historias ?? []).find((h: { paciente_id: string }) => h.paciente_id === p.id) ?? null,
        evoluciones: (evoluciones ?? []).filter((e: { paciente_id: string }) => e.paciente_id === p.id),
      })),
    }

    const contenido = JSON.stringify(backup, null, 2)
    const fecha = new Date().toISOString().slice(0, 10)
    const nombre = `backup-historias-${fecha}.json`

    const { data: archivo } = await drive.files.create({
      requestBody: {
        name: nombre,
        mimeType: 'application/json',
        parents: [folderId],
      },
      media: {
        mimeType: 'application/json',
        body: contenido,
      },
      fields: 'id, name',
      supportsAllDrives: true,
    })

    return NextResponse.json({
      ok: true,
      archivo: archivo.name,
      id: archivo.id,
      pacientes: backup.total_pacientes,
    })
  } catch (err) {
    console.error('Error backup:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
