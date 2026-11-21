// NV 色心 ODMR 教学页 —— 画布渲染 + 交互逻辑
// 物理计算全部来自 src/physics.js（与 nv_8peak_field_direction.py 同源）

import { calcPeaks, D0, GAMMA } from './physics.js';
import './esr-split.js';
import './rotating-frame.js';

'use strict';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const AXIS_COLORS = ['#e5484d', '#46a758', '#e7a13c', '#5aa9e6']; // 红/绿/琥珀/蓝

function setupHiDPI(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

// ---------------------------------------------------------------------------
// 四面体 NV 轴向渲染（交互模拟器）
// ---------------------------------------------------------------------------
import { NV_AXES } from './physics.js';

function createTetraViewer(canvas) {
  const state = { yaw: 0.7, pitch: 0.42, dragging: false, autoSpin: !reducedMotion };

  function project(v, w, h) {
    const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
    const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    const x1 = v[0] * cy + v[2] * sy;
    const z1 = -v[0] * sy + v[2] * cy;
    const y1 = v[1] * cp - z1 * sp;
    const z2 = v[1] * sp + z1 * cp;
    const scale = Math.min(w, h) * 0.34;
    const persp = 3.2 / (3.2 - z2);
    return { x: w / 2 + x1 * scale * persp, y: h / 2 - y1 * scale * persp, z: z2 };
  }

  function draw(Bv) {
    const { ctx, w, h } = setupHiDPI(canvas);
    ctx.clearRect(0, 0, w, h);

    const pts = NV_AXES.map(v => project(v, w, h));
    const faces = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];
    const faceDepth = faces.map(f => (pts[f[0]].z + pts[f[1]].z + pts[f[2]].z) / 3);
    const order = faces.map((_, i) => i).sort((a, b) => faceDepth[a] - faceDepth[b]);
    for (const fi of order) {
      const f = faces[fi];
      ctx.beginPath();
      ctx.moveTo(pts[f[0]].x, pts[f[0]].y);
      ctx.lineTo(pts[f[1]].x, pts[f[1]].y);
      ctx.lineTo(pts[f[2]].x, pts[f[2]].y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const c = project([0, 0, 0], w, h);

    pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = AXIS_COLORS[i];
      ctx.lineWidth = 2.2 + p.z * 0.8;
      ctx.globalAlpha = 0.75 + p.z * 0.25;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 + p.z * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = AXIS_COLORS[i];
      ctx.fill();
    });

    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#d8d2c4';
    ctx.fill();

    if (Bv) {
      const n = Math.hypot(...Bv);
      if (n > 1e-9) {
        const dir = Bv.map(v => v / n);
        const tip3 = dir.map(v => v * 1.28);
        const tip = project(tip3, w, h);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.strokeStyle = '#ff5c5c';
        ctx.lineWidth = 3;
        ctx.stroke();
        const perp3 = Math.abs(dir[2]) < 0.9 ? [-dir[1], dir[0], 0] : [1, 0, 0];
        const pn = Math.hypot(...perp3);
        const perp = perp3.map(v => v / pn * 0.12);
        const base3 = tip3.map((v, i) => v - dir[i] * 0.16);
        const w1 = project(base3.map((v, i) => v + perp[i]), w, h);
        const w2 = project(base3.map((v, i) => v - perp[i]), w, h);
        ctx.beginPath();
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(w1.x, w1.y);
        ctx.lineTo(w2.x, w2.y);
        ctx.closePath();
        ctx.fillStyle = '#ff5c5c';
        ctx.fill();
        ctx.fillStyle = '#ff8a8a';
        ctx.font = '13px Consolas, monospace';
        ctx.fillText('B', tip.x + 8, tip.y - 6);
      }
    }

    const L = 1.45;
    const lab = [[L, 0, 0, 'x'], [0, L, 0, 'y'], [0, 0, L, 'z']];
    ctx.font = '11px Consolas, monospace';
    for (const [lx, ly, lz, name] of lab) {
      const p = project([lx, ly, lz], w, h);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(name, p.x + 5, p.y + 4);
    }
  }

  let px = 0, py = 0;
  canvas.addEventListener('pointerdown', e => {
    state.dragging = true; state.autoSpin = false;
    px = e.clientX; py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!state.dragging) return;
    state.yaw += (e.clientX - px) * 0.012;
    state.pitch = Math.max(-1.4, Math.min(1.4, state.pitch + (e.clientY - py) * 0.012));
    px = e.clientX; py = e.clientY;
  });
  const end = () => { state.dragging = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  return { state, draw };
}

