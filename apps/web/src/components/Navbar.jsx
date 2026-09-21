import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, ShoppingCart, Search, User } from 'lucide-react';
import { LOGO_URL } from '@/lib/site';
import { COLLECTIONS } from '@/lib/collections';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import SearchDialog from '@/components/SearchDialog';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileCollectionsOpen, setMobileCollectionsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeTimer = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMegaOpen(false);
  }, [location.pathname]);

  const onHome = location.pathname === '/';
  const dark = scrolled || !onHome;
  const { totalCount } = useCart();
  const { isAuthed } = useAuth();

  const openMega = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMegaOpen(true);
  };
  const scheduleCloseMega = () => {
    closeTimer.current = setTimeout(() => setMegaOpen(false), 150);
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-40 transition-all duration-500 ${
        dark ? 'bg-[hsl(var(--background))]/95 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="mx-auto max-w-[90rem] px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src={LOGO_URL} alt="Iconic Handicraft" className="h-12 w-12 rounded-full object-contain bg-white/90 border border-border/40 shadow-sm" />
          <span className={`font-display text-xl tracking-wide ${dark ? 'text-primary' : 'text-white'}`}>
            Iconic Handicraft
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-9">
          <Link to="/" className={`text-sm tracking-wide transition-colors hover:text-gold ${dark ? 'text-foreground' : 'text-white/90'}`}>
            Home
          </Link>

          <div
            className="relative"
            onMouseEnter={openMega}
            onMouseLeave={scheduleCloseMega}
          >
            <button
              className={`flex items-center gap-1.5 text-sm tracking-wide transition-colors hover:text-gold ${dark ? 'text-foreground' : 'text-white/90'}`}
            >
              Collections <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {megaOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-5 w-[46rem]">
                <div className="bg-white rounded-2xl shadow-2xl border border-border p-8 grid grid-cols-3 gap-6">
                  {COLLECTIONS.map((c) => (
                    <button
                      key={c.slug}
                      onClick={() => {
                        setMegaOpen(false);
                        if (c.external) window.open(c.external, '_blank');
                        else navigate(`/collections/${c.slug}`);
                      }}
                      className="group text-left flex items-center gap-3 rounded-xl p-2 hover:bg-secondary transition-colors"
                    >
                      <img src={c.heroImage} alt={c.title} className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-primary group-hover:text-gold transition-colors">{c.title}</p>
                        <p className="text-xs text-muted-foreground font-light">{c.categories.length > 0 ? `${c.categories.length} categories` : 'View products'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link to="/about" className={`text-sm tracking-wide transition-colors hover:text-gold ${dark ? 'text-foreground' : 'text-white/90'}`}>
            About
          </Link>
          <Link to="/contact" className={`text-sm tracking-wide transition-colors hover:text-gold ${dark ? 'text-foreground' : 'text-white/90'}`}>
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link to={isAuthed ? '/account' : '/login'} aria-label="My Account" className={`p-2 transition-colors hover:text-gold ${dark ? 'text-primary' : 'text-white'}`}>
            <User className="h-5 w-5" />
          </Link>
          <button onClick={() => setSearchOpen(true)} aria-label="Search products" className={`p-2 transition-colors hover:text-gold ${dark ? 'text-primary' : 'text-white'}`}>
            <Search className="h-5 w-5" />
          </button>
          <Link to="/cart" className="relative p-2" aria-label="Cart">
            <ShoppingCart className={`h-5 w-5 ${dark ? 'text-primary' : 'text-white'}`} />
            {totalCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 min-w-[1.1rem] px-1 rounded-full bg-gold text-primary text-[10px] font-semibold flex items-center justify-center">
                {totalCount}
              </span>
            )}
          </Link>
          <Link
            to="/request-quote"
            className="hidden sm:inline-flex px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm tracking-wide hover:bg-[hsl(133_23%_33%)] transition-all duration-300 hover:-translate-y-0.5"
          >
            Request Quote
          </Link>
          <button className="lg:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? (
              <X className={`h-6 w-6 ${dark ? 'text-primary' : 'text-white'}`} />
            ) : (
              <Menu className={`h-6 w-6 ${dark ? 'text-primary' : 'text-white'}`} />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden bg-[hsl(var(--background))] border-t border-border mt-3 max-h-[80vh] overflow-y-auto">
          <div className="flex flex-col px-6 py-4">
            <Link to="/" className="py-3 text-left text-foreground border-b border-border/60">Home</Link>

            <button
              onClick={() => setMobileCollectionsOpen((v) => !v)}
              className="py-3 flex items-center justify-between text-left text-foreground border-b border-border/60"
            >
              Collections <ChevronDown className={`h-4 w-4 transition-transform ${mobileCollectionsOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileCollectionsOpen && (
              <div className="pl-3 flex flex-col border-b border-border/60">
                {COLLECTIONS.map((c) => (
                  <button
                    key={c.slug}
                    onClick={() => {
                      if (c.external) window.open(c.external, '_blank');
                      else navigate(`/collections/${c.slug}`);
                    }}
                    className="py-2.5 text-left text-sm text-muted-foreground hover:text-primary"
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            )}

            <Link to="/about" className="py-3 text-left text-foreground border-b border-border/60">About</Link>
            <Link to="/contact" className="py-3 text-left text-foreground border-b border-border/60">Contact</Link>
            <Link to={isAuthed ? '/account' : '/login'} className="py-3 text-left text-foreground border-b border-border/60">My Account</Link>
            <Link to="/request-quote" className="mt-4 mb-2 text-center px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm">
              Request Quote
            </Link>
          </div>
        </div>
      )}

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
};

export default Navbar;
