import React from 'react';
import { Helmet } from 'react-helmet';
import { MessageCircle, Phone, Mail, MapPin, Instagram, Youtube, Facebook, Linkedin } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import QuoteForm from '@/components/QuoteForm';
import { WHATSAPP_URL, PHONE, PHONE_TEL, EMAIL, ADDRESS, SOCIAL_LINKS } from '@/lib/site';

const ContactPage = () => (
  <>
    <Helmet>
      <title>Contact Us — Iconic Handicraft</title>
      <meta name="description" content="Get in touch with Iconic Handicraft for bulk gifting orders, custom branding and OEM manufacturing enquiries." />
    </Helmet>

    <section className="pt-32 md:pt-40 pb-16 bg-[hsl(var(--background))]">
      <div className="mx-auto max-w-[90rem] px-6">
        <Breadcrumbs items={[{ label: 'Contact' }]} />
        <span className="text-gold tracking-[0.35em] uppercase text-xs mt-6 block">Get In Touch</span>
        <h1 className="font-display text-primary text-4xl md:text-6xl mt-4 leading-tight max-w-3xl">
          Let's Talk About Your Next Gifting Project
        </h1>
      </div>
    </section>

    <section className="pb-24 md:pb-32">
      <div className="mx-auto max-w-[90rem] px-6 grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-5">
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded-2xl bg-white border border-border p-5 hover:shadow-md transition-shadow">
            <span className="h-11 w-11 rounded-full bg-[#25D366]/15 text-[#25D366] flex items-center justify-center"><MessageCircle className="h-5 w-5" /></span>
            <div>
              <p className="text-sm text-muted-foreground">WhatsApp</p>
              <p className="text-primary font-medium">Chat with our team</p>
            </div>
          </a>
          <a href={`tel:${PHONE_TEL}`} className="flex items-center gap-4 rounded-2xl bg-white border border-border p-5 hover:shadow-md transition-shadow">
            <span className="h-11 w-11 rounded-full bg-gold/15 text-gold flex items-center justify-center"><Phone className="h-5 w-5" /></span>
            <div>
              <p className="text-sm text-muted-foreground">Call Us</p>
              <p className="text-primary font-medium">{PHONE}</p>
            </div>
          </a>
          <a href={`mailto:${EMAIL}`} className="flex items-center gap-4 rounded-2xl bg-white border border-border p-5 hover:shadow-md transition-shadow">
            <span className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Mail className="h-5 w-5" /></span>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-primary font-medium">{EMAIL}</p>
            </div>
          </a>
          <div className="flex items-start gap-4 rounded-2xl bg-white border border-border p-5">
            <span className="h-11 w-11 rounded-full bg-secondary text-primary flex items-center justify-center flex-shrink-0"><MapPin className="h-5 w-5" /></span>
            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="text-primary font-medium">{ADDRESS}</p>
            </div>
          </div>
          <div className="rounded-2xl bg-white border border-border p-5">
            <p className="text-sm text-muted-foreground mb-3">Follow Us</p>
            <div className="flex gap-3">
              {[
                { Icon: Instagram, url: SOCIAL_LINKS.instagram, label: 'Instagram' },
                { Icon: Youtube, url: SOCIAL_LINKS.youtube, label: 'YouTube' },
                { Icon: Facebook, url: SOCIAL_LINKS.facebook, label: 'Facebook' },
                { Icon: Linkedin, url: SOCIAL_LINKS.linkedin, label: 'LinkedIn' },
              ].map(({ Icon, url, label }) => <a key={label} href={url} target="_blank" rel="noreferrer" aria-label={label} className="h-11 w-11 rounded-full border border-border flex items-center justify-center text-primary hover:bg-gold hover:text-primary-foreground hover:border-gold transition-all">
                  <Icon className="h-5 w-5" />
                </a>)}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-border rounded-[2rem] p-8 md:p-12">
          <h2 className="font-display text-primary text-3xl mb-8">Send Us a Message</h2>
          <QuoteForm compact />
        </div>
      </div>
    </section>
  </>
);

export default ContactPage;