// ---------------------------------------------------------------------------
// 交互模拟器
// ---------------------------------------------------------------------------
const sldB = document.getElementById('sldB');
if (sldB) {
  const sldT = document.getElementById('sldT');
  const sldP = document.getElementById('sldP');
  const outB = document.getElementById('outB');
  const outT = document.getElementById('outT');
  const outP = document.getElementById('outP');
  const specEl = document.getElementById('spectrum');
  const simTetraEl = document.getElementById('simTetra');
  const tableBody = document.getElementById('peakTable');
  const simTetra = createTetraViewer(simTetraEl);

  const F_MIN = 2650, F_MAX = 3090;

  function drawSpectrum(rows) {
    const { ctx, w, h } = setupHiDPI(specEl);
    ctx.clearRect(0, 0, w, h);
    const padL = 54, padR = 16, padT = 26, padB = 44;
    const X = f => padL + (f - F_MIN) / (F_MAX - F_MIN) * (w - padL - padR);
    const Y = v => padT + (1 - v) * (h - padT - padB);

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, h - padB); ctx.lineTo(w - padR, h - padB); ctx.stroke();
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let f = 2700; f <= 3050; f += 50) {
      ctx.fillText(String(f), X(f) - 12, h - padB + 16);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.moveTo(X(f), padT); ctx.lineTo(X(f), h - padB); ctx.stroke();
    }
    ctx.fillText('微波频率 (MHz)', w / 2 - 38, h - 8);
    ctx.fillText('荧光', 8, padT + 4);

    ctx.strokeStyle = 'rgba(231,161,60,0.5)';
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(X(D0), padT); ctx.lineTo(X(D0), h - padB); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(231,161,60,0.8)';
    ctx.fillText('D=2870', X(D0) - 20, padT - 8);

    const all = [];
    rows.forEach(r => {
      all.push({ f: r.freqLo, c: AXIS_COLORS[r.axis] });
      all.push({ f: r.freqHi, c: AXIS_COLORS[r.axis] });
    });

    ctx.beginPath();
    for (let px = 0; px <= w - padL - padR; px++) {
      const f = F_MIN + px / (w - padL - padR) * (F_MAX - F_MIN);
      let y = 1;
      for (const p of all) {
        const g = 2.2;
        y -= 0.16 * g * g / ((f - p.f) ** 2 + g * g);
      }
      const sy = Y(Math.max(0.05, y));
      px === 0 ? ctx.moveTo(padL + px, sy) : ctx.lineTo(padL + px, sy);
    }
    ctx.strokeStyle = 'rgba(216,210,196,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (const p of all) {
      const x = X(p.f);
      ctx.strokeStyle = p.c;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, h - padB); ctx.lineTo(x, h - padB - 12); ctx.stroke();
    }
  }

  function updateTable(rows) {
    tableBody.innerHTML = rows.map(r => `
      <tr>
        <td><span class="dot" style="background:${AXIS_COLORS[r.axis]}"></span>轴 ${r.axis + 1}</td>
        <td>${(GAMMA * r.bParallel).toFixed(2)}</td>
        <td>${r.freqLo.toFixed(2)}</td>
        <td>${r.freqHi.toFixed(2)}</td>
      </tr>`).join('');
  }

  function update() {
    const B = parseFloat(sldB.value);
    const th = parseFloat(sldT.value);
    const ph = parseFloat(sldP.value);
    outB.textContent = `${B.toFixed(2)} mT`;
    outT.textContent = `${th}°`;
    outP.textContent = `${ph}°`;

    const rows = calcPeaks(B, th, ph);
    drawSpectrum(rows);
    updateTable(rows);

    const thr = th * Math.PI / 180, phr = ph * Math.PI / 180;
    simTetra.draw([B * Math.sin(thr) * Math.cos(phr), B * Math.sin(thr) * Math.sin(phr), B * Math.cos(thr)]);
  }

  [sldB, sldT, sldP].forEach(el => el.addEventListener('input', update));
  simTetraEl.addEventListener('pointermove', () => { if (simTetra.state.dragging) update(); });
  new ResizeObserver(update).observe(specEl);
  new ResizeObserver(update).observe(simTetraEl);
  update();
}

