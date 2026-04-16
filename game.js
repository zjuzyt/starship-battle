const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const xpEl = document.getElementById("xp");
const livesEl = document.getElementById("lives");
const beamsEl = document.getElementById("beams");
const revivesEl = document.getElementById("revives");
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

function xpForLevel(level) {
  return Math.round(190 * Math.pow(1.42, level - 1));
}

function createState() {
  return {
    status: "ready",
    score: 0,
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(1),
    lives: 4,
    maxLives: 4,
    revives: 1,
    wave: 1,
    elapsed: 0,
    fireCooldown: 0,
    invulnerable: 1.8,
    notice: "",
    noticeTimer: 0,
    noticeMaxTimer: 0,
    player: {
      x: canvas.width * 0.18,
      y: canvas.height * 0.5,
      width: 48,
      height: 34,
      speed: 395,
      beams: 1,
      bulletDamage: 1,
      fireRateBonus: 0,
      rapidFire: 0,
      shieldHits: 0,
    },
    bullets: [],
    enemies: [],
    enemyBullets: [],
    particles: [],
    stars: Array.from({ length: 115 }, () => makeStar(true)),
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
  spawnTimer = 0.65;
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
  levelEl.textContent = state.level;
  xpEl.textContent = `${state.xp}/${state.xpToNext}`;
  livesEl.textContent = `${state.lives}/${state.maxLives}`;
  beamsEl.textContent = state.player.beams;
  revivesEl.textContent = state.revives;
  waveEl.textContent = state.wave;
}

function setNotice(text, duration = 2.2) {
  state.notice = text;
  state.noticeTimer = duration;
  state.noticeMaxTimer = duration;
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
  state.elapsed += dt;

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
  state.invulnerable = Math.max(0, state.invulnerable - dt);
  state.player.rapidFire = Math.max(0, state.player.rapidFire - dt);
  state.noticeTimer = Math.max(0, state.noticeTimer - dt);

  const nextWave = Math.max(1, Math.floor(state.elapsed * 0.16 + state.score / 1400) + 1);
  if (nextWave !== state.wave) {
    state.wave = nextWave;
    updateHud();
  }

  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = clamp(1.26 - state.wave * 0.03 - state.level * 0.005 + Math.random() * 0.25, 0.55, 1.45);
  }

  if (powerTimer <= 0) {
    spawnPowerup();
    powerTimer = 9 + Math.random() * 5;
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
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  state.bullets = state.bullets.filter(
    (bullet) => bullet.x < canvas.width + 40 && bullet.y > -30 && bullet.y < canvas.height + 30,
  );

  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  state.enemyBullets = state.enemyBullets.filter(
    (bullet) => bullet.x > -40 && bullet.x < canvas.width + 50 && bullet.y > -40 && bullet.y < canvas.height + 40,
  );
}

function chooseEnemyType() {
  const weights = [
    { type: "asteroid", weight: 56 },
    { type: "raider", weight: state.wave >= 2 ? 24 + state.wave * 0.25 : 0 },
    { type: "hunter", weight: state.wave >= 4 ? 10 + state.wave * 0.3 : 0 },
    { type: "juggernaut", weight: state.wave >= 7 ? 4 + state.wave * 0.22 : 0 },
  ];

  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of weights) {
    roll -= item.weight;
    if (roll <= 0) return item.type;
  }
  return "asteroid";
}

