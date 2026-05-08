import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
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
          borderRadius: '18%',
        }}
      >
        <span style={{ color: 'white', fontSize: 240, fontWeight: 800, fontFamily: 'sans-serif', letterSpacing: -8 }}>
          NV
        </span>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
