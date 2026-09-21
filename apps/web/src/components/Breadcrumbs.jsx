import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

// items: [{ label, to }] — last item has no `to` (current page)
const Breadcrumbs = ({ items }) => (
  <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground">
    <Link to="/" className="inline-flex items-center gap-1 hover:text-primary transition-colors">
      <Home className="h-3.5 w-3.5" />
    </Link>
    {items.map((item, i) => (
      <span key={i} className="inline-flex items-center gap-2">
        <ChevronRight className="h-3 w-3" />
        {item.to ? (
          <Link to={item.to} className="hover:text-primary transition-colors">{item.label}</Link>
        ) : (
          <span className="text-primary">{item.label}</span>
        )}
      </span>
    ))}
  </nav>
);

export default Breadcrumbs;
