// Versuch 2
// app.js
// Reihen-Auswahl stabil + Zeitlimit + Neigungssteuerung (iPhone).

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  menu: document.getElementById("menu"),
  gamePanel: document.getElementById("gamePanel"),

  taskText: document.getElementById("taskText"),
  msg: document.getElementById("msg"),

  time: document.getElementById("time"),
  timeFill: document.getElementById("timeFill"),

  hearts: document.getElementById("hearts"),
  coins: document.getElementById("coins"),
  combo: document.getElementById("combo"),
  level: document.getElementById("level"),

  btnAll: document.getElementById("btnAll"),
  btnNone: document.getElementById("btnNone"),
  btnStart: document.getElementById("btnStart"),
  btnMenu: document.getElementById("btnMenu"),
  btnNew: document.getElementById("btnNew"),
  btnReset: document.getElementById("btnReset"),

  btnGyro: document.getElementById("btnGyro"),
  btnCal: document.getElementById("btnCal"),
  gyroStatus: document.getElementById("gyroStatus"),

  rowPicks: Array.from(document.querySelectorAll(".rowPick")),
};

const STORE_KEY = "einmaleins_space_gates_v5_gyro";
const DEFAULT_STATE = {
  hearts: 3,
  coins: 0,
  combo: 0,
  level: 1,
  rowsSelected: [1,2,3,4,5,6,7,8,9,10],
};

let state = { ...DEFAULT_STATE, ...(load() ?? {}) };
if (!Array.isArray(state.rowsSelected) || state.rowsSelected.length === 0) state.rowsSelected = [...DEFAULT_STATE.rowsSelected];

let activeRows = [...state.rowsSelected];
let round = null;
let playing = false;

const keys = new Set();
window.addEventListener("keydown", (e) => {
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) e.preventDefault();
  keys.add(e.key);
  if (!playing) return;
  if (e.key.toLowerCase() === "n") newRound();
  if (e.key.toLowerCase() === "r") resetAll();
});
window.addEventListener("keyup", (e) => keys.delete(e.key));

function load(){ try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; } }
function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

// -------- Neigung (Gyro) --------
let gyroEnabled = false;
let lastBeta = null, lastGamma = null;   // rohe Sensorwerte
let zeroBeta = 0, zeroGamma = 0;         // Kalibrierung
let gyroHandlerAttached = false;

function setGyroStatus(text){ ui.gyroStatus.textContent = text; }

function onOrientation(e){
  // beta: vorne/hinten, gamma: links/rechts
  if (typeof e.beta === "number") lastBeta = e.beta;
  if (typeof e.gamma === "number") lastGamma = e.gamma;
}

async function enableGyro(){
  try {
    if (!window.DeviceOrientationEvent) {
      setGyroStatus("Neigung: nicht verfügbar");
      return;
    }

    // iOS: braucht Permission
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== "granted") {
        setGyroStatus("Neigung: abgelehnt");
        return;
      }
    }

    if (!gyroHandlerAttached) {
      window.addEventListener("deviceorientation", onOrientation, true);
      gyroHandlerAttached = true;
    }

    gyroEnabled = true;
    setGyroStatus("Neigung: an (kalibrieren empfohlen)");
  } catch {
    setGyroStatus("Neigung: Fehler/gesperrt");
  }
}

function calibrateGyro(){
  if (!gyroEnabled || lastBeta === null || lastGamma === null) {
    setGyroStatus("Kalibrieren: erst Neigung aktivieren");
    return;
  }
  zeroBeta = lastBeta;
  zeroGamma = lastGamma;
  setGyroStatus("Neigung: kalibriert ✅");
}

// Buttons
ui.btnGyro.addEventListener("click", enableGyro);
ui.btnCal.addEventListener("click", calibrateGyro);

// -------- UI --------
function renderHud(){
  ui.hearts.textContent = state.hearts;
  ui.coins.textContent = state.coins;
  ui.combo.textContent = state.combo;
  ui.level.textContent = state.level;
}

function showMenu(){
  playing = false;
  ui.menu.classList.remove("hidden");
  ui.gamePanel.classList.add("hidden");
  ui.msg.textContent = "";

  const set = new Set(state.rowsSelected || []);
  for (const cb of ui.rowPicks) cb.checked = set.has(Number(cb.value));

  ui.time.textContent = "--";
  ui.timeFill.style.width = "100%";
  setGyroStatus(gyroEnabled ? "Neigung: an" : "Neigung: aus");
  renderHud();
}

