/** QR code as crisp SVG (dark modules on a white quiet zone, so phones can scan it in dark mode too). */
import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

export function QrCode({ text, size = 200, label, testId }: { text: string; size?: number; label: string; testId?: string }) {
  const { path, n } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { path: d, n: count + 8 };
  }, [text]);
  return (
    <svg className="ui-qr" role="img" aria-label={label} data-testid={testId} width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#1d1a2e" />
    </svg>
  );
}
