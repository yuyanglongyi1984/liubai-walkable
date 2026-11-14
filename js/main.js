/**
 * Liubai (留白) — first walkable room: a cliff pavilion workshop.
 * First-person, pointer-lock, local assets only.
 */
import * as THREE from '../vendor/three.module.min.js';

const EYE = 1.58;
const WALK = 1.35;
const WALK_FAST = 2.05;
const PLAYER_R = 0.26;
const LOOK_SENS = 0.0018;

// Pavilion extents
const X0 = -4.35;
const X1 = 4.35;
const Z_BACK = 4.25;
const Z_FRONT = -1.2;
const Z_TERRACE = -5.55;
const CEIL = 3.32;
const COL_X = [-4.15, -1.4, 1.35, 4.15];
const COL_Z_FRONT = Z_FRONT;
const COL_Z_BACK = 4.05;
const COL_R = 0.16;

const FOG_COLOR = 0xd4ccc0;

const colliders = []; // {minx,miny,minz,maxx,maxy,maxz}

const $ = (id) => document.getElementById(id);

function addBoxCollider(x, y, z, w, h, d) {
  colliders.push({
    minx: x - w / 2,
    miny: y - h / 2,
    minz: z - d / 2,
    maxx: x + w / 2,
    maxy: y + h / 2,
    maxz: z + d / 2,
  });
}

function addCylinderCollider(x, z, r, y0 = 0, y1 = CEIL) {
  // Approximate with a square slightly smaller than the circle's AABB,
  // then also keep a cylinder list. Use a box of width 2r*0.9 for simplicity,
  // plus we handle cylinders separately.
  addBoxCollider(x, (y0 + y1) / 2, z, r * 1.7, y1 - y0, r * 1.7);
}

/* ---------- textures & materials ---------- */

function configColorMap(tex, repeatX = 1, repeatY = 1) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function configDataMap(tex, repeatX = 1, repeatY = 1) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function stdMat(map, nrm, rough, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    map,
    normalMap: nrm || null,
    roughnessMap: rough || null,
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0,
    side: opts.side ?? THREE.FrontSide,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    envMapIntensity: 0.2,
  });
  if (opts.normalScale) {
    m.normalScale.set(opts.normalScale, opts.normalScale);
  }
  if (opts.repeat && map) {
    // geometry UVs already encode world scale; don't also repeat the texture
  }
  return m;
}

function setBoxUVs(geometry, w, h, d, metersPerUV = 1.15) {
  const uv = geometry.attributes.uv;
  const spans = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const sx = spans[f][0] / metersPerUV;
    const sy = spans[f][1] / metersPerUV;
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * sx, uv.getY(idx) * sy);
    }
  }
  uv.needsUpdate = true;
}

function setPlaneUVs(geometry, w, h, metersPerUV = 1.15) {
  const uv = geometry.attributes.uv;
  const sx = w / metersPerUV;
  const sy = h / metersPerUV;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  }
  uv.needsUpdate = true;
}

function setCylUVs(geometry, radius, height, metersPerUV = 1.15) {
  const uv = geometry.attributes.uv;
  const sx = (2 * Math.PI * radius) / metersPerUV;
  const sy = height / metersPerUV;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  }
  uv.needsUpdate = true;
}

function boxMesh(w, h, d, mat, x, y, z, parent, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  setBoxUVs(geo, w, h, d, opts.uv ?? 1.15);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  if (opts.rotY) mesh.rotation.y = opts.rotY;
  if (opts.rotX) mesh.rotation.x = opts.rotX;
  if (opts.rotZ) mesh.rotation.z = opts.rotZ;
  mesh.castShadow = opts.cast !== false;
  mesh.receiveShadow = opts.recv !== false;
  parent.add(mesh);
  if (opts.collide) addBoxCollider(x, y, z, w, h, d);
  return mesh;
}

/* ---------- scene assembly ---------- */

function buildSky(scene, sunDir) {
  const uniforms = {
    uSun: { value: sunDir.clone().normalize() },
    uZenith: { value: new THREE.Color(0xb8b3aa) },
    uMid: { value: new THREE.Color(0xddd4c6) },
    uHorizon: { value: new THREE.Color(0xd8d0c4) },
    uBelow: { value: new THREE.Color(0xcfc6b8) },
    uSunTint: { value: new THREE.Color(0xffd9a0) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = wp.xyz - cameraPosition;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uSun, uZenith, uMid, uHorizon, uBelow, uSunTint;
      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        vec3 col = mix(uBelow, uHorizon, smoothstep(-0.35, 0.02, h));
        col = mix(col, uMid, smoothstep(0.0, 0.28, h));
        col = mix(col, uZenith, smoothstep(0.28, 0.9, h));
        float sun = pow(max(0.0, dot(dir, normalize(uSun))), 28.0);
        float haze = pow(max(0.0, dot(dir, normalize(uSun))), 4.0);
        col += uSunTint * sun * 0.45;
        col += uSunTint * haze * 0.08;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), mat);
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}

