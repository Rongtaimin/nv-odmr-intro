// NV 色心物理引擎：正向八峰计算 + 八峰反演磁场
// 与 nv_8peak_field_direction.py 同源：
//   H = D·Sz² + E·(Sx²−Sy²) + γB·S，对 4 个 NV 轴向分别对角化。
// 反演：多起点 Levenberg-Marquardt 最小二乘 (B, θ, φ, D)，E 固定。

export const D0 = 2870.0;          // 零场劈裂 (MHz)
export const E_STRAIN = 4.0;       // 横向应变 (MHz)
export const GAMMA = 28.02495;     // 旋磁比 (MHz/mT)
const SQ2 = Math.SQRT2;

// 3x3 Hermitian 本征值（解析三次方程法，已与 numpy 逐位核对）
function eig3(a, b, f, cRe, cIm, dRe, dIm, eRe, eIm) {
  const cc = cRe * cRe + cIm * cIm, dd = dRe * dRe + dIm * dIm, ee = eRe * eRe + eIm * eIm;
  const e1 = a + b + f;
  const trH2 = a * a + b * b + f * f + 2 * (cc + dd + ee);
  const e2 = (e1 * e1 - trH2) / 2;
  const M11 = b * f - ee;
  const m12re = cRe * f - (eRe * dRe + eIm * dIm);
  const m12im = -cIm * f - (eIm * dRe - eRe * dIm);
  const m13re = (cRe * eRe - cIm * eIm) - b * dRe;
  const m13im = -(cRe * eIm + cIm * eRe) + b * dIm;
  const e3 = a * M11 - (cRe * m12re - cIm * m12im) + (dRe * m13re - dIm * m13im);
  const p = e2 - e1 * e1 / 3;
  const q = -2 * e1 * e1 * e1 / 27 + e1 * e2 / 3 - e3;
  const m = 2 * Math.sqrt(-p / 3);
  const arg = Math.max(-1, Math.min(1, (3 * q) / (2 * p) * Math.sqrt(-3 / p)));
  const t = Math.acos(arg);
  const r = [];
  for (let k = 0; k < 3; k++) r.push(m * Math.cos((t - 2 * Math.PI * k) / 3) + e1 / 3);
  return r.sort((x, y) => x - y);
}

function nvEigen(Bx, By, Bz, D = D0, E = E_STRAIN) {
  return eig3(D + GAMMA * Bz, 0, D - GAMMA * Bz,
    GAMMA * Bx / SQ2, -GAMMA * By / SQ2,
    E, 0,
    GAMMA * Bx / SQ2, -GAMMA * By / SQ2);
}

export const NV_AXES = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]]
  .map(v => { const n = Math.hypot(...v); return v.map(x => x / n); });

const dot3 = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

// 每个 NV 轴一对峰；返回 [{freqLo, freqHi, bParallel}, ...]
export function calcPeaks(B, thDeg, phDeg, D = D0) {
  const th = thDeg * Math.PI / 180, ph = phDeg * Math.PI / 180;
  const Bv = [B * Math.sin(th) * Math.cos(ph), B * Math.sin(th) * Math.sin(ph), B * Math.cos(th)];
  return NV_AXES.map((z, i) => {
    let x = [-z[1], z[0], 0];
    const nx = Math.hypot(...x);
    if (nx < 1e-12) x = [1, 0, 0]; else x = x.map(v => v / nx);
    const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    const ev = nvEigen(dot3(Bv, x), dot3(Bv, y), dot3(Bv, z), D);
    return { axis: i, bParallel: dot3(Bv, z), freqLo: ev[1] - ev[0], freqHi: ev[2] - ev[0] };
  });
}

// 8 个峰（升序），供反演残差使用
export function calc8(B, thRad, phRad, D) {
  const rows = calcPeaks(B, thRad * 180 / Math.PI, phRad * 180 / Math.PI, D);
  const f = [];
  rows.forEach(r => { f.push(r.freqLo, r.freqHi); });
  return f.sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// 反演：多起点 LM
// ---------------------------------------------------------------------------

// 4x4 高斯消元解 (JᵀJ + λI)δ = -Jᵀr
function solve4(A, b) {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 4; col++) {
    let piv = col;
    for (let r = col + 1; r < 4; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-14) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < 4; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c < 5; c++) M[r][c] -= f * M[col][c];
    }
  }
  return [0, 1, 2, 3].map(i => M[i][4] / M[i][i]);
}

