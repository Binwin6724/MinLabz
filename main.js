// MinLabz site: 3D hero, live GitHub downloads, galleries.
const OWNER = "Binwin6724";
const APPS = {
  MinTransfer: { id: "mintransfer", color: 0x2f80ff, glow: 0x14d3a0 },
  MinSoundFX: { id: "minsoundfx", color: 0x7c5cff, glow: 0x4fb3ff },
  MinDesk: { id: "mindesk", color: 0x0a84ff, glow: 0x9b7bff },
};

// Used only if the GitHub API can't be reached (offline / rate-limited).
const FALLBACK = {
  MinTransfer: { tag: "v1.0.3", assets: ["MinTransfer-1.0.3-mac-arm64.dmg", "MinTransfer-1.0.3-mac-x64.dmg", "MinTransfer-1.0.3-win-x64-setup.exe"] },
  MinSoundFX: { tag: "v1.0.0", assets: ["MinSoundFX-1.0.0-mac-arm64.dmg", "MinSoundFX-1.0.0-mac-x64.dmg", "MinSoundFX-1.0.0-win-x64-setup.exe"] },
  MinDesk: { tag: "v1.0.0", assets: ["MinDesk-1.0.0.dmg"] },
};

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------ */
/* Platform detection                                                  */
/* ------------------------------------------------------------------ */
function detectPlatform() {
  const ua = navigator.userAgent;
  const plat = navigator.userAgentData?.platform || navigator.platform || "";
  if (/Win/i.test(plat) || /Windows/i.test(ua)) return { os: "win" };
  if (/Mac/i.test(plat) || /Mac OS X/i.test(ua)) {
    let arch = "arm64";
    try {
      const gl = document.createElement("canvas").getContext("webgl");
      const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
      const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "";
      if (/Intel|AMD|Radeon/i.test(r)) arch = "x64";
    } catch {}
    return { os: "mac", arch };
  }
  return { os: "other" };
}
const PLATFORM = detectPlatform();

/* ------------------------------------------------------------------ */
/* Live downloads from GitHub Releases                                 */
/* ------------------------------------------------------------------ */
function classify(name) {
  if (/\.exe$/i.test(name)) return { key: "win", label: "Windows", sub: "10 / 11 · x64" };
  if (/arm64.*\.dmg$/i.test(name)) return { key: "mac-arm64", label: "macOS", sub: "Apple silicon" };
  if (/x64.*\.dmg$/i.test(name)) return { key: "mac-x64", label: "macOS", sub: "Intel" };
  if (/\.dmg$/i.test(name)) return { key: "mac", label: "macOS", sub: "Apple silicon & Intel" };
  return null;
}
const fmtSize = (b) => (b ? `${(b / 1048576).toFixed(0)} MB` : "");

async function fetchRelease(repo) {
  const ck = `rel:${repo}`;
  const cached = sessionStorage.getItem(ck);
  if (cached) return JSON.parse(cached);
  try {
    const r = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    const rel = {
      tag: j.tag_name,
      date: j.published_at,
      assets: j.assets.map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size, count: a.download_count })),
      live: true,
    };
    sessionStorage.setItem(ck, JSON.stringify(rel));
    return rel;
  } catch {
    const f = FALLBACK[repo];
    return {
      tag: f.tag,
      assets: f.assets.map((name) => ({ name, url: `https://github.com/${OWNER}/${repo}/releases/download/${f.tag}/${name}` })),
      live: false,
    };
  }
}

function isRecommended(key) {
  if (PLATFORM.os === "win") return key === "win";
  if (PLATFORM.os === "mac") return key === "mac" || key === `mac-${PLATFORM.arch}`;
  return false;
}

