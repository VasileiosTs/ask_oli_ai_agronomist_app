interface Props {
  size?: number;
  bg?: string; // background color for the centre circle
}

// The Oli four-petal logo — used everywhere for consistency
// Four petals: vertical (dark green #2D6A4F) + horizontal (primary green #2EA043)
// Centre circle in background color creates the "heart clover" effect
export default function OliLogo({ size = 24, bg = '#0D1117' }: Props) {
  const s = size;
  const c = s / 2;
  const pR = s * 0.22;  // petal minor radius
  const pL = s * 0.31;  // petal major radius
  const off = s * 0.28; // petal center offset from logo center
  const dot = s * 0.16; // centre circle radius

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Vertical petals */}
      <ellipse cx={c} cy={c - off} rx={pR} ry={pL} fill="#2D6A4F"/>
      <ellipse cx={c} cy={c + off} rx={pR} ry={pL} fill="#2D6A4F"/>
      {/* Horizontal petals */}
      <ellipse cx={c - off} cy={c} rx={pL} ry={pR} fill="#2EA043"/>
      <ellipse cx={c + off} cy={c} rx={pL} ry={pR} fill="#2EA043"/>
      {/* Centre */}
      <circle cx={c} cy={c} r={dot} fill={bg}/>
    </svg>
  );
}
