import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { COLLECTIONS } from '@/lib/collections';

const CollectionsIndexPage = () => {
  return (
    <>
      <Helmet>
        <title>Collections — Iconic Handicraft</title>
        <meta name="description" content="Browse every Iconic Handicraft collection — corporate hampers, MDF boxes, wedding hampers, birthday hampers, premium hampers and the eco collection." />
      </Helmet>

      <section className="pt-36 pb-16 bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-[90rem] px-6">
          <Breadcrumbs items={[{ label: 'Collections' }]} />
          <span className="text-gold tracking-[0.35em] uppercase text-xs mt-6 block">Our Craft</span>
          <h1 className="font-display text-primary text-4xl md:text-6xl mt-4 leading-tight max-w-3xl">
            Every Collection, One Craftsmanship Standard
          </h1>
          <p className="text-muted-foreground mt-5 text-lg font-light max-w-2xl">
            Six curated worlds of premium gifting — each fully customizable, minimum order 50 pieces.
          </p>
        </div>
      </section>

      <section className="pb-24 md:pb-32">
        <div className="mx-auto max-w-[90rem] px-6 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {COLLECTIONS.map((c) => (
            c.external ? (
              <a
                key={c.slug}
                href={c.external}
                target="_blank"
                rel="noreferrer"
                className="group rounded-[1.75rem] overflow-hidden bg-white border border-border shadow-sm hover:shadow-2xl transition-all duration-500"
              >
                <Card c={c} />
              </a>
            ) : (
              <Link
                key={c.slug}
                to={`/collections/${c.slug}`}
                className="group rounded-[1.75rem] overflow-hidden bg-white border border-border shadow-sm hover:shadow-2xl transition-all duration-500"
              >
                <Card c={c} />
              </Link>
            )
          ))}
        </div>
      </section>
    </>
  );
};

const Card = ({ c }) => (
  <>
    <div className="relative h-64 overflow-hidden">
      <img src={c.heroImage} alt={c.title} className="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-70" />
    </div>
    <div className="p-7">
      <h3 className="font-display text-2xl text-primary mb-2">{c.title}</h3>
      <p className="text-muted-foreground text-sm font-light mb-5">{c.description}</p>
      <span className="inline-flex items-center gap-2 text-sm text-primary group-hover:text-gold transition-colors">
        Explore Collection <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </div>
  </>
);

export default CollectionsIndexPage;