function buildBackdrop(scene, landscapeTex) {
  landscapeTex.colorSpace = THREE.SRGBColorSpace;
  landscapeTex.anisotropy = 8;
  const uniforms = {
    uMap: { value: landscapeTex },
    uFog: { value: new THREE.Color(FOG_COLOR) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D uMap;
      uniform vec3 uFog;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        // Fade lower third into mist, and soften the side / top edges
        float bot = smoothstep(0.0, 0.18, vUv.y);
        float top = smoothstep(1.0, 0.62, vUv.y);
        float side = smoothstep(0.0, 0.10, vUv.x) * smoothstep(1.0, 0.90, vUv.x);
        float keep = bot * top * side;
        vec3 col = mix(uFog, t.rgb, keep);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    fog: false,
    depthWrite: false,
  });
  // Wide painted vista. A plane (not a cylinder) keeps the painted horizon straight.
  const geo = new THREE.PlaneGeometry(170, 70);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(6, 20, -62);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

function buildMist(scene, mistTex) {
  mistTex.colorSpace = THREE.SRGBColorSpace;
  mistTex.wrapS = mistTex.wrapT = THREE.RepeatWrapping;
  const mats = [];
  const group = new THREE.Group();
  const planes = [
    { y: -0.4, z: -14, w: 70, h: 16, o: 0.55, ry: 0 },
    { y: 0.8, z: -20, w: 80, h: 14, o: 0.42, ry: 0.05 },
    { y: 1.6, z: -28, w: 90, h: 16, o: 0.32, ry: -0.04 },
    { y: 0.2, z: -10, w: 40, h: 8, o: 0.3, ry: 0.15 },
    { y: 2.4, z: -22, w: 50, h: 10, o: 0.22, ry: -0.2 },
  ];
  for (const p of planes) {
    const mat = new THREE.MeshBasicMaterial({
      map: mistTex,
      transparent: true,
      opacity: p.o,
      depthWrite: false,
      fog: true,
      color: 0xeee6da,
      side: THREE.DoubleSide,
    });
    mats.push(mat);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), mat);
    mesh.position.set(0, p.y, p.z);
    mesh.rotation.y = p.ry;
    mesh.renderOrder = -5;
    group.add(mesh);
  }
  // Horizontal sea of mist just below the terrace
  const seaMat = new THREE.MeshBasicMaterial({
    map: mistTex,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    color: 0xe8e0d4,
    side: THREE.DoubleSide,
  });
  mats.push(seaMat);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -1.6, -28);
  sea.renderOrder = -6;
  group.add(sea);
  scene.add(group);
  return { group, mats };
}

function buildCliff(scene, mats) {
  const g = new THREE.Group();
  // Mass behind the pavilion
  boxMesh(22, 16, 6, mats.rock, 0, 5.5, Z_BACK + 3.6, g, { uv: 3.2, cast: false });
  // Left shoulder — kept well off the terrace so the vista stays open
  boxMesh(5, 14, 14, mats.rock, X0 - 5.2, 5, 1.2, g, { uv: 3.2, cast: false });
  // Right shoulder, slightly further so the view stays open
  boxMesh(4.5, 12, 10, mats.rock, X1 + 3.8, 4.2, 1.5, g, { uv: 3.0, cast: false });
  // Ledge under the terrace, barely visible
  boxMesh(14, 3.5, 5, mats.rock, 0.4, -2.1, -2.2, g, { uv: 2.5, cast: false, collide: false });
  scene.add(g);
  // Colliders so the player cannot walk into the cliff
  addBoxCollider(0, 5, Z_BACK + 2.2, 16, 16, 4);
  addBoxCollider(X0 - 4.4, 4, 1.2, 3, 14, 14);
  addBoxCollider(X1 + 3.0, 4, 1, 3, 12, 12);
  return g;
}

function buildFloor(scene, mats) {
  const w = X1 - X0 + 1.2;
  const depth = Z_BACK - Z_TERRACE + 0.8;
  const zc = (Z_BACK + Z_TERRACE) / 2;
  const geo = new THREE.PlaneGeometry(w, depth);
  setPlaneUVs(geo, w, depth, 3.5);
  const floor = new THREE.Mesh(geo, mats.stone);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, zc);
  floor.receiveShadow = true;
  scene.add(floor);

  // Invisible floor collider not needed; we lock y.
  // Threshold beam at the opening
  boxMesh(X1 - X0 - 0.1, 0.06, 0.16, mats.wood, 0, 0.03, Z_FRONT, scene, {
    uv: 1.1,
    cast: false,
  });
}

function makeColumn(x, z, mats, parent) {
  const h = CEIL;
  const shaft = new THREE.CylinderGeometry(COL_R * 0.92, COL_R, h - 0.22, 14);
  setCylUVs(shaft, COL_R, h, 0.9);
  const col = new THREE.Mesh(shaft, mats.wood);
  col.position.set(x, (h - 0.22) / 2 + 0.18, z);
  col.castShadow = true;
  col.receiveShadow = true;
  parent.add(col);

  // Stone plinth
  boxMesh(0.5, 0.18, 0.5, mats.stone, x, 0.09, z, parent, { uv: 0.9, collide: false });
  // Wood plinth cap
  boxMesh(0.4, 0.06, 0.4, mats.wood, x, 0.2, z, parent, { uv: 0.7 });
  // Capital
  boxMesh(0.5, 0.1, 0.5, mats.wood, x, CEIL - 0.05, z, parent, { uv: 0.7 });
  addCylinderCollider(x, z, COL_R + 0.08, 0, CEIL);
}

function addBracket(parent, mats, x, y, z, alongX) {
  // Simple que-ti / support under a beam
  const w = alongX ? 0.55 : 0.14;
  const d = alongX ? 0.14 : 0.55;
  boxMesh(w, 0.08, d, mats.wood, x, y, z, parent, { uv: 0.6 });
  boxMesh(alongX ? 0.22 : 0.1, 0.18, alongX ? 0.1 : 0.22, mats.wood, x, y - 0.1, z, parent, {
    uv: 0.5,
  });
}