// ---------------------------------------------------------------------------
// 亮/暗开关演示（教程 §3.2：微波共振时荧光下降）
// ---------------------------------------------------------------------------
const bdSwitch = document.getElementById('bdSwitch');
if (bdSwitch) {
  const bdCanvas = document.getElementById('brightDarkDemo');
  const lblOff = document.getElementById('bdLabelOff');
  const lblOn = document.getElementById('bdLabelOn');
  const bd = { t: 0, particles: [] }; // t: 0 = 失谐(亮)  1 = 共振(暗)

  bdSwitch.addEventListener('change', () => {
    lblOff.classList.toggle('active', !bdSwitch.checked);
    lblOn.classList.toggle('active', bdSwitch.checked);
  });

  function bdFrame(dt) {
    const { ctx, w, h } = setupHiDPI(bdCanvas);
    ctx.clearRect(0, 0, w, h);

    const target = bdSwitch.checked ? 1 : 0;
    bd.t += (target - bd.t) * Math.min(1, dt * 4.5); // 平滑过渡
    const dark = bd.t;
    const fl = 100 - 28 * dark;   // 荧光强度：100% → 72%
    const lum = fl / 100;

    // ================= 左侧：NV 发光示意 =================
    const cx = w * 0.30, cy = h * 0.40;
    const R = Math.min(w, h) * 0.15;

    // 光纤 + 二向色分光镜（激发光与返回荧光共用一根光纤）
    const fb0 = 30, fb1 = cx - R - 10;
    // 二向色分光镜（45° 短线符号）
    ctx.strokeStyle = '#5aa9e6';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(15, cy - 11); ctx.lineTo(25, cy + 11); ctx.stroke();
    // 光纤套管
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(fb0, cy - 9, fb1 - fb0, 18, 9); else ctx.rect(fb0, cy - 9, fb1 - fb0, 18);
    ctx.fill(); ctx.stroke();
    // 绿光入射箭头（光纤上行，向右）
    ctx.strokeStyle = 'oklch(0.75 0.17 150)';
    ctx.fillStyle = 'oklch(0.75 0.17 150)';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(fb0 + 4, cy - 3.5); ctx.lineTo(fb1 - 12, cy - 3.5); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fb1 - 6, cy - 3.5); ctx.lineTo(fb1 - 15, cy - 8); ctx.lineTo(fb1 - 15, cy + 1);
    ctx.closePath(); ctx.fill();
    // 红光返回箭头（光纤下行，向左）
    ctx.strokeStyle = 'oklch(0.68 0.19 25)';
    ctx.fillStyle = 'oklch(0.68 0.19 25)';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(fb1 - 4, cy + 3.5); ctx.lineTo(fb0 + 12, cy + 3.5); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fb0 + 6, cy + 3.5); ctx.lineTo(fb0 + 15, cy - 1); ctx.lineTo(fb0 + 15, cy + 8);
    ctx.closePath(); ctx.fill();

    // NV 红色辉光（随荧光强度变化）
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, R * 1.8);
    glow.addColorStop(0, `rgba(229,72,77,${0.85 * (0.3 + 0.7 * lum)})`);
    glow.addColorStop(0.45, `rgba(229,72,77,${0.35 * (0.25 + 0.75 * lum)})`);
    glow.addColorStop(1, 'rgba(229,72,77,0)');
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = glow; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,140,140,${0.45 + 0.55 * lum})`; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NV', cx, cy + 4);

    // 自旋态标注
    ctx.font = '13px sans-serif';
    if (dark < 0.5) {
      ctx.fillStyle = 'oklch(0.75 0.17 150)';
      ctx.fillText('自旋态 mₛ = 0（亮）', cx, cy + R * 2.0);
    } else {
      ctx.fillStyle = 'oklch(0.68 0.19 25)';
      ctx.fillText('自旋态 mₛ = ±1（暗）', cx, cy + R * 2.0);
    }
    ctx.textAlign = 'left';

    // ISC 暗通道（共振时显现）
    if (dark > 0.05) {
      ctx.save();
      ctx.globalAlpha = dark;
      ctx.strokeStyle = 'oklch(0.70 0.12 310)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.3, cy + R * 0.35);
      ctx.bezierCurveTo(cx - R * 1.7, cy + R * 0.8, cx - R * 1.0, cy + R * 2.3, cx - R * 0.05, cy + R * 1.7);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'oklch(0.70 0.12 310)';
      ctx.font = '12px sans-serif';
      ctx.fillText('系间窜越 ISC：暗通道，不发红光', cx - R * 2.0, cy + R * 1.05);
      ctx.restore();
    }

    // 红色荧光光子（发射速率 ∝ 荧光强度）
    if (bd.particles.length < 160 && Math.random() < 0.95 * lum) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4; // 主要向上方飞出
      const sp = 34 + Math.random() * 52;
      bd.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
    }
    for (let i = bd.particles.length - 1; i >= 0; i--) {
      const p = bd.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.75;
      if (p.life <= 0) { bd.particles.splice(i, 1); continue; }
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,96,96,${0.9 * p.life})`;
      ctx.fill();
    }
    // 光路标注
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'oklch(0.75 0.17 150 / 0.95)';
    ctx.fillText('→ 532 nm 激发光（光纤入射）', 12, cy - 30);
    ctx.fillStyle = 'rgba(255,110,110,0.95)';
    ctx.fillText('← 637 nm 荧光（同一光纤返回）', 12, cy - 15);
    ctx.fillStyle = 'rgba(255,120,120,0.8)';
    ctx.fillText('637 nm 荧光', cx + R * 1.1, cy - R * 1.2);
    // 分光镜脚注（红光远弱于绿光，需按波长分离）
    ctx.fillStyle = '#5aa9e6';
    ctx.fillText('◆ 二向色分光镜：红光远弱于绿光', 12, h - 28);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('靠它按波长把微弱红光分到探测器', 24, h - 11);

    // ================= 右侧：荧光强度表 =================
    const mx = w * 0.68, mw = 36, my0 = h * 0.14, my1 = h * 0.58;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(mx, my0, mw, my1 - my0);
    const fh = (my1 - my0) * lum;
    const grd = ctx.createLinearGradient(0, my1, 0, my0);
    grd.addColorStop(0, 'rgba(229,72,77,0.5)');
    grd.addColorStop(1, 'rgba(229,72,77,0.95)');
    ctx.fillStyle = grd;
    ctx.fillRect(mx + 1, my1 - fh, mw - 2, fh);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px sans-serif';
    ctx.fillText('荧光强度', mx + mw / 2, my0 - 10);
    ctx.fillStyle = dark < 0.5 ? 'oklch(0.75 0.17 150)' : 'oklch(0.68 0.19 25)';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${fl.toFixed(0)}%（${dark < 0.5 ? '亮' : '暗'}）`, mx + mw / 2, my1 + 22);
    ctx.textAlign = 'left';

    // ================= 右下：微型扫频谱 + 频率游标 =================
    const sx0 = w * 0.50, sx1 = w - 20, sy0 = h * 0.74, sy1 = h - 36;
    const F0 = 2800, F1 = 2940;
    const X = f => sx0 + (f - F0) / (F1 - F0) * (sx1 - sx0);
    const Y = v => sy0 + (1 - v) * (sy1 - sy0);
    const dip = f => { const g = 4.0; return 1 - 0.55 * g * g / ((f - D0) ** 2 + g * g); };

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx0, sy1); ctx.lineTo(sx1, sy1); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('微波频率', (sx0 + sx1) / 2, h - 8);
    for (const f of [2800, 2870, 2940]) ctx.fillText(String(f), X(f), sy1 + 13);
    ctx.textAlign = 'left';

    ctx.beginPath();
    for (let px = 0; px <= sx1 - sx0; px++) {
      const f = F0 + px / (sx1 - sx0) * (F1 - F0);
      const yy = Y(dip(f));
      px === 0 ? ctx.moveTo(sx0 + px, yy) : ctx.lineTo(sx0 + px, yy);
    }
    ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 2; ctx.stroke();

    // 游标：失谐时停在 2810（谱线高位），共振时滑到 2870 凹陷底部
    const fm = 2810 + dark * (D0 - 2810);
    const mxp = X(fm), myp = Y(dip(fm));
    ctx.beginPath(); ctx.arc(mxp, myp, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#e7a13c'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
    ctx.fillStyle = '#e7a13c';
    ctx.font = '12px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(dark > 0.5 ? 'f = D：共振！荧光下跌' : 'f 失谐：荧光保持高位', (sx0 + sx1) / 2, sy0 - 10);
    ctx.textAlign = 'left';
  }

  if (reducedMotion) {
    bdFrame(1);
    bdSwitch.addEventListener('change', () => { bd.t = bdSwitch.checked ? 1 : 0; bdFrame(1); });
    new ResizeObserver(() => bdFrame(1)).observe(bdCanvas);
  } else {
    let last = performance.now();
    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      bdFrame(dt);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }
}
