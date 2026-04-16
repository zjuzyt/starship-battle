const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const waveEl = document.getElementById("wave");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const fireBtn = document.getElementById("fireBtn");

const keys = new Set();
const touchMoves = new Set();

let state;
let lastTime = 0;
let animationId = 0;
let spawnTimer = 0;
let powerTimer = 0;

function createState() {
  return {
    status: "ready",
    score: 0,
    lives: 3,
    wave: 1,
    fireCooldown: 0,
    invulnerable: 1.6,
    player: {
      x: canvas.width * 0.18,
      y: canvas.height * 0.5,
      width: 48,
      height: 34,
      speed: 390,
      triple: 0,
    },
    bullets: [],
    enemies: [],
    enemyBullets: [],
    particles: [],
    stars: Array.from({ length: 110 }, () => makeStar(true)),
    powerups: [],
  };
}

function makeStar(randomX = false) {
  return {
    x: randomX ? Math.random() * canvas.width : canvas.width + Math.random() * 80,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.8 + 0.4,
    speed: Math.random() * 90 + 30,
    alpha: Math.random() * 0.65 + 0.25,
  };
}

function resetGame() {
  state = createState();
  spawnTimer = 0.5;
  powerTimer = 7;
  lastTime = performance.now();
  overlay.classList.add("hidden");
  state.status = "running";
  pauseBtn.textContent = "暂停";
  updateHud();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

function updateHud() {
  scoreEl.textContent = state.score;
  livesEl.textContent = state.lives;
  waveEl.textContent = state.wave;
}

function loop(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.032);
  lastTime = time;

  if (state.status === "running") {
    update(dt);
  }

  draw();
  animationId = requestAnimationFrame(loop);
}

function update(dt) {
  updateStars(dt);
  updatePlayer(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updatePowerups(dt);
  updateParticles(dt);
  handleCollisions();

  spawnTimer -= dt;
  powerTimer -= dt;
  state.fireCooldown = Math.max(0, state.fireCooldown - dt);
  state.player.triple = Math.max(0, state.player.triple - dt);
  state.invulnerable = Math.max(0, state.invulnerable - dt);

  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = Math.max(0.42, 1.15 - state.wave * 0.07 - Math.random() * 0.28);
  }

  if (powerTimer <= 0) {
    spawnPowerup();
    powerTimer = 10 + Math.random() * 6;
  }

  const nextWave = Math.floor(state.score / 900) + 1;
  if (nextWave !== state.wave) {
    state.wave = nextWave;
    updateHud();
  }
}

function updateStars(dt) {
  for (const star of state.stars) {
    star.x -= star.speed * dt;
    if (star.x < -6) {
      Object.assign(star, makeStar(false));
    }
  }
}

function updatePlayer(dt) {
  const player = state.player;
  let dx = 0;
  let dy = 0;
  if (keys.has("arrowup") || keys.has("w") || touchMoves.has("up")) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s") || touchMoves.has("down")) dy += 1;
  if (keys.has("arrowleft") || keys.has("a") || touchMoves.has("left")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d") || touchMoves.has("right")) dx += 1;

  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    player.x += (dx / length) * player.speed * dt;
    player.y += (dy / length) * player.speed * dt;
  }

  player.x = clamp(player.x, 24, canvas.width - 70);
  player.y = clamp(player.y, 28, canvas.height - 28);
}

function updateBullets(dt) {
  for (const bullet of state.bullets) {
    bullet.x += bullet.speed * dt;
  }
  state.bullets = state.bullets.filter((bullet) => bullet.x < canvas.width + 40);

  for (const bullet of state.enemyBullets) {
    bullet.x -= bullet.speed * dt;
  }
  state.enemyBullets = state.enemyBullets.filter((bullet) => bullet.x > -40);
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    enemy.x -= enemy.speed * dt;
    enemy.y += Math.sin(performance.now() / 360 + enemy.seed) * enemy.drift * dt;
    enemy.cooldown -= dt;
    if (enemy.type === "raider" && enemy.cooldown <= 0) {
      state.enemyBullets.push({
        x: enemy.x - 24,
        y: enemy.y,
        r: 5,
        speed: 230 + state.wave * 12,
      });
      enemy.cooldown = 1.7 + Math.random();
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.x > -80 && enemy.hp > 0);
}