function buildFrame(scene, mats) {
  const g = new THREE.Group();
  // Columns
  for (const x of COL_X) {
    makeColumn(x, COL_Z_FRONT, mats, g);
    makeColumn(x, COL_Z_BACK, mats, g);
  }

  // Main beams along X (front and back, at ceiling)
  const spanX = COL_X[3] - COL_X[0];
  const midX = (COL_X[0] + COL_X[3]) / 2;
  boxMesh(spanX + 0.5, 0.22, 0.28, mats.wood, midX, CEIL - 0.16, COL_Z_FRONT, g, { uv: 1.0 });
  boxMesh(spanX + 0.5, 0.22, 0.28, mats.wood, midX, CEIL - 0.16, COL_Z_BACK, g, { uv: 1.0 });

  // Beams along Z between front and back, at each column line
  const spanZ = COL_Z_BACK - COL_Z_FRONT;
  const midZ = (COL_Z_FRONT + COL_Z_BACK) / 2;
  for (const x of COL_X) {
    boxMesh(0.24, 0.2, spanZ, mats.wood, x, CEIL - 0.16, midZ, g, { uv: 1.0 });
  }

  // Secondary purlins / rafters under the ceiling, along X
  for (let i = 1; i <= 5; i++) {
    const z = COL_Z_FRONT + (spanZ * i) / 6;
    boxMesh(spanX + 0.3, 0.08, 0.1, mats.wood, midX, CEIL - 0.28, z, g, {
      uv: 1.0,
      cast: false,
    });
  }

  // Ceiling boards (darker wood plane)
  const ceilGeo = new THREE.PlaneGeometry(spanX + 0.8, spanZ + 0.6);
  setPlaneUVs(ceilGeo, spanX + 0.8, spanZ + 0.6, 0.9);
  const ceil = new THREE.Mesh(ceilGeo, mats.woodDark);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(midX, CEIL, midZ);
  ceil.receiveShadow = true;
  g.add(ceil);

  // Eaves extending over the terrace
  const eaveDepth = 1.55;
  const eaveZ = COL_Z_FRONT - eaveDepth / 2;
  boxMesh(spanX + 0.9, 0.1, eaveDepth, mats.woodDark, midX, CEIL + 0.04, eaveZ, g, {
    uv: 1.0,
    cast: false,
  });
  boxMesh(spanX + 0.95, 0.16, 0.2, mats.wood, midX, CEIL - 0.08, COL_Z_FRONT - eaveDepth, g, {
    uv: 1.0,
  });
  // Eave rafters
  for (let i = 0; i < 9; i++) {
    const x = COL_X[0] - 0.15 + ((spanX + 0.3) * i) / 8;
    boxMesh(0.07, 0.07, eaveDepth, mats.wood, x, CEIL - 0.12, eaveZ, g, { uv: 0.7, cast: false });
  }

  // Brackets at front columns
  for (const x of COL_X) {
    addBracket(g, mats, x, CEIL - 0.32, COL_Z_FRONT + 0.22, true);
    addBracket(g, mats, x, CEIL - 0.32, COL_Z_FRONT - 0.22, true);
  }

  // Decorative fascia above the opening (a slightly thicker carved-looking band)
  boxMesh(spanX + 0.4, 0.26, 0.12, mats.wood, midX, CEIL - 0.42, COL_Z_FRONT + 0.05, g, {
    uv: 0.8,
  });

  scene.add(g);
}

function screenPanel(mats, w, h, x, y, z, rotY, parent, opts = {}) {
  const mat = opts.bare ? mats.wood : mats.screen;
  // Thin box so it has presence
  const m = boxMesh(w, h, 0.045, mat, x, y, z, parent, {
    uv: opts.bare ? 0.9 : Math.max(w, h),
    rotY,
    collide: opts.collide !== false,
  });
  if (opts.bare) {
    // Empty frame: four edges only, remove the solid panel look by adding a hole
    // Simpler: a frame of wood around open air
    parent.remove(m);
    const t = 0.07;
    const cx = x;
    const cy = y;
    const cz = z;
    // We'll build a frame aligned in XY, then rotate the group
    const fg = new THREE.Group();
    fg.position.set(cx, cy, cz);
    fg.rotation.y = rotY || 0;
    const parts = [
      [w, t, 0.05, 0, h / 2 - t / 2, 0],
      [w, t, 0.05, 0, -h / 2 + t / 2, 0],
      [t, h, 0.05, -w / 2 + t / 2, 0, 0],
      [t, h, 0.05, w / 2 - t / 2, 0, 0],
    ];
    // A few inner muntins, incomplete — 留白
    const inner = [
      [t * 0.7, h * 0.55, 0.04, -w * 0.18, -h * 0.1, 0],
      [w * 0.45, t * 0.7, 0.04, 0.05, h * 0.12, 0],
    ];
    for (const [pw, ph, pd, px, py, pz] of parts.concat(inner)) {
      boxMesh(pw, ph, pd, mats.wood, px, py, pz, fg, { uv: 0.6 });
    }
    parent.add(fg);
    if (opts.collide !== false) addBoxCollider(x, y, z, Math.abs(Math.cos(rotY || 0)) * w + 0.08, h, Math.abs(Math.sin(rotY || 0)) * w + 0.08);
    return fg;
  }
  // Wooden outer frame slightly proud of the paper
  const t = 0.055;
  const fg = new THREE.Group();
  // frames already baked into the screen texture; a slight physical frame helps at grazing angles
  boxMesh(w + 0.02, t, 0.06, mats.wood, x, y + h / 2 - t / 2, z, parent, {
    uv: 0.6,
    rotY,
    cast: false,
  });
  boxMesh(w + 0.02, t, 0.06, mats.wood, x, y - h / 2 + t / 2, z, parent, {
    uv: 0.6,
    rotY,
    cast: false,
  });
  return m;
}

