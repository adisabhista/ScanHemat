import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeImageQuality,
  buildCameraReceiptFileName,
  createReceiptFileFromBlob,
  hasCameraAccessSupport
} from "@/lib/image/client-quality";

test("reports low brightness", () => {
  const result = analyzeImageQuality(buildImageData(1200, 1200, () => [20, 20, 20]));

  assert.ok(result.warnings.includes("Pencahayaan kurang."));
});

test("reports low resolution", () => {
  const result = analyzeImageQuality(buildImageData(640, 480, () => [240, 240, 240]));

  assert.ok(result.warnings.includes("Resolusi foto terlalu rendah."));
});

test("reports ready when brightness, sharpness, and resolution are acceptable", () => {
  const result = analyzeImageQuality(
    buildImageData(1200, 1200, (x, y) => {
      const value = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? 30 : 245;
      return [value, value, value];
    })
  );

  assert.equal(result.message, "Siap dipindai.");
});

test("builds a stable camera receipt file name", () => {
  const fileName = buildCameraReceiptFileName(new Date("2026-05-16T07:08:09.000Z"));

  assert.match(fileName, /^receipt-camera-20260516-\d{6}\.jpg$/);
});

test("creates file from captured blob", () => {
  const file = createReceiptFileFromBlob(new Blob(["x"], { type: "image/jpeg" }), "receipt-camera-test.jpg");

  assert.equal(file.name, "receipt-camera-test.jpg");
  assert.equal(file.type, "image/jpeg");
});

test("detects unsupported camera state", () => {
  assert.equal(hasCameraAccessSupport(null), false);
  assert.equal(hasCameraAccessSupport({ getUserMedia: async () => ({}) as MediaStream }), true);
});

function buildImageData(width: number, height: number, colorAt: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue] = colorAt(x, y);
      const index = (y * width + x) * 4;
      data[index] = red;
      data[index + 1] = green;
      data[index + 2] = blue;
      data[index + 3] = 255;
    }
  }

  return { data, width, height };
}
