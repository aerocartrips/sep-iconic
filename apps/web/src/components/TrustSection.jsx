import React from 'react';
import { Helmet } from 'react-helmet';
import { BadgeCheck, Building2, Factory, Gift, ExternalLink } from 'lucide-react';
import { INDIAMART_LOGO_URL } from '@/lib/site';

const INDIAMART_URL = 'https://www.indiamart.com/iconicstore-newdelhi/';

const IndiaMARTLogo = () => (
  <img
    src={INDIAMART_LOGO_URL}
    alt="IndiaMART"
    className="h-16 md:h-20 w-auto max-w-full object-contain"
    draggable={false}
  />
);

const trustBadges = [
  {
    Icon: BadgeCheck,
    title: 'Verified IndiaMART Supplier',
  },
  {
    Icon: Building2,
    title: 'Trusted by Businesses Across India',
  },
  {
    Icon: Factory,
    title: 'OEM & Private Label Manufacturer',
  },
  {
    Icon: Gift,
    title: 'Corporate, Wedding & Premium Packaging Specialists',
  },
];

const TrustSection = () => {
  return (
    <section className="bg-background py-20 md:py-24">
      <Helmet>
        <meta
          name="description"
          content="ICONIC Handicraft is a verified IndiaMART supplier trusted by businesses across India for premium customized packaging, corporate gifting, wedding hampers, and OEM manufacturing."
        />
      </Helmet>

      <div className="mx-auto max-w-[90rem] px-6">
        {/* Heading */}
        <div className="mx-auto max-w-3xl text-center mb-14">
          <span className="text-xs font-medium uppercase tracking-[0.25em] text-gold">
            Trust & Credibility
          </span>
          <h2 className="font-display text-4xl md:text-5xl text-primary mt-4 leading-tight">
            Trusted by Businesses Across India
          </h2>
          <p className="mt-5 text-muted-foreground text-base md:text-lg font-light leading-relaxed">
            We are proud to be a verified supplier on India's leading B2B marketplace.
            Businesses across the country trust ICONIC Handicraft for premium customized
            packaging, corporate gifting, wedding hampers, and OEM manufacturing solutions.
          </p>
        </div>

        {/* IndiaMART Trust Card */}
        <div className="mx-auto max-w-3xl">
          <div className="group bg-card rounded-3xl border border-border/70 shadow-[0_18px_50px_-20px_rgba(53,84,61,0.25)] p-8 md:p-12 transition-all duration-300 hover:shadow-[0_28px_70px_-24px_rgba(53,84,61,0.35)] hover:-translate-y-1">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-10">
              {/* Logo block */}
              <div className="flex-shrink-0 flex flex-col items-center gap-4 md:w-1/3">
                <div className="rounded-2xl bg-secondary/60 border border-border/60 px-6 py-5 w-full flex items-center justify-center">
                  <IndiaMARTLogo />
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gold">
                  <BadgeCheck className="h-4 w-4" />
                  Verified Supplier
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-display text-2xl md:text-3xl text-primary leading-snug">
                  Verified IndiaMART Supplier
                </h3>
                <p className="mt-3 text-muted-foreground font-light leading-relaxed">
                  Explore our verified IndiaMART profile to discover our products, company
                  information, customer inquiries, and business presence.
                </p>

                <a
                  href={INDIAMART_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-primary-foreground font-medium text-sm tracking-wide transition-all duration-300 hover:bg-gold hover:text-primary hover:shadow-lg hover:scale-[1.03] active:scale-[0.98]"
                >
                  Visit Our IndiaMART Store
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Features */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {trustBadges.map(({ Icon, title }) => (
            <div
              key={title}
              className="group flex items-center gap-4 bg-card rounded-2xl border border-border/60 p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
            >
              <span className="flex-shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-full bg-secondary/70 text-gold transition-colors duration-300 group-hover:bg-gold group-hover:text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium text-primary leading-snug">
                {title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
