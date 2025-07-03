import trimCanvas from "trim-canvas";

// ⚠️ Este fix es necesario porque la librería react-signature-canvas
// intenta importar por default cuando trim-canvas no exporta default.

export const getTrimmedCanvas = (canvas) => {
  return trimCanvas(canvas);
};
