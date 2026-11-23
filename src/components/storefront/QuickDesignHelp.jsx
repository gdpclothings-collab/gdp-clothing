import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ClipboardCopy, ExternalLink, HelpCircle, Mail, X } from 'lucide-react';

const HELP_TOPICS = [
  {
    title: 'How do I preview my design on a garment?',
    answer: 'Upload up to five photos, optionally remove backgrounds, choose a GDP flame or storm background and enter your name. One STORM-inspired composition places the name above your pets and the background toward the bottom. Choose T-shirt, Sweatshirt or Hoodie, then Front or Back. You can compare six black garment mockups.',
  },
  {
    title: 'My background removal is slow or looks wrong',
    answer: 'If you enable remove.bg, Quick Design first checks whether a PNG or WebP already has a transparent background. Those images are left exactly as uploaded, with no remove.bg call or credits used. Opaque photos (including JPGs) are sent for an optional low-resolution cutout. A solid-colour background can still need removal, and the local check cannot always identify the subject. When removal is unavailable, your original stays safe and the external remove.bg link remains available. This is not final print-ready artwork.',
  },
  {
    title: 'Can I leave the subtitle blank?',
    answer: 'Yes. Only the name is required for a design request. An empty subtitle stays empty; no automatic CUSTOM BOOTLEG text is added.',
  },
  {
    title: 'How do I change the name style?',
    answer: 'Choose one of five bootleg font presets, adjust the 60–160% font-size slider, and choose a premium finish such as chrome, neon glow or retro 3D. Set a name color, then choose Straight, Curve upward or Curve downward. Long names auto-fit within the 12 × 16-inch layout.',
  },
  {
    title: 'Are front and back both included?',
    answer: 'No. Each mockup is an alternative. Only the garment and one selected side are included in a design request. The black garment images are studio-rendered illustrations rather than manufacturer-certified photos.',
  },
  {
    title: 'What if I need help finishing or ordering?',
    answer: 'Choose a black garment and print side, save or share the mockup, and use the contact link below. Include your name, selected style and original photos when GDP asks for them. The development preview does not upload photos, place an order, or charge your card.',
  },
];

export default function QuickDesignHelp({ onClose, details }) {
  const closeRef = useRef(null);
  const [copyStatus, setCopyStatus] = useState('');
  const titleId = 'gdp-quick-design-help-title';

  useEffect(() => {
    const previous = document.activeElement;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = priorOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);

  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll('button:not([disabled]), a[href], summary')].filter((item) => item.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const copyDesignDetails = async () => {
    const summary = [
      'GDP Quick Design – customer help request',
      'Name: ' + (details?.headline?.trim() || '(not entered)'),
      'Subtitle: ' + (details?.subline?.trim() || '(none)'),
      'Layout: STORM-inspired — name top, pets center, background bottom',
      'GDP background: ' + (details?.background || '(not selected)'),
      'Font: ' + (details?.font || 'Street Impact'),
      'Font size: ' + (details?.fontSizePercent || 100) + '%',
      'Premium finish: ' + (details?.premiumStyle || 'Solid color'),
      'Name layout: ' + (details?.curve || 'straight'),
      'Photos selected: ' + (details?.photoCount || 0),
      'Garment: ' + (details?.garment || 'T-shirt'),
      'Side to print: ' + (details?.garmentSide || 'front'),
      'Artwork preview: 12 x 16 inches',
      'Note: Original photos and previews are NOT included in this text.',
    ].join('\n');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(summary);
      setCopyStatus('Design details copied. Paste them into your message to GDP.');
    } catch {
      setCopyStatus('Copy unavailable on this device. You can describe your style to GDP using the contact page.');
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/80 px-2 pt-4 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section id="gdp-quick-design-help-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={trapFocus} data-gdp-quick-design-help="true" className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-white/20 bg-[#13151a] text-white shadow-2xl sm:max-h-[87vh] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-lime-300/15 text-lime-300"><HelpCircle size={22} /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-lime-300">Free design support</p>
              <h2 id={titleId} className="text-xl font-black">Need help with your design?</h2>
            </div>
          </div>
          <button type="button" ref={closeRef} onClick={onClose} aria-label="Close design help" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/20 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-lime-300"><X size={20} /></button>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <p className="text-sm leading-6 text-white/70">Follow the steps below, or contact GDP for personalized assistance. Opening this guide never changes your artwork or submits an order.</p>

          <div className="mt-5 rounded-xl border border-lime-300/15 bg-lime-300/5 p-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-lime-200"><BookOpen size={17} /> Quick start</div>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-white/85">
              <li>1. Add one to five photos. Opt in to remove.bg only if you want photos processed by the external service.</li>
              <li>2. Pick an original GDP bootleg background.</li>
              <li>3. Add your name, font size, premium finish, color, and straight or curved text.</li>
              <li>4. Compare both free samples, then preview T-shirt, sweatshirt or hoodie (front/back).</li>
              <li>5. Save your sample and contact GDP if you need help finishing.</li>
            </ol>
          </div>

          <h3 className="mt-6 text-sm font-black uppercase tracking-wide text-white/80">Common questions</h3>
          <div className="mt-3 divide-y divide-white/10 rounded-xl border border-white/15">
            {HELP_TOPICS.map((topic, index) => (
              <details key={topic.title} className="group px-4 py-3" open={index === 0}>
                <summary className="cursor-pointer select-none pr-2 text-sm font-bold leading-6 text-white/90 focus-visible:outline-2 focus-visible:outline-lime-300">{topic.title}</summary>
                <p className="mt-2 text-sm leading-6 text-white/65">{topic.answer}</p>
              </details>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-white/15 bg-white/5 p-4">
            <p className="text-sm font-bold">Still need GDP to help finish your design?</p>
            <p className="mt-2 text-xs leading-5 text-white/65">Copy your current design choices, then open GDP's existing contact page in another tab. Your photos stay in this browser; GDP may ask you to send the original files separately.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={copyDesignDetails} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10"><ClipboardCopy size={17}/> Copy design details</button>
              <a href="https://gdpclothing.ca/pages/contact" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-2 text-center text-sm font-black text-black hover:bg-lime-200"><Mail size={17}/> Contact GDP <ExternalLink size={15}/></a>
            </div>
            {copyStatus && <p role="status" className="mt-3 flex items-start gap-2 text-xs leading-5 text-lime-200"><Check size={14} className="mt-0.5 shrink-0"/>{copyStatus}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
