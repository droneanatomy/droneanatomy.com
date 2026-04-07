'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { CustomButton } from '../CustomButton';
import styles from './WireframeTerrain.module.css';

export type ContentPosition =
    | 'top-left' | 'top-center' | 'top-right'
    | 'center-left' | 'center' | 'center-right'
    | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface WireframeTerrainProps {
    className?: string;
    title?: string;
    subtitle?: string;
    ctaText?: string;
    ctaLink?: string;
    contentPosition?: ContentPosition;
}

const positionClassMap: Record<ContentPosition, string> = {
    'top-left': styles.topLeft,
    'top-center': styles.topCenter,
    'top-right': styles.topRight,
    'center-left': styles.centerLeft,
    'center': styles.center,
    'center-right': styles.centerRight,
    'bottom-left': styles.bottomLeft,
    'bottom-center': styles.bottomCenter,
    'bottom-right': styles.bottomRight,
};

export const WireframeTerrain: React.FC<WireframeTerrainProps> = ({
    className = '',
    title,
    subtitle,
    ctaText,
    ctaLink = '/',
    contentPosition = 'top-left',
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const bloomRef = useRef<HTMLCanvasElement>(null);
    const tag1Ref = useRef<HTMLDivElement>(null);
    const tag2Ref = useRef<HTMLDivElement>(null);
    const hudBrRef = useRef<HTMLDivElement>(null);
    const isInViewRef = useRef(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile — skip Three.js entirely on small screens
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 1024);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    useEffect(() => {
        if (isMobile) return; // Skip Three.js on mobile

        const container = containerRef.current;
        const canvas = canvasRef.current;
        const bloomCanvas = bloomRef.current;
        if (!container || !canvas || !bloomCanvas) return;

        // ── Renderer ──────────────────────────────────────────────
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setClearColor(0x020818);

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x020e2e, 0.018);

        const rect = container.getBoundingClientRect();
        let W = rect.width;
        let H = rect.height;
        renderer.setSize(W, H);

        const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 300);
        camera.position.set(0, 14, 30);

        // ── Terrain ───────────────────────────────────────────────
        const SEG = 128, SIZE = 120;
        const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
        geo.rotateX(-Math.PI / 2);
        const count = geo.attributes.position.count;
        const geo2 = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
        geo2.rotateX(-Math.PI / 2);

        scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x00d4ff, wireframe: true, transparent: true, opacity: 0.55 })));
        const m2 = new THREE.Mesh(geo2, new THREE.MeshBasicMaterial({ color: 0x0044ff, wireframe: true, transparent: true, opacity: 0.2 }));
        m2.position.y = 0.2;
        scene.add(m2);

        // ── Drone Factory ─────────────────────────────────────────
        function createDrone(primaryColor: number, accentColor: number) {
            const group = new THREE.Group();

            const wireMat = new THREE.MeshBasicMaterial({ color: primaryColor, wireframe: true, transparent: true, opacity: 0.85 });
            const glowMat = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.92 });
            const ringMat = new THREE.MeshBasicMaterial({ color: primaryColor, transparent: true, opacity: 0.65 });
            const coreMat = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.5 });

            // Body
            group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), wireMat));

            // Arms
            group.add(new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 0.15), wireMat));
            group.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 3), wireMat));

            // Diagonal braces
            const diagMat = new THREE.LineBasicMaterial({ color: primaryColor, transparent: true, opacity: 0.4 });
            ([[1.4, 0, 1.4], [-1.4, 0, 1.4], [1.4, 0, -1.4], [-1.4, 0, -1.4]] as [number, number, number][]).forEach(([x, , z]) => {
                const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, 0, z)];
                group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), diagMat));
            });

            // Rotors
            const rotorRefs: THREE.Group[] = [];
            const rotorPos: [number, number, number][] = [[1.4, 0, 0], [-1.4, 0, 0], [0, 0, 1.4], [0, 0, -1.4]];
            rotorPos.forEach(pos => {
                const rotorGroup = new THREE.Group();
                rotorGroup.position.set(...pos);
                rotorGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 8), wireMat));
                const bladeMat = new THREE.MeshBasicMaterial({ color: primaryColor, transparent: true, opacity: 0.6 });
                rotorGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.06), bladeMat));
                rotorGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 1.2), bladeMat));
                rotorGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 6), glowMat));
                rotorGroup.position.y = 0.3;
                group.add(rotorGroup);
                rotorRefs.push(rotorGroup);
            });

            // Landing skids
            const skidMat = new THREE.MeshBasicMaterial({ color: primaryColor, transparent: true, opacity: 0.4 });
            [[-0.7], [0.7]].forEach(([x]) => {
                const skid = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.07, 0.07), skidMat);
                skid.position.set(x, -0.9, 0);
                group.add(skid);
            });
            ([[-0.9, -0.5, 0.3], [-0.9, -0.5, -0.3], [0.9, -0.5, 0.3], [0.9, -0.5, -0.3]] as [number, number, number][]).forEach(([x, y, z]) => {
                const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), skidMat);
                strut.position.set(x, y, z);
                group.add(strut);
            });

            // Sensor pod
            const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), glowMat);
            sensor.position.set(0, -1.05, 0);
            group.add(sensor);
            const sensorLens = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 1 }));
            sensorLens.position.set(0, -1.22, 0);
            group.add(sensorLens);

            // Core + halo
            group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), coreMat));
            const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.025, 8, 32), ringMat);
            ring.rotation.x = Math.PI / 2;
            group.add(ring);

            // Exhaust cones
            const thrustMat = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.18 });
            rotorPos.forEach(pos => {
                const thrust = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 6), thrustMat);
                thrust.position.set(pos[0], 0.6, pos[2]);
                thrust.rotation.x = Math.PI;
                group.add(thrust);
            });

            return { group, rotorRefs };
        }

        const drone1 = createDrone(0x00d4ff, 0x00ffff);
        const drone2 = createDrone(0x00ff99, 0x00ffcc);
        scene.add(drone1.group);
        scene.add(drone2.group);

        // ── Trails ────────────────────────────────────────────────
        function createTrail(color: number) {
            const N = 40;
            const positions = new Float32Array(N * 3);
            const trailGeo = new THREE.BufferGeometry();
            trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const trailMat = new THREE.PointsMaterial({ color, size: 0.12, transparent: true, opacity: 0.5, depthWrite: false });
            const trail = new THREE.Points(trailGeo, trailMat);
            scene.add(trail);
            const history: { x: number; y: number; z: number }[] = [];
            return { trail, trailGeo, history, N };
        }

        const trail1 = createTrail(0x00d4ff);
        const trail2 = createTrail(0x00ff99);

        function updateTrail(tr: ReturnType<typeof createTrail>, pos: THREE.Vector3) {
            tr.history.unshift({ x: pos.x, y: pos.y, z: pos.z });
            if (tr.history.length > tr.N) tr.history.pop();
            const arr = tr.trailGeo.attributes.position.array as Float32Array;
            for (let i = 0; i < tr.history.length; i++) {
                arr[i * 3] = tr.history[i].x;
                arr[i * 3 + 1] = tr.history[i].y;
                arr[i * 3 + 2] = tr.history[i].z;
            }
            tr.trailGeo.attributes.position.needsUpdate = true;
        }

        // ── Bloom ─────────────────────────────────────────────────
        const bx = bloomCanvas!.getContext('2d')!;
        function bloom() {
            bloomCanvas!.width = W;
            bloomCanvas!.height = H;
            const g = bx.createRadialGradient(W / 2, H * 0.6, 0, W / 2, H * 0.6, W * 0.7);
            g.addColorStop(0, 'rgba(0,150,255,0.18)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            bx.fillStyle = g;
            bx.fillRect(0, 0, W, H);
        }
        bloom();

        // ── 3D → 2D projection ────────────────────────────────────
        const _v = new THREE.Vector3();
        function toScreen(pos3d: THREE.Vector3) {
            _v.copy(pos3d).project(camera);
            return {
                x: (_v.x * 0.5 + 0.5) * W,
                y: (-_v.y * 0.5 + 0.5) * H,
                visible: _v.z < 1,
            };
        }

        function updateTag(el: HTMLDivElement | null, worldPos: THREE.Vector3) {
            if (!el) return;
            const s = toScreen(worldPos);
            if (s.visible && s.x > 0 && s.x < W && s.y > 0 && s.y < H) {
                el.style.display = 'block';
                el.style.left = (s.x + 14) + 'px';
                el.style.top = (s.y - 30) + 'px';
            } else {
                el.style.display = 'none';
            }
        }

        // ── Animation loop ────────────────────────────────────────
        const clock = new THREE.Clock();
        let camZ = 30;
        function animate() {
            requestAnimationFrame(animate);

            // Skip all work when off-screen (saves GPU/CPU)
            if (!isInViewRef.current) return;

            const t = clock.getElapsedTime();

            // Terrain waves
            const p1 = geo.attributes.position;
            const p2 = geo2.attributes.position;
            for (let i = 0; i < count; i++) {
                const x = p1.getX(i), z = p1.getZ(i);
                const y = Math.sin(x * 0.18 + t * 0.7) * 1.8 +
                    Math.sin(z * 0.22 + t * 0.5) * 1.4 +
                    Math.sin((x + z) * 0.12 + t * 0.9) * 1.1 +
                    Math.sin(x * 0.35 - t * 0.6) * 0.6;
                p1.setY(i, y);
                p2.setY(i, y);
            }
            p1.needsUpdate = true;
            p2.needsUpdate = true;

            // Camera drift
            camZ -= 0.018;
            if (camZ < -40) camZ = 30;
            camera.position.z = camZ;
            camera.position.y = 13 + Math.sin(t * 0.25) * 1.5;
            camera.lookAt(0, 0, camZ - 55);

            // Drone 1 — wide sweep
            const d1x = Math.sin(t * 0.38) * 14;
            const d1z = camZ - 30 + Math.cos(t * 0.28) * 18;
            const d1y = 7 + Math.sin(t * 1.1) * 0.9;
            drone1.group.position.set(d1x, d1y, d1z);
            drone1.group.rotation.y = Math.atan2(Math.cos(t * 0.38) * 0.38 * 14, -Math.sin(t * 0.28) * 0.28 * 18);
            drone1.group.rotation.x = Math.sin(t * 0.5) * 0.06;
            drone1.group.rotation.z = Math.cos(t * 0.38) * 0.07;

            // Drone 2 — tighter orbit
            const d2x = Math.cos(t * 0.52) * 9 + 5;
            const d2z = camZ - 40 + Math.sin(t * 0.44) * 13;
            const d2y = 8.5 + Math.cos(t * 0.85) * 1.1;
            drone2.group.position.set(d2x, d2y, d2z);
            drone2.group.rotation.y = Math.atan2(-Math.sin(t * 0.52) * 0.52 * 9, Math.cos(t * 0.44) * 0.44 * 13);
            drone2.group.rotation.x = Math.sin(t * 0.6) * 0.07;
            drone2.group.rotation.z = Math.sin(t * 0.52) * 0.08;

            // Rotor spin
            const rs = t * 15;
            drone1.rotorRefs.forEach((r, i) => (r.rotation.y = rs * (i % 2 === 0 ? 1 : -1)));
            drone2.rotorRefs.forEach((r, i) => (r.rotation.y = rs * 1.3 * (i % 2 === 0 ? 1 : -1)));

            // Trails
            updateTrail(trail1, drone1.group.position);
            updateTrail(trail2, drone2.group.position);

            // Tags
            updateTag(tag1Ref.current, drone1.group.position);
            updateTag(tag2Ref.current, drone2.group.position);

            renderer.render(scene, camera);
        }
        animate();

        // ── Viewport observer — pause when off-screen ─────────────
        const viewObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    isInViewRef.current = entry.isIntersecting;
                });
            },
            { threshold: 0.05, rootMargin: '100px' }
        );
        viewObserver.observe(container);

        // ── HUD counter ───────────────────────────────────────────
        setInterval(() => {
            const alt = Math.max(100, 2400 - Math.round((30 - camZ) * 3));
            if (hudBrRef.current) {
                hudBrRef.current.innerHTML = `ALT: ${alt.toLocaleString()}m<br>CAM: CINEMATIC<br>DRONE ANATOMY<br>UNITS: DA-01 · DA-02`;
            }
        }, 120);

        // ── Resize ────────────────────────────────────────────────
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                W = entry.contentRect.width;
                H = entry.contentRect.height;
                camera.aspect = W / H;
                camera.updateProjectionMatrix();
                renderer.setSize(W, H);
                bloom();
            }
        });
        ro.observe(container);

        // ── Cleanup ───────────────────────────────────────────────
        // return () => {
        //     cancelAnimationFrame(animId);
        //     clearInterval(hudInterval);
        //     ro.disconnect();
        //     viewObserver.disconnect();
        //     renderer.dispose();
        //     scene.traverse(obj => {
        //         if (obj instanceof THREE.Mesh) {
        //             obj.geometry.dispose();
        //             if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        //             else obj.material.dispose();
        //         }
        //     });
        // };
    }, [isMobile]);

    // if (isMobile) {
    //     return (
    //         <Banner
    //             title={title}
    //             subtitle={subtitle}
    //             ctaText={ctaText}
    //             ctaLink={ctaLink}
    //             backgroundImageMobile={backgroundImageMobile}
    //             contentPosition={contentPosition}
    //             overlayStyle="dark"
    //         />
    //     );
    // }

    return (
        <div ref={containerRef} className={`${styles.container} ${className}`}>
            <canvas ref={canvasRef} className={styles.canvas} />
            <canvas ref={bloomRef} className={styles.bloom} />
            <div className={styles.overlay} />

            <div className={styles.hudTl}>
                TERRAIN.SYS v4.1.0<br />
                MESH &nbsp;: ACTIVE<br />
                GRID &nbsp;: 360x360<br />
                UNITS &nbsp;: 2 ACTIVE
            </div>
            <div ref={hudBrRef} className={styles.hudBr}>
                ALT: 2400m<br />CAM: CINEMATIC<br />DRONE ANATOMY<br />SURVEILLANCE ON
            </div>

            <div ref={tag1Ref} className={`${styles.droneTag} ${styles.droneTag1}`}>
                ▲ DA-01 · NOXR<br />SPD: 18 m/s
            </div>
            <div ref={tag2Ref} className={`${styles.droneTag} ${styles.droneTag2}`}>
                ▲ DA-02 · NOXR<br />SPD: 22 m/s
            </div>

            {/* Content overlay */}
            {(title || subtitle || ctaText) && (
                <div className={`${styles.content} ${positionClassMap[contentPosition]}`}>
                    {title && <h2 className={styles.title}>{title}</h2>}
                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                    {ctaText && (
                        <div className={styles.ctaWrapper}>
                            <CustomButton href={ctaLink} showArrow>
                                {ctaText}
                            </CustomButton>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WireframeTerrain;
