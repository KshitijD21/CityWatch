"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";

// Cities across the world [lat, lng]
const CITY_MARKERS: [number, number][] = [
  // US
  [40.7128, -74.006], // New York
  [34.0522, -118.2437], // Los Angeles
  [41.8781, -87.6298], // Chicago
  [29.7604, -95.3698], // Houston
  [33.4484, -112.074], // Phoenix
  [32.7767, -96.797], // Dallas
  [37.7749, -122.4194], // San Francisco
  [47.6062, -122.3321], // Seattle
  [39.7392, -104.9903], // Denver
  [25.7617, -80.1918], // Miami
  [33.749, -84.388], // Atlanta
  [42.3601, -71.0589], // Boston
  [38.9072, -77.0369], // Washington DC
  [36.1627, -86.7816], // Nashville
  [30.2672, -97.7431], // Austin
  [44.9778, -93.265], // Minneapolis
  [36.1699, -115.1398], // Las Vegas

  // Europe
  [51.5074, -0.1278], // London
  [48.8566, 2.3522], // Paris
  [52.52, 13.405], // Berlin
  [41.9028, 12.4964], // Rome
  [40.4168, -3.7038], // Madrid

  // Asia
  [35.6762, 139.6503], // Tokyo
  [28.6139, 77.209], // New Delhi
  [1.3521, 103.8198], // Singapore
  [25.2048, 55.2708], // Dubai
  [31.2304, 121.4737], // Shanghai

  // South America
  [-23.5505, -46.6333], // São Paulo
  [-34.6037, -58.3816], // Buenos Aires

  // Africa
  [30.0444, 31.2357], // Cairo
  [-1.2921, 36.8219], // Nairobi

  // Oceania
  [-33.8688, 151.2093], // Sydney
];

// Arcs — clean global connections
const CITY_ARCS: { from: [number, number]; to: [number, number] }[] = [
  // US key routes
  { from: [40.7128, -74.006], to: [41.8781, -87.6298] }, // NYC → Chicago
  { from: [34.0522, -118.2437], to: [37.7749, -122.4194] }, // LA → SF
  { from: [33.749, -84.388], to: [25.7617, -80.1918] }, // Atlanta → Miami
  { from: [47.6062, -122.3321], to: [39.7392, -104.9903] }, // Seattle → Denver

  // Transatlantic
  { from: [40.7128, -74.006], to: [51.5074, -0.1278] }, // NYC → London

  // Europe
  { from: [51.5074, -0.1278], to: [48.8566, 2.3522] }, // London → Paris
  { from: [48.8566, 2.3522], to: [52.52, 13.405] }, // Paris → Berlin

  // Europe → Middle East → Asia
  { from: [51.5074, -0.1278], to: [25.2048, 55.2708] }, // London → Dubai
  { from: [25.2048, 55.2708], to: [28.6139, 77.209] }, // Dubai → Delhi
  { from: [28.6139, 77.209], to: [1.3521, 103.8198] }, // Delhi → Singapore
  { from: [31.2304, 121.4737], to: [35.6762, 139.6503] }, // Shanghai → Tokyo

  // Oceania
  { from: [1.3521, 103.8198], to: [-33.8688, 151.2093] }, // Singapore → Sydney

  // South America
  { from: [25.7617, -80.1918], to: [-23.5505, -46.6333] }, // Miami → São Paulo

  // Africa
  { from: [30.0444, 31.2357], to: [-1.2921, 36.8219] }, // Cairo → Nairobi
];

export function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let phi = 4.5;
    let dragStartX = 0;
    let dragPhi = 0;
    let isDragging = false;
    let velocity = 0;
    let frameId: number;
    let startTime = Date.now();

    const getSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return 800;
      return parent.getBoundingClientRect().width;
    };

    let size = getSize();

    const globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio, 2),
      width: size * 2,
      height: size * 2,
      phi: 4.5,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.15, 0.15, 0.2],
      markerColor: [0.4, 0.7, 1],
      glowColor: [0.031, 0.031, 0.051],
      markers: CITY_MARKERS.map(([lat, lng]) => ({
        location: [lat, lng] as [number, number],
        size: 0.02,
      })),
      arcs: [],
      arcColor: [0.3, 0.5, 0.8],
      arcWidth: 0.3,
      arcHeight: 0.3,
      markerElevation: 0.01,
    });

    // Drag interaction (mouse + touch)
    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragPhi = phi;
      velocity = 0;
      canvas.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      velocity = dx * 0.002;
      phi = dragPhi + dx * 0.005;
    };
    const onPointerUp = () => {
      isDragging = false;
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";

    // Animation loop — arcs fade in one by one over first 3 seconds
    function animate() {
      if (!isDragging) {
        if (!prefersReducedMotion) {
          velocity *= 0.95;
          phi += 0.003 + velocity;
        }
      }

      // Gradually reveal arcs over 4 seconds (staggered)
      const elapsed = (Date.now() - startTime) / 1000;
      const arcCount = Math.min(
        CITY_ARCS.length,
        Math.floor((elapsed / 4) * CITY_ARCS.length)
      );

      size = getSize();
      globe.update({
        phi,
        width: size * 2,
        height: size * 2,
        arcs: CITY_ARCS.slice(0, arcCount).map(({ from, to }) => ({
          from,
          to,
          color: [0.3, 0.5, 0.8] as [number, number, number],
        })),
      });
      frameId = requestAnimationFrame(animate);
    }
    frameId = requestAnimationFrame(animate);

    // Fade in
    canvas.style.opacity = "0";
    canvas.style.transition = "opacity 2s ease-in";
    requestAnimationFrame(() => {
      canvas.style.opacity = "1";
    });

    return () => {
      cancelAnimationFrame(frameId);
      globe.destroy();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        contain: "layout paint size",
        opacity: 0,
      }}
    />
  );
}
