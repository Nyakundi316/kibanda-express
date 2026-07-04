"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet is driven imperatively: one map instance for the component's life,
// and location updates just move the marker instead of re-rendering the map.
// Loaded with next/dynamic({ ssr: false }) because Leaflet touches `window`.

type Props = {
  lat: number;
  lng: number;
  updatedAt: number;
  riderName?: string;
  vehicleType?: string;
};

const VEHICLE_GLYPH: Record<string, string> = {
  motorbike: "🏍️",
  bicycle: "🚲",
  car: "🚗",
  on_foot: "🚶",
};

function riderIcon(vehicleType?: string) {
  const glyph = VEHICLE_GLYPH[vehicleType ?? ""] ?? "🛵";
  return L.divIcon({
    className: "", // suppress leaflet's default white box
    html: `
      <div style="position:relative;width:44px;height:44px">
        <div style="position:absolute;inset:0;border-radius:9999px;background:#b3541e33;animation:rider-ping 1.6s ease-out infinite"></div>
        <div style="position:absolute;inset:6px;border-radius:9999px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:18px">${glyph}</div>
      </div>
      <style>@keyframes rider-ping{0%{transform:scale(.6);opacity:.9}80%,100%{transform:scale(1.4);opacity:0}}</style>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

function ago(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)} min ago`;
}

export default function RiderMap({ lat, lng, updatedAt, riderName, vehicleType }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Tick the "updated Xs ago" chip.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!holder.current || mapRef.current) return;
    const map = L.map(holder.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    markerRef.current = L.marker([lat, lng], {
      icon: riderIcon(vehicleType),
      title: riderName ?? "Rider",
    }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the rider as new fixes stream in.
  useEffect(() => {
    markerRef.current?.setLatLng([lat, lng]);
    mapRef.current?.panTo([lat, lng], { animate: true, duration: 0.8 });
  }, [lat, lng]);

  return (
    <div className="relative rounded-3xl overflow-hidden smooth-shadow" style={{ height: 260 }}>
      <div ref={holder} className="absolute inset-0" style={{ zIndex: 0 }} />
      <div
        className="absolute top-3 left-3 bg-surface/95 rounded-full px-3 py-1.5 font-label-sm text-on-surface flex items-center gap-1.5"
        style={{ zIndex: 500 }}
      >
        <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
        {riderName ? `${riderName} · ` : ""}updated {ago(updatedAt, now)}
      </div>
    </div>
  );
}
