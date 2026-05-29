import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://natalia-volpe.vercel.app/api/auth-drive/callback'
  )

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive'],
  })

  return NextResponse.redirect(url)
}
