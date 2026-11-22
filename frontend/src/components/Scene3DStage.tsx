import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { CueKind, PlayPhase } from "../types/game";

export interface ActiveCueSignal {
  seq: number;
  kind: CueKind;
}

interface Scene3DStageProps {
  enabled: boolean;
  phase: PlayPhase;
  isSwapped: boolean;
  swapProgress: number; // 0..1 during "swapping" phase
  blindMode: boolean;
  activeCue: ActiveCueSignal | null;
  className?: string;
}

/**
 * Lightweight Three.js interactive 3D visual arena for Scene 1:
 * - Object A (Cyan Icosahedron core + halo) starts on Left (-X)
 * - Object B (Coral-Amber Octahedron core + halo) starts on Right (+X)
 * - Voice cues trigger elastic impulse + expanding shockwave ring on the called object
 * - Hand-Swap 5s countdown orbits the two objects across opposing 3D semicircles to swap hands!
 */
export const Scene3DStage: React.FC<Scene3DStageProps> = ({
  enabled,
  phase,
  isSwapped,
  swapProgress,
  blindMode,
  activeCue,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  // Mutable animation state read at 60fps without recreating the Three.js scene
  const animStateRef = useRef({
    phase,
    isSwapped,
    swapProgress,
    blindMode,
    pulseA: 0,
    pulseB: 0,
    waveA: 0,
    waveB: 0,
    lastSeq: -1,
  });

  useEffect(() => {
    const s = animStateRef.current;
    s.phase = phase;
    s.isSwapped = isSwapped;
    s.swapProgress = swapProgress;
    s.blindMode = blindMode;

    if (activeCue && activeCue.seq !== s.lastSeq) {
      s.lastSeq = activeCue.seq;
      if (!blindMode) {
        if (activeCue.kind === "item_a") {
          s.pulseA = 1.0;
          s.waveA = 1.0;
        } else if (activeCue.kind === "item_b") {
          s.pulseB = 1.0;
          s.waveB = 1.0;
        }
      }
    }
  }, [phase, isSwapped, swapProgress, blindMode, activeCue]);

  useEffect(() => {
    if (!enabled) return;
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 480);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initW = container.clientWidth || 800;
    const initH = Math.max(1, container.clientHeight || 480);
    const initAspect = initW / initH;
    const calcZ = (a: number) => (a < 1.15 ? Math.min(16.5, 9.2 / Math.max(0.45, a)) : 8.2);
    const camera = new THREE.PerspectiveCamera(42, initAspect, 0.1, 100);
    camera.position.set(0, 0.3, calcZ(initAspect));

    // Studio lighting
    const ambient = new THREE.AmbientLight(0x94a3b8, 0.75);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xe0f2fe, 1.4);
    keyLight.position.set(3, 6, 7);
    scene.add(keyLight);

    const lightA = new THREE.PointLight(0x22d3ee, 4.5, 14);
    lightA.position.set(-2.6, 0.5, 2.2);
    scene.add(lightA);

    const lightB = new THREE.PointLight(0xf97316, 4.5, 14);
    lightB.position.set(2.6, 0.5, 2.2);
    scene.add(lightB);

    // Helper to build a tactile sculpted 3D object
    const buildOrbGroup = (
      primaryHex: number,
      emissiveHex: number,
      geometryType: "ico" | "octa"
    ) => {
      const group = new THREE.Group();

      const coreGeo =
        geometryType === "ico"
          ? new THREE.IcosahedronGeometry(0.95, 1)
          : new THREE.OctahedronGeometry(1.06, 1);

      const coreMat = new THREE.MeshStandardMaterial({
        color: primaryHex,
        emissive: emissiveHex,
        emissiveIntensity: 0.45,
        roughness: 0.22,
        metalness: 0.65,
        flatShading: true,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      group.add(coreMesh);

      const wireGeo =
        geometryType === "ico"
          ? new THREE.IcosahedronGeometry(1.14, 1)
          : new THREE.OctahedronGeometry(1.24, 1);
      const wireMat = new THREE.MeshBasicMaterial({
        color: primaryHex,
        wireframe: true,
        transparent: true,
        opacity: 0.28,
      });
      const wireMesh = new THREE.Mesh(wireGeo, wireMat);
      group.add(wireMesh);

      const gyroGeo = new THREE.TorusGeometry(1.42, 0.032, 12, 72);
      const gyroMat = new THREE.MeshBasicMaterial({
        color: primaryHex,
        transparent: true,
        opacity: 0.55,
      });
      const gyroMesh = new THREE.Mesh(gyroGeo, gyroMat);
      gyroMesh.rotation.x = Math.PI * 0.36;
      group.add(gyroMesh);

      const waveGeo = new THREE.RingGeometry(1.15, 1.32, 48);
      const waveMat = new THREE.MeshBasicMaterial({
        color: primaryHex,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const waveMesh = new THREE.Mesh(waveGeo, waveMat);
      group.add(waveMesh);

      return { group, coreMesh, coreMat, wireMesh, wireMat, gyroMesh, waveMesh, waveMat };
    };

    const orbA = buildOrbGroup(0x22d3ee, 0x0891b2, "ico");
    const orbB = buildOrbGroup(0xfb923c, 0xc2410c, "octa");
    orbA.group.position.set(-2.35, 0, 0);
    orbB.group.position.set(2.35, 0, 0);
    scene.add(orbA.group);
    scene.add(orbB.group);

    // Center focus/swap orbital vortex ring
    const centerRingGeo = new THREE.TorusGeometry(2.35, 0.022, 12, 120);
    const centerRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
    });
    const centerRing = new THREE.Mesh(centerRingGeo, centerRingMat);
    centerRing.rotation.x = Math.PI * 0.48;
    scene.add(centerRing);

    // Ambient focus stardust particles
    const particleCount = 150;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const colorCyan = new THREE.Color(0x22d3ee);
    const colorAmber = new THREE.Color(0xfb923c);
    const colorSlate = new THREE.Color(0x64748b);

    for (let i = 0; i < particleCount; i++) {
      const r = 3.2 + Math.random() * 5.8;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 6.5;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * r - 2.5;

      const c = i % 3 === 0 ? colorCyan : i % 3 === 1 ? colorAmber : colorSlate;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particlesGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const particlesMat = new THREE.PointsMaterial({
      size: 0.065,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particles);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = Math.max(1, container.clientHeight || 480);
      const a = w / h;
      camera.aspect = a;
      camera.position.z = calcZ(a);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const renderFrame = (now: number) => {
      rafId = requestAnimationFrame(renderFrame);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const st = animStateRef.current;
      const speedScale = st.phase === "paused" ? 0.15 : st.phase === "swapping" ? 1.75 : 1.0;
      elapsed += dt * speedScale;

      // Decay impulses smoothly
      st.pulseA = Math.max(0, st.pulseA - dt * 2.1);
      st.pulseB = Math.max(0, st.pulseB - dt * 2.1);
      st.waveA = Math.max(0, st.waveA - dt * 1.45);
      st.waveB = Math.max(0, st.waveB - dt * 1.45);

      // Compute orbital X/Z positions for Object A & Object B
      const radiusX = 2.35;
      const baseAngleA = st.isSwapped ? 0 : Math.PI; // Math.PI = left (-2.35), 0 = right (+2.35)
      const baseAngleB = st.isSwapped ? Math.PI : 0;

      const swapAngleOffset =
        st.phase === "swapping" ? easeInOutCubic(Math.max(0, Math.min(1, st.swapProgress))) * Math.PI : 0;

      const angleA = baseAngleA - swapAngleOffset;
      const angleB = baseAngleB - swapAngleOffset;

      const swapArcZ = st.phase === "swapping" ? 1.55 : 0;
      const posAX = Math.cos(angleA) * radiusX;
      const posAZ = Math.sin(angleA) * swapArcZ + st.pulseA * 1.15;
      const posAY = Math.sin(elapsed * 1.4) * 0.22 + (st.phase === "swapping" ? Math.sin(swapAngleOffset) * 0.35 : 0);

      const posBX = Math.cos(angleB) * radiusX;
      const posBZ = Math.sin(angleB) * swapArcZ + st.pulseB * 1.15;
      const posBY = Math.sin(elapsed * 1.4 + Math.PI) * 0.22 - (st.phase === "swapping" ? Math.sin(swapAngleOffset) * 0.35 : 0);

      orbA.group.position.lerp(new THREE.Vector3(posAX, posAY, posAZ), 0.18);
      orbB.group.position.lerp(new THREE.Vector3(posBX, posBY, posBZ), 0.18);

      lightA.position.set(orbA.group.position.x, orbA.group.position.y + 0.4, orbA.group.position.z + 2.2);
      lightB.position.set(orbB.group.position.x, orbB.group.position.y + 0.4, orbB.group.position.z + 2.2);

      // Blind mode dims direct orb luminance slightly into calm ambient mood
      const blindDim = st.blindMode && st.phase === "playing" ? 0.38 : 1.0;

      // Apply cue pulse scaling, rotation, emissive glow & expanding shockwave
      const scaleA = (1 + st.pulseA * 0.38) * (st.blindMode && st.phase === "playing" ? 0.85 : 1);
      const scaleB = (1 + st.pulseB * 0.38) * (st.blindMode && st.phase === "playing" ? 0.85 : 1);

      orbA.coreMesh.scale.setScalar(scaleA);
      orbB.coreMesh.scale.setScalar(scaleB);

      orbA.coreMesh.rotation.y += dt * (0.55 + st.pulseA * 3.8) * speedScale;
      orbA.coreMesh.rotation.x += dt * (0.35 + st.pulseA * 2.2) * speedScale;
      orbA.wireMesh.rotation.y -= dt * 0.4 * speedScale;
      orbA.gyroMesh.rotation.z += dt * (0.9 + st.pulseA * 4.5) * speedScale;

      orbB.coreMesh.rotation.y -= dt * (0.55 + st.pulseB * 3.8) * speedScale;
      orbB.coreMesh.rotation.x += dt * (0.32 + st.pulseB * 2.2) * speedScale;
      orbB.wireMesh.rotation.y += dt * 0.4 * speedScale;
      orbB.gyroMesh.rotation.z -= dt * (0.9 + st.pulseB * 4.5) * speedScale;

      orbA.coreMat.emissiveIntensity = (0.42 + st.pulseA * 1.9) * blindDim;
      orbB.coreMat.emissiveIntensity = (0.42 + st.pulseB * 1.9) * blindDim;
      orbA.wireMat.opacity = (0.25 + st.pulseA * 0.5) * blindDim;
      orbB.wireMat.opacity = (0.25 + st.pulseB * 0.5) * blindDim;

      // Expanding 3D shockwave ring on voice announcement
      if (st.waveA > 0.01) {
        const progA = 1 - st.waveA;
        orbA.waveMesh.scale.setScalar(1 + progA * 1.85);
        orbA.waveMat.opacity = st.waveA * 0.85;
      } else {
        orbA.waveMat.opacity = 0;
      }

      if (st.waveB > 0.01) {
        const progB = 1 - st.waveB;
        orbB.waveMesh.scale.setScalar(1 + progB * 1.85);
        orbB.waveMat.opacity = st.waveB * 0.85;
      } else {
        orbB.waveMat.opacity = 0;
      }

      // Center ring reacts strongly during hand-swap countdown
      centerRing.rotation.z += dt * (st.phase === "swapping" ? 2.4 : 0.25);
      centerRingMat.color.setHex(st.phase === "swapping" ? 0xfbbf24 : 0x38bdf8);
      centerRingMat.opacity = st.phase === "swapping" ? 0.58 : 0.14;

      // Subtle stardust drift
      particles.rotation.y += dt * 0.06 * speedScale;
      particles.rotation.x = Math.sin(elapsed * 0.25) * 0.08;

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });
    };
  }, [enabled]);

  if (!enabled || webglFailed) {
    return (
      <div
        className={`relative overflow-hidden pointer-events-none ${className}`}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_48%,rgba(34,211,238,0.16),transparent_48%),radial-gradient(circle_at_72%_48%,rgba(249,115,22,0.16),transparent_48%)]" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full pointer-events-none select-none ${className}`}
      aria-hidden="true"
    />
  );
};