function renderButtons(container, rel) {
  const items = rel.assets.map((a) => ({ ...a, c: classify(a.name) })).filter((a) => a.c);
  items.sort((a, b) => isRecommended(b.c.key) - isRecommended(a.c.key));
  container.innerHTML = "";
  for (const a of items) {
    const el = document.createElement("a");
    el.className = "btn dl-btn" + (isRecommended(a.c.key) ? " rec" : "");
    el.href = a.url;
    el.rel = "noopener";
    el.innerHTML = `<span>${isRecommended(a.c.key) ? "↓ " : ""}${a.c.label}</span><small>${a.c.sub}${a.size ? " · " + fmtSize(a.size) : ""}</small>`;
    container.appendChild(el);
  }
}

async function initDownloads() {
  const note = document.getElementById("os-note");
  if (note) note.textContent = PLATFORM.os === "win" ? "We picked Windows for you." : PLATFORM.os === "mac" ? `We picked macOS (${PLATFORM.arch === "x64" ? "Intel" : "Apple silicon"}) for you.` : "";
  let total = 0, anyLive = false;
  await Promise.all(
    Object.keys(APPS).map(async (repo) => {
      const rel = await fetchRelease(repo);
      anyLive ||= rel.live;
      total += rel.assets.reduce((s, a) => s + (a.count || 0), 0);
      document.querySelectorAll(`[data-repo="${repo}"]`).forEach((block) => {
        const box = block.querySelector(".dl-buttons");
        if (box) renderButtons(box, rel);
        const ver = block.querySelector(".ver");
        if (ver) {
          const d = rel.date ? new Date(rel.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
          ver.innerHTML = `${rel.tag}${d ? " · " + d : ""} · <a href="https://github.com/${OWNER}/${repo}/releases" target="_blank" rel="noopener">release notes</a>`;
        }
      });
    })
  );
  const t = document.querySelector("[data-total-downloads]");
  if (t) {
    if (!anyLive) { t.textContent = "MIT"; t.nextElementSibling.textContent = "licensed"; return; }
    countUp(t, total);
  }
}
function countUp(el, to) {
  if (reduceMotion) return (el.textContent = to.toLocaleString());
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / 1400);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ------------------------------------------------------------------ */
/* Galleries, tilt, lightbox, reveal, nav                              */
/* ------------------------------------------------------------------ */
function initGalleries() {
  document.querySelectorAll("[data-gallery]").forEach((g) => {
    const img = g.querySelector(".screen-img");
    const buttons = [...g.querySelectorAll(".thumbs button")];
    let idx = 0, timer;
    const show = (i) => {
      idx = (i + buttons.length) % buttons.length;
      const b = buttons[idx];
      buttons.forEach((x) => x.classList.toggle("on", x === b));
      if (img.getAttribute("src") === b.dataset.src) return;
      const pre = new Image();
      pre.src = b.dataset.src;
      img.classList.add("swap");
      pre.onload = () => setTimeout(() => { img.src = b.dataset.src; img.alt = b.textContent; img.classList.remove("swap"); }, 180);
    };
    buttons.forEach((b, i) => b.addEventListener("click", () => { show(i); restart(); }));
    // Gentle auto-advance while visible, paused on hover.
    const restart = () => { clearInterval(timer); if (!reduceMotion) timer = setInterval(() => g.matches(":hover") || !g.classList.contains("in") || show(idx + 1), 4500); };
    restart();

    const screen = g.querySelector(".screen");
    screen.addEventListener("pointermove", (e) => {
      const r = screen.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      screen.style.transform = `rotateY(${(x - 0.5) * 8}deg) rotateX(${(0.5 - y) * 6}deg) scale(1.01)`;
      screen.style.setProperty("--gx", `${x * 100}%`);
      screen.style.setProperty("--gy", `${y * 100}%`);
    });
    screen.addEventListener("pointerleave", () => (screen.style.transform = ""));
    img.addEventListener("click", () => openLightbox(img.src, img.alt));
  });
}

const lb = document.getElementById("lightbox");
function openLightbox(src, alt) { lb.querySelector("img").src = src; lb.querySelector("img").alt = alt; lb.hidden = false; }
lb.addEventListener("click", () => (lb.hidden = true));
addEventListener("keydown", (e) => e.key === "Escape" && (lb.hidden = true));

const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

const nav = document.getElementById("nav");
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 20), { passive: true });

