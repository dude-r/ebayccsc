// Numbered section header: a colored chip + title over a heavy underline.
// `size` toggles between the Full Breakdown (23px chip / 22px title) and the
// slightly smaller Story (22px chip / 21px title) treatments.
export default function SectionHeader({ n, title, accent = '#1B5E43', size = 'lg' }) {
  const chip = size === 'lg' ? 23 : 22
  const titleSize = size === 'lg' ? 22 : 21
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingBottom: 10,
        borderBottom: '2px solid #221F1A',
        marginBottom: size === 'lg' ? 6 : 8,
      }}
    >
      <span
        style={{
          width: chip,
          height: chip,
          borderRadius: 6,
          background: accent,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F4EFDF',
          fontSize: 12,
          fontWeight: 800,
        }}
      >
        {n}
      </span>
      <h2 style={{ margin: 0, fontSize: titleSize, fontWeight: 800, letterSpacing: '-.4px' }}>
        {title}
      </h2>
    </div>
  )
}