function buildWalls(scene, mats) {
  const g = new THREE.Group();
  const wallH = CEIL - 0.15;
  const wallY = wallH / 2;

  // Back wall: three paper/lattice panels between back columns, rightmost unfinished
  for (let i = 0; i < 3; i++) {
    const a = COL_X[i];
    const b = COL_X[i + 1];
    const w = b - a - COL_R * 2 - 0.08;
    const x = (a + b) / 2;
    const bare = i === 2; // 留白: back-right panel is only a frame
    screenPanel(mats, w, wallH - 0.2, x, wallY, Z_BACK - 0.02, 0, g, { bare });
  }
  // Solid collider along the back (the screens already collide; add a thin safety wall)
  addBoxCollider(0, wallY, Z_BACK + 0.12, X1 - X0, wallH, 0.2);

  // Left wall: plaster / paper panels, with shelves standing in front
  const leftZ0 = COL_Z_FRONT + 0.15;
  const leftZ1 = COL_Z_BACK - 0.15;
  const leftLen = leftZ1 - leftZ0;
  // Two panels along left side
  screenPanel(
    mats,
    leftLen * 0.48,
    wallH - 0.2,
    X0 + 0.04,
    wallY,
    leftZ0 + leftLen * 0.25,
    Math.PI / 2,
    g
  );
  screenPanel(
    mats,
    leftLen * 0.48,
    wallH - 0.2,
    X0 + 0.04,
    wallY,
    leftZ0 + leftLen * 0.75,
    Math.PI / 2,
    g
  );
  addBoxCollider(X0 - 0.12, wallY, (leftZ0 + leftZ1) / 2, 0.2, wallH, leftLen + 0.3);

  // Left front bay is closed with a lattice window (not a walkable opening)
  const winW = COL_X[1] - COL_X[0] - COL_R * 2 - 0.1;
  const winX = (COL_X[0] + COL_X[1]) / 2;
  screenPanel(mats, winW, wallH - 0.35, winX, wallY + 0.05, Z_FRONT - 0.02, 0, g);
  // A low sill under the window
  boxMesh(winW, 0.14, 0.22, mats.wood, winX, 0.16, Z_FRONT, g, { uv: 0.8, collide: true });

  // Right wall: a paper panel toward the back, and one screen left slightly ajar (留白).
  const rightBackLen = 2.2;
  screenPanel(
    mats,
    rightBackLen,
    wallH - 0.2,
    X1 - 0.04,
    wallY,
    COL_Z_BACK - 0.25 - rightBackLen / 2,
    Math.PI / 2,
    g
  );
  const rightScreenW = 1.55;
  const ajar = -0.38;
  screenPanel(
    mats,
    rightScreenW,
    wallH - 0.35,
    X1 - 0.22,
    wallY + 0.05,
    COL_Z_BACK - 2.55,
    Math.PI / 2 + ajar,
    g,
    { collide: true }
  );
  addBoxCollider(X1 + 0.2, wallY, 1.6, 0.25, wallH, 5.6);

  scene.add(g);
}

function makePaperStack(mats, parent, x, y, z, w, d, n, rot = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rot;
  let yy = 0;
  for (let i = 0; i < n; i++) {
    const th = 0.012 + Math.random() * 0.01;
    const jx = (Math.random() - 0.5) * 0.03;
    const jz = (Math.random() - 0.5) * 0.03;
    const jr = (Math.random() - 0.5) * 0.08;
    const pw = w * (0.94 + Math.random() * 0.08);
    const pd = d * (0.94 + Math.random() * 0.08);
    boxMesh(pw, th, pd, mats.paper, jx, yy + th / 2, jz, g, {
      uv: 0.5,
      rotY: jr,
      cast: i === n - 1,
    });
    yy += th;
  }
  parent.add(g);
  addBoxCollider(x, y + yy / 2, z, w, yy, d);
  return yy;
}

function makeScroll(mats, parent, x, y, z, len, rotY, rotX) {
  const geo = new THREE.CylinderGeometry(0.025, 0.025, len, 10);
  setCylUVs(geo, 0.025, len, 0.4);
  const m = new THREE.Mesh(geo, mats.paper);
  m.position.set(x, y, z);
  m.rotation.y = rotY || 0;
  m.rotation.z = rotX || Math.PI / 2;
  m.castShadow = true;
  parent.add(m);
}

