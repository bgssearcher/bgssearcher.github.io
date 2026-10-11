'use client';

import { useEffect, useRef, useState } from 'react';
import type * as LeafletTypes from 'leaflet';
import { INITIAL_CENTER, MIN_FETCH_ZOOM } from '../lib/constants';
import type { ViewInfo } from '../lib/geo';
import type { ClusterCell, MapTarget, Selection, Sign } from '../lib/types';

// CSS は npm パッケージから読み込む（元の ./lib/*.css の代わり）
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

interface Props {
  data: Sign[];
  cells: ClusterCell[];                    // 地図を引いたときの「まとまり」（数字つきの丸）
  selection: Selection | null;
  sidebarOpen: boolean;
  onMarkerClick: (id: string) => void;
  onViewChange: (view: ViewInfo) => void; // 地図が動き終わったときに、表示範囲とズームを知らせる
  fitNonce: number;                       // 変わるたびに、いま出ている看板が全部見えるよう地図を動かす（検索結果用）
  target: MapTarget | null;               // 指定の場所へ地図を動かす（共有リンク・ランダム用）
}

export default function MapView({ data, cells, selection, sidebarOpen, onMarkerClick, onViewChange, fitNonce, target }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const clusterRef = useRef<any>(null);
  const summaryRef = useRef<LeafletTypes.LayerGroup | null>(null); // 「まとまり」の丸を入れる層
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
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const dataRef = useRef(data);
  dataRef.current = data;

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

      const map = L.map(containerRef.current, { touchZoom: true, zoomControl: false }).setView(
        INITIAL_CENTER,
        MIN_FETCH_ZOOM,
      );
      L.control.zoom({ position: 'topright' }).addTo(map);
      const isMobile = window.innerWidth <= 768;
      L.control.scale({ imperial: false, position: isMobile ? 'topleft' : 'bottomright' }).addTo(map);

      L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>',
      }).addTo(map);

      const cluster = (L as any).markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 80,
        disableClusteringAtZoom: 11,
        animate: false,
        spiderfyOnMaxZoom: false,   // 放射状に広げる動作をやめる
        zoomToBoundsOnClick: false, // 標準のズームは使わず、下の自前の動きにする
      });
      // 数字の丸をタップしたら、最低1段階は拡大する
      cluster.on('clusterclick', (e: any) => {
        const t = Math.max(map.getBoundsZoom(e.layer.getBounds()), map.getZoom() + 1);
        map.setView(e.layer.getLatLng(), Math.min(t, 18));
      });
      cluster.addTo(map);
      clusterRef.current = cluster;
      summaryRef.current = L.layerGroup().addTo(map);

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

      // 地図が動き終わるたびに、表示範囲とズームを知らせる
      const emitView = () => {
        const b = map.getBounds();
        onViewChangeRef.current({
          zoom: map.getZoom(),
          south: b.getSouth(),
          west: b.getWest(),
          north: b.getNorth(),
          east: b.getEast(),
        });
      };
      map.on('moveend', emitView);

      mapRef.current = map;
      setReady(true);
      emitView(); // 最初の表示範囲も知らせる
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
    for (const row of data) {
      const marker = L.marker([row.lat, row.lng], { icon: icons.normal });
      marker.on('click', () => onMarkerClickRef.current(row.id));
      markersRef.current.set(row.id, marker);
      markers.push(marker);
    }
    cluster.addLayers(markers);
  }, [ready, data]);

  // ---- 2a. 引いた地図の「まとまり」（数字つきの丸）を描く ----
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = summaryRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();
    for (const c of cells) {
      // 見た目は、Leaflet.markercluster の標準（緑・黄・橙の丸）と同じ
      const size = c.cnt < 10 ? 'small' : c.cnt < 100 ? 'medium' : 'large';
      const icon = L.divIcon({
        html: `<div><span>${c.cnt}</span></div>`,
        className: `marker-cluster marker-cluster-${size}`,
        iconSize: [40, 40],
      });
      const m = L.marker([c.lat, c.lng], { icon });
      // タップしたら、その場所を中心に2段階拡大する
      m.on('click', () => map.setView([c.lat, c.lng], Math.min(map.getZoom() + 2, 18)));
      layer.addLayer(m);
    }
  }, [ready, cells]);

  // ---- 2b. 検索結果が来たときだけ、全部が見えるよう地図を動かす ----
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || fitNonce === 0) return;
    const rows = dataRef.current;
    if (rows.length === 0) return;
    map.stop();
    map.fitBounds(
      rows.map((r) => [r.lat, r.lng] as [number, number]),
      { padding: [30, 30] },
    );
  }, [ready, fitNonce]);

  // ---- 2c. 指定された場所へ地図を動かす（共有リンク・ランダム） ----
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !target) return;
    map.stop();
    map.setView([target.lat, target.lng], target.zoom, { animate: false });
    if (window.innerWidth <= 768 && sidebarOpenRef.current) {
      map.panBy([0, window.innerHeight * 0.18], { animate: false });
    }
  }, [ready, target]);

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

    if (selection.source !== 'card') return;     // マーカー・共有リンク・ランダムは、ここでは動かさない
    if (zoomedFor.current === selection) return; // 範囲の取り直しで data だけ変わったときは動かさない
    zoomedFor.current = selection;

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
