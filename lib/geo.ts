// 地図の範囲まわりの小さな計算

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface ViewInfo extends Bounds {
  zoom: number;
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;

// 取得する範囲を区切る格子の大きさ（度）。ズームが大きい（狭い範囲）ほど細かくする
export function gridSize(zoom: number): number {
  if (zoom >= 15) return 0.0125;
  if (zoom >= 13) return 0.025;
  return 0.05;
}

// 「まとまり」1つぶんの大きさ（度）。画面上で約60px になるように、ズームに合わせて決める
export function clusterCell(zoom: number): number {
  return Math.round(((360 * 60) / (256 * Math.pow(2, zoom))) * 1e6) / 1e6;
}

// 少し広めに取って、小さなドラッグでは再取得しないようにする
export function padBounds(b: Bounds, ratio = 0.25): Bounds {
  const dLat = (b.north - b.south) * ratio;
  const dLng = (b.east - b.west) * ratio;
  return { south: b.south - dLat, west: b.west - dLng, north: b.north + dLat, east: b.east + dLng };
}

// 範囲を格子に合わせて外側へ広げる（同じ場所なら、誰が見ても同じ範囲になり、キャッシュが効く）
export function snapOutward(b: Bounds, grid: number): Bounds {
  return {
    south: r4(Math.floor(b.south / grid) * grid),
    west: r4(Math.floor(b.west / grid) * grid),
    north: r4(Math.ceil(b.north / grid) * grid),
    east: r4(Math.ceil(b.east / grid) * grid),
  };
}

// inner が outer の中にすっぽり収まっているか
export function contains(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.south >= outer.south &&
    inner.north <= outer.north &&
    inner.west >= outer.west &&
    inner.east <= outer.east
  );
}
