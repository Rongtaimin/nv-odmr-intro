// 单条 NV 轴：ESR 频率曲线与 ODMR 双峰联动图
import { calcSingleAxisPeaks, D0 } from './physics.js';

const canvas = document.getElementById('esrSplitDemo');
if (canvas) {
  const slider = document.getElementById('esrB');
  const bOut = document.getElementById('esrBOut');
  const loOut = document.getElementById('esrLo');
  const hiOut = document.getElementById('esrHi');
  const deltaOut = document.getElementById('esrDelta');
  const angleButtons = [...document.querySelectorAll('[data-esr-angle]')];
  const state = { B: Number(slider.value), theta: 45 };
  const COLORS = { lo: '#5aa9e6', hi: '#e7a13c', ink: '#d8d2c4', muted: 'rgba(216,210,196,0.48)' };
  const curves = new Map([0, 45, 90].map(theta => [theta, Array.from({ length: 121 }, (_, i) => {
    const B = i * 0.25;
    return { B, ...calcSingleAxisPeaks(B, theta) };
  })]));

  function setupCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function line(ctx, x1, y1, x2, y2, color, width = 1, dash = []) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
  }

  function text(ctx, value, x, y, color = COLORS.muted, align = 'left', font = '11px sans-serif') {
    ctx.fillStyle = color; ctx.font = font; ctx.textAlign = align; ctx.fillText(value, x, y); ctx.textAlign = 'left';
  }

  function drawAxes(ctx, plot, xTicks, yTicks, xMap, yMap) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (const tick of yTicks) {
      const y = yMap(tick);
      line(ctx, plot.x, y, plot.x + plot.w, y, 'rgba(255,255,255,0.08)');
      text(ctx, tick.toFixed(1), plot.x - 9, y + 4, COLORS.muted, 'right', '11px Consolas,monospace');
    }
    for (const tick of xTicks) {
      const x = xMap(tick);
      line(ctx, x, plot.y, x, plot.y + plot.h, 'rgba(255,255,255,0.06)');
      text(ctx, String(tick), x, plot.y + plot.h + 20, COLORS.muted, 'center', '11px Consolas,monospace');
    }
    line(ctx, plot.x, plot.y, plot.x, plot.y + plot.h, 'rgba(255,255,255,0.35)');
    line(ctx, plot.x, plot.y + plot.h, plot.x + plot.w, plot.y + plot.h, 'rgba(255,255,255,0.35)');
  }

  function draw() {
    const { ctx, w, h } = setupCanvas();
    ctx.clearRect(0, 0, w, h);
    const peaks = calcSingleAxisPeaks(state.B, state.theta);
    const lo = peaks.freqLo / 1000, hi = peaks.freqHi / 1000;
    const compact = w < 600;
    // 窄屏仍保持左右对应：压缩 ODMR 图与图间距，而不是上下堆叠。
    const left = compact
      ? { x: 32, y: 54, w: (w - 70) * 0.18, h: h - 120 }
      : { x: 54, y: 56, w: (w - 110) * 0.19, h: h - 116 };
    const gap = compact ? 34 : 80;
    const right = {
      x: left.x + left.w + gap,
      y: compact ? 54 : 56,
      w: w - (left.x + left.w + gap) - (compact ? 10 : 28),
      h: h - (compact ? 120 : 116),
    };
    const F_MIN = 2, F_MAX = 3.8;
    // ODMR 图旋转 90°：横轴为荧光强度，竖轴为频率，与 ESR 图同高对应。
    const XL = v => left.x + (1.04 - v) / (1.04 - 0.56) * left.w;
    const YL = f => left.y + (F_MAX - f) / (F_MAX - F_MIN) * left.h;
    const XB = B => right.x + B / 30 * right.w;
    const YF = f => right.y + (F_MAX - f) / (F_MAX - F_MIN) * right.h;

    text(ctx, 'ODMR 频谱', left.x, 27, COLORS.ink, 'left', compact ? '600 11px sans-serif' : '600 14px sans-serif');
    text(ctx, compact ? 'ESR 频率' : 'ESR 频率随磁场变化', right.x, 27, COLORS.ink, 'left', compact ? '600 11px sans-serif' : '600 14px sans-serif');
    text(ctx, compact ? `θ=${state.theta}°` : `当前 θ = ${state.theta}°`, right.x + right.w, 27, '#a9d89d', 'right', compact ? '10px sans-serif' : '12px sans-serif');

    drawAxes(ctx, left, compact ? [0.6, 1.0] : [0.6, 0.8, 1.0], compact ? [2, 2.9, 3.8] : [2, 2.3, 2.6, 2.9, 3.2, 3.5, 3.8], XL, YL);
    drawAxes(ctx, right, compact ? [0, 15, 30] : [0, 5, 10, 15, 20, 25, 30], compact ? [2, 2.9, 3.8] : [2, 2.3, 2.6, 2.9, 3.2, 3.5, 3.8], XB, YF);
    text(ctx, compact ? '荧光' : '荧光强度', left.x + left.w / 2, left.y + left.h + (compact ? 38 : 43), COLORS.muted, 'center', compact ? '10px sans-serif' : '11px sans-serif');
    text(ctx, compact ? 'B (mT)' : '磁场 B (mT)', right.x + right.w / 2, right.y + right.h + (compact ? 38 : 43), COLORS.muted, 'center', compact ? '10px sans-serif' : '11px sans-serif');

    ctx.save(); ctx.translate(compact ? 9 : 15, left.y + left.h / 2); ctx.rotate(-Math.PI / 2);
    text(ctx, compact ? 'GHz' : '频率 (GHz)', 0, 0, COLORS.muted, 'center', compact ? '10px sans-serif' : '11px sans-serif'); ctx.restore();
    ctx.save(); ctx.translate(right.x - (compact ? 26 : 38), right.y + right.h / 2); ctx.rotate(-Math.PI / 2);
    text(ctx, compact ? 'GHz' : 'ESR 频率 (GHz)', 0, 0, COLORS.muted, 'center', compact ? '10px sans-serif' : '11px sans-serif'); ctx.restore();

    // 零场劈裂参考线贯穿两张频率图。
    line(ctx, left.x, YL(D0 / 1000), left.x + left.w, YL(D0 / 1000), 'rgba(231,161,60,0.28)', 1, [4, 5]);
    line(ctx, right.x, YF(D0 / 1000), right.x + right.w, YF(D0 / 1000), 'rgba(231,161,60,0.28)', 1, [4, 5]);
    text(ctx, 'D', right.x + 5, YF(D0 / 1000) - 6, 'rgba(231,161,60,0.8)');

    // 三个角度的参考曲线；当前角度使用双峰的同色高亮。
    for (const [theta, samples] of curves) {
      const active = theta === state.theta;
      for (const branch of ['freqLo', 'freqHi']) {
        ctx.beginPath();
        samples.forEach((p, i) => {
          const x = XB(p.B), y = YF(p[branch] / 1000);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.strokeStyle = active ? COLORS[branch === 'freqLo' ? 'lo' : 'hi'] : 'rgba(216,210,196,0.19)';
        ctx.lineWidth = active ? (compact ? 1.8 : 2.4) : 1.2;
        ctx.stroke();
      }
    }

    // 当前磁场游标。
    line(ctx, XB(state.B), right.y, XB(state.B), right.y + right.h, 'rgba(169,216,157,0.55)', 1.2, [5, 4]);
    text(ctx, compact ? `${state.B.toFixed(1)}` : `${state.B.toFixed(1)} mT`, Math.min(right.x + right.w - 4, Math.max(right.x + 4, XB(state.B))), right.y + 14,
      '#a9d89d', state.B > 24 ? 'right' : state.B < 3 ? 'left' : 'center', compact ? '9px Consolas,monospace' : '11px Consolas,monospace');

    // 旋转后的 ODMR 荧光谱：共振凹陷向右伸出，峰位与 ESR 点水平对齐。
    const width = 0.014;
    const degenerate = Math.abs(hi - lo) < 0.002;
    const depth = degenerate ? 0.15 : 0.29;
    const fluorescence = f => 1
      - depth * width * width / ((f - lo) ** 2 + width * width)
      - depth * width * width / ((f - hi) ** 2 + width * width);
    ctx.beginPath();
    for (let py = 0; py <= left.h; py++) {
      const f = F_MAX - py / left.h * (F_MAX - F_MIN);
      const x = XL(fluorescence(f)), y = left.y + py;
      py === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = COLORS.ink; ctx.lineWidth = compact ? 1.6 : 2; ctx.stroke();

    const points = [
      { key: 'lo', f: lo, label: 'fₗ', color: COLORS.lo },
      { key: 'hi', f: hi, label: 'fᵤ', color: COLORS.hi },
    ];
    for (const p of points) {
      const lx = XL(fluorescence(p.f)), ly = YL(p.f);
      const rx = XB(state.B), ry = YF(p.f);
      // 两图频率轴同向同高，对应点用水平虚线连接。
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry);
      ctx.strokeStyle = p.color; ctx.globalAlpha = compact ? 0.45 : 0.55; ctx.lineWidth = 1.2; ctx.setLineDash([4, 5]); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(lx, ly, compact ? 4 : 5, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
      ctx.beginPath(); ctx.arc(rx, ry, compact ? 4.5 : 5.5, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
      ctx.strokeStyle = 'rgba(20,20,18,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();
      if (!compact && (!degenerate || p.key === 'lo')) {
        text(ctx, degenerate ? 'fₗ = fᵤ' : p.label, lx, ly - 12, p.color, 'center', '600 13px sans-serif');
        text(ctx, `${p.label} = ${p.f.toFixed(3)}`, rx + (state.B > 25 ? -9 : 9), ry - 9,
          p.color, state.B > 25 ? 'right' : 'left', '12px Consolas,monospace');
      }
    }
  }

  function update() {
    state.B = Number(slider.value);
    const peaks = calcSingleAxisPeaks(state.B, state.theta);
    bOut.textContent = `${state.B.toFixed(1)} mT`;
    loOut.textContent = `${(peaks.freqLo / 1000).toFixed(3)} GHz`;
    hiOut.textContent = `${(peaks.freqHi / 1000).toFixed(3)} GHz`;
    deltaOut.textContent = `${(peaks.freqHi - peaks.freqLo).toFixed(1)} MHz`;
    canvas.setAttribute('aria-label', `磁场 ${state.B.toFixed(1)} 毫特斯拉，夹角 ${state.theta} 度。低支频率 ${(peaks.freqLo / 1000).toFixed(3)} GHz，高支频率 ${(peaks.freqHi / 1000).toFixed(3)} GHz。左图两个 ODMR 峰与右图曲线圆点一一对应。`);
    draw();
  }

  slider.addEventListener('input', update);
  angleButtons.forEach(button => button.addEventListener('click', () => {
    state.theta = Number(button.dataset.esrAngle);
    angleButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    update();
  }));
  new ResizeObserver(draw).observe(canvas);
  update();
}