function buildShelves(scene, mats) {
  const g = new THREE.Group();
  // Open-fronted shelves against the left wall, long axis along Z, open toward +X (the room).
  const sw = 0.4;
  const sl = 2.25;
  const sh = 1.7;
  const sx = X0 + 0.28 + sw / 2;
  const sz = 1.65;
  const backX = sx - sw / 2;
  const frontX = sx + sw / 2;

  boxMesh(0.04, sh, sl, mats.wood, backX, sh / 2, sz, g, { uv: 0.9 });
  boxMesh(sw, sh, 0.05, mats.wood, sx, sh / 2, sz + sl / 2, g, { uv: 0.9 });
  boxMesh(sw, sh, 0.05, mats.wood, sx, sh / 2, sz - sl / 2, g, { uv: 0.9 });
  boxMesh(0.05, sh, 0.05, mats.wood, frontX - 0.01, sh / 2, sz + sl / 2 - 0.02, g, { uv: 0.7 });
  boxMesh(0.05, sh, 0.05, mats.wood, frontX - 0.01, sh / 2, sz - sl / 2 + 0.02, g, { uv: 0.7 });
  const heights = [0.1, 0.52, 0.98, 1.4, 1.68];
  for (const hy of heights) {
    boxMesh(sw + 0.02, 0.035, sl - 0.02, mats.wood, sx, hy, sz, g, { uv: 0.8 });
  }
  addBoxCollider(sx, sh / 2, sz, sw + 0.08, sh, sl);

  const fx = sx + 0.01;
  makePaperStack(mats, g, fx, 0.14, sz + 0.55, 0.28, 0.34, 14, 0.05);
  makePaperStack(mats, g, fx, 0.14, sz + 0.05, 0.26, 0.3, 10, -0.08);
  makePaperStack(mats, g, fx, 0.14, sz - 0.5, 0.24, 0.28, 7, 0.1);
  makePaperStack(mats, g, fx, 0.56, sz + 0.6, 0.24, 0.28, 8, 0.08);
  makePaperStack(mats, g, fx, 0.56, sz - 0.15, 0.22, 0.26, 6, -0.05);
  makePaperStack(mats, g, fx, 1.02, sz + 0.45, 0.22, 0.26, 7, -0.04);
  makePaperStack(mats, g, fx, 1.02, sz - 0.45, 0.2, 0.24, 5, 0.12);
  makePaperStack(mats, g, fx, 1.44, sz + 0.2, 0.2, 0.24, 5, 0.1);

  makeScroll(mats, g, fx + 0.02, 0.6, sz - 0.55, 0.32, 0.2, Math.PI / 2);
  makeScroll(mats, g, fx - 0.05, 0.63, sz - 0.48, 0.3, 0.4, Math.PI / 2);

  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    mats.ceramic
  );
  bowl.position.set(fx + 0.02, 1.08, sz + 0.65);
  bowl.castShadow = true;
  g.add(bowl);

  boxMesh(0.2, 0.03, 0.16, mats.cloth, fx, 1.055, sz + 0.2, g, { uv: 0.4, rotY: 0.2 });

  const cx = X0 + 0.7;
  const cz = 0.35;
  boxMesh(0.55, 0.42, 0.42, mats.wood, cx, 0.21, cz, g, { uv: 0.7, collide: true });
  boxMesh(0.57, 0.04, 0.04, mats.wood, cx, 0.4, cz + 0.2, g, { uv: 0.5 });
  boxMesh(0.57, 0.04, 0.04, mats.wood, cx, 0.4, cz - 0.2, g, { uv: 0.5 });
  makePaperStack(mats, g, cx, 0.43, cz, 0.28, 0.3, 6, 0.15);

  const lean = new THREE.Group();
  lean.position.set(X1 - 0.7, 0, COL_Z_BACK - 0.55);
  for (let i = 0; i < 3; i++) {
    boxMesh(0.12, 1.4, 0.04, mats.wood, i * 0.05, 0.7, i * 0.03, lean, {
      uv: 0.8,
      rotZ: 0.12 + i * 0.04,
      rotY: 0.3,
    });
  }
  g.add(lean);
  addBoxCollider(X1 - 0.7, 0.7, COL_Z_BACK - 0.55, 0.4, 1.4, 0.3);

  scene.add(g);
}

function makeBrush(mats, length = 0.36) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0065, 0.0075, length * 0.68, 8),
    mats.woodDesk
  );
  handle.position.y = length * 0.2;
  g.add(handle);
  const ferrule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0078, 0.0078, 0.018, 8),
    mats.ink
  );
  ferrule.position.y = length * 0.2 - length * 0.34;
  g.add(ferrule);
  const hair = new THREE.Mesh(
    new THREE.CylinderGeometry(0.003, 0.008, length * 0.28, 8),
    mats.ink
  );
  hair.position.y = length * 0.2 - length * 0.34 - length * 0.14;
  g.add(hair);
  return g;
}

function buildDesk(scene, mats) {
  const g = new THREE.Group();
  const dx = 0.35;
  const dz = 1.05;
  const topW = 1.9;
  const topD = 0.92;
  const topY = 0.72;

  boxMesh(topW, 0.05, topD, mats.woodDesk, dx, topY, dz, g, { uv: 0.85, collide: false });
  // Apron
  boxMesh(topW - 0.04, 0.07, 0.04, mats.woodDesk, dx, topY - 0.06, dz + topD / 2 - 0.03, g, {
    uv: 0.7,
  });
  boxMesh(topW - 0.04, 0.07, 0.04, mats.woodDesk, dx, topY - 0.06, dz - topD / 2 + 0.03, g, {
    uv: 0.7,
  });

  const legW = 0.065;
  const legH = topY - 0.025;
  const inset = 0.08;
  const lx = topW / 2 - inset;
  const lz = topD / 2 - inset;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      boxMesh(legW, legH, legW, mats.woodDesk, dx + sx * lx, legH / 2, dz + sz * lz, g, {
        uv: 0.6,
      });
    }
  }
  // Stretchers
  boxMesh(topW - inset * 2, 0.035, 0.035, mats.woodDesk, dx, 0.16, dz + lz, g, { uv: 0.6 });
  boxMesh(topW - inset * 2, 0.035, 0.035, mats.woodDesk, dx, 0.16, dz - lz, g, { uv: 0.6 });

  addBoxCollider(dx, topY / 2, dz, topW, topY + 0.02, topD);

  // Paper — mostly blank, faint ink in the corner
  boxMesh(0.52, 0.003, 0.37, mats.paperFaint, dx + 0.18, topY + 0.028, dz + 0.02, g, {
    uv: 0.5,
    rotY: -0.04,
    cast: false,
  });

  // Inkstone
  const stone = boxMesh(0.16, 0.022, 0.11, mats.ink, dx - 0.48, topY + 0.036, dz + 0.12, g, {
    uv: 0.3,
    rotY: 0.08,
  });
  // Wet well
  const well = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.034, 0.008, 16),
    mats.inkWet
  );
  well.position.set(dx - 0.48, topY + 0.05, dz + 0.12);
  g.add(well);

  // Ink stick
  boxMesh(0.08, 0.012, 0.022, mats.ink, dx - 0.48, topY + 0.032, dz - 0.08, g, {
    uv: 0.3,
    rotY: 0.4,
  });

  // Brushes on the table
  const b1 = makeBrush(mats, 0.34);
  b1.position.set(dx - 0.12, topY + 0.04, dz - 0.18);
  b1.rotation.z = Math.PI / 2;
  b1.rotation.y = 0.15;
  g.add(b1);

  const b2 = makeBrush(mats, 0.32);
  b2.position.set(dx - 0.1, topY + 0.04, dz - 0.22);
  b2.rotation.z = Math.PI / 2;
  b2.rotation.y = 0.22;
  g.add(b2);

  // Small brush rest
  boxMesh(0.12, 0.018, 0.03, mats.woodDesk, dx - 0.2, topY + 0.034, dz - 0.2, g, {
    uv: 0.4,
    rotY: 0.18,
  });

  // Bench in front of the desk (toward the back of the room, +Z)
  const bx = dx + 0.05;
  const bz = dz + 0.72;
  boxMesh(1.15, 0.04, 0.28, mats.woodDesk, bx, 0.32, bz, g, { uv: 0.8 });
  boxMesh(0.05, 0.3, 0.26, mats.woodDesk, bx - 0.48, 0.15, bz, g, { uv: 0.6 });
  boxMesh(0.05, 0.3, 0.26, mats.woodDesk, bx + 0.48, 0.15, bz, g, { uv: 0.6 });
  addBoxCollider(bx, 0.17, bz, 1.15, 0.34, 0.28);

  // Contact shadow cards
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x1a1612,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(topW * 1.05, topD * 1.08), shadowMat);
  sh.rotation.x = -Math.PI / 2;
  sh.position.set(dx, 0.01, dz);
  sh.renderOrder = 1;
  g.add(sh);

  scene.add(g);
}

