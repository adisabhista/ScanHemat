export type ImageQualityWarning =
  | "Pencahayaan kurang."
  | "Gambar terlalu buram."
  | "Resolusi foto terlalu rendah."
  | "Pastikan seluruh struk terlihat.";

export type ImageQualityResult = {
  brightness: number;
  sharpness: number;
  width: number;
  height: number;
  warnings: ImageQualityWarning[];
  message: ImageQualityWarning | "Siap dipindai.";
};

type ImageDataLike = {
  data: Uint8ClampedArray | number[];
  width: number;
  height: number;
};

const minimumWidth = 900;
const minimumHeight = 900;
const minimumBrightness = 70;
const minimumSharpness = 9;

export function hasCameraAccessSupport(mediaDevices?: Pick<MediaDevices, "getUserMedia"> | null) {
  return typeof mediaDevices?.getUserMedia === "function";
}

export function buildCameraReceiptFileName(date = new Date()) {
  const pad = (value: number) => value.toString().padStart(2, "0");

  return `receipt-camera-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.jpg`;
}

export function createReceiptFileFromBlob(blob: Blob, fileName = buildCameraReceiptFileName()) {
  return new File([blob], fileName, { type: blob.type || "image/jpeg" });
}

export function analyzeImageQuality(imageData: ImageDataLike): ImageQualityResult {
  const warnings: ImageQualityWarning[] = [];
  const brightness = getAverageBrightness(imageData);
  const sharpness = getSimpleSharpness(imageData);

  if (imageData.width < minimumWidth || imageData.height < minimumHeight) {
    warnings.push("Resolusi foto terlalu rendah.");
  }

  if (brightness < minimumBrightness) {
    warnings.push("Pencahayaan kurang.");
  }

  if (sharpness < minimumSharpness) {
    warnings.push("Gambar terlalu buram.");
  }

  return {
    brightness,
    sharpness,
    width: imageData.width,
    height: imageData.height,
    warnings,
    message: warnings[0] ?? "Siap dipindai."
  };
}

function getAverageBrightness(imageData: ImageDataLike) {
  const { data } = imageData;
  let total = 0;
  let pixels = 0;

  for (let index = 0; index < data.length; index += 16) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    total += red * 0.299 + green * 0.587 + blue * 0.114;
    pixels += 1;
  }

  return pixels > 0 ? total / pixels : 0;
}

function getSimpleSharpness(imageData: ImageDataLike) {
  const { data, width, height } = imageData;
  const sampleStep = 4;
  let totalDifference = 0;
  let comparisons = 0;

  for (let y = sampleStep; y < height - sampleStep; y += sampleStep) {
    for (let x = sampleStep; x < width - sampleStep; x += sampleStep) {
      const current = getLuma(data, y * width + x);
      const right = getLuma(data, y * width + x + sampleStep);
      const bottom = getLuma(data, (y + sampleStep) * width + x);

      totalDifference += Math.abs(current - right) + Math.abs(current - bottom);
      comparisons += 2;
    }
  }

  return comparisons > 0 ? totalDifference / comparisons : 0;
}

function getLuma(data: Uint8ClampedArray | number[], pixelIndex: number) {
  const index = pixelIndex * 4;
  const red = data[index] ?? 0;
  const green = data[index + 1] ?? 0;
  const blue = data[index + 2] ?? 0;

  return red * 0.299 + green * 0.587 + blue * 0.114;
}