initGalleries();
initDownloads();

/* ------------------------------------------------------------------ */
/* Three.js hero                                                        */
/* ------------------------------------------------------------------ */
initHero().catch((err) => {
  console.warn("3D hero disabled:", err);
  document.getElementById("hero-canvas").style.display = "none";
});

async function initHero() {
  const THREE = await import("three");
  const { RoundedBoxGeometry } = await import("three/addons/geometries/RoundedBoxGeometry.js");
  const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");

  const canvas = document.getElementById("hero-canvas");
  const hero = canvas.parentElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.4, 13);

  const world = new THREE.Group();
  scene.add(world);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const l1 = new THREE.PointLight(0x2f80ff, 60, 30); l1.position.set(-5, 4, 6); scene.add(l1);
  const l2 = new THREE.PointLight(0x7c5cff, 60, 30); l2.position.set(5, -3, 5); scene.add(l2);
  const l3 = new THREE.PointLight(0x14d3a0, 40, 30); l3.position.set(0, 5, -4); scene.add(l3);

  // App tiles (rounded glassy slabs with the app icon on both faces)
  const loader = new THREE.TextureLoader();
  const tiles = [];
  const names = Object.keys(APPS);
  const tileGeo = new RoundedBoxGeometry(2.1, 2.1, 0.32, 8, 0.42);
  const iconGeo = new THREE.PlaneGeometry(2.62, 2.62);
  const R = 2.25;
  names.forEach((name, i) => {
    const app = APPS[name];
    const tex = loader.load(`assets/icons/${app.id}.png`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      tileGeo,
      new THREE.MeshPhysicalMaterial({ color: app.color, metalness: 0.3, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1, emissive: app.glow, emissiveIntensity: 0.08 })
    );
    const iconMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    const front = new THREE.Mesh(iconGeo, iconMat); front.position.z = 0.165;
    const back = new THREE.Mesh(iconGeo, iconMat); back.position.z = -0.165; back.rotation.y = Math.PI;
    g.add(body, front, back);
    const a = (i / names.length) * Math.PI * 2 + Math.PI / 2;
    g.userData = { name, id: app.id, base: new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R * 0.55 + 0.2, Math.sin(a) * 0.6), phase: i * 2.1, scale: 1 };
    g.position.copy(g.userData.base);
    body.userData.tile = g; front.userData.tile = g; back.userData.tile = g;
    world.add(g);
    tiles.push(g);
  });

  // Audio-bar ring (a nod to MinSoundFX)
  const BARS = 120;
  const barGeo = new THREE.BoxGeometry(0.05, 1, 0.05);
  barGeo.translate(0, 0.5, 0);
  const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const bars = new THREE.InstancedMesh(barGeo, barMat, BARS);
  const ringR = 3.2;
  const dummy = new THREE.Object3D();
  const cA = new THREE.Color(0x2f80ff), cB = new THREE.Color(0x7c5cff), cC = new THREE.Color(0x14d3a0), tmp = new THREE.Color();
  for (let i = 0; i < BARS; i++) {
    const t = i / BARS;
    t < 0.5 ? tmp.copy(cA).lerp(cB, t * 2) : tmp.copy(cB).lerp(cC, (t - 0.5) * 2);
    bars.setColorAt(i, tmp);
  }
  const ring = new THREE.Group();
  ring.add(bars);
  ring.rotation.x = 0.28;
  ring.position.y = -2.0;
  world.add(ring);

  // Star dust
  const N = 1400;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 6 + Math.random() * 14, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th) * 0.6, r * Math.cos(ph) - 4], i * 3);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x9fb4ff, size: 0.035, transparent: true, opacity: 0.7, depthWrite: false }));
  scene.add(dust);

  // Layout
  function resize() {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const wide = w > 900;
    world.position.x = wide ? Math.min(4.4, 1.2 + w / 450) : 0;
    world.position.y = wide ? 0.15 : 2.4;
    world.scale.setScalar(wide ? 0.92 : Math.max(0.55, w / 1000));
  }
  addEventListener("resize", resize);
  resize();

  // Interaction: drag to spin (with inertia), hover/click tiles
  const pointer = new THREE.Vector2(9, 9), ray = new THREE.Raycaster();
  let spin = 0, vel = 0.0025, dragging = false, lastX = 0, moved = 0, hovered = null;
  const mouse = { x: 0, y: 0 };
  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; moved = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointerup", (e) => {
    dragging = false;
    if (moved < 6 && hovered) document.getElementById(hovered.userData.id).scrollIntoView({ behavior: "smooth" });
  });
  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    mouse.x = pointer.x; mouse.y = pointer.y;
    if (dragging) { const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx); vel = dx * 0.0009; }
  });
  canvas.addEventListener("pointerleave", () => pointer.set(9, 9));

  // Only render while the hero is on screen
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(hero);

  const clock = new THREE.Clock();
  const pickables = tiles.flatMap((t) => t.children);
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = clock.getElapsedTime();
    const motion = reduceMotion ? 0 : 1;

    // Spin with inertia, easing back to a slow idle drift
    if (!dragging) vel += (0.0025 * motion - vel) * 0.02;
    spin += vel;

    // Scroll: lift and tilt the scene away as you leave the hero
    const sp = Math.min(1, scrollY / hero.clientHeight);
    world.rotation.x = -0.1 + mouse.y * 0.12 + sp * 0.5;
    world.rotation.z = sp * 0.15;
    camera.position.x += (mouse.x * 0.8 - camera.position.x) * 0.05;
    camera.position.y += (0.4 + mouse.y * 0.5 + sp * 2 - camera.position.y) * 0.05;
    camera.lookAt(world.position.x * 0.45, 0, 0);

    tiles.forEach((g) => {
      const { base, phase } = g.userData;
      const c = Math.cos(spin), s = Math.sin(spin);
      g.position.set(base.x * c - base.z * s, base.y + Math.sin(t * 1.1 + phase) * 0.18 * motion, base.x * s + base.z * c);
      g.rotation.y = -spin * 0.6 + Math.sin(t * 0.6 + phase) * 0.35 * motion;
      g.rotation.x = Math.sin(t * 0.8 + phase) * 0.12 * motion;
      const target = g === hovered ? 1.15 : 1;
      g.userData.scale += (target - g.userData.scale) * 0.12;
      g.scale.setScalar(g.userData.scale);
    });

    // Bars: layered sine "spectrum"
    for (let i = 0; i < BARS; i++) {
      const a = (i / BARS) * Math.PI * 2;
      const h = 0.15 + (0.5 + 0.5 * Math.sin(a * 3 + t * 2.2)) * 0.5 * (0.6 + 0.4 * Math.sin(a * 7 - t * 3.1)) + (hovered ? 0.25 : 0) * (0.5 + 0.5 * Math.sin(a * 12 + t * 8));
      dummy.position.set(Math.cos(a) * ringR, 0, Math.sin(a) * ringR);
      dummy.rotation.set(0, -a, 0);
      dummy.scale.set(1, motion ? h : 0.3, 1);
      dummy.updateMatrix();
      bars.setMatrixAt(i, dummy.matrix);
    }
    bars.instanceMatrix.needsUpdate = true;
    ring.rotation.y = spin * 0.3;

    dust.rotation.y = t * 0.015 * motion;

    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    hovered = hit ? hit.object.userData.tile : null;
    canvas.style.cursor = dragging ? "grabbing" : hovered ? "pointer" : "grab";

    renderer.render(scene, camera);
  }
  frame();
}
