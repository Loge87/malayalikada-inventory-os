/** How a barcode reached the app. */
export type ScanSource =
  | "scan" // hardware scanner (keystroke burst) — BarcodeInput
  | "manual" // typed or pasted into the field — BarcodeInput
  | "camera"; // decoded from the device camera — CameraScanButton