function spawnEnemy() {
  const type = chooseEnemyType();
  const elite = Math.random() < Math.min(0.03 + state.wave * 0.004, 0.14);

  const base = {
    asteroid: { hp: 1, speed: 138, speedCap: 198, drift: 14, size: 34 + Math.random() * 24, score: 70, xp: 10, cooldown: 99 },
    raider: { hp: 2, speed: 116, speedCap: 188, drift: 34, size: 38, score: 125, xp: 16, cooldown: 1.75 },
    hunter: { hp: 2, speed: 158, speedCap: 214, drift: 74, size: 34, score: 160, xp: 22, cooldown: 99 },
    juggernaut: { hp: 5, speed: 92, speedCap: 168, drift: 16, size: 52, score: 225, xp: 30, cooldown: 2.4 },
  }[type];

  const waveScale = 1 + (state.wave - 1) * 0.1;
  const eliteScale = elite ? 1.55 : 1;
  const size = base.size * (elite ? 1.15 : 1);
  const speed = clamp(base.speed + state.wave * 3 + Math.random() * 22 + (elite ? 10 : 0), base.speed * 0.95, base.speedCap);

  state.enemies.push({
    type,
    elite,
    x: canvas.width + 60,
    y: 46 + Math.random() * (canvas.height - 92),
    width: size * 1.34,
    height: size,
    r: size * 0.48,
    hp: Math.max(1, Math.round(base.hp * waveScale * eliteScale)),
    speed,
    drift: base.drift + (elite ? 10 : 0),
    cooldown: base.cooldown + Math.random() * 0.6,
    score: Math.round(base.score * waveScale * (elite ? 1.55 : 1)),
    xp: Math.round(base.xp * waveScale * (elite ? 1.45 : 1)),
    contactDamage: type === "juggernaut" ? 2 : 1,
    seed: Math.random() * 10,
  });
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    enemy.x -= enemy.speed * dt;

    if (enemy.type === "hunter") {
      const targetY = state.player.y + Math.sin(performance.now() / 320 + enemy.seed) * 18;
      const step = clamp(targetY - enemy.y, -1, 1);
      enemy.y += step * enemy.drift * dt;
    } else {
      enemy.y += Math.sin(performance.now() / 360 + enemy.seed) * enemy.drift * dt;
    }

    enemy.y = clamp(enemy.y, 30, canvas.height - 30);
    enemy.cooldown -= dt;

    if (enemy.type === "raider" && enemy.cooldown <= 0) {
      const tier = Math.floor((state.wave - 1) / 5);
      const bulletSpeed = Math.min(290, 205 + state.wave * 4);
      state.enemyBullets.push({
        x: enemy.x - 24,
        y: enemy.y,
        r: 5,
        vx: -bulletSpeed,
        vy: 0,
        damage: 1,
      });
      if (tier >= 1) {
        state.enemyBullets.push({ x: enemy.x - 24, y: enemy.y, r: 4.6, vx: -bulletSpeed * 0.9, vy: 48, damage: 1 });
        state.enemyBullets.push({ x: enemy.x - 24, y: enemy.y, r: 4.6, vx: -bulletSpeed * 0.9, vy: -48, damage: 1 });
      }
      enemy.cooldown = Math.max(0.85, 1.65 - tier * 0.12 + Math.random() * 0.9);
    }

    if (enemy.type === "juggernaut" && enemy.cooldown <= 0) {
      const speed = Math.min(280, 192 + state.wave * 4);
      const spread = 95 + Math.min(55, state.wave * 4);
      for (const vy of [-95, 0, 95]) {
        state.enemyBullets.push({
          x: enemy.x - 30,
          y: enemy.y,
          r: 5.2,
          vx: -speed,
          vy: (vy / 95) * spread,
          damage: 1,
        });
      }
      enemy.cooldown = Math.max(1.1, 2.2 - state.wave * 0.02 + Math.random() * 0.9);
    }
  }

  state.enemies = state.enemies.filter((enemy) => enemy.x > -90 && enemy.hp > 0);
}

function spawnPowerup() {
  const roll = Math.random();
  const type = roll < 0.42 ? "repair" : roll < 0.76 ? "overdrive" : "shield";
  state.powerups.push({
    type,
    x: canvas.width + 30,
    y: 60 + Math.random() * (canvas.height - 120),
    r: 15,
    speed: 148,
    spin: 0,
  });
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

function getBeamOffsets(count, spacing = 12) {
  if (count <= 1) return [0];
  const offsets = [];
  const center = (count - 1) / 2;
  for (let i = 0; i < count; i += 1) {
    offsets.push((i - center) * spacing);
  }
  return offsets;
}

function shoot() {
  if (state.status !== "running" || state.fireCooldown > 0) return;

  const player = state.player;
  const offsets = getBeamOffsets(player.beams, 11);
  for (const offset of offsets) {
    state.bullets.push({
      x: player.x + 42,
      y: player.y + offset,
      r: 3.6,
      vx: 660,
      vy: 0,
      damage: player.bulletDamage,
    });
  }

  let cooldown = 0.24 + Math.min(0.08, (player.beams - 1) * 0.004) - player.fireRateBonus;
  cooldown = clamp(cooldown, 0.1, 0.32);
  if (player.rapidFire > 0) cooldown *= 0.68;
  state.fireCooldown = cooldown;
}

function gainExperience(amount, x, y) {
  state.xp += amount;
  let leveled = false;
  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    levelUp();
    leveled = true;
    burst(x, y, "#9ffcff", 22);
  }
  if (!leveled) updateHud();
}

