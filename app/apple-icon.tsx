import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#06b6d4',
        }}
      >
        <span style={{ color: 'white', fontSize: 88, fontWeight: 800, fontFamily: 'sans-serif', letterSpacing: -4 }}>
          NV
        </span>
      </div>
    ),
    { width: 180, height: 180 }
  )
}
