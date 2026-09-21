import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { COLLECTIONS } from '@/lib/collections';

const Collections = () => {
  return (
    <section id="collections" className="py-24 md:py-32 bg-[hsl(var(--background))]">
      <div className="mx-auto max-w-[90rem] px-6">
        <div className="max-w-2xl mb-16">
          <span className="text-gold tracking-[0.35em] uppercase text-xs">Our Craft</span>
          <h2 className="font-display text-primary text-4xl md:text-6xl mt-4 leading-tight">
            Explore Collections
          </h2>
          <p className="text-muted-foreground mt-5 text-lg font-light">
            Six curated worlds of premium gifting, each handcrafted and fully customizable
            for discerning brands and celebrations.
          </p>
        </div>

        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {COLLECTIONS.map((c, i) => (
            <motion.div
              key={c.slug}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: (i % 3) * 0.1 }}
            >
              {c.external ? (
                <a
                  href={c.external}
                  target="_blank"
                  rel="noreferrer"
                  className="group block text-left rounded-[1.75rem] overflow-hidden bg-white border border-border shadow-sm hover:shadow-2xl transition-all duration-500"
                >
                  <CardBody c={c} />
                </a>
              ) : (
                <Link
                  to={`/collections/${c.slug}`}
                  className="group block text-left rounded-[1.75rem] overflow-hidden bg-white border border-border shadow-sm hover:shadow-2xl transition-all duration-500"
                >
                  <CardBody c={c} />
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const CardBody = ({ c }) => (
  <>
    <div className="relative h-72 overflow-hidden">
      <img
        src={c.heroImage}
        alt={c.title}
        className="h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-70" />
      {c.external && (
        <span className="absolute top-4 right-4 bg-gold text-primary text-[10px] tracking-wider uppercase px-3 py-1 rounded-full">
          Eco
        </span>
      )}
    </div>
    <div className="p-7">
      <h3 className="font-display text-2xl text-primary mb-2">{c.title}</h3>
      <p className="text-muted-foreground text-sm font-light mb-5">{c.description}</p>
      <span className="inline-flex items-center gap-2 text-sm text-primary group-hover:text-gold transition-colors">
        Explore Collection
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </div>
  </>
);

export default Collections;
