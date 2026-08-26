/**
 * Cho phép chọn ANGLE backend của Chrome khi hyperframes render.
 *
 * WHY: hyperframes hardcode `--use-angle=swiftshader` trong buildChromeArgs()
 * (node_modules/hyperframes/dist/cli.js) → Chrome raster hoàn toàn bằng CPU.
 * Đo trên composition thật (Ryzen 5 5600H): swiftshader ~390 ms/frame, D3D11
 * (GPU Radeon) ~61 ms/frame — chênh hơn 6 lần. Remotion nhanh hơn chính vì nó
 * để Chrome tự chọn GPU (DEFAULT_OPENGL_RENDERER = null).
 *
 * Patch này KHÔNG đổi mặc định: nó chỉ biến hằng số đó thành đọc env
 * HF_ANGLE_BACKEND (không set → vẫn swiftshader y như cũ). Bật GPU bằng cách
 * đặt HF_ANGLE_BACKEND=d3d11 trong .env.local.
 *
 * Chạy tự động qua postinstall (npm install ghi đè node_modules → mất patch).
 * Thủ công: npm run patch:hf
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

/** Literal hyperframes đang hardcode (xuất hiện ở render + snapshot/inspect). */
const NEEDLE = `"--use-angle=swiftshader"`;
/** Bản thay: cùng vị trí trong mảng chromeArgs, nhưng backend đọc từ env. */
const PATCH = "`--use-angle=${process.env.HF_ANGLE_BACKEND || \"swiftshader\"}`";

function resolveCliPath(): string {
  // Bám theo package.json của hyperframes thay vì đoán đường dẫn — chạy đúng cả
  // khi npm hoist khác đi.
  const pkgPath = require.resolve("hyperframes/package.json");
  return join(dirname(pkgPath), "dist", "cli.js");
}

const cliPath = resolveCliPath();
const src = readFileSync(cliPath, "utf-8");

const hits = src.split(NEEDLE).length - 1;
if (hits === 0 && src.includes(PATCH)) {
  console.log(`hyperframes GPU patch: đã có sẵn (${cliPath})`);
  process.exit(0);
}
if (hits === 0) {
  console.error(
    `hyperframes GPU patch: KHÔNG tìm thấy ${NEEDLE} trong ${cliPath}.\n` +
      `  Nhiều khả năng hyperframes đã đổi cách build chromeArgs ở bản mới —\n` +
      `  mở file kiểm tra buildChromeArgs() rồi sửa NEEDLE trong script này.`,
  );
  process.exit(1);
}

writeFileSync(cliPath, src.split(NEEDLE).join(PATCH), "utf-8");
console.log(
  `hyperframes GPU patch: đã vá ${hits} chỗ trong ${cliPath}\n` +
    `  Đặt HF_ANGLE_BACKEND=d3d11 (Windows) / gl-egl (Linux có GPU) để bật GPU.\n` +
    `  Không set → giữ nguyên swiftshader như mặc định của hyperframes.`,
);
