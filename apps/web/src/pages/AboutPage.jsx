import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import Breadcrumbs from '@/components/Breadcrumbs';
import { WORKSHOP_IMAGE } from '@/lib/collections';

const AboutPage = () => (
  <>
    <Helmet>
      <title>About Us — Iconic Handicraft</title>
      <meta name="description" content="Iconic Handicraft is a premium B2B manufacturer of luxury gifting, hampers and custom packaging, trusted by brands across India and worldwide." />
    </Helmet>

    <section className="pt-32 md:pt-40 pb-16 bg-[hsl(var(--background))]">
      <div className="mx-auto max-w-[90rem] px-6">
        <Breadcrumbs items={[{ label: 'About' }]} />
        <span className="text-gold tracking-[0.35em] uppercase text-xs mt-6 block">Our Story</span>
        <h1 className="font-display text-primary text-4xl md:text-6xl mt-4 leading-tight max-w-3xl">
          Crafting Luxury Gifting, One Detail at a Time
        </h1>
      </div>
    </section>

    <section className="pb-24 md:pb-32">
      <div className="mx-auto max-w-[90rem] px-6 grid lg:grid-cols-2 gap-14 items-center">
        <div className="rounded-[2rem] overflow-hidden shadow-xl">
          <img src={WORKSHOP_IMAGE} alt="Iconic Handicraft workshop" className="w-full h-[420px] md:h-[520px] object-cover" />
        </div>
        <div>
          <h2 className="font-display text-primary text-3xl md:text-4xl mb-6">A manufacturing house built on craftsmanship</h2>
          <p className="text-muted-foreground font-light text-lg leading-relaxed mb-5">
            Iconic Handicraft is a premium B2B manufacturer specializing in corporate hampers, MDF gift
            boxes, wedding trousseau packaging and sustainable gifting solutions. Every piece is
            handcrafted by skilled artisans and finished to a luxury standard.
          </p>
          <p className="text-muted-foreground font-light text-lg leading-relaxed mb-5">
            We work exclusively with businesses, corporates, event planners and brands — offering
            OEM manufacturing, private labelling and complete custom branding, with a minimum order
            quantity of just 50 pieces per design.
          </p>
          <p className="text-muted-foreground font-light text-lg leading-relaxed mb-8">
            From our workshop, we ship pan-India and worldwide, supporting collections that scale
            from a handful of styles to hundreds of SKUs without compromising on finish or lead time.
          </p>
          <Link to="/request-quote" className="inline-block px-8 py-3.5 rounded-full bg-primary text-primary-foreground text-sm tracking-wide hover:bg-[hsl(133_23%_33%)] transition-all">
            Start a Conversation
          </Link>
        </div>
      </div>
    </section>
  </>
);

export default AboutPage;