function readRowsFromUI(){
  return ui.rowPicks.filter(cb => cb.checked).map(cb => Number(cb.value)).sort((a,b)=>a-b);
}

function startGame(){
  const picked = readRowsFromUI();
  state.rowsSelected = picked.length ? picked : [1,2,3,4,5,6,7,8,9,10];
  activeRows = [...state.rowsSelected];
  save();

  playing = true;
  ui.menu.classList.add("hidden");
  ui.gamePanel.classList.remove("hidden");
  ui.msg.textContent = "";
  setGyroStatus(gyroEnabled ? "Neigung: an" : "Neigung: aus");
  renderHud();
  newRound();
}

function resetAll(){
  state = { ...DEFAULT_STATE };
  activeRows = [...state.rowsSelected];
  save();
  ui.msg.textContent = "Reset!";
  if (playing) newRound(); else showMenu();
}

// Menu buttons
function onTap(el, fn){
  el.addEventListener("click", fn);
  el.addEventListener("touchend", (e) => {
    e.preventDefault();
    fn();
  }, { passive:false });
}

onTap(ui.btnAll, () => ui.rowPicks.forEach(cb => cb.checked = true));
onTap(ui.btnNone, () => ui.rowPicks.forEach(cb => cb.checked = false));
onTap(ui.btnStart, startGame);

// Game buttons
ui.btnMenu.addEventListener("click", () => { save(); showMenu(); });
ui.btnNew.addEventListener("click", () => { if (playing) newRound(); });
ui.btnReset.addEventListener("click", resetAll);

// -------- Frage --------
function makeQuestion(){
  const rows = (activeRows && activeRows.length) ? activeRows : [1,2,3,4,5,6,7,8,9,10];
  const a = rows[randInt(0, rows.length - 1)];
  const b = randInt(1, 10);
  const correct = a * b;

  let wrong = correct;
  while (wrong === correct){
    const delta = randInt(1, 10);
    wrong = clamp(correct + (Math.random() < 0.5 ? -delta : delta), 0, 100);
    if (wrong === correct) wrong = correct + 1;
  }
  return { a, b, correct, wrong };
}

// -------- Welt --------
const TILE = 32, COLS = 12, ROWS = 60;
const WORLD_W = COLS*TILE, WORLD_H = ROWS*TILE;
const TILE_EMPTY=0, TILE_WALL=1, TILE_BREAK=2;