function levelUp() {
  state.level += 1;

  const bonuses = [];

  if (state.level % 2 === 0) {
    state.player.beams += 1;
    bonuses.push("射线 +1");
  }
  if (state.level % 3 === 0) {
    state.player.bulletDamage += 1;
    bonuses.push("伤害 +1");
  }
  if (state.level % 4 === 0) {
    state.maxLives += 1;
    bonuses.push("生命上限 +1");
  }
  if (state.level % 5 === 0) {
    state.player.speed = Math.min(520, state.player.speed + 12);
    bonuses.push("移速 +12");
  }
  if (state.level % 6 === 0) {
    state.player.fireRateBonus = Math.min(0.09, state.player.fireRateBonus + 0.012);
    bonuses.push("射速 +");
  }
  if (state.level % 8 === 0) {
    state.revives = Math.min(3, state.revives + 1);
    bonuses.push("复活 +1");
  }
  if (bonuses.length === 0) {
    bonuses.push("战舰强化");
  }

  state.lives = state.maxLives;
  state.player.rapidFire = Math.max(state.player.rapidFire, 3.6);
  state.xpToNext = xpForLevel(state.level);

  setNotice(`升级到 Lv.${state.level}：${bonuses.slice(0, 2).join("，")}，生命回满`, 2.4);
  burst(state.player.x, state.player.y, "#7de5ff", 24);
  updateHud();
}