function updatePowerups(dt) {
  for (const powerup of state.powerups) {
    powerup.x -= powerup.speed * dt;
    powerup.spin += dt * 4;
  }
  state.powerups = state.powerups.filter((powerup) => powerup.x > -40);
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

function spawnEnemy() {
  const type = Math.random() < Math.min(0.28 + state.wave * 0.02, 0.48) ? "raider" : "asteroid";
  const size = type === "raider" ? 38 : 32 + Math.random() * 24;
  state.enemies.push({
    type,
    x: canvas.width + 60,
    y: 46 + Math.random() * (canvas.height - 92),
    width: size * 1.35,
    height: size,
    r: size * 0.48,
    hp: type === "raider" ? 2 + Math.floor(state.wave / 4) : 1,
    speed: (type === "raider" ? 120 : 150) + state.wave * 16 + Math.random() * 55,
    drift: type === "raider" ? 38 : 16,
    cooldown: 0.7 + Math.random() * 1.2,
    seed: Math.random() * 10,
  });
}

function spawnPowerup() {
  state.powerups.push({
    x: canvas.width + 30,
    y: 60 + Math.random() * (canvas.height - 120),
    r: 15,
    speed: 145,
    spin: 0,
  });
}

function shoot() {
  if (state.status !== "running" || state.fireCooldown > 0) return;
  const player = state.player;
  const shots = player.triple > 0 ? [-11, 0, 11] : [0];
  for (const offset of shots) {
    state.bullets.push({
      x: player.x + 42,
      y: player.y + offset,
      r: 4,
      speed: 650,
    });
  }
  state.fireCooldown = player.triple > 0 ? 0.16 : 0.22;
}

function handleCollisions() {
  const player = state.player;

  for (const bullet of state.bullets) {
    for (const enemy of state.enemies) {
      if (!bullet.hit && circleRect(bullet.x, bullet.y, bullet.r, enemy)) {
        bullet.hit = true;
        enemy.hp -= 1;
        burst(bullet.x, bullet.y, enemy.type === "raider" ? "#7de5ff" : "#ffcc66", 8);
        if (enemy.hp <= 0) {
          state.score += enemy.type === "raider" ? 160 : 90;
          burst(enemy.x, enemy.y, "#ff8a5b", 22);
          updateHud();
        }
      }
    }
  }
  state.bullets = state.bullets.filter((bullet) => !bullet.hit);

  if (state.invulnerable <= 0) {
    const playerBox = {
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height,
    };
    const enemyHit = state.enemies.find((enemy) => rectsOverlap(playerBox, enemy));
    const shotHit = state.enemyBullets.find((bullet) => circleRect(bullet.x, bullet.y, bullet.r, playerBox));
    if (enemyHit || shotHit) {
      damagePlayer();
      if (enemyHit) enemyHit.hp = 0;
      if (shotHit) shotHit.hit = true;
    }
  }

  state.enemyBullets = state.enemyBullets.filter((bullet) => !bullet.hit);

  for (const powerup of state.powerups) {
    if (circleRect(powerup.x, powerup.y, powerup.r, player)) {
      powerup.hit = true;
      state.player.triple = 8;
      state.score += 120;
      burst(powerup.x, powerup.y, "#7de5ff", 18);
      updateHud();
    }
  }
  state.powerups = state.powerups.filter((powerup) => !powerup.hit);
}

function damagePlayer() {
  state.lives -= 1;
  state.invulnerable = 1.7;
  burst(state.player.x, state.player.y, "#ff5c7a", 28);
  updateHud();
  if (state.lives <= 0) {
    endGame();
  }
}

function endGame() {
  state.status = "ended";
  overlay.classList.remove("hidden");
  overlay.querySelector("h1").textContent = "任务结束";
  overlay.querySelector("p").textContent = `最终分数 ${state.score}，到达第 ${state.wave} 波。`;
  startBtn.textContent = "再玩一次";
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 210;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 1.5 + Math.random() * 3,
      life: 0.35 + Math.random() * 0.45,
      color,
    });
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSpace();
  drawPowerups();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
}