function buildBucket(scene, mats) {
  const g = new THREE.Group();
  const x = X1 - 0.7;
  const z = Z_FRONT + 0.55;
  const outer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.15, 0.34, 16, 1, true),
    mats.wood
  );
  setCylUVs(outer.geometry, 0.18, 0.34, 0.6);
  outer.position.set(x, 0.18, z);
  outer.castShadow = true;
  g.add(outer);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), mats.wood);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.set(x, 0.02, z);
  g.add(bottom);
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.165, 0.135, 0.3, 16, 1, true),
    mats.woodDark
  );
  inner.position.set(x, 0.2, z);
  g.add(inner);
  // Bands
  for (const hy of [0.08, 0.28]) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(hy < 0.2 ? 0.155 : 0.175, 0.01, 6, 16),
      mats.ink
    );
    band.rotation.x = Math.PI / 2;
    band.position.set(x, hy, z);
    g.add(band);
  }
  addBoxCollider(x, 0.18, z, 0.38, 0.36, 0.38);
  scene.add(g);
}

function railingPost(mats, parent, x, z) {
  boxMesh(0.11, 0.92, 0.11, mats.wood, x, 0.52, z, parent, { uv: 0.7, collide: true });
  boxMesh(0.16, 0.05, 0.16, mats.wood, x, 0.98, z, parent, { uv: 0.5 });
  boxMesh(0.2, 0.08, 0.2, mats.stone, x, 0.04, z, parent, { uv: 0.5, collide: false });
}

function railingSpan(mats, parent, x0, z0, x1, z1) {
  const mx = (x0 + x1) / 2;
  const mz = (z0 + z1) / 2;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const rotY = Math.atan2(dx, dz) + Math.PI / 2;
  // Top, mid, bottom rails
  for (const y of [0.9, 0.58, 0.28]) {
    boxMesh(len, 0.045, 0.055, mats.wood, mx, y, mz, parent, { uv: 0.8, rotY, collide: y === 0.58 });
  }
  // Short verticals
  const n = Math.max(2, Math.round(len / 0.32));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = x0 + dx * t;
    const z = z0 + dz * t;
    boxMesh(0.035, 0.6, 0.035, mats.wood, x, 0.58, z, parent, { uv: 0.5 });
  }
}

function buildRailing(scene, mats) {
  const g = new THREE.Group();
  // Front edge posts
  const zE = Z_TERRACE + 0.18;
  const xs = [-4.05, -2.7, -1.35, 0, 1.35, 2.7, 4.05];
  for (const x of xs) railingPost(mats, g, x, zE);
  for (let i = 0; i < xs.length - 1; i++) railingSpan(mats, g, xs[i], zE, xs[i + 1], zE);

  // Left side of terrace
  const zS = [Z_FRONT - 0.15, -2.6, -4.05, zE];
  const xL = X0 + 0.2;
  for (const z of zS) railingPost(mats, g, xL, z);
  for (let i = 0; i < zS.length - 1; i++) railingSpan(mats, g, xL, zS[i], xL, zS[i + 1]);

  // Right side
  const xR = X1 - 0.2;
  for (const z of zS) railingPost(mats, g, xR, z);
  for (let i = 0; i < zS.length - 1; i++) railingSpan(mats, g, xR, zS[i], xR, zS[i + 1]);

  // Invisible barriers — player cannot fall
  addBoxCollider(0, 0.6, Z_TERRACE + 0.05, 9.2, 1.3, 0.28);
  addBoxCollider(X0 + 0.05, 0.6, (Z_FRONT + Z_TERRACE) / 2, 0.28, 1.3, 4.6);
  addBoxCollider(X1 - 0.05, 0.6, (Z_FRONT + Z_TERRACE) / 2, 0.28, 1.3, 4.6);
  // Hard world bounds just beyond
  addBoxCollider(0, 1, Z_TERRACE - 0.4, 14, 3, 0.4);
  addBoxCollider(0, 1, Z_BACK + 0.55, 14, 3, 0.4);

  scene.add(g);
}

function addPines(scene, pineTex) {
  pineTex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: pineTex,
    transparent: true,
    depthWrite: false,
    fog: true,
    side: THREE.DoubleSide,
  });
  const spots = [
    [-11, -0.2, -9, 5.5],
    [-9.5, 0.4, -14, 4.2],
    [10.5, 0.2, -8, 4.8],
    [-13, 1.0, -18, 6.0],
  ];
  for (const [x, y, z, h] of spots) {
    const w = h * 0.72;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y + h / 2, z);
    m.renderOrder = -2;
    scene.add(m);
  }
}

