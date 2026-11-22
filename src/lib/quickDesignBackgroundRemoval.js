// GDPR-friendly, user-device-only AI cutout. No customer photo is posted to a
// server: a pinned Transformers.js module and Apache-2.0 ONNX model are fetched,
// then inference runs locally using WASM.  Do NOT confuse this with a free cloud AI
// image-generation API; size and performance depend on the customer's device.
//
// Commercial model: onnx-community/ormbg-ONNX (Apache-2.0)
// Library: @huggingface/transformers 3.8.1 (Apache-2.0)
export const QUICK_DESIGN_CUTOUT_MODEL = 'onnx-community/ormbg-ONNX';
export const QUICK_DESIGN_CUTOUT_LIBRARY_URL =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

let removerPromise = null;

async function getRemover() {
  if (!removerPromise) {
    removerPromise = (async () => {
      // Vite is intentionally told not to bundle the external ESM entrypoint.
      // Dynamic import occurs ONLY when a customer enables local cutouts.
      const mod = await import(/* @vite-ignore */ QUICK_DESIGN_CUTOUT_LIBRARY_URL);
      return mod.pipeline('background-removal', QUICK_DESIGN_CUTOUT_MODEL, {
        device: 'wasm',
        dtype: 'uint8',
      });
    })().catch((error) => {
      removerPromise = null; // allow a retry after a failed model download
      throw error;
    });
  }
  return removerPromise;
}

export async function removeQuickDesignBackground(blobUrl) {
  if (typeof blobUrl !== 'string' || !blobUrl.startsWith('blob:')) {
    throw new Error('Only customer-uploaded local photos may be processed.');
  }
  const remover = await getRemover();
  const result = await remover([blobUrl]);
  const cutout = Array.isArray(result) ? result[0] : result;
  if (!cutout || cutout.channels !== 4 || !cutout.width || !cutout.height) {
    throw new Error('The removal model did not return a transparent image.');
  }
  const blob = await cutout.toBlob();
  if (!blob || !blob.size) throw new Error('Unable to save the transparent cutout.');
  return URL.createObjectURL(blob);
}
