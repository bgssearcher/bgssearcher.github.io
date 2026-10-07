'use client';

import { useEffect, useRef, useState } from 'react';
import type * as LeafletTypes from 'leaflet';
import type { Selection, Sign } from '../lib/types';

// CSS は npm パッケージから読み込む（元の ./lib/*.css の代わり）
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

interface Props {
  data: Sign[];
  selection: Selection | null;
  sidebarOpen: boolean;
  onMarkerClick: (id: string) => void;
}

export default function MapView({ data, selection, sidebarOpen, onMarkerClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const clusterRef = useRef<any>(null);
  const LRef = useRef<typeof LeafletTypes | null>(null);
  const markersRef = useRef<Map<string, LeafletTypes.Marker>>(new Map());
  const selectedMarkerRef = useRef<LeafletTypes.Marker | null>(null);
  const zoomedFor = useRef<Selection | null>(null); // 同じ選択で何度も地図を動かさないための目印
  const iconsRef = useRef<{ normal: LeafletTypes.DivIcon; selected: LeafletTypes.DivIcon } | null>(null);
  const [ready, setReady] = useState(false);

  // 最新の値を、イベント内から参照するための入れ物
  const sidebarOpenRef = useRef(sidebarOpen);
  sidebarOpenRef.current = sidebarOpen;
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  // ---- 1. 地図を作る（ブラウザでだけ実行される） ----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Leaflet は window を使うので、サーバー側で読み込まれないよう useEffect の中で import する
      const L = ((await import('leaflet')) as any).default as typeof LeafletTypes;
      (window as any).L = L; // markercluster は グローバルの L を探すため
      await import('leaflet.markercluster');
      if (cancelled || !containerRef.current) return;
      LRef.current = L;
      const makeIcon = (selected: boolean) =>
        L.divIcon({
          className: 'custom-square-marker' + (selected ? ' selected' : ''),
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
      iconsRef.current = { normal: makeIcon(false), selected: makeIcon(true) };

      const map = L.map(containerRef.current, { zooming: true, touchZoom: true, zoomControl: false }).setView(
        [35.6812, 139.7671],
        10,
      );
      L.control.zoom({ position: 'topright' }).addTo(map);
      const isMobile = window.innerWidth <= 768;
      L.control.scale({ imperial: false, position: isMobile ? 'topleft' : 'bottomright' }).addTo(map);

      L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>',
      }).addTo(map);

      clusterRef.current = (L as any)
        .markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 80, disableClusteringAtZoom: 11, animate: false })
        .addTo(map);

      // ---- 現在地ボタン ----
      let tracking = false;
      let locMarker: LeafletTypes.CircleMarker | null = null;
      let locCircle: LeafletTypes.Circle | null = null;
      const locate = new L.Control({ position: 'topright' });
      locate.onAdd = () => {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        div.innerHTML = '<a class="locate-button" title="現在地を表示">📍</a>';
        const btn = div.querySelector('a') as HTMLElement;
        div.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!tracking) {
            map.locate({ setView: true, maxZoom: 16, watch: true, enableHighAccuracy: true });
            btn.style.backgroundColor = '#ebf5fb';
          } else {
            map.stopLocate();
            btn.style.backgroundColor = '#fff';
          }
          tracking = !tracking;
        });
        return div;
      };
      locate.addTo(map);

      map.on('locationfound', (e: LeafletTypes.LocationEvent) => {
        if (locMarker) map.removeLayer(locMarker);
        if (locCircle) map.removeLayer(locCircle);
        locMarker = L.circleMarker(e.latlng, { radius: 8, color: '#fff', weight: 2, fillColor: '#3498db', fillOpacity: 1 }).addTo(map);
        locCircle = L.circle(e.latlng, { radius: e.accuracy, color: '#3498db', weight: 1, fillColor: '#3498db', fillOpacity: 0.15 }).addTo(map);
      });
      map.on('locationerror', () => {
        alert('位置情報の取得に失敗しました。端末のGPS設定やブラウザの権限を確認してください。');
        tracking = false;
        const a = containerRef.current?.querySelector('.locate-button') as HTMLElement | null;
        if (a) a.style.backgroundColor = '#fff';
      });

      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // ---- 2. 表示するデータが変わったらマーカーを作り直す ----
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!ready || !L || !map || !cluster) return;

    const icons = iconsRef.current;
    if (!icons) return;

    cluster.clearLayers();
    markersRef.current.clear();
    selectedMarkerRef.current = null;

    const markers: LeafletTypes.Marker[] = [];
    const bounds: [number, number][] = [];
    for (const row of data) {
      const marker = L.marker([row.lat, row.lng], { icon: icons.normal });
      marker.on('click', () => onMarkerClickRef.current(row.id));
      markersRef.current.set(row.id, marker);
      markers.push(marker);
      bounds.push([row.lat, row.lng]);
    }
    cluster.addLayers(markers);
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
  }, [ready, data]);

  // ---- 3. 選ばれた看板が変わったら、色を変えて、必要なら地図を動かす ----
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!ready || !map || !cluster) return;
    const icons = iconsRef.current;
    if (!icons) return;

    selectedMarkerRef.current?.setIcon(icons.normal);
    selectedMarkerRef.current = null;
    if (!selection) return;

    const marker = markersRef.current.get(selection.id);
    if (!marker) return;
    marker.setIcon(icons.selected);
    selectedMarkerRef.current = marker;

    if (zoomedFor.current === selection) return; // 絞り込みで data だけ変わったときは動かさない
    zoomedFor.current = selection;
    if (selection.source === 'marker') return;   // マーカーを直接押したときは動かさない

    const adjustForMobile = () => {
      if (window.innerWidth <= 768 && sidebarOpenRef.current) {
        map.panBy([0, window.innerHeight * 0.18], { animate: true });
      }
    };
    map.stop();
    cluster.zoomToShowLayer(marker, () => {
      map.setView(marker.getLatLng(), 16);
      marker.setIcon(icons.selected);
      adjustForMobile();
    });
  }, [ready, selection, data]);

  return <div id="map" ref={containerRef} />;
}
