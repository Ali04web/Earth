"use client";
import { useEffect, useRef, useCallback } from "react";
import type { Article } from "@/app/api/news/route";
import { CAT_COLORS } from "@/lib/constants";

interface GlobeProps {
  articles: Article[];
  activeSources: Set<string>;
  onPinHover: (art: Article | null, x: number, y: number) => void;
  onPinClick: (art: Article) => void;
  onRotate: (lat: number, lon: number) => void;
  flyTo?: [number, number] | null;
}

export default function Globe({ articles, activeSources, onPinHover, onPinClick, onRotate, flyTo }: GlobeProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const stateRef   = useRef({
    rotX: 0.3, rotY: 0, velX: 0, velY: 0,
    isDrag: false, prevX: 0, prevY: 0,
    time: 0, hoveredPin: null as any,
    pinMeshes: [] as any[],
    pinGroup: null as any,
    clouds: null as any,
    earth: null as any,
    camera: null as any,
    scene: null as any,
    renderer: null as any,
    THREE: null as any,
  });

  const initGlobe = useCallback(async () => {
    if (!canvasRef.current) return;
    const THREE = await import("three");
    const s = stateRef.current;
    s.THREE = THREE;
    const canvas = canvasRef.current;
    const wrap   = canvas.parentElement!;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    s.renderer = renderer;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 2.85;
    s.scene = scene; s.camera = camera;

    function resize() {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    function makeEarth() {
      const sz = 2048;
      const cv = document.createElement("canvas");
      cv.width = sz; cv.height = sz;
      const cx = cv.getContext("2d")!;
      const W = sz, H = sz;

      // --- Ocean background with depth gradient ---
      const oceanGrad = cx.createRadialGradient(W*0.5, H*0.45, 0, W*0.5, H*0.5, W*0.65);
      oceanGrad.addColorStop(0, "#061E30");
      oceanGrad.addColorStop(0.4, "#04162A");
      oceanGrad.addColorStop(0.7, "#021020");
      oceanGrad.addColorStop(1, "#010810");
      cx.fillStyle = oceanGrad;
      cx.fillRect(0, 0, W, H);

      // Subtle ocean noise pattern
      for (let i = 0; i < 18000; i++) {
        const x = Math.random() * W, y = Math.random() * H;
        const a = 0.02 + Math.random() * 0.03;
        cx.fillStyle = `rgba(${10+Math.random()*15|0},${30+Math.random()*20|0},${50+Math.random()*30|0},${a})`;
        cx.fillRect(x, y, 1+Math.random()*3, 1+Math.random()*3);
      }

      // Simple seeded noise function
      function noise2D(x: number, y: number) {
        const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return n - Math.floor(n);
      }

      function fbm(x: number, y: number, octaves = 4) {
        let val = 0, amp = 0.5, freq = 1;
        for (let i = 0; i < octaves; i++) {
          val += amp * noise2D(x * freq, y * freq);
          amp *= 0.5; freq *= 2;
        }
        return val;
      }

      // === CONTINENT DATA ===
      // Using equirectangular projection mapping: x = (lon+180)/360*W, y = (90-lat)/180*H
      function ll(lat: number, lon: number): [number,number] {
        return [(lon + 180) / 360 * W, (90 - lat) / 180 * H];
      }

      // -- Africa --
      const africa = [
        ll(37,-10), ll(37,-1), ll(36,0), ll(37,10), ll(33,12),
        ll(31,10), ll(32,25), ll(31,32), ll(27,34), ll(22,37),
        ll(15,43), ll(12,44), ll(11,51), ll(2,51), ll(-2,42),
        ll(-11,40), ll(-15,41), ll(-25,35), ll(-34,26), ll(-35,20),
        ll(-33,18), ll(-29,17), ll(-22,14), ll(-17,12), ll(-12,14),
        ll(-6,12), ll(0,10), ll(4,10), ll(5,5), ll(5,1),
        ll(4,-5), ll(6,-10), ll(5,-15), ll(10,-16), ll(15,-18),
        ll(20,-17), ll(22,-16), ll(27,-13), ll(30,-10), ll(35,-6),
      ];

      // -- Europe --
      const europe = [
        ll(36,-10), ll(38,-8), ll(43,-9), ll(44,-2), ll(46,-2),
        ll(48,-5), ll(51,-5), ll(54,-3), ll(57,-6), ll(58,-3),
        ll(55,8), ll(54,10), ll(56,13), ll(55,15), ll(54,14),
        ll(52,14), ll(50,18), ll(48,18), ll(47,20), ll(44,28),
        ll(46,30), ll(46,37), ll(45,40), ll(42,42), ll(42,28),
        ll(40,26), ll(38,24), ll(36,28), ll(37,36), ll(36,36),
        ll(35,33), ll(32,35), ll(31,32), ll(37,10), ll(36,0),
      ];

      // -- Asia (mainland) --
      const asia = [
        ll(46,37), ll(50,40), ll(55,38), ll(58,50), ll(60,60),
        ll(62,70), ll(64,80), ll(68,80), ll(70,90), ll(72,100),
        ll(72,120), ll(70,135), ll(68,140), ll(65,143), ll(60,145),
        ll(56,140), ll(55,135), ll(52,130), ll(48,135), ll(46,140),
        ll(43,145), ll(40,130), ll(38,120), ll(35,115), ll(30,122),
        ll(23,120), ll(22,114), ll(18,110), ll(20,107), ll(16,108),
        ll(10,107), ll(8,105), ll(1,104), ll(-6,106), ll(-8,115),
        ll(-8,120), ll(-7,130), ll(-6,140), ll(-4,125), ll(2,105),
        ll(10,99), ll(13,100), ll(18,98), ll(20,93), ll(22,90),
        ll(26,89), ll(28,88), ll(28,84), ll(30,78), ll(25,68),
        ll(24,62), ll(26,57), ll(22,60), ll(16,52), ll(13,45),
        ll(15,43), ll(22,37), ll(27,34), ll(31,32), ll(35,33),
        ll(36,36), ll(37,36), ll(38,40), ll(40,42), ll(42,42),
        ll(42,45),
      ];

      // -- North America --
      const northAmerica = [
        ll(50,-128), ll(54,-130), ll(59,-138), ll(60,-148), ll(63,-150),
        ll(65,-168), ll(72,-157), ll(71,-155), ll(70,-140), ll(68,-135),
        ll(70,-128), ll(72,-120), ll(72,-95), ll(72,-85), ll(70,-80),
        ll(65,-65), ll(60,-65), ll(55,-60), ll(48,-55), ll(47,-60),
        ll(45,-64), ll(43,-66), ll(42,-70), ll(41,-72), ll(38,-76),
        ll(35,-76), ll(32,-80), ll(30,-82), ll(29,-85), ll(30,-90),
        ll(29,-95), ll(26,-97), ll(22,-98), ll(18,-96), ll(16,-88),
        ll(15,-84), ll(10,-84), ll(8,-78), ll(8,-77), ll(10,-75),
        ll(12,-72), ll(12,-70), ll(11,-62), ll(20,-75), ll(25,-80),
        ll(30,-87), ll(29,-90), ll(30,-94), ll(32,-95), ll(32,-105),
        ll(32,-115), ll(33,-117), ll(35,-121), ll(38,-123), ll(42,-124),
        ll(46,-124), ll(49,-125),
      ];

      // -- South America --
      const southAmerica = [
        ll(12,-72), ll(12,-70), ll(8,-62), ll(6,-60), ll(5,-52),
        ll(0,-50), ll(-3,-42), ll(-5,-35), ll(-12,-37), ll(-18,-40),
        ll(-23,-42), ll(-28,-49), ll(-34,-53), ll(-38,-58), ll(-42,-64),
        ll(-48,-66), ll(-52,-70), ll(-55,-68), ll(-55,-70), ll(-52,-74),
        ll(-46,-76), ll(-40,-74), ll(-38,-72), ll(-33,-72), ll(-28,-71),
        ll(-20,-70), ll(-15,-76), ll(-10,-78), ll(-5,-81), ll(0,-80),
        ll(5,-77), ll(8,-78), ll(10,-75),
      ];

      // -- Australia --
      const australia = [
        ll(-12,132), ll(-12,137), ll(-15,141), ll(-18,146),
        ll(-24,152), ll(-28,154), ll(-33,152), ll(-37,150),
        ll(-39,147), ll(-37,140), ll(-35,137), ll(-34,136),
        ll(-32,133), ll(-32,128), ll(-30,115), ll(-26,114),
        ll(-22,114), ll(-18,122), ll(-14,130), ll(-13,131),
      ];

      // -- Greenland --
      const greenland = [
        ll(60,-44), ll(64,-40), ll(68,-30), ll(72,-22), ll(77,-18),
        ll(82,-20), ll(83,-30), ll(83,-45), ll(80,-65), ll(76,-72),
        ll(72,-56), ll(68,-52), ll(65,-50), ll(62,-48),
      ];

      // -- Indonesia/SE Asia islands --
      const sumatra = [ll(5,96), ll(2,99), ll(-2,101), ll(-5,105), ll(-6,106), ll(-4,104), ll(0,99), ll(3,97)];
      const borneo = [ll(7,117), ll(5,119), ll(2,118), ll(-1,117), ll(-3,116), ll(-2,112), ll(1,109), ll(4,110), ll(6,114)];
      const java = [ll(-6,106), ll(-7,108), ll(-8,112), ll(-8,114), ll(-7,114), ll(-6,110), ll(-6,107)];
      const newGuinea = [ll(-2,134), ll(-4,137), ll(-6,141), ll(-8,147), ll(-6,148), ll(-4,145), ll(-2,140), ll(-1,136)];

      // -- Japan --
      const japan = [ll(31,131), ll(33,132), ll(35,134), ll(37,137), ll(39,140), ll(41,141), ll(43,145), ll(44,145), ll(42,143), ll(39,140), ll(36,136), ll(34,133)];

      // -- UK/Ireland --
      const uk = [ll(50,-5), ll(51,-3), ll(52,1), ll(53,0), ll(55,-2), ll(57,-5), ll(58,-3), ll(57,-6), ll(54,-3), ll(51,-4)];
      const ireland = [ll(52,-10), ll(53,-7), ll(54,-6), ll(55,-7), ll(54,-10), ll(52,-10)];

      // -- Madagascar --
      const madagascar = [ll(-12,49), ll(-15,50), ll(-20,45), ll(-25,46), ll(-24,44), ll(-19,44), ll(-14,48)];

      // -- New Zealand --
      const nzNorth = [ll(-35,174), ll(-37,175), ll(-39,177), ll(-41,175), ll(-39,174), ll(-37,174)];
      const nzSouth = [ll(-42,172), ll(-44,169), ll(-46,167), ll(-47,168), ll(-45,170), ll(-43,172)];

      // -- Arabian Peninsula --
      const arabia = [ll(30,35), ll(27,37), ll(22,39), ll(16,43), ll(13,45), ll(15,52), ll(22,60), ll(26,57), ll(27,50), ll(28,48), ll(30,48), ll(32,36)];

      // -- India/Sri Lanka --
      const india = [ll(30,78), ll(28,73), ll(25,68), ll(22,69), ll(20,72), ll(17,73), ll(15,74), ll(12,75), ll(8,77), ll(8,79), ll(10,80),
        ll(13,80), ll(16,82), ll(18,84), ll(20,87), ll(22,90), ll(26,89), ll(28,88), ll(28,84)];
      const sriLanka = [ll(10,80), ll(8,80), ll(6,81), ll(7,82), ll(9,82)];

      // -- Korean Peninsula --
      const korea = [ll(34,126), ll(35,129), ll(37,129), ll(38,128), ll(39,127), ll(38,126), ll(36,126)];

      // Collected continents with terrain types
      const continents: {pts: [number,number][], baseColor: string, terrainHue: number}[] = [
        { pts: africa,       baseColor: "#0C3018", terrainHue: 100 },
        { pts: europe,       baseColor: "#102818", terrainHue: 120 },
        { pts: asia,         baseColor: "#0E2C16", terrainHue: 90 },
        { pts: northAmerica, baseColor: "#0D2E18", terrainHue: 110 },
        { pts: southAmerica, baseColor: "#0B3518", terrainHue: 130 },
        { pts: australia,    baseColor: "#2A2008", terrainHue: 40 },
        { pts: greenland,    baseColor: "#1A2830", terrainHue: 200 },
        { pts: sumatra,      baseColor: "#0E3518", terrainHue: 120 },
        { pts: borneo,       baseColor: "#0E3518", terrainHue: 120 },
        { pts: java,         baseColor: "#0E3518", terrainHue: 120 },
        { pts: newGuinea,    baseColor: "#0D3218", terrainHue: 115 },
        { pts: japan,        baseColor: "#102618", terrainHue: 110 },
        { pts: uk,           baseColor: "#102818", terrainHue: 130 },
        { pts: ireland,      baseColor: "#102A18", terrainHue: 135 },
        { pts: madagascar,   baseColor: "#103018", terrainHue: 100 },
        { pts: nzNorth,      baseColor: "#102818", terrainHue: 130 },
        { pts: nzSouth,      baseColor: "#102818", terrainHue: 130 },
        { pts: arabia,       baseColor: "#302810", terrainHue: 40 },
        { pts: india,        baseColor: "#182810", terrainHue: 80 },
        { pts: sriLanka,     baseColor: "#0E3518", terrainHue: 120 },
        { pts: korea,        baseColor: "#0E2C16", terrainHue: 110 },
      ];

      // -- Draw continents with terrain noise --
      continents.forEach(({ pts, terrainHue }) => {
        // Fill base shape
        cx.beginPath();
        cx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) cx.lineTo(pts[i][0], pts[i][1]);
        cx.closePath();
        cx.save();
        cx.clip();

        // Draw terrain noise into the clipped region
        const bounds = pts.reduce((b, p) => ({
          minX: Math.min(b.minX, p[0]), maxX: Math.max(b.maxX, p[0]),
          minY: Math.min(b.minY, p[1]), maxY: Math.max(b.maxY, p[1])
        }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

        const step = 4;
        for (let y = bounds.minY - step; y <= bounds.maxY + step; y += step) {
          for (let x = bounds.minX - step; x <= bounds.maxX + step; x += step) {
            const n = fbm(x * 0.008, y * 0.008, 5);
            const lat = 90 - (y / H) * 180;
            const absLat = Math.abs(lat);

            let h: number, s: number, l: number;
            if (absLat > 68) {
              // Snow/ice
              h = 200; s = 15 + n * 20; l = 65 + n * 20;
            } else if (n > 0.7) {
              // Mountains
              h = 30 + n * 10; s = 15 + n * 15; l = 18 + n * 12;
            } else if (n > 0.55) {
              // Hills/highlands
              h = terrainHue - 20 + n * 15; s = 25 + n * 20; l = 14 + n * 8;
            } else if (absLat > 50) {
              // Taiga/Tundra
              h = terrainHue + 10; s = 20 + n * 15; l = 12 + n * 8;
            } else if (absLat < 25 && n < 0.35) {
              // Desert regions
              h = 35 + n * 20; s = 30 + n * 20; l = 16 + n * 10;
            } else {
              // Forest/grassland
              h = terrainHue + (n * 30 - 15); s = 30 + n * 25; l = 10 + n * 10;
            }

            cx.fillStyle = `hsl(${h},${s}%,${l}%)`;
            cx.fillRect(x, y, step + 1, step + 1);
          }
        }
        cx.restore();

        // Coastline glow
        cx.beginPath();
        cx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) cx.lineTo(pts[i][0], pts[i][1]);
        cx.closePath();
        cx.strokeStyle = "rgba(0,180,255,0.18)";
        cx.lineWidth = 5;
        cx.stroke();
        cx.strokeStyle = "rgba(0,140,220,0.1)";
        cx.lineWidth = 10;
        cx.stroke();
        cx.strokeStyle = "rgba(0,100,180,0.05)";
        cx.lineWidth = 18;
        cx.stroke();
      });

      // === ICE CAPS ===
      // North pole
      for (let i = 0; i < 60; i++) {
        const cx2 = W * 0.3 + Math.random() * W * 0.4;
        const cy2 = Math.random() * H * 0.04;
        const r = 10 + Math.random() * 35;
        cx.fillStyle = `rgba(${160+Math.random()*40|0},${200+Math.random()*30|0},${220+Math.random()*30|0},${0.15+Math.random()*0.2})`;
        cx.beginPath(); cx.ellipse(cx2, cy2, r, r*0.5, Math.random()*0.5, 0, Math.PI*2); cx.fill();
      }
      // South pole
      for (let i = 0; i < 50; i++) {
        const cx2 = W * 0.2 + Math.random() * W * 0.6;
        const cy2 = H - Math.random() * H * 0.05;
        const r = 15 + Math.random() * 40;
        cx.fillStyle = `rgba(${160+Math.random()*40|0},${200+Math.random()*30|0},${225+Math.random()*25|0},${0.12+Math.random()*0.18})`;
        cx.beginPath(); cx.ellipse(cx2, cy2, r, r*0.6, Math.random()*0.5, 0, Math.PI*2); cx.fill();
      }

      // === CITY LIGHTS ===
      const cities: [number,number][] = [
        // North America
        [40.7,-74], [34,-118.2], [41.9,-87.6], [29.8,-95.4], [33.4,-112],
        [49.3,-123.1], [45.5,-73.6], [43.7,-79.4], [25.8,-80.2], [39,-77],
        [47.6,-122.3], [37.8,-122.4], [32.7,-117.2], [19.4,-99.1], [23.1,-82.4],
        // Europe
        [51.5,-0.1], [48.9,2.3], [52.5,13.4], [40.4,-3.7], [41.9,12.5],
        [59.3,18.1], [55.8,37.6], [50.1,14.4], [52.2,21], [47.5,19.1],
        [48.2,16.4], [38.7,-9.1], [60.2,24.9], [59.9,10.7], [53.3,-6.3],
        // Asia
        [35.7,139.7], [31.2,121.5], [39.9,116.4], [37.6,127], [22.3,114.2],
        [1.3,103.9], [13.8,100.5], [28.6,77.2], [19,72.9], [35,135.8],
        [34.7,135.5], [25,121.5], [14.6,121], [23.8,90.4], [24.9,67.1],
        // Middle East
        [25.2,55.3], [24.5,54.7], [21.5,39.2], [41,29], [32.1,34.8],
        // Africa
        [30,31.2], [33.6,-7.6], [-33.9,18.4], [-1.3,36.8], [6.5,3.4],
        [9,38.7], [36.8,3.1], [-26.2,28.1], [5.6,-0.2], [-4.3,15.3],
        // South America
        [-23.6,-46.6], [-34.6,-58.4], [-12,-77], [4.7,-74.1], [-33.4,-70.7],
        [10.5,-66.9], [-15.8,-48], [-0.2,-78.5],
        // Oceania
        [-33.9,151.2], [-37.8,145], [-41.3,174.8], [-36.8,174.8],
      ];

      cities.forEach(([lat, lon]) => {
        const x = (lon + 180) / 360 * W;
        const y = (90 - lat) / 180 * H;
        // Outer glow
        const g = cx.createRadialGradient(x, y, 0, x, y, 12);
        g.addColorStop(0, "rgba(255,200,80,0.5)");
        g.addColorStop(0.3, "rgba(255,180,60,0.2)");
        g.addColorStop(1, "rgba(255,160,40,0)");
        cx.fillStyle = g;
        cx.fillRect(x - 12, y - 12, 24, 24);
        // Core dot
        cx.fillStyle = "rgba(255,220,120,0.9)";
        cx.beginPath(); cx.arc(x, y, 1.5, 0, Math.PI * 2); cx.fill();
      });

      // === GRID LINES ===
      cx.strokeStyle = "rgba(0,180,255,0.035)";
      cx.lineWidth = 0.5;
      // Longitude lines every 15 degrees
      for (let lon = -180; lon <= 180; lon += 15) {
        const x = (lon + 180) / 360 * W;
        cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke();
      }
      // Latitude lines every 15 degrees
      for (let lat = -90; lat <= 90; lat += 15) {
        const y = (90 - lat) / 180 * H;
        cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke();
      }
      // Equator, tropics, arctic circles slightly brighter
      [0, 23.44, -23.44, 66.56, -66.56].forEach(lat => {
        const y = (90 - lat) / 180 * H;
        cx.strokeStyle = "rgba(0,180,255,0.06)";
        cx.lineWidth = 0.8;
        cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke();
      });

      // === OCEAN CURRENTS (subtle swirl lines) ===
      cx.strokeStyle = "rgba(0,120,200,0.025)";
      cx.lineWidth = 1.5;
      for (let i = 0; i < 40; i++) {
        const sx = Math.random() * W, sy = Math.random() * H;
        cx.beginPath(); cx.moveTo(sx, sy);
        let px = sx, py = sy;
        for (let j = 0; j < 30; j++) {
          const n = fbm(px * 0.003, py * 0.003, 3);
          const angle = n * Math.PI * 4;
          px += Math.cos(angle) * 8;
          py += Math.sin(angle) * 8;
          cx.lineTo(px, py);
        }
        cx.stroke();
      }

      const tex = new THREE.CanvasTexture(cv);
      tex.anisotropy = 8;
      return tex;
    }

    // --- CLOUD LAYER TEXTURE ---
    function makeClouds() {
      const sz = 1024;
      const cv = document.createElement("canvas");
      cv.width = sz; cv.height = sz;
      const cx = cv.getContext("2d")!;
      cx.clearRect(0, 0, sz, sz);

      function noise2D(x: number, y: number) {
        const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
        return n - Math.floor(n);
      }
      function cloudFbm(x: number, y: number) {
        let val = 0, amp = 0.5, freq = 1;
        for (let i = 0; i < 6; i++) {
          val += amp * noise2D(x * freq, y * freq);
          amp *= 0.5; freq *= 2.1;
        }
        return val;
      }

      const step = 4;
      for (let y = 0; y < sz; y += step) {
        for (let x = 0; x < sz; x += step) {
          const n = cloudFbm(x * 0.006 + 10, y * 0.006 + 20);
          if (n > 0.52) {
            const alpha = Math.min(1, (n - 0.52) * 3) * 0.35;
            cx.fillStyle = `rgba(200,220,240,${alpha})`;
            cx.fillRect(x, y, step + 1, step + 1);
          }
        }
      }

      const tex = new THREE.CanvasTexture(cv);
      return tex;
    }

    const earthTex = makeEarth();
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1,128,128),
      new THREE.MeshPhongMaterial({
        map: earthTex, specular: new THREE.Color(0x112233),
        shininess: 18, emissive: new THREE.Color(0x001018), emissiveIntensity: 0.35,
      })
    );
    scene.add(earth);
    s.earth = earth;

    // Cloud layer
    const cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.025, 64, 64),
      new THREE.MeshPhongMaterial({
        map: makeClouds(),
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.FrontSide,
      })
    );
    scene.add(cloudMesh);
    s.clouds = cloudMesh;

    // Atmosphere glow layers
    [{ r:1.06,o:.12,c:0x0077BB },{ r:1.12,o:.06,c:0x004466 },{ r:1.22,o:.025,c:0x002233 }].forEach(({r,o,c})=>{
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(r,48,48),
        new THREE.MeshPhongMaterial({color:c,transparent:true,opacity:o,side:THREE.FrontSide,blending:THREE.AdditiveBlending,depthWrite:false})
      ));
    });
    // Subtle wireframe grid on surface
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.003,36,36),
      new THREE.MeshBasicMaterial({color:0x003344,wireframe:true,transparent:true,opacity:.04})
    ));

    scene.add(new THREE.AmbientLight(0x102030,2.8));
    const sun = new THREE.DirectionalLight(0x4499CC,3);
    sun.position.set(3,1,2); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x001133,0.8);
    rim.position.set(-2,-1,-2); scene.add(rim);

    const sv: number[] = [];
    for(let i=0;i<4000;i++){
      const t=Math.random()*Math.PI*2,p=Math.acos(2*Math.random()-1),r=9+Math.random()*3;
      sv.push(r*Math.sin(p)*Math.cos(t),r*Math.cos(p),r*Math.sin(p)*Math.sin(t));
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position",new THREE.Float32BufferAttribute(sv,3));
    scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0x8899BB,size:.012})));

    const pinGroup = new THREE.Group();
    scene.add(pinGroup);
    s.pinGroup = pinGroup;

    // Raycaster for hover/click
    const raycaster = new THREE.Raycaster();
    function getNDC(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX-rect.left)/rect.width)*2-1,
        -((e.clientY-rect.top)/rect.height)*2+1
      );
    }

    canvas.addEventListener("mousedown", e => {
      s.isDrag = true; s.prevX = e.clientX; s.prevY = e.clientY;
      s.velX = s.velY = 0;
    });
    window.addEventListener("mouseup", () => { s.isDrag = false; });
    window.addEventListener("mousemove", e => {
      if (s.isDrag) {
        s.velY += (e.clientX-s.prevX)*0.007;
        s.velX += (e.clientY-s.prevY)*0.007;
        s.prevX = e.clientX; s.prevY = e.clientY;
        onRotate(+(s.rotX*57.3).toFixed(2), +(s.rotY*57.3%360).toFixed(2));
        return;
      }
      raycaster.setFromCamera(getNDC(e), camera);
      const hits = raycaster.intersectObjects(s.pinMeshes);
      if (hits.length) {
        canvas.style.cursor = "pointer";
        const pin = hits[0].object as any;
        if (s.hoveredPin !== pin) {
          s.hoveredPin = pin;
          onPinHover(pin.userData.arts?.[0] || null, e.clientX, e.clientY);
        }
      } else {
        canvas.style.cursor = "crosshair";
        if (s.hoveredPin) { s.hoveredPin = null; onPinHover(null, 0, 0); }
      }
    });
    canvas.addEventListener("click", e => {
      raycaster.setFromCamera(getNDC(e), camera);
      const hits = raycaster.intersectObjects(s.pinMeshes);
      if (hits.length) {
        const pin = hits[0].object as any;
        const art = pin.userData.arts?.[0];
        if (art) onPinClick(art);
      }
    });

    // Animate
    function animate() {
      requestAnimationFrame(animate);
      s.time += 0.012;
      if (!s.isDrag) s.velY += 0.0015;
      s.velX *= 0.93; s.velY *= 0.96;
      s.rotX += s.velX; s.rotY += s.velY;
      earth.rotation.x = s.rotX; earth.rotation.y = s.rotY;
      if (s.clouds) {
        s.clouds.rotation.x = s.rotX;
        s.clouds.rotation.y = s.rotY + s.time * 0.08;
      }
      s.pinGroup.rotation.x = s.rotX; s.pinGroup.rotation.y = s.rotY;
      s.pinGroup.children.forEach((obj: any) => {
        if (obj.userData.isRing) {
          const t = ((s.time + obj.userData.phase) % 2);
          obj.scale.setScalar(1 + t*1.8);
          obj.material.opacity = Math.max(0, 0.65 - t*0.35);
        }
      });
      renderer.render(scene, camera);
    }
    animate();
  }, [onPinHover, onPinClick, onRotate]);

  // Build pins when articles change
  useEffect(() => {
    const s = stateRef.current;
    if (!s.pinGroup || !s.THREE) return;
    const THREE = s.THREE;
    while (s.pinGroup.children.length) s.pinGroup.remove(s.pinGroup.children[0]);
    s.pinMeshes = [];

    function latLon2Vec(lat: number, lon: number, r=1.012) {
      const phi=(90-lat)*Math.PI/180, th=(lon+180)*Math.PI/180;
      return new THREE.Vector3(-r*Math.sin(phi)*Math.cos(th), r*Math.cos(phi), r*Math.sin(phi)*Math.sin(th));
    }

    const locMap: Record<string, Article[]> = {};
    articles.filter(a => a.geo && activeSources.has(a.source)).forEach(a => {
      const key = a.geo!.coords.join(",");
      if (!locMap[key]) locMap[key] = [];
      locMap[key].push(a);
    });

    Object.entries(locMap).forEach(([, arts]) => {
      const [lat,lon] = arts[0].geo!.coords;
      const color = CAT_COLORS[arts[0].cat] || 0x00D2FF;
      const pos = latLon2Vec(lat,lon);

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.013,8,8),
        new THREE.MeshBasicMaterial({color,blending:THREE.AdditiveBlending})
      );
      dot.position.copy(pos);
      dot.userData = { arts, lat, lon };
      s.pinGroup.add(dot);
      s.pinMeshes.push(dot);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(.018,.022,16),
        new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,side:THREE.DoubleSide,blending:THREE.AdditiveBlending})
      );
      ring.position.copy(pos);
      ring.lookAt(new THREE.Vector3(0,0,0));
      ring.userData = { isRing:true, phase:Math.random()*Math.PI*2 };
      s.pinGroup.add(ring);
    });
  }, [articles, activeSources]);

  // Fly to location
  useEffect(() => {
    if (!flyTo) return;
    const s = stateRef.current;
    const targetLon = -flyTo[1] * Math.PI/180;
    const targetLat = -flyTo[0] * Math.PI/180 * 0.4;
    s.velY += (targetLon - s.rotY) * 0.06;
    s.velX += (targetLat - s.rotX) * 0.06;
  }, [flyTo]);

  useEffect(() => { initGlobe(); }, [initGlobe]);

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-full"
      style={{ display: "block" }}
    />
  );
}
