import React from "react";
import { mergeContactPageBody } from "@/lib/contactPageDefaults";

const inputClass =
  "w-full h-10 rounded-lg border border-[#d4d4d4] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-black/10";
const textareaClass =
  "w-full rounded-lg border border-[#d4d4d4] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10";

function Field({ label, helper, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#555]">{label}</span>
      {helper ? <span className="ml-2 text-[10px] text-[#888]">{helper}</span> : null}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function ContactPageEditorFields({ body, onChange }) {
  const value = mergeContactPageBody(body);

  const set = (key, nextValue) => {
    onChange({
      ...value,
      [key]: nextValue,
      template: "contact",
    });
  };

  return (
    <section className="rounded-xl border border-[#dedede] overflow-hidden">
      <div className="px-4 py-3 bg-[#fafafa] border-b border-[#e8e8e8]">
        <div className="text-sm font-semibold">Contact page content</div>
        <div className="text-xs text-[#777] mt-0.5">
          Store email, phone and address are managed in Store settings. These fields control the customer-facing copy.
        </div>
      </div>

      <div className="p-4 space-y-4 bg-white">
        <Field label="Intro">
          <textarea
            rows={3}
            value={value.intro}
            onChange={(event) => set("intro", event.target.value)}
            className={textareaClass}
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Response time">
            <input
              value={value.responseTime}
              onChange={(event) => set("responseTime", event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Location note">
            <input
              value={value.locationNote}
              onChange={(event) => set("locationNote", event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Form heading">
          <input
            value={value.formHeading}
            onChange={(event) => set("formHeading", event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Form helper text">
          <textarea
            rows={2}
            value={value.formHelper}
            onChange={(event) => set("formHelper", event.target.value)}
            className={textareaClass}
          />
        </Field>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-[#e5e5e5] p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#777]">
              Custom Studio callout
            </div>
            <Field label="Heading">
              <input
                value={value.customTitle}
                onChange={(event) => set("customTitle", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Text">
              <textarea
                rows={4}
                value={value.customText}
                onChange={(event) => set("customText", event.target.value)}
                className={textareaClass}
              />
            </Field>
          </div>

          <div className="rounded-lg border border-[#e5e5e5] p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#777]">
              FAQ callout
            </div>
            <Field label="Heading">
              <input
                value={value.faqTitle}
                onChange={(event) => set("faqTitle", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Text">
              <textarea
                rows={4}
                value={value.faqText}
                onChange={(event) => set("faqText", event.target.value)}
                className={textareaClass}
              />
            </Field>
          </div>
        </div>
      </div>
    </section>
  );
}
