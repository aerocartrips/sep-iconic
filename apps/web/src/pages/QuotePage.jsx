import React from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import QuoteForm from '@/components/QuoteForm';
import { QUOTE_IMAGE, WHATSAPP_URL } from '@/lib/site';

const QuotePage = () => {
  const [params] = useSearchParams();
  const category = params.get('category') || '';
  const productName = params.get('product') || '';

  return (
    <>
      <Helmet>
        <title>Request a Custom Quote — Iconic Handicraft</title>
        <meta name="description" content="Request a custom quote for corporate hampers, MDF boxes, wedding packaging and more — minimum order 50 pieces, fully customizable." />
      </Helmet>

      <section className="pt-32 md:pt-40 pb-16 bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-[90rem] px-6">
          <Breadcrumbs items={[{ label: 'Request Quote' }]} />
          <span className="text-gold tracking-[0.35em] uppercase text-xs mt-6 block">Get In Touch</span>
          <h1 className="font-display text-primary text-4xl md:text-6xl mt-4 leading-tight max-w-3xl">
            Request a Custom Quote
          </h1>
          <p className="text-muted-foreground mt-5 text-lg font-light max-w-2xl">
            Tell us what you need — a gifting specialist will respond within one business day with a
            bespoke proposal.
          </p>
        </div>
      </section>

      <section className="pb-24 md:pb-32">
        <div className="mx-auto max-w-[90rem] px-6">
          <div className="grid lg:grid-cols-2 gap-0 rounded-[2rem] overflow-hidden shadow-xl bg-white border border-border">
            <div className="relative min-h-[420px] hidden lg:block">
              <img src={QUOTE_IMAGE} alt="Craftsmanship" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/70 to-transparent" />
              <div className="absolute bottom-10 left-10 right-10 text-white">
                <h3 className="font-display text-4xl leading-tight">Bespoke gifting, made to order</h3>
                <p className="text-white/85 font-light mt-3">
                  Prefer to talk it through first? WhatsApp us any time.
                </p>
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-5 px-6 py-3 rounded-full bg-gold text-primary text-sm">
                  <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
                </a>
              </div>
            </div>
            <div className="p-8 md:p-12">
              <QuoteForm compact defaultCategory={category} defaultProduct={productName} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default QuotePage;
