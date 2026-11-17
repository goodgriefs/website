"use strict";

/*
 * Facebook, TikTok, and X live here.
 * Set a string to "" to hide that link. This object wins over the href in the HTML.
 */
const LINK_URLS = {
  facebook: "https://www.facebook.com/Peachyproxies",
  tiktok: "https://www.tiktok.com/@mtgdestiny",
  x: "https://x.com/PeachyProxy",
};

const DIFF = {
  easy: { ball: 440, ai: 230, error: 0, react: 240, note: "Hexy is half asleep." },
  medium: { ball: 540, ai: 370, error: 52, react: 140, note: "Hexy is watching the ball." },
  hard: { ball: 650, ai: 540, error: 12, react: 60, note: "Hexy wants this point." },
};

function applyLinkUrls() {
  document.querySelectorAll("[data-link]").forEach((el) => {
    const key = el.dataset.link;
    if (!(key in LINK_URLS)) return;
    const url = (LINK_URLS[key] || "").trim();
    if (!url) {
      el.hidden = true;
      el.removeAttribute("href");
      return;
    }
    el.hidden = false;
    el.href = url;
  });
}

function initGate() {
  const enter = document.getElementById("enter-btn");
  const leave = document.getElementById("leave-btn");
  const gate = document.getElementById("gate");
  const site = document.getElementById("site");
  const open = !document.documentElement.classList.contains("is-in");
  if (open) site.setAttribute("inert", "");
  else site.removeAttribute("inert");

  function admit() {
    document.documentElement.classList.add("is-in");
    site.removeAttribute("inert");
    try { sessionStorage.setItem("peachy-age", "ok"); } catch (err) {}
    const main = document.getElementById("main");
    if (main) main.focus();
  }

  enter.addEventListener("click", admit);
  leave.addEventListener("click", () => {
    window.location.href = "https://www.google.com";
  });

  gate.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || document.documentElement.classList.contains("is-in")) return;
    const buttons = [...gate.querySelectorAll("button")];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (open) enter.focus();
}

function initLightbox() {
  const dialog = document.getElementById("lightbox");
  const img = document.getElementById("light-img");
  const cap = document.getElementById("light-cap");
  const shots = [...document.querySelectorAll(".proxy-open")];
  let index = 0;

  function show(i) {
    index = (i + shots.length) % shots.length;
    const button = shots[index];
    img.src = button.dataset.src;
    img.alt = button.dataset.alt;
    cap.textContent = button.parentElement.querySelector("figcaption").textContent.trim();
    if (!dialog.open) dialog.showModal();
  }

  shots.forEach((button, i) => {
    button.addEventListener("click", () => show(i));
  });
  document.getElementById("light-close").addEventListener("click", () => dialog.close());
  document.getElementById("light-prev").addEventListener("click", () => show(index - 1));
  document.getElementById("light-next").addEventListener("click", () => show(index + 1));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(index - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      show(index + 1);
    }
  });
}

