// Oli clover mark — four heart-shaped petals from the official Oli brand design system.
// Paths are in original 0..1024 coordinate space (center at CX,CY).
// The group transform normalises them into a −115..115 viewBox.

const PETALS = [
  // petal 0 — top
  'M485.364349,126.635529 C493.483337,134.800385 501.486481,142.587433 509.158356,150.688248 C512.278076,153.982437 514.235291,153.549149 517.170288,150.477722 C525.684509,141.567917 534.386841,132.830750 543.203735,124.218674 C571.364746,96.711922 613.776672,95.596962 643.852722,121.216347 C664.958313,139.194534 675.638123,162.291412 675.849670,189.550858 C676.045715,214.806061 667.021423,237.189331 649.060425,255.370804 C617.451660,287.367493 585.632263,319.155975 553.960327,351.090332 C541.527771,363.625916 529.155457,376.225067 516.977173,389.006317 C513.898560,392.237335 512.050232,392.077454 509.004822,388.989410 C465.261871,344.633423 421.361816,300.432404 377.607697,256.087372 C359.840607,238.080322 350.351013,216.068756 350.196533,190.959351 C349.918091,145.700668 380.499146,111.931267 416.539764,104.584862 C443.344727,99.121025 466.191986,106.737442 485.364349,126.635529Z',
  // petal 1 — right
  'M685.529907,562.562134 C678.260742,558.614319 672.183960,553.663635 666.667908,548.087219 C623.319824,504.264465 580.062195,460.352234 536.674194,416.569031 C533.613831,413.480713 534.726135,411.782471 537.200073,409.282227 C573.054932,373.045624 608.825806,336.726013 644.644714,300.453796 C654.939026,290.029205 664.634338,278.986786 675.798950,269.453247 C703.995361,245.376160 742.431946,240.338852 774.185913,257.594299 C801.717346,272.555176 815.603333,296.646057 817.320923,327.820312 C818.347839,346.460236 814.255981,363.760345 802.015808,378.181610 C794.382629,387.175018 785.688721,395.279785 777.329590,403.642151 C768.332214,412.643005 770.389404,411.441132 777.318542,418.626068 C783.794312,425.340820 790.221741,432.102661 796.740173,438.775726 C814.292114,456.744202 819.890137,478.501099 815.885376,502.687775 C809.803162,539.421509 783.047913,566.419250 746.425659,573.606812 C724.866882,577.838013 704.784241,573.380127 685.529907,562.562134Z',
  // petal 2 — left
  'M445.194946,461.179871 C419.360260,487.226868 393.580566,512.831665 368.276581,538.898315 C357.991577,549.493286 347.588806,559.577454 334.100555,566.092346 C280.944519,591.766785 219.583862,560.441467 210.035431,502.205444 C206.075287,478.052399 211.833496,456.245483 229.584625,438.398346 C236.987274,430.955719 244.242279,423.366302 251.574463,415.853424 C256.082764,411.234039 256.109406,411.224426 251.419312,406.467590 C244.749619,399.702972 238.162689,392.851532 231.340622,386.243439 C215.471497,370.872040 208.289597,352.228271 208.573975,330.153900 C209.056702,292.679688 233.012192,260.113159 269.124390,250.599716 C299.862305,242.502075 328.107147,249.246735 351.356323,270.777771 C373.463257,291.251007 394.040009,313.379456 415.230804,334.838165 C439.703156,359.619873 464.052521,384.523499 488.620911,409.209351 C491.723877,412.327179 491.840515,414.126343 488.712830,417.232300 C474.169006,431.675201 459.844360,446.338806 445.194946,461.179871Z',
  // petal 3 — bottom
  'M498.790283,447.790771 C501.984192,444.594208 504.927216,441.646942 507.859314,438.688873 C512.999329,433.503387 512.965332,433.531342 518.265686,438.906616 C533.938660,454.800873 549.596069,470.710876 565.337524,486.537140 C592.008362,513.351746 618.788269,540.057861 645.432495,566.898804 C682.119446,603.856628 681.770203,662.490784 644.151306,698.566284 C615.696228,725.854004 571.819336,729.114929 541.630554,699.280701 C533.572998,691.317810 525.250488,683.615723 517.375183,675.478943 C513.722473,671.704956 511.305664,672.431458 508.003601,675.807678 C499.617584,684.381897 491.054016,692.789856 482.373596,701.067261 C458.262726,724.058838 423.697723,726.190796 395.589233,709.072388 C359.188995,686.904175 343.732117,640.005005 359.107239,600.210449 C364.121185,587.233154 371.486420,575.917603 381.232239,566.100769 C420.317780,526.730469 459.431335,487.388000 498.790283,447.790771Z',
] as const;

// Original path coordinate constants (from oli-petals.js)
const CX = 512.982712;
const CY = 412.3559454;
const SC = 0.34726718334730355;

/** Returns true when a hex colour is perceptually dark (luminance < 50%). */
function isDark(hex: string): boolean {
  if (!hex || hex === 'transparent' || !hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

interface Props {
  /** Icon size in px (width = height). Default 24. */
  size?: number;
  /** Background colour of the surface this mark sits on.
   *  Used only to auto-select light vs dark ink — no circle is drawn.
   *  Pass the exact background hex so the mark is legible. */
  bg?: string;
  /** Explicit fill colour — overrides the bg-derived auto colour. */
  color?: string;
  /** Built-in animation variant. 'cascade' = sequential petal pulse (loading).
   *  The external 'animate-oli-think' Tailwind class can still be applied by the parent. */
  animate?: 'cascade' | 'breathe' | 'none';
}

export default function OliLogo({ size = 24, bg = 'transparent', color, animate = 'none' }: Props) {
  // Auto-select ink: dark background → accent green; light → forest dark
  const fill = color ?? (isDark(bg) ? '#2EA043' : '#194121');
  // Single combined transform: scale(SC) then translate(-CX,-CY)
  const transform = `scale(${SC}) translate(${-CX} ${-CY})`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-115 -115 230 230"
      width={size}
      height={size}
      aria-label="Oli"
      role="img"
    >
      {animate !== 'none' && (
        <style>{`
          .oli-anim-group .petal { transform-box: fill-box; transform-origin: center; }
          ${animate === 'cascade' ? `
            .oli-anim-cascade .petal { animation: oli-cas 1.4s ease-in-out infinite; }
            .oli-anim-cascade .p0 { animation-delay: 0s; }
            .oli-anim-cascade .p1 { animation-delay: .18s; }
            .oli-anim-cascade .p2 { animation-delay: .36s; }
            .oli-anim-cascade .p3 { animation-delay: .54s; }
            @keyframes oli-cas {
              0%,60%,100% { opacity: .28; transform: scale(.88); }
              30%          { opacity: 1;   transform: scale(1); }
            }
          ` : ''}
          ${animate === 'breathe' ? `
            .oli-anim-breathe .petal { animation: oli-breathe 2.6s ease-in-out infinite; }
            @keyframes oli-breathe {
              0%,100% { transform: scale(.94); }
              50%      { transform: scale(1.06); }
            }
          ` : ''}
        `}</style>
      )}
      <g
        className={`oli-anim-group ${animate !== 'none' ? `oli-anim-${animate}` : ''}`}
        transform={transform}
      >
        {PETALS.map((d, i) => (
          <path key={i} className={`petal p${i}`} d={d} fill={fill} />
        ))}
      </g>
    </svg>
  );
}
