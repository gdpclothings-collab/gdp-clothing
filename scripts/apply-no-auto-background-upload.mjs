import fs from 'node:fs';

const target = 'src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx';
let source = fs.readFileSync(target, 'utf8');

function replaceRange(startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${label}`);
  source = source.slice(0, start) + replacement + source.slice(end);
}

const sourceFileRef = '  const sourcePhotoFilesRef = useRef(new Map());\n';
if (!source.includes(sourceFileRef)) throw new Error('Expected background-removal source file ref is missing');
source = source.replace(sourceFileRef, '');

replaceRange(
  '  const prepareAsset = async (file) => {',
  '\n\n  const uploadPhotos = async (files) => {',
  `  const prepareAsset = async (file) => {\n    setUploadMessage(\`Uploading \${file.name}…\`);\n    const uploaded = await customerApi.uploadArtwork(file);\n    return {\n      url: uploaded.file_url,\n      path: uploaded.storage_path,\n      originalUrl: uploaded.file_url,\n      originalPath: uploaded.storage_path,\n      backgroundMode: 'original',\n      name: file.name || 'customer-photo',\n      type: file.type || 'image/png',\n    };\n  };`,
  'prepareAsset block'
);

replaceRange(
  '  const retryActiveBackgroundRemoval = async () => {',
  '\n\n  const patchText = (patch) => {',
  '',
  'background-removal retry block'
);

const photoHeader = `      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Photos</p><p className="mt-1 text-[11px] font-semibold text-slate-500">{photos.length} / {BOOTLEG_MAX_PHOTOS} photo{photos.length === 1 ? '' : 's'} added</p></div><Layers size={16} className="text-slate-400" /></div>\n`;
if (!source.includes(photoHeader)) throw new Error('Could not locate photo panel header');
source = source.replace(photoHeader, `${photoHeader}      <div data-gdp-photo-upload-guidance="transparent-recommended" className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sky-950"><div className="flex items-start gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0" /><div><p className="text-xs font-black">For best print results</p><p className="mt-1 text-[11px] font-semibold leading-4">Upload artwork with a transparent background when possible. Transparent PNG or WebP is recommended. JPG/JPEG and photos with backgrounds are still accepted and will keep their existing background.</p></div></div></div>\n`);

const fallbackStart = `        {activePhoto.asset?.backgroundRemovalStatus === 'failed' ? <div data-gdp-background-removal-fallback="true"`;
const fallbackIndex = source.indexOf(fallbackStart);
if (fallbackIndex < 0) throw new Error('Could not locate background-removal fallback UI');
const fallbackEnd = source.indexOf('\n        <RangeControl label="Photo size"', fallbackIndex);
if (fallbackEnd < 0) throw new Error('Could not locate end of background-removal fallback UI');
source = source.slice(0, fallbackIndex) + source.slice(fallbackEnd + 1);

if (source.includes('customerApi.removePhotoBackground(')) throw new Error('removePhotoBackground call still present');
if (source.includes('retryActiveBackgroundRemoval')) throw new Error('Retry background-removal handler still present');
if (source.includes('data-gdp-background-removal-fallback')) throw new Error('Background-removal fallback UI still present');
if (!source.includes('data-gdp-photo-upload-guidance="transparent-recommended"')) throw new Error('Transparent background guidance missing');
if (!source.includes('const uploaded = await customerApi.uploadArtwork(file);')) throw new Error('Direct original upload path missing');

fs.writeFileSync(target, source);
