// 原理 04：实验室参考系 ↔ 共振旋转参考系。自动播放，无用户控件。
const labSvg = document.getElementById('rfLabSvg');

if (labSvg) {
  const byId = id => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = 190;
  const L = 82;
  const SPEED = 0.8;
  let elapsed = 0;
  let lastTime = null;

  function project(v) {
    return {
      x: C + L * (v[0] + 0.55 * v[1]),
      y: 165 + L * (0.28 * v[1] - v[2]),
    };
  }

  function setVector(id, vector) {
    const p = project(vector);
    const line = byId(id);
    line.setAttribute('x1', C);
    line.setAttribute('y1', 165);
    line.setAttribute('x2', p.x);
    line.setAttribute('y2', p.y);
    return p;
  }

  function setLabel(id, point) {
    const label = byId(id);
    label.setAttribute('x', point.x + 8);
    label.setAttribute('y', point.y - 8);
  }

  function ringPath(z, radius) {
    const points = [];
    for (let i = 0; i <= 72; i += 1) {
      const angle = i / 72 * Math.PI * 2;
      points.push(project([radius * Math.cos(angle), radius * Math.sin(angle), z]));
    }
    return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ') + ' Z';
  }

  function draw() {
    const phi = 0.35 - elapsed * 2.4;
    const theta = 0.45 - elapsed * 0.55;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    const labMu = [sinT * Math.cos(phi), sinT * Math.sin(phi), cosT];
    const labB1 = [0.82 * Math.cos(phi + Math.PI / 2), 0.82 * Math.sin(phi + Math.PI / 2), 0];
    const rotMu = [sinT, 0, cosT];
    const rotB1 = [0, 0.82, 0];

    byId('rfLabPlane').setAttribute('d', ringPath(0, 1.05));
    byId('rfLabCone').setAttribute('d', ringPath(cosT, Math.abs(sinT)));
    setLabel('rfLabMuLabel', setVector('rfLabMu', labMu));
    setLabel('rfLabB1Label', setVector('rfLabB1', labB1));
    setLabel('rfRotMuLabel', setVector('rfRotMu', rotMu));
    setVector('rfRotB1', rotB1);
  }

  draw();
  if (!reducedMotion) {
    function frame(now) {
      if (lastTime !== null) elapsed += Math.min(0.05, (now - lastTime) / 1000) * SPEED;
      lastTime = now;
      draw();
      requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', () => { lastTime = null; });
    requestAnimationFrame(frame);
  }
}