function handleCollisions() {
  const player = state.player;

  for (const bullet of state.bullets) {
    for (const enemy of state.enemies) {
      if (!bullet.hit && circleRect(bullet.x, bullet.y, bullet.r, enemy)) {
        bullet.hit = true;
        enemy.hp -= bullet.damage;
        burst(bullet.x, bullet.y, enemy.type === "asteroid" ? "#ffcc66" : "#7de5ff", 8);

        if (enemy.hp <= 0) {
          state.score += enemy.score;
          gainExperience(enemy.xp, enemy.x, enemy.y);
          burst(enemy.x, enemy.y, enemy.elite ? "#ffd98a" : "#ff8a5b", enemy.elite ? 34 : 22);
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
      const enemyDamage = enemyHit ? enemyHit.contactDamage || 1 : 0;
      const shotDamage = shotHit ? shotHit.damage || 1 : 0;
      damagePlayer(Math.max(enemyDamage, shotDamage, 1));
      if (enemyHit) enemyHit.hp = 0;
      if (shotHit) shotHit.hit = true;
    }
  }

  state.enemyBullets = state.enemyBullets.filter((bullet) => !bullet.hit);

  for (const powerup of state.powerups) {
    if (circleRect(powerup.x, powerup.y, powerup.r, player)) {
      powerup.hit = true;

      if (powerup.type === "repair") {
        state.lives = Math.min(state.maxLives, state.lives + 2);
        setNotice("拾取维修包：生命 +2");
        burst(powerup.x, powerup.y, "#9bff9f", 20);
      } else if (powerup.type === "overdrive") {
        state.player.rapidFire += 7;
        setNotice("拾取超频：射速提升");
        burst(powerup.x, powerup.y, "#ff9a66", 20);
      } else {
        state.player.shieldHits += 2;
        setNotice("拾取护盾：抵挡 2 次伤害");
        burst(powerup.x, powerup.y, "#7de5ff", 20);
      }

      gainExperience(10, powerup.x, powerup.y);
      state.score += 35;
      updateHud();
    }
  }
  state.powerups = state.powerups.filter((powerup) => !powerup.hit);
}

function damagePlayer(amount = 1) {
  if (state.player.shieldHits > 0) {
    state.player.shieldHits -= 1;
    setNotice(`护盾吸收伤害，剩余 ${state.player.shieldHits} 层`, 1.5);
    burst(state.player.x, state.player.y, "#7de5ff", 16);
    return;
  }

  state.lives -= amount;
  state.invulnerable = 1.7;
  burst(state.player.x, state.player.y, "#ff5c7a", 28);
  updateHud();

  if (state.lives <= 0) {
    if (state.revives > 0) {
      reviveRun();
    } else {
      endGame();
    }
  }
}

function reviveRun() {
  state.revives -= 1;
  state.maxLives += 1;
  state.lives = state.maxLives;
  state.score = 0;
  state.wave = 1;
  state.elapsed = 0;
  state.invulnerable = 2.6;

  state.player.x = canvas.width * 0.18;
  state.player.y = canvas.height * 0.5;
  state.player.shieldHits = Math.max(1, state.player.shieldHits);

  state.bullets.length = 0;
  state.enemyBullets.length = 0;
  state.enemies.length = 0;
  state.powerups.length = 0;
  state.particles.length = 0;

  spawnTimer = 0.8;
  powerTimer = 4.6;

  setNotice("复活成功：战局重置，最大生命 +1", 2.8);
  burst(state.player.x, state.player.y, "#ffe38a", 36);
  updateHud();
}

function endGame() {
  state.status = "ended";
  overlay.classList.remove("hidden");
  overlay.querySelector("h1").textContent = "战舰坠毁";
  overlay.querySelector("p").textContent = `最终等级 Lv.${state.level}，到达第 ${state.wave} 波。点击重新出发。`;
  startBtn.textContent = "重新出发";
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
  drawNotice();
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

  if (p.shieldHits > 0) {
    ctx.strokeStyle = "rgba(125, 229, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 32 + Math.sin(performance.now() / 120) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

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

  ctx.fillStyle = state.player.rapidFire > 0 ? "#ff9966" : "#ffcc66";
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

  for (const bullet of state.enemyBullets) {
    ctx.fillStyle = bullet.vy === 0 ? "#ff5c7a" : "#ff9d6a";
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
    } else if (enemy.type === "hunter") {
      ctx.fillStyle = "#ff8f5b";
      ctx.strokeStyle = "#ffe1c2";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(28, 0);
      ctx.lineTo(0, -18);
      ctx.lineTo(-26, 0);
      ctx.lineTo(0, 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#40140c";
      ctx.fillRect(-9, -5, 14, 10);
    } else if (enemy.type === "juggernaut") {
      ctx.fillStyle = "#8f5bff";
      ctx.strokeStyle = "#dac7ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-34, -20, 66, 40, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2d184b";
      ctx.fillRect(-20, -6, 26, 12);
      ctx.fillRect(10, -10, 12, 20);
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

    if (enemy.elite) {
      ctx.strokeStyle = "rgba(255, 223, 134, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.r + 8, 0, Math.PI * 2);
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

    if (powerup.type === "repair") {
      ctx.strokeStyle = "#9bff9f";
      ctx.fillStyle = "rgba(155, 255, 159, 0.14)";
    } else if (powerup.type === "overdrive") {
      ctx.strokeStyle = "#ff9a66";
      ctx.fillStyle = "rgba(255, 154, 102, 0.14)";
    } else {
      ctx.strokeStyle = "#7de5ff";
      ctx.fillStyle = "rgba(125, 229, 255, 0.16)";
    }

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

function drawNotice() {
  if (state.noticeTimer <= 0 || !state.notice) return;

  const elapsed = state.noticeMaxTimer - state.noticeTimer;
  const alpha = Math.min(1, elapsed / 0.28, state.noticeTimer / 0.28);
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 0.95);
  ctx.fillStyle = "rgba(5, 13, 25, 0.7)";
  ctx.strokeStyle = "rgba(125, 229, 255, 0.5)";
  ctx.lineWidth = 1.5;

  const w = Math.min(canvas.width - 80, 480);
  const h = 42;
  const x = (canvas.width - w) / 2;
  const y = 18;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#eaf7ff";
  ctx.font = "600 18px Arial, Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.notice, canvas.width / 2, y + h / 2 + 1);
  ctx.restore();
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
    overlay.querySelector("p").textContent = "方向键或 WASD 移动，空格发射，活下来并不断升级。";
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
updateHud();
draw();
