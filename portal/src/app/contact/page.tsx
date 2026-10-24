import { PriceRequestForm } from "@/components/price-request-form";
import { SITE } from "@/lib/site";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="container-page grid gap-10 anim-up py-14 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <p className="eyebrow">Contact</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Request a price list</h1>
        <p className="mt-3 text-muted">
          Not a trade customer yet? Leave your details and we will get back to you with our price list.
        </p>
        <div className="mt-6 space-y-1 text-sm">
          {SITE.address ? <p>{SITE.address}</p> : null}
          {SITE.phone ? <p>{SITE.phone}</p> : null}
          {SITE.email ? <p>{SITE.email}</p> : null}
        </div>
      </div>
      <div className="card p-6 shadow-[var(--shadow-md)] sm:p-8">
        <PriceRequestForm />
      </div>
    </div>
  );
}