function initPong() {
  const canvas = document.getElementById("pong-board");
  const ctx = canvas.getContext("2d");
  const W = 960;
  const H = 540;
  const PH = 146;
  const PW = 18;
  const BALL_R = 22;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const player = { x: 36, y: H / 2 };
  const ai = { x: W - 36, y: H / 2 };
  const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  const scores = { you: 0, hexy: 0 };
  let diff = "easy";
  let state = "wait";
  let serveDir = -1;
  let waitUntil = performance.now() + 600;
  let aiDest = H / 2;
  let aiNext = 0;
  let pointerOn = false;
  let pointerY = H / 2;
  let nudge = 0;
  let keyDir = 0;
  let shake = 0;
  let hitFlash = 0;
  const trail = [];
  const sparks = [];
  let raf = 0;
  let visible = false;
  let last = performance.now();
  let soundOn = false;
  let audioCtx = null;

  const youScore = document.getElementById("you-score");
  const hexyScore = document.getElementById("hexy-score");
  const result = document.getElementById("pong-result");
  const resultText = document.getElementById("pong-result-text");
  const note = document.getElementById("diff-note");

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function tone(freq, dur, type, vol, delay) {
    if (!soundOn || !audioCtx) return;
    const t0 = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function clap() { tone(190, 0.07, "triangle", 0.05); }
  function tick() { tone(540, 0.04, "sine", 0.03); }

  function launch(dir) {
    const speed = DIFF[diff].ball;
    const angle = Math.random() * 0.55 - 0.275;
    ball.x = W / 2;
    ball.y = H / 2 + (Math.random() * 120 - 60);
    ball.vx = Math.cos(angle) * speed * dir;
    ball.vy = Math.sin(angle) * speed;
    state = "play";
    trail.length = 0;
  }

  function resetMatch() {
    scores.you = 0;
    scores.hexy = 0;
    youScore.textContent = "0";
    hexyScore.textContent = "0";
    result.hidden = true;
    player.y = H / 2;
    ai.y = H / 2;
    serveDir = -1;
    state = "wait";
    ball.vx = 0;
    ball.vy = 0;
    ball.x = W / 2;
    ball.y = H / 2;
    waitUntil = performance.now() + 400;
    sparks.length = 0;
  }

  function finish(winner) {
    state = "over";
    ball.x = W / 2;
    ball.y = H / 2;
    ball.vx = 0;
    ball.vy = 0;
    resultText.textContent = winner === "you" ? "You took the spring." : "Hexy took it.";
    result.hidden = false;
    if (winner === "you") {
      tone(523, 0.12, "sine", 0.05);
      tone(659, 0.14, "sine", 0.05, 0.1);
      tone(784, 0.2, "sine", 0.05, 0.2);
    } else {
      tone(196, 0.2, "sine", 0.05);
    }
    if (!reduce) {
      for (let i = 0; i < 28; i++) {
        sparks.push({
          x: W / 2,
          y: H / 2,
          vx: Math.random() * 420 - 210,
          vy: Math.random() * -280 - 40,
          life: 0.8 + Math.random() * 0.5,
          color: Math.random() > 0.5 ? "#ff8a6b" : "#e4c27a",
          r: 3 + Math.random() * 4,
        });
      }
    }
  }

  function score(who) {
    scores[who] += 1;
    youScore.textContent = String(scores.you);
    hexyScore.textContent = String(scores.hexy);
    if (who === "you") {
      tone(523, 0.1, "sine", 0.045);
      tone(659, 0.14, "sine", 0.045, 0.08);
    } else {
      tone(220, 0.14, "sine", 0.045);
    }
    if (scores[who] >= 2) {
      finish(who);
      return;
    }
    serveDir = who === "hexy" ? -1 : 1;
    state = "wait";
    ball.vx = 0;
    ball.vy = 0;
    ball.x = W / 2;
    ball.y = H / 2;
    waitUntil = performance.now() + 650;
  }

  function predictY() {
    let x = ball.x;
    let y = ball.y;
    let vx = ball.vx;
    let vy = ball.vy;
    if (vx <= 40) return H / 2;
    for (let i = 0; i < 280; i++) {
      x += vx / 60;
      y += vy / 60;
      if (y < BALL_R || y > H - BALL_R) vy = -vy;
      if (x >= W - 48) return y;
    }
    return y;
  }

  function overlaps(pad) {
    return (
      ball.x + BALL_R > pad.x - PW / 2 &&
      ball.x - BALL_R < pad.x + PW / 2 &&
      ball.y + BALL_R > pad.y - PH / 2 &&
      ball.y - BALL_R < pad.y + PH / 2
    );
  }

  function bounce(pad, dir) {
    const offset = Math.max(-1, Math.min(1, (ball.y - pad.y) / (PH / 2)));
    const mag = Math.min(Math.hypot(ball.vx, ball.vy) * 1.05, DIFF[diff].ball * 1.62);
    const angle = offset * 0.95;
    ball.vx = Math.cos(angle) * mag * dir;
    ball.vy = Math.sin(angle) * mag;
    ball.x = pad.x + dir * (PW / 2 + BALL_R + 2);
    shake = reduce ? 0 : 8;
    hitFlash = 0.12;
    clap();
    if (!reduce) {
      for (let i = 0; i < 7; i++) {
        sparks.push({
          x: ball.x,
          y: ball.y,
          vx: (Math.random() - 0.5) * 180,
          vy: (Math.random() - 0.5) * 180,
          life: 0.35,
          color: "#ffd0bf",
          r: 2 + Math.random() * 2,
        });
      }
    }
  }

  function clampPaddle(pad) {
    const limit = PH / 2 + 18;
    if (pad.y < limit) pad.y = limit;
    if (pad.y > H - limit) pad.y = H - limit;
  }

  function step(dt) {
    const now = performance.now();
    if (pointerOn) player.y = pointerY;
    else if (nudge || keyDir) player.y += (nudge || keyDir) * 620 * dt;
    clampPaddle(player);

    if (now >= aiNext) {
      aiNext = now + DIFF[diff].react;
      if (diff === "easy" || ball.vx <= 0) aiDest = diff === "easy" ? ball.y : H / 2;
      else aiDest = predictY() + (Math.random() * 2 - 1) * DIFF[diff].error;
    }
    const max = DIFF[diff].ai * dt;
    const dy = aiDest - ai.y;
    if (Math.abs(dy) > 3) ai.y += Math.max(-max, Math.min(max, dy));
    clampPaddle(ai);

    if (state === "wait" && now >= waitUntil) launch(serveDir);
    if (state !== "play") return;

    const sub = Math.max(1, Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / 10));
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      ball.x += ball.vx * h;
      ball.y += ball.vy * h;
      if (ball.y < BALL_R) {
        ball.y = BALL_R;
        ball.vy = Math.abs(ball.vy);
        tick();
      } else if (ball.y > H - BALL_R) {
        ball.y = H - BALL_R;
        ball.vy = -Math.abs(ball.vy);
        tick();
      }
      if (ball.vx < 0 && overlaps(player)) bounce(player, 1);
      else if (ball.vx > 0 && overlaps(ai)) bounce(ai, -1);
      if (ball.x < -BALL_R) {
        score("hexy");
        return;
      }
      if (ball.x > W + BALL_R) {
        score("you");
        return;
      }
    }

    if (!reduce) {
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 8) trail.shift();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPeach(x, y, r) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r);
    g.addColorStop(0, "#ffd3c2");
    g.addColorStop(0.55, "#ff8a6b");
    g.addColorStop(1, "#e15a45");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 40, 28, 0.45)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.15);
    ctx.quadraticCurveTo(x + r * 0.2, y + r * 0.25, x, y + r * 0.8);
    ctx.stroke();
    ctx.fillStyle = "#3d7a46";
    ctx.beginPath();
    ctx.ellipse(x + r * 0.28, y - r * 0.92, r * 0.48, r * 0.2, -0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw() {
    resize();
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sx = reduce ? 0 : (Math.random() * 2 - 1) * shake;
    const sy = reduce ? 0 : (Math.random() * 2 - 1) * shake;
    ctx.save();
    ctx.translate(sx, sy);

    const water = ctx.createLinearGradient(0, 0, 0, H);
    water.addColorStop(0, "#1a3c42");
    water.addColorStop(1, "#0c1c22");
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(228, 194, 122, 0.16)";
    ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      const y = (H / 6) * i;
      ctx.moveTo(24, y);
      ctx.bezierCurveTo(W * 0.3, y - 10, W * 0.7, y + 10, W - 24, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#6b4a32";
    ctx.fillRect(0, 0, W, 10);
    ctx.fillRect(0, H - 10, W, 10);
    ctx.fillStyle = "#e4c27a";
    ctx.fillRect(0, 10, W, 3);
    ctx.fillRect(0, H - 13, W, 3);

    ctx.setLineDash([10, 14]);
    ctx.strokeStyle = "rgba(244, 231, 214, 0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(W / 2, 24);
    ctx.lineTo(W / 2, H - 24);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(244, 231, 214, 0.55)";
    ctx.font = "600 15px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("YOU", 86, 40);
    ctx.fillText("HEXY", W - 86, 40);

    if (!reduce) {
      trail.forEach((p, i) => {
        ctx.globalAlpha = (i / trail.length) * 0.28;
        ctx.fillStyle = "#ff8a6b";
        ctx.beginPath();
        ctx.arc(p.x, p.y, BALL_R * (0.35 + (0.65 * i) / trail.length), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    function paddle(pad, hot) {
      const x = pad.x - PW / 2;
      const y = pad.y - PH / 2;
      roundRect(x, y, PW, PH, 8);
      const g = ctx.createLinearGradient(x, y, x, y + PH);
      g.addColorStop(0, "#f0d7a4");
      g.addColorStop(1, "#b88858");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = hot ? "#fff4ec" : "#ff8a6b";
      ctx.fillRect(pad.x + (pad === player ? PW / 2 - 4 : -PW / 2), y + 8, 4, PH - 16);
    }
    paddle(player, hitFlash > 0 && ball.vx > 0);
    paddle(ai, hitFlash > 0 && ball.vx < 0);

    sparks.forEach((s) => {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    drawPeach(ball.x, ball.y, BALL_R);
    ctx.restore();
  }

  function frame(now) {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    shake *= Math.pow(0.04, dt);
    hitFlash = Math.max(0, hitFlash - dt);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 420 * dt;
      s.life -= dt;
      if (s.life <= 0) sparks.splice(i, 1);
    }
    step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (!raf && visible) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) wake();
  }, { threshold: 0.08 });
  observer.observe(canvas);
  new ResizeObserver(() => resize()).observe(canvas);

  function localY(event) {
    const rect = canvas.getBoundingClientRect();
    return ((event.clientY - rect.top) / rect.height) * H;
  }

  canvas.addEventListener("pointerdown", (event) => {
    pointerOn = true;
    pointerY = localY(event);
    canvas.setPointerCapture(event.pointerId);
    canvas.focus();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" || pointerOn) {
      pointerOn = event.pointerType === "mouse" ? true : pointerOn;
      pointerY = localY(event);
    }
  });
  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "mouse") pointerOn = false;
  });
  canvas.addEventListener("pointercancel", (event) => {
    if (event.pointerType !== "mouse") pointerOn = false;
  });
  canvas.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") pointerOn = false;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.tabIndex = 0;

  document.querySelectorAll("[data-nudge]").forEach((button) => {
    const dir = Number(button.dataset.nudge);
    const start = (event) => {
      event.preventDefault();
      nudge = dir;
    };
    const stop = () => {
      if (nudge === dir) nudge = 0;
    };
    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointerleave", stop);
    button.addEventListener("pointercancel", stop);
  });

  window.addEventListener("keydown", (event) => {
    const hot = document.activeElement === canvas || canvas.matches(":hover");
    if (!hot) return;
    if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
      keyDir = -1;
      event.preventDefault();
    } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
      keyDir = 1;
      event.preventDefault();
    }
  });
  window.addEventListener("keyup", (event) => {
    if (["ArrowUp", "ArrowDown", "w", "W", "s", "S"].includes(event.key)) keyDir = 0;
  });

  document.querySelectorAll("[data-diff]").forEach((button) => {
    button.addEventListener("click", () => {
      diff = button.dataset.diff;
      document.querySelectorAll("[data-diff]").forEach((other) => {
        other.setAttribute("aria-checked", other === button ? "true" : "false");
      });
      note.textContent = DIFF[diff].note;
      resetMatch();
    });
  });

  document.getElementById("reset-btn").addEventListener("click", resetMatch);
  document.getElementById("again-btn").addEventListener("click", resetMatch);
  document.getElementById("sound-btn").addEventListener("click", async () => {
    soundOn = !soundOn;
    const button = document.getElementById("sound-btn");
    button.setAttribute("aria-pressed", soundOn ? "true" : "false");
    button.textContent = soundOn ? "Sound on" : "Sound off";
    if (soundOn) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended") await audioCtx.resume();
      tone(660, 0.08, "sine", 0.04);
    }
  });

  document.addEventListener("visibilitychange", () => {
    last = performance.now();
  });

  resize();
  draw();
  wake();
}

applyLinkUrls();
initGate();
initLightbox();
initPong();