function resizeCanvasToCss(){
  const cssW = canvas.clientWidth;
  const cssH = Math.round(cssW * 1.7);
  canvas.style.height = cssH + "px";
  const targetW = Math.floor(cssW * devicePixelRatio);
  const targetH = Math.floor(cssH * devicePixelRatio);
  if (canvas.width !== targetW || canvas.height !== targetH){
    canvas.width = targetW; canvas.height = targetH;
  }
}
function getViewport(){
  const aspect = canvas.width / canvas.height;
  const viewH = 18*TILE;
  const viewW = viewH * aspect;
  return { w:viewW, h:viewH };
}
function buildMap(level){
  const g = Array.from({length:ROWS}, () => Array(COLS).fill(TILE_EMPTY));
  for (let y=0;y<ROWS;y++){
    for (let x=0;x<COLS;x++){
      if (x===0||x===COLS-1||y===0||y===ROWS-1) g[y][x]=TILE_WALL;
    }
  }
  for (let y=1;y<ROWS-1;y++){ g[y][1]=TILE_WALL; g[y][COLS-2]=TILE_WALL; }
  for (let y=1;y<=5;y++) for (let x=2;x<=COLS-3;x++) g[y][x]=TILE_EMPTY;
  for (let y=ROWS-8;y<=ROWS-2;y++) for (let x=2;x<=COLS-3;x++) g[y][x]=TILE_EMPTY;

  const blocks = clamp(55 + level*6, 55, 140);
  for (let i=0;i<blocks;i++){
    const x = randInt(2, COLS-3);
    const y = randInt(6, ROWS-10);
    if (Math.random()<0.3) continue;
    g[y][x]=TILE_BREAK;
    if (Math.random()<0.35){
      const x2 = clamp(x + (Math.random()<0.5?-1:1), 2, COLS-3);
      if (g[y][x2]===TILE_EMPTY) g[y][x2]=TILE_BREAK;
    }
    if (Math.random()<0.18){
      const y2 = clamp(y+1, 6, ROWS-10);
      if (g[y2][x]===TILE_EMPTY) g[y2][x]=TILE_BREAK;
    }
  }

  const pillars = clamp(10 + Math.floor(level/2), 10, 18);
  for (let i=0;i<pillars;i++){
    const x = randInt(3, COLS-4);
    const y = randInt(8, ROWS-14);
    g[y][x]=TILE_WALL;
    if (Math.random()<0.6) g[y+1][x]=TILE_WALL;
  }
  return g;
}
function tileAt(grid, tx, ty){
  if (ty<0||ty>=ROWS||tx<0||tx>=COLS) return TILE_WALL;
  return grid[ty][tx];
}
function setTile(grid, tx, ty, v){
  if (ty<0||ty>=ROWS||tx<0||tx>=COLS) return;
  grid[ty][tx]=v;
}
function worldToTile(x,y){ return { tx:Math.floor(x/TILE), ty:Math.floor(y/TILE) }; }
function isSolid(t){ return t===TILE_WALL || t===TILE_BREAK; }
function collidesSolid(grid, x, y, r){
  const minX=Math.floor((x-r)/TILE), maxX=Math.floor((x+r)/TILE);
  const minY=Math.floor((y-r)/TILE), maxY=Math.floor((y+r)/TILE);
  for (let ty=minY; ty<=maxY; ty++){
    for (let tx=minX; tx<=maxX; tx++){
      if (isSolid(tileAt(grid,tx,ty))){
        const rx=tx*TILE, ry=ty*TILE;
        const cx=clamp(x,rx,rx+TILE), cy=clamp(y,ry,ry+TILE);
        const dx=x-cx, dy=y-cy;
        if (dx*dx+dy*dy < r*r) return true;
      }
    }
  }
  return false;
}

// -------- Entities / Zeit --------
function spawnTargets(level){
  const n = clamp(6 + Math.floor(level/2), 6, 12);
  const arr = [];
  for (let i=0;i<n;i++){
    const y = randInt(8, ROWS-16)*TILE + TILE/2;
    const xMin=2.5*TILE, xMax=(COLS-2.5)*TILE;
    const x = randInt(Math.floor(xMin), Math.floor(xMax));
    const speed = 55 + Math.random()*40 + level*3;
    arr.push({ x,y, r:12, dir:Math.random()<0.5?-1:1, speed, xMin,xMax, hp:2, hitFlash:0 });
  }
  return arr;
}

function computeTimeLimitSeconds(level){
  return clamp(Math.round(26 + level*1.5), 22, 40);
}

function renderTimeUI(){
  if (!round){ ui.time.textContent="--"; ui.timeFill.style.width="100%"; return; }
  ui.time.textContent = Math.max(0, Math.ceil(round.timeLeft)).toString();
  const pct = clamp(round.timeLeft / round.timeMax, 0, 1);
  ui.timeFill.style.width = (pct*100).toFixed(1) + "%";
}

function newRound(){
  const q = makeQuestion();
  const gateW=4*TILE, gateH=2*TILE, gateY=2*TILE;
  const gateA = { x:2*TILE, y:gateY, w:gateW, h:gateH, label:"A", value:null };
  const gateB = { x:(COLS*TILE)-(2*TILE)-gateW, y:gateY, w:gateW, h:gateH, label:"B", value:null };
  const correctOnA = Math.random()<0.5;
  gateA.value = correctOnA ? q.correct : q.wrong;
  gateB.value = correctOnA ? q.wrong : q.correct;

  const timeMax = computeTimeLimitSeconds(state.level);

  round = {
    q,
    grid: buildMap(state.level),
    gates: { A:gateA, B:gateB },
    ship: { x:WORLD_W/2, y:WORLD_H-5*TILE, r:14, speed:clamp(220+state.level*8,220,320), fireRate:14, fireAcc:0, inv:0 },
    bullets: [],
    targets: spawnTargets(state.level),
    particles: [],
    camY: 0,
    locked: false,
    timeMax,
    timeLeft: timeMax
  };

  ui.taskText.textContent = `${q.a} × ${q.b} = ?   (Reihe: ${q.a}er)`;
  ui.msg.textContent = "";
  renderHud();
  renderTimeUI();
}

