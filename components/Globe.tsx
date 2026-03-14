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

    // Earth texture
    function makeEarth() {
      const sz = 1024;
      const cv = document.createElement("canvas");
      cv.width = cv.height = sz;
      const cx = cv.getContext("2d")!;
      const og = cx.createRadialGradient(sz*.5,sz*.5,0,sz*.5,sz*.5,sz*.7);
      og.addColorStop(0,"#021828"); og.addColorStop(1,"#010C14");
      cx.fillStyle = og; cx.fillRect(0,0,sz,sz);
      const lands = [
        [[150,95],[240,80],[330,110],[360,150],[380,220],[360,290],[320,320],[260,310],[200,270],[160,210],[140,150]],
        [[260,310],[290,310],[300,340],[270,360],[250,340]],
        [[260,360],[320,340],[360,380],[380,440],[380,520],[350,570],[300,580],[260,540],[240,470],[230,400]],
        [[270,40],[340,30],[380,50],[370,80],[310,90],[270,70]],
        [[460,90],[530,75],[580,85],[610,110],[590,150],[550,165],[510,160],[470,140],[450,115]],
        [[490,55],[540,40],[570,65],[555,100],[520,110],[490,90]],
        [[465,175],[550,160],[610,185],[640,250],[650,340],[620,420],[580,455],[530,460],[480,430],[440,360],[435,285],[450,220]],
        [[585,155],[630,145],[670,160],[675,200],[640,210],[600,190]],
        [[550,55],[680,45],[800,60],[870,90],[880,150],[840,190],[780,200],[700,185],[640,170],[590,155],[560,110],[540,80]],
        [[600,185],[660,170],[730,175],[800,185],[850,220],[840,280],[800,310],[750,310],[680,280],[640,250],[615,215]],
        [[660,230],[720,240],[770,260],[790,300],[770,340],[730,360],[680,340],[650,295],[645,255]],
        [[818,165],[832,155],[840,175],[826,190],[815,178]],
        [[710,340],[760,335],[790,345],[810,360],[780,375],[740,365],[715,352]],
        [[720,360],[800,345],[860,365],[880,415],[870,470],[820,500],[760,490],[720,455],[705,400]],
        [[462,100],[475,90],[482,108],[472,118],[460,110]],
      ];
      cx.fillStyle = "rgba(10,40,20,0.88)";
      lands.forEach(pts => {
        cx.beginPath();
        cx.moveTo(pts[0][0]*(sz/1024), pts[0][1]*(sz/512));
        pts.slice(1).forEach(p => cx.lineTo(p[0]*(sz/1024), p[1]*(sz/512)));
        cx.closePath(); cx.fill();
      });
      cx.fillStyle = "rgba(180,220,255,0.22)";
      cx.beginPath(); cx.ellipse(sz/2,8,sz*.35,18,0,0,Math.PI*2); cx.fill();
      cx.beginPath(); cx.ellipse(sz/2,sz-8,sz*.25,14,0,0,Math.PI*2); cx.fill();
      cx.strokeStyle = "rgba(0,180,255,0.05)"; cx.lineWidth = 0.6;
      for(let x=0;x<sz;x+=sz/12){cx.beginPath();cx.moveTo(x,0);cx.lineTo(x,sz);cx.stroke();}
      for(let y=0;y<sz;y+=sz/6){cx.beginPath();cx.moveTo(0,y);cx.lineTo(sz,y);cx.stroke();}
      return new THREE.CanvasTexture(cv);
    }

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1,72,72),
      new THREE.MeshPhongMaterial({
        map: makeEarth(), specular: new THREE.Color(0x112233),
        shininess: 12, emissive: new THREE.Color(0x001018), emissiveIntensity: 0.4,
      })
    );
    scene.add(earth);
    s.earth = earth;

    [{ r:1.065,o:.13,c:0x0066aa },{ r:1.14,o:.05,c:0x003344 }].forEach(({r,o,c})=>{
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(r,32,32),
        new THREE.MeshPhongMaterial({color:c,transparent:true,opacity:o,side:THREE.FrontSide,blending:THREE.AdditiveBlending,depthWrite:false})
      ));
    });
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.002,24,24),
      new THREE.MeshBasicMaterial({color:0x003344,wireframe:true,transparent:true,opacity:.06})
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