/* ---------- collision & controls ---------- */

function resolveCollision(px, py, pz) {
  const yTop = py;
  const yBot = py - EYE + 0.12;
  for (let pass = 0; pass < 3; pass++) {
    for (const c of colliders) {
      if (yTop < c.miny || yBot > c.maxy) continue;
      const nx = Math.max(c.minx, Math.min(px, c.maxx));
      const nz = Math.max(c.minz, Math.min(pz, c.maxz));
      let dx = px - nx;
      let dz = pz - nz;
      const d2 = dx * dx + dz * dz;
      const r = PLAYER_R;
      if (d2 < r * r) {
        if (d2 < 1e-8) {
          // Inside a box: push out along the smallest overlap
          const left = px - c.minx + r;
          const right = c.maxx - px + r;
          const back = pz - c.minz + r;
          const fwd = c.maxz - pz + r;
          const m = Math.min(left, right, back, fwd);
          if (m === left) px = c.minx - r;
          else if (m === right) px = c.maxx + r;
          else if (m === back) pz = c.minz - r;
          else pz = c.maxz + r;
        } else {
          const d = Math.sqrt(d2);
          const k = (r - d) / d;
          px += dx * k;
          pz += dz * k;
        }
      }
    }
  }
  return { x: px, z: pz };
}

/* ---------- bootstrap ---------- */

async function loadTextures() {
  const manager = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(manager);
  const load = (path) =>
    new Promise((resolve, reject) => {
      loader.load(
        path,
        (t) => resolve(t),
        undefined,
        (err) => reject(err || new Error('Failed to load ' + path))
      );
    });
  const T = 'assets/textures/';
  const names = {
    wood: 'wood.png',
    woodN: 'wood_n.png',
    woodR: 'wood_r.png',
    woodDesk: 'wood_desk.png',
    woodDeskN: 'wood_desk_n.png',
    woodDeskR: 'wood_desk_r.png',
    stone: 'stone.png',
    stoneN: 'stone_n.png',
    stoneR: 'stone_r.png',
    paper: 'paper.png',
    paperN: 'paper_n.png',
    paperR: 'paper_r.png',
    paperFaint: 'paper_faint.png',
    plaster: 'plaster.png',
    plasterN: 'plaster_n.png',
    plasterR: 'plaster_r.png',
    rock: 'rock.png',
    rockN: 'rock_n.png',
    rockR: 'rock_r.png',
    screen: 'screen.png',
    screenN: 'screen_n.png',
    screenR: 'screen_r.png',
    mist: 'mist.png',
    pine: 'pine.png',
    landscape: 'assets/landscape.jpg',
  };
  const out = {};
  const entries = Object.entries(names);
  await Promise.all(
    entries.map(async ([k, v]) => {
      const path = v.startsWith('assets/') ? v : T + v;
      out[k] = await load(path);
    })
  );
  return out;
}

function makeMaterials(tex) {
  configColorMap(tex.wood);
  configDataMap(tex.woodN);
  configDataMap(tex.woodR);
  configColorMap(tex.woodDesk);
  configDataMap(tex.woodDeskN);
  configDataMap(tex.woodDeskR);
  configColorMap(tex.stone);
  configDataMap(tex.stoneN);
  configDataMap(tex.stoneR);
  configColorMap(tex.paper);
  configDataMap(tex.paperN);
  configDataMap(tex.paperR);
  configColorMap(tex.paperFaint);
  configColorMap(tex.plaster);
  configDataMap(tex.plasterN);
  configDataMap(tex.plasterR);
  configColorMap(tex.rock);
  configDataMap(tex.rockN);
  configDataMap(tex.rockR);
  configColorMap(tex.screen);
  configDataMap(tex.screenN);
  configDataMap(tex.screenR);

  const wood = stdMat(tex.wood, tex.woodN, tex.woodR, {
    color: 0xe4d4c2,
    roughness: 0.78,
    normalScale: 0.7,
  });
  const woodDark = stdMat(tex.wood, tex.woodN, tex.woodR, {
    color: 0xb8a894,
    roughness: 0.86,
    normalScale: 0.5,
  });
  const woodDesk = stdMat(tex.woodDesk, tex.woodDeskN, tex.woodDeskR, {
    color: 0xf0e0cc,
    roughness: 0.7,
    normalScale: 0.85,
  });
  const stone = stdMat(tex.stone, tex.stoneN, tex.stoneR, {
    roughness: 0.9,
    normalScale: 1.1,
  });
  const paper = stdMat(tex.paper, tex.paperN, tex.paperR, {
    roughness: 0.88,
    normalScale: 0.4,
  });
  const paperFaint = stdMat(tex.paperFaint, tex.paperN, tex.paperR, {
    roughness: 0.88,
    normalScale: 0.35,
  });
  const plaster = stdMat(tex.plaster, tex.plasterN, tex.plasterR, {
    roughness: 0.9,
    normalScale: 0.4,
  });
  const rock = stdMat(tex.rock, tex.rockN, tex.rockR, {
    roughness: 0.95,
    normalScale: 1.3,
    color: 0xc8c2ba,
  });
  const screen = stdMat(tex.screen, tex.screenN, tex.screenR, {
    roughness: 0.84,
    normalScale: 0.55,
  });
  const ink = new THREE.MeshStandardMaterial({
    color: 0x141312,
    roughness: 0.45,
    metalness: 0.0,
  });
  const inkWet = new THREE.MeshStandardMaterial({
    color: 0x050506,
    roughness: 0.18,
    metalness: 0.05,
  });
  const ceramic = new THREE.MeshStandardMaterial({
    color: 0xb7a898,
    roughness: 0.35,
    metalness: 0.0,
  });
  const cloth = new THREE.MeshStandardMaterial({
    color: 0x2a2724,
    roughness: 0.9,
    metalness: 0.0,
  });
  return {
    wood,
    woodDark,
    woodDesk,
    stone,
    paper,
    paperFaint,
    plaster,
    rock,
    screen,
    ink,
    inkWet,
    ceramic,
    cloth,
  };
}

