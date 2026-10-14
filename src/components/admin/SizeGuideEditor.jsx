import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SIZE_GUIDE_FIELDS } from '@/lib/sizeGuideRows';

const inputClass = 'w-full min-w-[90px] rounded-md border border-[#dadada] bg-white px-2 py-2 text-xs text-[#222] outline-none focus:border-[#777]';

export default function SizeGuideEditor({ rows, note, onRowsChange, onNoteChange }) {
  const updateCell = (index, key, value) => {
    onRowsChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  };

  const addSize = () => {
    onRowsChange([...rows, { size: '', length: '', lengthTolerance: '', chestTolerance: '', width: '', sleeve: '', sleeveTolerance: '' }]);
  };

  return (
    <div className="space-y-3" data-gdp-admin-size-guide="true">
      <p className="text-xs leading-5 text-[#777]">
        Edit each size's measurements in inches. Fractions (e.g. 33 1/2) and tolerances (e.g. +/-1) are accepted as text.
        This chart is informational: editing it does not change available garment sizes, variants, inventory or pricing.
      </p>
      <div className="overflow-x-auto rounded-lg border border-[#dedede]">
        <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
          <thead className="bg-[#f7f7f7] text-[#555]">
            <tr>
              <th scope="col" className="px-2 py-3">Size</th>
              {SIZE_GUIDE_FIELDS.map((field) => <th key={field.key} scope="col" className="px-2 py-3">{field.label}</th>)}
              <th scope="col" className="px-2 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-[#eee]">
                <td className="p-2">
                  <input aria-label={`Size label row ${index + 1}`} value={row.size || ''} onChange={(event) => updateCell(index, 'size', event.target.value)} className={inputClass} placeholder="e.g. XL" maxLength={20} />
                </td>
                {SIZE_GUIDE_FIELDS.map((field) => (
                  <td key={field.key} className="p-2">
                    <input
                      aria-label={`${field.label} for ${row.size || `row ${index + 1}`}`}
                      value={row[field.key] || ''}
                      onChange={(event) => updateCell(index, field.key, event.target.value)}
                      className={inputClass}
                      placeholder={field.key.endsWith('Tolerance') ? '+/-1' : 'Inches'}
                      maxLength={50}
                    />
                  </td>
                ))}
                <td className="p-2">
                  <button type="button" onClick={() => onRowsChange(rows.filter((_, rowIndex) => rowIndex !== index))} aria-label={`Remove ${row.size || `size row ${index + 1}`}`} className="grid h-10 w-10 place-items-center rounded-lg border border-[#ddd] text-[#666] hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="border-t border-[#eee] px-3 py-5 text-xs text-[#888]">No chart yet. Add a size to create one.</p>}
      </div>
      <button type="button" onClick={addSize} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d6d6d6] bg-white px-4 text-xs font-bold hover:bg-[#f7f7f7]">
        <Plus size={14} /> Add size row
      </button>
      <label className="block text-xs font-semibold text-[#555]">
        Size guide note
        <textarea rows={2} value={note} onChange={(event) => onNoteChange(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d6d6d6] bg-white px-3 py-2 text-sm font-normal text-[#333]" placeholder="All measurements are in inches." />
      </label>
    </div>
  );
}
