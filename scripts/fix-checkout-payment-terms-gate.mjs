import fs from "node:fs";

const path = "src/pages/CheckoutTwoStep.jsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 anchor, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
  '    if (!isPayment || !items.length || actions || preparing.current) return;\n    if (!detailsComplete) { navigate("/checkout", { replace:true }); return; }',
  '    if (!isPayment || !items.length || actions || preparing.current) return;\n    if (!detailsComplete) { navigate("/checkout", { replace:true }); return; }\n    // The checkout backend correctly requires policy acceptance before it creates a Stripe session.\n    // Do not call createOrder until the customer has explicitly accepted the policies.\n    if (!form.termsAccepted) return;',
  "payment initialization terms gate",
);

replaceOnce(
  '  }, [isPayment]);',
  '  }, [isPayment, form.termsAccepted]);',
  "payment initialization dependency",
);

replaceOnce(
  '{placing&&!actions&&<div className="min-h-40 rounded-xl border border-border flex items-center justify-center text-sm text-muted-foreground"><Lock size={18} className="mr-2"/> Loading secure payment…</div>}<div ref={paymentHost}',
  '{!form.termsAccepted&&!actions&&<div className="min-h-40 rounded-xl border border-border flex items-center justify-center px-6 text-center text-sm text-muted-foreground"><Lock size={18} className="mr-2 shrink-0"/> Accept the Terms & Conditions and acknowledge the Privacy Policy below to load the secure Stripe payment fields.</div>}{placing&&!actions&&<div className="min-h-40 rounded-xl border border-border flex items-center justify-center text-sm text-muted-foreground"><Lock size={18} className="mr-2"/> Loading secure payment…</div>}<div ref={paymentHost}',
  "payment placeholder guidance",
);

fs.writeFileSync(path, source);
console.log("Checkout payment terms gate repaired.");