function inRect(px,py,r,rect){
  const cx = clamp(px, rect.x, rect.x+rect.w);
  const cy = clamp(py, rect.y, rect.y+rect.h);
  const dx = px-cx, dy = py-cy;
  return (dx*dx+dy*dy) < r*r;
}
function spawnParticles(x,y,n,tint=0){
  for (let i=0;i<n;i++){
    round.particles.push({ x,y, vx:(Math.random()*2-1)*160, vy:(Math.random()*2-1)*160, life:0.6+Math.random()*0.3, tint });
  }
}
function timeoutFail(){
  if (!round || round.locked) return;
  round.locked = true;
  state.combo = 0;
  state.hearts -= 1;
  ui.msg.textContent = "⏱️ Zeit vorbei! Herz -1";
  spawnParticles(round.ship.x, round.ship.y, 22, 2);
  if (state.hearts <= 0){
    ui.msg.textContent = "💥 Game Over. Reset mit 'R'.";
    save(); renderHud();
    return;
  }
  save(); renderHud();
  setTimeout(() => { round.locked=false; newRound(); }, 900);
}
function resolveGate(gate){
  if (!round || round.locked) return;
  round.locked = true;
  const correct = round.q.correct;
  const ok = (gate.value === correct);

  if (ok){
    state.combo += 1;
    const gain = 20 + Math.min(30, state.combo*2);
    state.coins += gain;
    ui.msg.textContent = `✅ Richtig! Tor ${gate.label} (+${gain} Coins)`;
    spawnParticles(round.ship.x, round.ship.y, 36, 1);
    if (state.combo % 3 === 0){
      state.level += 1;
      ui.msg.textContent = `⭐ Level Up! (Level ${state.level})`;
    }
  } else {
    state.combo = 0;
    state.hearts -= 1;
    ui.msg.textContent = `❌ Falsch. ${round.q.a}×${round.q.b}=${correct} (Herz -1)`;
    spawnParticles(round.ship.x, round.ship.y, 20, 2);
    if (state.hearts <= 0){
      ui.msg.textContent = "💥 Game Over. Reset mit 'R'.";
      save(); renderHud();
      return;
    }
  }

  save(); renderHud();
  setTimeout(() => { round.locked=false; newRound(); }, 950);
}

// -------- Rendering --------
const COLORS = {
  wall:"#1f2937",
  br:"#4b5563",
  crack:"#111827",
  gate:"#111827",
  target:"#2563eb",
  bullet:"#f59e0b",
  ship:"#dc2626",
  shipDark:"#991b1b",
  cockpit:"rgba(255,255,255,0.45)"
};

