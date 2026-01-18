/**
 * Shared helpers for Tier 3 debug overlays.
 */

export function drawLegend(ctx, title, titleColor = 'rgba(255,255,255,0.9)', items = null) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(8, 8, 180, items ? (items.length * 16 + 34) : 40);
  ctx.fillStyle = titleColor;
  ctx.font = '12px Space Mono';
  ctx.fillText(title, 12, 26);

  if (items && Array.isArray(items)) {
    ctx.font = '10px Space Mono';
    let y = 44;
    for (const it of items) {
      if (it.color) {
        const c = it.color;
        ctx.fillStyle = Array.isArray(c) ? `rgba(${c[0]},${c[1]},${c[2]},${(c[3]||255)/255})` : c;
        ctx.fillText('■', 12, y);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(it.label, 28, y);
      } else {
        ctx.fillStyle = it.color || 'rgba(255,255,255,0.9)';
        ctx.fillText(`${it.symbol || ''} ${it.label}`, 12, y);
      }
      y += 16;
    }
  }
  ctx.restore();
}

export function getEventEmoji(type) {
  const map = {
    volcanic_eruption: '🌋',
    supervolcano: '💥',
    asteroid_impact: '☄️',
    glacial_advance: '❄️',
    glacial_retreat: '🌊'
  };
  return map[type] || '⚠️';
}

export function getEventColor(type) {
  const map = {
    volcanic_eruption: 'rgba(255,100,0,0.95)',
    supervolcano: 'rgba(255,0,0,0.95)',
    asteroid_impact: 'rgba(200,0,200,0.95)',
    glacial_advance: 'rgba(100,200,255,0.95)',
    glacial_retreat: 'rgba(100,150,255,0.95)'
  };
  return map[type] || 'rgba(255,255,255,0.95)';
}

export function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}