function setupLights(scene) {
  const hemi = new THREE.HemisphereLight(0xeee4d4, 0x6a645c, 0.95);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd4a0, 1.15);
  sun.position.set(14, 16, -26);
  sun.target.position.set(0, 1.1, 0);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -13;
  sun.shadow.camera.right = 13;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -6;
  sun.shadow.camera.near = 8;
  sun.shadow.camera.far = 55;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xd8d2ca, 0.48);
  fill.position.set(-8, 6, 10);
  scene.add(fill);

  const amb = new THREE.AmbientLight(0xcdc3b4, 0.32);
  scene.add(amb);

  // Soft warm pool near the opening, as if the dusk is spilling in
  const pool = new THREE.PointLight(0xffe0b0, 0.7, 11, 1.4);
  pool.position.set(1.2, 2.2, -2.4);
  scene.add(pool);

  // Gentle interior bounce so beams and walls stay readable
  const bounce = new THREE.PointLight(0xf0e6d6, 0.85, 11, 1.2);
  bounce.position.set(0.2, 2.7, 1.6);
  scene.add(bounce);

  return { sun, hemi };
}

async function main() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(FOG_COLOR, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.014);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 250);
  camera.position.set(1.15, EYE, 3.62);

  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  camera.lookAt(-0.35, 0.62, -3.8);
  const view = new URLSearchParams(location.search).get('view');
  if (view === 'shelves') {
    camera.position.set(-1.1, EYE, 3.35);
    camera.lookAt(-3.6, 1.1, 1.6);
  } else if (view === 'terrace') {
    camera.position.set(0.6, EYE, -3.15);
    camera.lookAt(1.2, 1.4, -18);
  } else if (view === 'desk') {
    camera.position.set(0.35, 1.22, 2.15);
    camera.lookAt(0.3, 0.85, -12);
  } else if (view === 'lookback') {
    camera.position.set(0.4, EYE, -3.3);
    camera.lookAt(0.2, 1.3, 3.5);
  }
  euler.setFromQuaternion(camera.quaternion);

  let tex;
  try {
    tex = await loadTextures();
  } catch (err) {
    console.error(err);
    const loading = $('loading');
    if (loading) loading.textContent = 'Failed to load assets';
    return;
  }

  const mats = makeMaterials(tex);
  const sunDir = new THREE.Vector3(14, 16, -26);
  const sky = buildSky(scene, sunDir);
  buildBackdrop(scene, tex.landscape);
  const mist = buildMist(scene, tex.mist);
  buildCliff(scene, mats);
  buildFloor(scene, mats);
  buildFrame(scene, mats);
  buildWalls(scene, mats);
  buildShelves(scene, mats);
  buildDesk(scene, mats);
  buildBucket(scene, mats);
  buildRailing(scene, mats);
  setupLights(scene);

  // Hide loader, fade title
  const loading = $('loading');
  const title = $('title');
  const hint = $('hint');
  requestAnimationFrame(() => {
    if (loading) loading.classList.add('hide');
    if (title) title.classList.add('show');
    setTimeout(() => title && title.classList.add('gone'), 5200);
  });

  // Controls
  const keys = Object.create(null);
  const onKey = (e, down) => {
    keys[e.code] = down;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
      e.preventDefault();
    }
  };
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));

  let locked = false;
  const canvas = renderer.domElement;
  canvas.addEventListener('click', () => {
    if (!locked) canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (locked && hint) hint.classList.add('gone');
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    euler.setFromQuaternion(camera.quaternion);
    euler.y -= e.movementX * LOOK_SENS;
    euler.x -= e.movementY * LOOK_SENS;
    const lim = Math.PI / 2 - 0.04;
    euler.x = Math.max(-lim, Math.min(lim, euler.x));
    euler.z = 0;
    camera.quaternion.setFromEuler(euler);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    // Keep sky around the camera
    sky.position.copy(camera.position);

    // Slow mist drift
    if (mist && mist.mats) {
      const t = clock.elapsedTime;
      mist.mats.forEach((m, i) => {
        if (m.map) {
          m.map.offset.x = (t * (0.003 + i * 0.0007)) % 1;
          m.map.offset.y = (t * (0.001 + i * 0.0003)) % 1;
        }
      });
    }

    const speed = keys.ShiftLeft || keys.ShiftRight ? WALK_FAST : WALK;
    fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    right.crossVectors(fwd, up).normalize();

    wish.set(0, 0, 0);
    if (keys.KeyW || keys.ArrowUp) wish.add(fwd);
    if (keys.KeyS || keys.ArrowDown) wish.sub(fwd);
    if (keys.KeyD || keys.ArrowRight) wish.add(right);
    if (keys.KeyA || keys.ArrowLeft) wish.sub(right);
    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(speed * dt);
      const nx = camera.position.x + wish.x;
      const nz = camera.position.z + wish.z;
      const res = resolveCollision(nx, camera.position.y, nz);
      camera.position.x = res.x;
      camera.position.z = res.z;
    }
    camera.position.y = EYE;

    renderer.render(scene, camera);
  }
  animate();
}

main().catch((err) => {
  console.error(err);
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.remove('hide');
    loading.textContent = 'Something went wrong';
  }
});