function residuals(p, targets) {
  const calc = calc8(p[0], p[1], p[2], p[3]);
  return calc.map((c, i) => c - targets[i]);
}

function sumSq(r) { return r.reduce((s, v) => s + v * v, 0); }

function lmSolve(targets, seed) {
  let p = [...seed];
  let r = residuals(p, targets);
  let cost = sumSq(r);
  let lambda = 1e-3;
  const BOUNDS = [[0, 50], [0, Math.PI], [-Math.PI, Math.PI], [2850, 2890]];
  const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));

  for (let iter = 0; iter < 100; iter++) {
    // 数值雅可比（中心差分）
    const J = [];
    for (let j = 0; j < 4; j++) {
      const h = Math.max(1e-6, Math.abs(p[j]) * 1e-6);
      const pp = [...p], pm = [...p];
      pp[j] += h; pm[j] -= h;
      const rp = residuals(pp, targets), rm = residuals(pm, targets);
      J.push(rp.map((v, i) => (v - rm[i]) / (2 * h)));
    }
    // JᵀJ 与 Jᵀr
    const JTJ = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    const JTr = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        JTJ[i][j] = J[i].reduce((s, v, k) => s + v * J[j][k], 0);
      }
      JTr[i] = J[i].reduce((s, v, k) => s + v * r[k], 0);
    }
    const A = JTJ.map((row, i) => row.map((v, j) => v + (i === j ? lambda : 0)));
    const delta = solve4(A, JTr.map(v => -v));
    if (!delta) return null;
    const pNew = p.map((v, j) => clamp(v + delta[j], BOUNDS[j]));
    const costNew = sumSq(residuals(pNew, targets));
    if (costNew < cost) {
      const rel = (cost - costNew) / (cost + 1e-30);
      p = pNew; cost = costNew; lambda = Math.max(1e-9, lambda * 0.3);
      r = residuals(p, targets);
      if (rel < 1e-12) break;
    } else {
      lambda *= 5;
      if (lambda > 1e9) break;
    }
  }
  return { p, cost };
}

/**
 * 八峰反演磁场。
 * @param {number[]} peaksMhz 8 个共振峰频率 (MHz, 顺序任意)
 * @returns {{B_mT:number, theta_deg:number, phi_deg:number, D_MHz:number,
 *            Bx_mT:number, By_mT:number, Bz_mT:number, rms_MHz:number}}
 */
export function invertField(peaksMhz) {
  const targets = [...peaksMhz].map(Number).sort((a, b) => a - b);
  if (targets.length !== 8 || targets.some(v => !isFinite(v))) {
    throw new Error('需要 8 个有效频率数值');
  }
  const span = targets[7] - targets[0];
  const bEst = Math.min(45, Math.max(0.02, span / (2 * GAMMA)));

  // 丰富多起点：B 缩放 × 极角 × 方位角，覆盖小磁场与近垂直等病态情形
  const seeds = [];
  for (const bMul of [0.5, 1.0, 2.0]) {
    for (const thDeg of [20, 35, 54.7, 75, 90]) {
      for (let phDeg = 0; phDeg < 360; phDeg += 30) {
        seeds.push([bEst * bMul, thDeg * Math.PI / 180, phDeg * Math.PI / 180, D0]);
      }
    }
  }
  let best = null;
  for (const s of seeds) {
    const res = lmSolve(targets, s);
    if (res && (!best || res.cost < best.cost)) best = res;
  }
  if (!best) throw new Error('求解失败，请检查输入数据');

  const [B, th, ph, D] = best.p;
  const rms = Math.sqrt(best.cost / 8);
  return {
    B_mT: B,
    theta_deg: th * 180 / Math.PI,
    phi_deg: ((ph * 180 / Math.PI) % 360 + 360) % 360,
    D_MHz: D,
    Bx_mT: B * Math.sin(th) * Math.cos(ph),
    By_mT: B * Math.sin(th) * Math.sin(ph),
    Bz_mT: B * Math.cos(th),
    rms_MHz: rms,
  };
}
