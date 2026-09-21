import React, { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ArrowRight } from 'lucide-react';
import { HERO_SLIDES, WHATSAPP_URL } from '@/lib/site';

const Hero = () => {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const goQuote = useCallback(() => {
    document.getElementById('quote')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const slide = HERO_SLIDES[index];

  return (
    <section className="relative h-[100dvh] w-full overflow-hidden bg-primary">
      <AnimatePresence mode="sync">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          <img
            src={slide.image}
            alt={slide.title}
            className="h-full w-full object-cover ken-burns"
            key={`img-${index}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/50" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 h-full flex items-center">
        <div className="mx-auto max-w-[90rem] w-full px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className="max-w-2xl"
            >
              <span className="inline-block text-gold tracking-[0.35em] uppercase text-xs mb-5">
                {slide.eyebrow}
              </span>
              <h1 className="font-display text-white text-5xl md:text-7xl leading-[1.05] mb-6">
                {slide.title}
              </h1>
              <p className="text-white/85 text-lg md:text-xl font-light max-w-xl mb-10">
                {slide.description}
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={goQuote}
                  className="px-7 py-3.5 rounded-full bg-primary text-primary-foreground text-sm tracking-wide hover:bg-[hsl(133_23%_33%)] transition-all duration-300 hover:-translate-y-0.5"
                >
                  Request Custom Quote
                </button>
                {slide.externalCta ? (
                  <a
                    href={slide.externalCta.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-7 py-3.5 rounded-full bg-gold text-primary text-sm tracking-wide hover:brightness-105 transition-all duration-300 hover:-translate-y-0.5 inline-flex items-center gap-2"
                  >
                    {slide.externalCta.label} <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <button
                    onClick={() => navigate('/collections')}
                    className="px-7 py-3.5 rounded-full border border-white/60 text-white text-sm tracking-wide hover:bg-white/10 transition-all duration-300 hover:-translate-y-0.5"
                  >
                    Explore Collection
                  </button>
                )}
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-7 py-3.5 rounded-full border border-white/60 text-white text-sm tracking-wide hover:bg-white/10 transition-all duration-300 hover:-translate-y-0.5 inline-flex items-center gap-2"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp Us
                </a>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-3">
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-1 rounded-full transition-all duration-500 ${
              i === index ? 'w-10 bg-gold' : 'w-4 bg-white/40'
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default Hero;
