import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function TimingApprovalStep({ model }) {
  const {
    StepTitle,
    designPath,
    needByDate,
    setNeedByDate,
    Choice,
    priority,
    setPriority,
    rushFee,
    rightsConfirmed,
    setRightsConfirmed,
    approvalAcknowledged,
    setApprovalAcknowledged
  } = model;

  return (
    <div>
                <StepTitle eyebrow="Approve the result" title="TIMING + FINAL APPROVAL" text={designPath === "seasonal" ? "Your exact 300 DPI seasonal composite is prepared below. Confirm timing, artwork rights and this exact preview before it can enter your cart." : "The preview you approve is converted into the exact 300 DPI production file before it enters your cart."} />
                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="font-mono text-xs uppercase text-muted-foreground">Need it by</label><input type="date" value={needByDate} onChange={e => setNeedByDate(e.target.value)} className="w-full border border-border bg-background px-3 py-2 mt-1"/></div>
                  <div><label className="font-mono text-xs uppercase text-muted-foreground">Priority</label><div className="flex gap-2 mt-1"><Choice active={priority === "standard"} onClick={() => setPriority("standard")}>Standard</Choice><Choice active={priority === "rush"} onClick={() => setPriority("rush")}>Rush (+{"$" + rushFee})</Choice></div></div>
                </div>
                <div className="mt-6 border border-border p-4"><div className="flex items-start gap-3"><ShieldCheck size={22} className="text-accent shrink-0"/><div><div className="font-bold">Preview-to-print guarantee</div><p className="text-sm text-muted-foreground mt-1">After approval, GDP locks the preview and its matching production PNG. Production prints that locked file—there is no separate designer interpretation.</p></div></div></div>
                <label className="flex items-start gap-3 mt-5 text-sm"><input type="checkbox" checked={rightsConfirmed} onChange={e => setRightsConfirmed(e.target.checked)} className="mt-1"/><span>I confirm I own or have permission to reproduce the photos and artwork I submitted. <Link to="/pages/custom-artwork-policy" target="_blank" className="font-semibold text-accent hover:underline">Upload policy</Link></span></label>
                <label className="flex items-start gap-3 mt-3 text-sm"><input type="checkbox" checked={approvalAcknowledged} onChange={e => setApprovalAcknowledged(e.target.checked)} className="mt-1"/><span><strong>I approve the exact live preview shown.</strong> I understand this result will be locked when added to cart and printed after successful payment. To change it, I must create a new design before checkout. Customer uploads follow the <Link to="/pages/data-retention" target="_blank" className="font-semibold text-accent hover:underline">retention policy</Link>.</span></label>
    </div>
  );
}
