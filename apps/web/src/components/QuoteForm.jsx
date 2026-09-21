import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, X, MessageCircle } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { QUOTE_IMAGE, CATEGORY_OPTIONS, WHATSAPP_URL } from '@/lib/site';

const empty = {
  full_name: '', company: '', email: '', phone: '', city: '',
  category: '', product_name: '', quantity: '', message: '',
};

const QuoteForm = ({ defaultCategory = '', defaultProduct = '', compact = false }) => {
  const [form, setForm] = useState({ ...empty, category: defaultCategory, product_name: defaultProduct });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm((f) => ({ ...f, category: defaultCategory || f.category, product_name: defaultProduct || f.product_name }));
  }, [defaultCategory, defaultProduct]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await pb.collection('quote_requests').create(form);
      setDone(true);
      setForm({ ...empty, category: defaultCategory, product_name: defaultProduct });
    } catch (err) {
      setError('Something went wrong. Please try again or WhatsApp us.');
    } finally {
      setLoading(false);
    }
  };

  const field =
    'w-full bg-[hsl(var(--background))] border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-gold transition-colors';

  const formEl = (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
      <input required className={field} placeholder="Full Name" value={form.full_name} onChange={set('full_name')} />
      <input className={field} placeholder="Company Name" value={form.company} onChange={set('company')} />
      <input required type="email" className={field} placeholder="Email" value={form.email} onChange={set('email')} />
      <input className={field} placeholder="Phone Number" value={form.phone} onChange={set('phone')} />
      <input className={field} placeholder="City" value={form.city} onChange={set('city')} />
      <select className={field} value={form.category} onChange={set('category')}>
        <option value="">Product Category</option>
        {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input className={field} placeholder="Product Name" value={form.product_name} onChange={set('product_name')} />
      <input className={field} placeholder="Quantity (min 100)" value={form.quantity} onChange={set('quantity')} />
      <textarea rows={4} className={`${field} sm:col-span-2 resize-none`} placeholder="Tell us about your project" value={form.message} onChange={set('message')} />

      {error && <p className="sm:col-span-2 text-destructive text-sm">{error}</p>}

      <div className="sm:col-span-2 mt-2 grid sm:grid-cols-2 gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3.5 text-sm tracking-wide hover:bg-[hsl(133_23%_33%)] transition-all disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Request a Custom Quote
        </button>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-primary text-primary py-3.5 text-sm tracking-wide hover:bg-primary hover:text-primary-foreground transition-all"
        >
          <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
        </a>
      </div>
    </form>
  );

  if (compact) {
    return (
      <>
        {formEl}
        <SuccessModal done={done} setDone={setDone} />
      </>
    );
  }

  return (
    <section id="quote" className="py-24 md:py-32 bg-[hsl(var(--background))]">
      <div className="mx-auto max-w-[90rem] px-6">
        <div className="grid lg:grid-cols-2 gap-0 rounded-[2rem] overflow-hidden shadow-xl bg-white border border-border">
          <div className="relative min-h-[420px] hidden lg:block">
            <img src={QUOTE_IMAGE} alt="Craftsmanship" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/70 to-transparent" />
            <div className="absolute bottom-10 left-10 right-10 text-white">
              <h3 className="font-display text-4xl leading-tight">Bespoke gifting, made to order</h3>
              <p className="text-white/85 font-light mt-3">
                Larger quantities or special customization? Tell us your vision.
              </p>
            </div>
          </div>

          <div className="p-8 md:p-12">
            <span className="text-gold tracking-[0.35em] uppercase text-xs">Get In Touch</span>
            <h2 className="font-display text-primary text-4xl mt-3 mb-8">Request a Custom Quote</h2>
            {formEl}
          </div>
        </div>
      </div>

      <SuccessModal done={done} setDone={setDone} />
    </section>
  );
};

const SuccessModal = ({ done, setDone }) => (
  <AnimatePresence>
    {done && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
        onClick={() => setDone(false)}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
          className="relative bg-white rounded-[1.75rem] p-10 max-w-md text-center shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => setDone(false)} className="absolute top-4 right-4 text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
          <CheckCircle2 className="h-14 w-14 text-gold mx-auto mb-5" strokeWidth={1.25} />
          <h3 className="font-display text-3xl text-primary mb-3">Thank You</h3>
          <p className="text-muted-foreground font-light">
            Your request has reached our craftsmanship team. A gifting specialist will
            reach out within one business day with a bespoke proposal.
          </p>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default QuoteForm;
