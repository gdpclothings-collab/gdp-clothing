import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function AuthLayout({ icon: Icon, title, subtitle, children, footer }) {
  return (
    <main className="relative min-h-[calc(100vh-5rem)] overflow-hidden bg-background px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute left-1/2 top-[-9rem] h-72 w-72 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute bottom-[-10rem] right-[-6rem] h-72 w-72 rounded-full bg-accent/8 blur-3xl sm:h-96 sm:w-96" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:gap-10">
        <section className="hidden min-h-[620px] rounded-3xl border border-border bg-primary p-8 text-primary-foreground shadow-sm lg:flex lg:flex-col lg:justify-between xl:p-10">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/70 transition-colors hover:text-primary-foreground">
              <ArrowLeft className="h-4 w-4" />
              GDP Clothing
            </Link>

            <div className="mt-16 max-w-md">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10">
                {Icon ? <Icon className="h-6 w-6" aria-hidden="true" /> : <ShieldCheck className="h-6 w-6" aria-hidden="true" />}
              </div>
              <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary-foreground/55">Customer account</div>
              <h1 className="mt-3 font-display text-6xl leading-[0.9] xl:text-7xl">YOUR GDP<br />WORKSPACE</h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-primary-foreground/70">
                Keep purchases, custom orders, proofs, saved designs and account details together in one secure place.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] text-primary-foreground/65">
            <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 px-3 py-3">Orders</div>
            <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 px-3 py-3">Designs</div>
            <div className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 px-3 py-3">Proofs</div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-xl lg:max-w-none">
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              GDP Clothing
            </Link>
            <span className="rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Secure
            </span>
          </div>

          <div className="rounded-3xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-6 sm:px-7 sm:py-7 md:px-8">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground sm:h-12 sm:w-12">
                  {Icon ? <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />}
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">GDP Clothing account</div>
                  <h1 className="mt-1 font-display text-4xl leading-none sm:text-5xl">{title}</h1>
                  {subtitle && <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>}
                </div>
              </div>
            </div>

            <div className="px-5 py-6 sm:px-7 sm:py-7 md:px-8 md:py-8">{children}</div>

            {footer && (
              <div className="border-t border-border bg-secondary/20 px-5 py-4 text-center text-sm text-muted-foreground sm:px-7 md:px-8">
                {footer}
              </div>
            )}
          </div>

          <div className="mx-auto mt-4 flex max-w-lg items-start justify-center gap-2 px-4 text-center text-[11px] leading-5 text-muted-foreground sm:text-xs">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Your account is used to keep your GDP Clothing orders, designs and approvals connected to you.</span>
          </div>
        </section>
      </div>
    </main>
  );
}