function drawSpace() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#050b18");
  gradient.addColorStop(0.55, "#0b1424");
  gradient.addColorStop(1, "#190d18");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const star of state.stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const p = state.player;
  if (state.invulnerable > 0 && Math.floor(performance.now() / 90) % 2 === 0) return;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = "#7de5ff";
  ctx.strokeStyle = "#d7fbff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.lineTo(-24, -22);
  ctx.lineTo(-12, 0);
  ctx.lineTo(-24, 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#17324d";
  ctx.beginPath();
  ctx.ellipse(2, 0, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffcc66";
  ctx.beginPath();
  ctx.moveTo(-25, -10);
  ctx.lineTo(-47 - Math.random() * 13, 0);
  ctx.lineTo(-25, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBullets() {
  ctx.fillStyle = "#9ffcff";
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.roundRect(bullet.x - 2, bullet.y - 3, 18, 6, 3);
    ctx.fill();
  }

  ctx.fillStyle = "#ff5c7a";
  for (const bullet of state.enemyBullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    if (enemy.type === "raider") {
      ctx.fillStyle = "#ff5c7a";
      ctx.strokeStyle = "#ffd0d8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-28, 0);
      ctx.lineTo(18, -20);
      ctx.lineTo(30, 0);
      ctx.lineTo(18, 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#310a16";
      ctx.fillRect(-5, -6, 16, 12);
    } else {
      ctx.rotate(enemy.seed);
      ctx.fillStyle = "#8f7b61";
      ctx.strokeStyle = "#ffcc66";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 9; i += 1) {
        const angle = (i / 9) * Math.PI * 2;
        const r = enemy.r * (0.75 + ((i * 17) % 5) * 0.08);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPowerups() {
  for (const powerup of state.powerups) {
    ctx.save();
    ctx.translate(powerup.x, powerup.y);
    ctx.rotate(powerup.spin);
    ctx.strokeStyle = "#7de5ff";
    ctx.fillStyle = "rgba(125, 229, 255, 0.16)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(18, 0);
    ctx.lineTo(0, 18);
    ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function togglePause() {
  if (state.status === "ready" || state.status === "ended") return;
  state.status = state.status === "paused" ? "running" : "paused";
  pauseBtn.textContent = state.status === "paused" ? "继续" : "暂停";
  overlay.classList.toggle("hidden", state.status !== "paused");
  overlay.querySelector("h1").textContent = "已暂停";
  overlay.querySelector("p").textContent = "按 P 或点击继续回到战场。";
  startBtn.textContent = "继续";
  lastTime = performance.now();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a, b) {
  return (
    a.x - a.width / 2 < b.x + b.width / 2 &&
    a.x + a.width / 2 > b.x - b.width / 2 &&
    a.y - a.height / 2 < b.y + b.height / 2 &&
    a.y + a.height / 2 > b.y - b.height / 2
  );
}

function circleRect(cx, cy, radius, rect) {
  const closestX = clamp(cx, rect.x - rect.width / 2, rect.x + rect.width / 2);
  const closestY = clamp(cy, rect.y - rect.height / 2, rect.y + rect.height / 2);
  return Math.hypot(cx - closestX, cy - closestY) < radius;
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
  }
  if (key === " ") shoot();
  if (key === "p") togglePause();
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

startBtn.addEventListener("click", () => {
  if (state.status === "paused") {
    togglePause();
  } else {
    overlay.querySelector("h1").textContent = "星际战舰";
    resetGame();
  }
});

pauseBtn.addEventListener("click", togglePause);
fireBtn.addEventListener("pointerdown", shoot);

document.querySelectorAll("[data-move]").forEach((button) => {
  const move = button.dataset.move;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    touchMoves.add(move);
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointerup", () => touchMoves.delete(move));
  button.addEventListener("pointercancel", () => touchMoves.delete(move));
  button.addEventListener("pointerleave", () => touchMoves.delete(move));
});

if (!("roundRect" in CanvasRenderingContext2D.prototype)) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, width, height, radius) {
    this.moveTo(x + radius, y);
    this.arcTo(x + width, y, x + width, y + height, radius);
    this.arcTo(x + width, y + height, x, y + height, radius);
    this.arcTo(x, y + height, x, y, radius);
    this.arcTo(x, y, x + width, y, radius);
    return this;
  };
}

state = createState();
draw();
