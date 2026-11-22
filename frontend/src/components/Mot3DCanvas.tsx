import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type MotPhase = "highlight" | "tracking" | "recall" | "reveal";

interface Mot3DCanvasProps {
  roundKey: number;
  ballCount: number;
  targetIndices: number[];
  phase: MotPhase;
  speedScale: number; // 0.7..1.6
  enableOrbit: boolean;
  selectedIndices: number[];
  onToggleSelect: (ballIndex: number) => void;
}

interface BallEntity {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
}

const BOUNDS = { x: 3.35, y: 2.05, z: 1.75 };
const BALL_RADIUS = 0.34;

/**
 * Interactive Three.js 3D Multiple Object Tracking (MOT) Engine:
 * - Translucent neon 3D arena cube with depth grid floor
 * - Smooth 3D elastic physics + sphere-to-sphere repulsion (zero clipping)
 * - Full Raycaster hover highlight & click-to-lock selection in Recall phase
 */
export const Mot3DCanvas: React.FC<Mot3DCanvasProps> = ({
  roundKey,
  ballCount,
  targetIndices,
  phase,
  speedScale,
  enableOrbit,
  selectedIndices,
  onToggleSelect,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const propsRef = useRef({
    phase,
    targetSet: new Set(targetIndices),
    selectedSet: new Set(selectedIndices),
    speedScale,
    enableOrbit,
    onToggleSelect,
  });

  useEffect(() => {
    propsRef.current = {
      phase,
      targetSet: new Set(targetIndices),
      selectedSet: new Set(selectedIndices),
      speedScale,
      enableOrbit,
      onToggleSelect,
    };
  }, [phase, targetIndices, selectedIndices, speedScale, enableOrbit, onToggleSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    setWebglFailed(false);
    const width = container.clientWidth || 900;
    const height = Math.max(1, container.clientHeight || 520);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const aspect = width / height;
    const camera = new THREE.PerspectiveCamera(44, aspect, 0.1, 100);
    const computeCameraZ = (a: number) => (a < 1.15 ? Math.min(19.0, 11.4 / Math.max(0.45, a)) : 8.9);
    let baseCameraZ = computeCameraZ(aspect);
    camera.position.set(0, 0.65, baseCameraZ);
    camera.lookAt(0, 0, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0xbcd4f0, 0.78));
    const keyLight = new THREE.DirectionalLight(0xe0f2fe, 1.45);
    keyLight.position.set(4, 7, 8);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x38bdf8, 4.2, 18);
    rimLight.position.set(-4.5, 2.5, 3);
    scene.add(rimLight);
    const warmLight = new THREE.PointLight(0xf97316, 2.2, 16);
    warmLight.position.set(4.5, -2.5, 2.5);
    scene.add(warmLight);

    // Translucent 3D Arena Wireframe Box
    const boxGeo = new THREE.BoxGeometry(
      (BOUNDS.x + BALL_RADIUS) * 2,
      (BOUNDS.y + BALL_RADIUS) * 2,
      (BOUNDS.z + BALL_RADIUS) * 2
    );
    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const boxWire = new THREE.LineSegments(
      edgesGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.28 })
    );
    scene.add(boxWire);

    // Subtle spatial depth grid floor
    const grid = new THREE.GridHelper(7.4, 12, 0x0ea5e9, 0x1e293b);
    grid.position.y = -(BOUNDS.y + BALL_RADIUS);
    const gridMat = grid.material as THREE.Material;
    gridMat.transparent = true;
    gridMat.opacity = 0.35;
    scene.add(grid);

    // Create N non-overlapping balls with smooth 3D velocity vectors
    const sphereGeo = new THREE.SphereGeometry(BALL_RADIUS, 28, 28);
    const hitGeo = new THREE.SphereGeometry(BALL_RADIUS * 1.48, 12, 12);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const ringGeo = new THREE.TorusGeometry(BALL_RADIUS * 1.48, 0.032, 10, 48);
    const balls: BallEntity[] = [];
    const hitMeshes: THREE.Mesh[] = [];

    for (let i = 0; i < ballCount; i++) {
      const pos = new THREE.Vector3();
      for (let attempt = 0; attempt < 40; attempt++) {
        pos.set(
          (Math.random() * 2 - 1) * (BOUNDS.x - 0.3),
          (Math.random() * 2 - 1) * (BOUNDS.y - 0.3),
          (Math.random() * 2 - 1) * (BOUNDS.z - 0.3)
        );
        if (balls.every((b) => b.pos.distanceTo(pos) > BALL_RADIUS * 3.1)) break;
      }

      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        (Math.random() * 2 - 1) * 0.75
      ).normalize();
      const baseSpeed = 2.0 + Math.random() * 0.7;

      const mat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        emissive: 0x0f172a,
        emissiveIntensity: 0.35,
        roughness: 0.22,
        metalness: 0.55,
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.position.copy(pos);
      mesh.userData.ballIndex = i;
      scene.add(mesh);

      // Generous invisible hit sphere for effortless thumb tapping on mobile touchscreens
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData.ballIndex = i;
      mesh.add(hitMesh);
      hitMeshes.push(hitMesh);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      scene.add(ring);

      balls.push({
        mesh,
        mat,
        ring,
        ringMat,
        pos,
        vel: dir.multiplyScalar(baseSpeed),
      });
    }

    // Raycaster for interactive 3D picking during recall phase
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-99, -99);
    let hoveredIdx = -1;

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const hitTest = (): number => {
      if (propsRef.current.phase !== "recall") return -1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      if (hits.length > 0 && typeof hits[0].object.userData.ballIndex === "number") {
        return hits[0].object.userData.ballIndex as number;
      }
      return -1;
    };

    const onPointerMove = (ev: PointerEvent) => {
      updatePointer(ev);
      hoveredIdx = hitTest();
      renderer.domElement.style.cursor = hoveredIdx >= 0 ? "pointer" : "default";
    };

    const onPointerDown = (ev: PointerEvent) => {
      updatePointer(ev);
      const idx = hitTest();
      if (idx >= 0) {
        propsRef.current.onToggleSelect(idx);
      }
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth || 900;
      const h = Math.max(1, container.clientHeight || 520);
      const nextAspect = w / h;
      baseCameraZ = computeCameraZ(nextAspect);
      camera.aspect = nextAspect;
      camera.position.z = baseCameraZ;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    let rafId = 0;
    let lastTs = performance.now();
    let elapsed = 0;

    // Color constants
    const cNeutral = new THREE.Color(0x93c5fd);
    const cNeutralEmissive = new THREE.Color(0x1e3a8a);
    const cTarget = new THREE.Color(0x22d3ee);
    const cTargetEmissive = new THREE.Color(0x0891b2);
    const cSelected = new THREE.Color(0xfbbf24);
    const cSelectedEmissive = new THREE.Color(0xb45309);
    const cCorrect = new THREE.Color(0x34d399);
    const cCorrectEmissive = new THREE.Color(0x059669);
    const cWrong = new THREE.Color(0xfb7185);
    const cWrongEmissive = new THREE.Color(0xbe123c);
    const cDecoy = new THREE.Color(0x64748b);
    const cDecoyEmissive = new THREE.Color(0x0f172a);

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(0.04, (now - lastTs) / 1000);
      lastTs = now;
      elapsed += dt;

      const {
        phase: curPhase,
        targetSet,
        selectedSet,
        speedScale: spd,
        enableOrbit: orbit,
      } = propsRef.current;

      // Subtle camera parallax during tracking (returns gently to front for comfortable picking)
      if (orbit && curPhase === "tracking") {
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, Math.sin(elapsed * 0.55) * 1.6, 0.04);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.65 + Math.cos(elapsed * 0.4) * 0.55, 0.04);
      } else {
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.06);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.55, 0.06);
      }
      camera.lookAt(0, 0, 0);

      // Update 3D physics during tracking
      if (curPhase === "tracking") {
        const minDist = BALL_RADIUS * 2.55;
        for (let i = 0; i < balls.length; i++) {
          const b = balls[i];
          b.pos.addScaledVector(b.vel, dt * spd);

          // Wall elastic bounces
          if (b.pos.x > BOUNDS.x) { b.pos.x = BOUNDS.x; b.vel.x = -Math.abs(b.vel.x); }
          if (b.pos.x < -BOUNDS.x) { b.pos.x = -BOUNDS.x; b.vel.x = Math.abs(b.vel.x); }
          if (b.pos.y > BOUNDS.y) { b.pos.y = BOUNDS.y; b.vel.y = -Math.abs(b.vel.y); }
          if (b.pos.y < -BOUNDS.y) { b.pos.y = -BOUNDS.y; b.vel.y = Math.abs(b.vel.y); }
          if (b.pos.z > BOUNDS.z) { b.pos.z = BOUNDS.z; b.vel.z = -Math.abs(b.vel.z); }
          if (b.pos.z < -BOUNDS.z) { b.pos.z = -BOUNDS.z; b.vel.z = Math.abs(b.vel.z); }
        }

        // Pairwise smooth elastic collision / repulsion so spheres weave crisply without clipping
        const delta = new THREE.Vector3();
        for (let i = 0; i < balls.length; i++) {
          for (let j = i + 1; j < balls.length; j++) {
            delta.subVectors(balls[i].pos, balls[j].pos);
            const dist = delta.length();
            if (dist > 0.0001 && dist < minDist) {
              const normal = delta.divideScalar(dist);
              const overlap = (minDist - dist) * 0.5;
              balls[i].pos.addScaledVector(normal, overlap);
              balls[j].pos.addScaledVector(normal, -overlap);

              const relVel = new THREE.Vector3().subVectors(balls[i].vel, balls[j].vel);
              const velAlongNormal = relVel.dot(normal);
              if (velAlongNormal < 0) {
                balls[i].vel.addScaledVector(normal, -velAlongNormal);
                balls[j].vel.addScaledVector(normal, velAlongNormal);
              }
            }
          }
        }
      }

      // Visual styling per phase
      for (let i = 0; i < balls.length; i++) {
        const b = balls[i];
        const isTarget = targetSet.has(i);
        const isSelected = selectedSet.has(i);
        const isHovered = curPhase === "recall" && hoveredIdx === i;

        b.mesh.position.copy(b.pos);
        b.ring.position.copy(b.pos);
        b.ring.lookAt(camera.position);

        if (curPhase === "highlight") {
          if (isTarget) {
            b.mat.color.lerp(cTarget, 0.25);
            b.mat.emissive.lerp(cTargetEmissive, 0.25);
            b.mat.emissiveIntensity = 1.4 + Math.sin(elapsed * 7) * 0.45;
            b.mesh.scale.setScalar(1.12 + Math.sin(elapsed * 7) * 0.06);
            b.ringMat.color.copy(cTarget);
            b.ringMat.opacity = 0.85;
            b.ring.scale.setScalar(1.05 + Math.sin(elapsed * 7) * 0.08);
          } else {
            b.mat.color.lerp(cDecoy, 0.2);
            b.mat.emissive.lerp(cDecoyEmissive, 0.2);
            b.mat.emissiveIntensity = 0.25;
            b.mesh.scale.setScalar(0.95);
            b.ringMat.opacity = 0;
          }
        } else if (curPhase === "tracking") {
          b.mat.color.lerp(cNeutral, 0.25);
          b.mat.emissive.lerp(cNeutralEmissive, 0.25);
          b.mat.emissiveIntensity = 0.48;
          b.mesh.scale.setScalar(1.0);
          b.ringMat.opacity = 0;
        } else if (curPhase === "recall") {
          if (isSelected) {
            b.mat.color.lerp(cSelected, 0.25);
            b.mat.emissive.lerp(cSelectedEmissive, 0.25);
            b.mat.emissiveIntensity = 1.15;
            b.mesh.scale.setScalar(1.14);
            b.ringMat.color.copy(cSelected);
            b.ringMat.opacity = 0.9;
            b.ring.scale.setScalar(1.06);
          } else if (isHovered) {
            b.mat.color.lerp(cTarget, 0.25);
            b.mat.emissive.lerp(cTargetEmissive, 0.25);
            b.mat.emissiveIntensity = 0.85;
            b.mesh.scale.setScalar(1.12);
            b.ringMat.color.setHex(0xffffff);
            b.ringMat.opacity = 0.6;
            b.ring.scale.setScalar(1.04);
          } else {
            b.mat.color.lerp(cNeutral, 0.2);
            b.mat.emissive.lerp(cNeutralEmissive, 0.2);
            b.mat.emissiveIntensity = 0.42;
            b.mesh.scale.setScalar(1.0);
            b.ringMat.opacity = 0;
          }
        } else {
          // Reveal phase
          if (isTarget && isSelected) {
            b.mat.color.lerp(cCorrect, 0.28);
            b.mat.emissive.lerp(cCorrectEmissive, 0.28);
            b.mat.emissiveIntensity = 1.5;
            b.mesh.scale.setScalar(1.18);
            b.ringMat.color.copy(cCorrect);
            b.ringMat.opacity = 0.95;
          } else if (isTarget && !isSelected) {
            b.mat.color.lerp(cTarget, 0.28);
            b.mat.emissive.lerp(cTargetEmissive, 0.28);
            b.mat.emissiveIntensity = 1.1 + Math.sin(elapsed * 8) * 0.4;
            b.mesh.scale.setScalar(1.1);
            b.ringMat.color.copy(cTarget);
            b.ringMat.opacity = 0.85;
          } else if (!isTarget && isSelected) {
            b.mat.color.lerp(cWrong, 0.28);
            b.mat.emissive.lerp(cWrongEmissive, 0.28);
            b.mat.emissiveIntensity = 1.3;
            b.mesh.scale.setScalar(1.08);
            b.ringMat.color.copy(cWrong);
            b.ringMat.opacity = 0.9;
          } else {
            b.mat.color.lerp(cDecoy, 0.2);
            b.mat.emissive.lerp(cDecoyEmissive, 0.2);
            b.mat.emissiveIntensity = 0.15;
            b.mesh.scale.setScalar(0.86);
            b.ringMat.opacity = 0;
          }
        }
      }

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.dispose();
      boxGeo.dispose();
      edgesGeo.dispose();
      sphereGeo.dispose();
      hitGeo.dispose();
      hitMat.dispose();
      ringGeo.dispose();
      balls.forEach((b) => {
        b.mat.dispose();
        b.ringMat.dispose();
      });
    };
  }, [roundKey, ballCount]);

  if (webglFailed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-rose-300 bg-slate-950 rounded-3xl border border-rose-500/30">
        当前环境未启用 WebGL 3D 硬件加速，请检查显卡设置后重试。
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full relative touch-none" />;
};
