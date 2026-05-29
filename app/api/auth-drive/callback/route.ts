import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'No code received' }, { status: 400 })
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://natalia-volpe.vercel.app/api/auth-drive/callback'
  )

  const { tokens } = await oauth2Client.getToken(code)

  return NextResponse.json({
    mensaje: 'Copiá el refresh_token y agregalo en Vercel como GOOGLE_DRIVE_REFRESH_TOKEN',
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
  })
}
