import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Youtube, Facebook, Linkedin, Phone, Mail, MapPin, MessageCircle } from 'lucide-react';
import { LOGO_URL, WHATSAPP_URL, PHONE, PHONE_TEL, EMAIL, ADDRESS, SOCIAL_LINKS } from '@/lib/site';
import { COLLECTIONS } from '@/lib/collections';
const Footer = () => {
  const year = new Date().getFullYear();
  return <footer className="bg-primary text-primary-foreground pt-20 pb-8">
      <div className="mx-auto max-w-[90rem] px-6 grid gap-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-3 mb-5">
            <img src={LOGO_URL} alt="Iconic Handicraft" className="h-14 w-14 rounded-full object-contain bg-white border border-border/50 shadow-sm" />
            <span className="font-display text-xl">Iconic Handicraft</span>
          </div>
          <p className="text-white/70 text-sm font-light leading-relaxed">
            A luxury gifting house crafting premium hampers, MDF boxes, eco-friendly bags and
            fully customized packaging for brands and celebrations worldwide.
          </p>
        </div>

        <div>
          <h4 className="font-display text-lg mb-5 text-gold">Collections</h4>
          <ul className="space-y-3 text-sm text-white/75">
            {COLLECTIONS.map(c => <li key={c.slug}>
                {c.external ? <a href={c.external} target="_blank" rel="noreferrer" className="hover:text-gold transition-colors">
                    {c.title}
                  </a> : <Link to={`/collections/${c.slug}`} className="hover:text-gold transition-colors">
                    {c.title}
                  </Link>}
              </li>)}
          </ul>
        </div>

        <div>
          <h4 className="font-display text-lg mb-5 text-gold">Company</h4>
          <ul className="space-y-3 text-sm text-white/75">
            <li><Link to="/about" className="hover:text-gold transition-colors">About Us</Link></li>
            <li><Link to="/contact" className="hover:text-gold transition-colors">Contact</Link></li>
            <li><Link to="/request-quote" className="hover:text-gold transition-colors">Request Quote</Link></li>
          </ul>
          <h4 className="font-display text-lg mb-5 mt-8 text-gold">Contact</h4>
          <ul className="space-y-3 text-sm text-white/75">
            <li><a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-gold"><MessageCircle className="h-4 w-4" /> WhatsApp</a></li>
            <li><a href={`tel:${PHONE_TEL}`} className="inline-flex items-center gap-2 hover:text-gold"><Phone className="h-4 w-4" /> {PHONE}</a></li>
            <li><a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 hover:text-gold"><Mail className="h-4 w-4" /> {EMAIL}</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-lg mb-5 text-gold">Visit Us With Appointment</h4>
          <p className="inline-flex items-start gap-2 text-sm text-white/75 mb-6"><MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" /> {ADDRESS}</p>
          <div className="flex gap-4">
            {[
              { Icon: Instagram, url: SOCIAL_LINKS.instagram, label: 'Instagram' },
              { Icon: Youtube, url: SOCIAL_LINKS.youtube, label: 'YouTube' },
              { Icon: Facebook, url: SOCIAL_LINKS.facebook, label: 'Facebook' },
              { Icon: Linkedin, url: SOCIAL_LINKS.linkedin, label: 'LinkedIn' },
            ].map(({ Icon, url, label }) => <a key={label} href={url} target="_blank" rel="noreferrer" aria-label={label} className="h-10 w-10 rounded-full border border-white/25 flex items-center justify-center hover:bg-gold hover:text-primary hover:border-gold transition-all">
                <Icon className="h-4 w-4" />
              </a>)}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[90rem] px-6 mt-16 pt-6 border-t border-white/15 flex flex-col sm:flex-row justify-between gap-3 text-xs text-white/55">
        <span>© {year} Iconic Handicraft. All rights reserved.</span>
        <div className="flex gap-6">
          <a href="#" className="hover:text-gold">Privacy Policy</a>
          <a href="#" className="hover:text-gold">Terms</a>
        </div>
      </div>
    </footer>;
};
export default Footer;