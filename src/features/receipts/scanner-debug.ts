export function shouldShowScannerDebug(environment = process.env.NODE_ENV) {
  return environment === "development";
}