function drawGate(g){
  ctx.save();
  ctx.fillStyle = "rgba(17,24,39,0.08)";
  ctx.strokeStyle = COLORS.gate;
  ctx.lineWidth = 2;
  ctx.fillRect(g.x,g.y,g.w,g.h);
  ctx.strokeRect(g.x,g.y,g.w,g.h);
  ctx.fillStyle = "#111827";
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.font="20px system-ui";
  ctx.fillText(`${g.label}: ${g.value}`, g.x+g.w/2, g.y+g.h/2);
  ctx.restore();
}
function drawShip(s){
  ctx.save();
  if (s.inv>0) ctx.globalAlpha = (Math.sin(performance.now()*0.02)>0 ? 0.35 : 1);

  ctx.fillStyle = COLORS.ship;
  ctx.strokeStyle = COLORS.shipDark;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(s.x, s.y - 34);
  ctx.quadraticCurveTo(s.x - 18, s.y - 6, s.x - 14, s.y + 26);
  ctx.quadraticCurveTo(s.x, s.y + 36, s.x + 14, s.y + 26);
  ctx.quadraticCurveTo(s.x + 18, s.y - 6, s.x, s.y - 34);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(s.x - 14, s.y + 6);
  ctx.lineTo(s.x - 40, s.y + 22);
  ctx.lineTo(s.x - 10, s.y + 26);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(s.x + 14, s.y + 6);
  ctx.lineTo(s.x + 40, s.y + 22);
  ctx.lineTo(s.x + 10, s.y + 26);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = COLORS.cockpit;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y - 6, 7, 10, 0, 0, Math.PI*2);
  ctx.fill();

  ctx.fillStyle = "rgba(245,158,11,0.25)";
  ctx.beginPath();
  ctx.ellipse(s.x, s.y + 40, 10, 8, 0, 0, Math.PI*2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

// -------- Loop --------
let last = performance.now();

function getMoveVector(){
  // Keyboard
  let axK=0, ayK=0;
  if (keys.has("ArrowLeft")) axK -= 1;
  if (keys.has("ArrowRight")) axK += 1;
  if (keys.has("ArrowUp")) ayK -= 1;
  if (keys.has("ArrowDown")) ayK += 1;

  // Gyro (mit Deadzone + Kalibrierung)
  let axG=0, ayG=0;
  if (gyroEnabled && lastBeta !== null && lastGamma !== null) {
    const g = lastGamma - zeroGamma; // links/rechts
    const b = lastBeta - zeroBeta;   // vor/zurück

    const dead = 3; // Grad
    const norm = 22; // Grad bis "voll"
    const dg = Math.abs(g) < dead ? 0 : g;
    const db = Math.abs(b) < dead ? 0 : b;

    axG = clamp(dg / norm, -1, 1);
    ayG = clamp(db / norm, -1, 1);
  }

  // Kombinieren (Keyboard überschreibt nicht, addiert)
  let ax = axK + axG;
  let ay = ayK + ayG;

  // Normieren
  const len = Math.hypot(ax, ay);
  if (len > 1e-6) { ax /= Math.max(1, len); ay /= Math.max(1, len); }
  return { ax, ay };
}

function update(dt){
  const grid = round.grid;
  const ship = round.ship;

  // Timer
  if (!round.locked){
    round.timeLeft -= dt;
    if (round.timeLeft <= 0){
      round.timeLeft = 0;
      renderTimeUI();
      timeoutFail();
      return;
    }
  }
  renderTimeUI();

  // Movement
  const mv = getMoveVector();
  const step = ship.speed * dt;

  let nx = clamp(ship.x + mv.ax*step, 2*TILE, WORLD_W - 2*TILE);
  let ny = clamp(ship.y + mv.ay*step, 2*TILE, WORLD_H - 2*TILE);

  if (!collidesSolid(grid, nx, ship.y, ship.r)) ship.x = nx;
  if (!collidesSolid(grid, ship.x, ny, ship.r)) ship.y = ny;

  ship.inv = Math.max(0, ship.inv - dt);

  // Dauerfeuer nach oben
  if (!round.locked){
    ship.fireAcc += dt * ship.fireRate;
    while (ship.fireAcc >= 1){
      ship.fireAcc -= 1;
      round.bullets.push({ x:ship.x, y:ship.y - ship.r - 18, vx:0, vy:-560, r:4, life:2.0 });
    }
  }

  // Bullets + Kollisionen
  for (const b of round.bullets){
    b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt;

    const {tx,ty} = worldToTile(b.x,b.y);
    const t = tileAt(grid,tx,ty);

    if (t === TILE_BREAK){
      setTile(grid,tx,ty,TILE_EMPTY);
      b.life = 0;
      spawnParticles(b.x,b.y,10,1);
      state.coins += 1;
    } else if (t === TILE_WALL){
      b.life = 0;
      spawnParticles(b.x,b.y,6,1);
    }

    for (const trg of round.targets){
      if (trg.hp <= 0) continue;
      const dx=b.x-trg.x, dy=b.y-trg.y;
      const rr=b.r+trg.r;
      if (dx*dx+dy*dy < rr*rr){
        b.life = 0;
        trg.hp -= 1;
        trg.hitFlash = 0.12;
        spawnParticles(trg.x,trg.y,10,1);
        if (trg.hp <= 0){
          state.coins += 15;
          spawnParticles(trg.x,trg.y,26,1);
        }
        break;
      }
    }
  }
  round.bullets = round.bullets.filter(b => b.life>0 && b.y>-TILE);

  // Targets bewegen + Schaden
  for (const t of round.targets){
    if (t.hp<=0) continue;
    t.hitFlash = Math.max(0, t.hitFlash - dt);
    t.x += t.dir * t.speed * dt;
    if (t.x < t.xMin){ t.x=t.xMin; t.dir=1; }
    if (t.x > t.xMax){ t.x=t.xMax; t.dir=-1; }

    const dx=ship.x-t.x, dy=ship.y-t.y;
    const rr=ship.r+t.r;
    if (dx*dx+dy*dy < rr*rr){
      if (ship.inv <= 0){
        ship.inv = 0.9;
        state.hearts -= 1;
        state.combo = 0;
        ui.msg.textContent = "💥 Treffer! Herz -1";
        spawnParticles(ship.x, ship.y, 22, 2);
        save(); renderHud();
        if (state.hearts <= 0){
          ui.msg.textContent = "💥 Game Over. Reset mit 'R'.";
          round.locked = true;
        }
      }
    }
  }

  // Particles
  for (const p of round.particles){
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.vy += 260*dt; p.life -= dt;
  }
  round.particles = round.particles.filter(p => p.life>0);

  // Camera
  const {h:viewH} = getViewport();
  round.camY = clamp(ship.y - viewH*0.70, 0, WORLD_H - viewH);

  // Gates
  if (!round.locked){
    if (inRect(ship.x,ship.y,ship.r,round.gates.A)) resolveGate(round.gates.A);
    else if (inRect(ship.x,ship.y,ship.r,round.gates.B)) resolveGate(round.gates.B);
  }

  ui.coins.textContent = state.coins;
}

function draw(){
  resizeCanvasToCss();
  const {w:viewW, h:viewH} = getViewport();
  const scale = canvas.width / viewW;

  ctx.setTransform(scale,0,0,scale,0,0);
  ctx.clearRect(0,0,viewW,viewH);

  // Sterne
  ctx.save();
  ctx.fillStyle = "rgba(17,24,39,0.10)";
  for (let i=0;i<90;i++){
    const sx=(i*97)%viewW, sy=(i*241)%viewH;
    ctx.beginPath(); ctx.arc(sx,sy,(i%3)+0.6,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(0, -round.camY);

  const y0=Math.floor(round.camY/TILE)-1;
  const y1=Math.floor((round.camY+viewH)/TILE)+2;

  for (let ty=y0; ty<=y1; ty++){
    if (ty<0||ty>=ROWS) continue;
    for (let tx=0; tx<COLS; tx++){
      const t = round.grid[ty][tx];
      if (t===TILE_EMPTY) continue;
      const x=tx*TILE, y=ty*TILE;

      if (t===TILE_WALL){
        ctx.fillStyle = COLORS.wall;
        ctx.globalAlpha = 0.90;
        ctx.fillRect(x,y,TILE,TILE);
        ctx.globalAlpha = 0.18;
        ctx.fillRect(x,y,TILE,TILE*0.22);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = COLORS.br;
        ctx.globalAlpha = 0.65;
        ctx.fillRect(x,y,TILE,TILE);
        ctx.globalAlpha = 0.20;
        ctx.fillRect(x,y,TILE,TILE*0.22);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = COLORS.crack;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.moveTo(x+TILE*0.2, y+TILE*0.3);
        ctx.lineTo(x+TILE*0.55, y+TILE*0.55);
        ctx.lineTo(x+TILE*0.35, y+TILE*0.75);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  drawGate(round.gates.A);
  drawGate(round.gates.B);

  // Targets
  for (const t of round.targets){
    if (t.hp<=0) continue;
    ctx.save();
    ctx.fillStyle = COLORS.target;
    ctx.strokeStyle = "rgba(37,99,235,0.35)";
    ctx.globalAlpha = t.hitFlash>0 ? 0.45 : 1;
    ctx.beginPath(); ctx.arc(t.x,t.y,t.r,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(t.x,t.y,t.r+5,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  // Bullets (orange)
  ctx.fillStyle = COLORS.bullet;
  ctx.globalAlpha = 0.95;
  for (const b of round.bullets){
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawShip(round.ship);

  // Particles
  for (const p of round.particles){
    ctx.globalAlpha = clamp(p.life,0,1);
    ctx.fillStyle = p.tint===1 ? "rgba(245,158,11,1)" : (p.tint===2 ? "rgba(220,38,38,1)" : "rgba(17,24,39,1)");
    ctx.beginPath(); ctx.arc(p.x,p.y,3.2,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

let last = performance.now();
function loop(now){
  const dt = Math.min(0.033, (now-last)/1000);
  last = now;
  if (round && playing){
    update(dt);
    draw();
  }
  requestAnimationFrame(loop);
}

// Start
showMenu();
requestAnimationFrame(loop);


