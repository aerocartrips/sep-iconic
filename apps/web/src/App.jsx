import React from 'react';
import { Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import ScrollToTop from '@/components/ScrollToTop';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Toaster } from '@/components/ui/toaster';
import { MessageCircle, Phone } from 'lucide-react';
import { WHATSAPP_URL, PHONE_TEL } from '@/lib/site';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import HomePage from '@/pages/HomePage';
import CollectionsIndexPage from '@/pages/CollectionsIndexPage';
import CollectionPage from '@/pages/CollectionPage';
import CategoryProductsPage from '@/pages/CategoryProductsPage';
import ProductDetailPage from '@/pages/ProductDetailPage';
import AboutPage from '@/pages/AboutPage';
import ContactPage from '@/pages/ContactPage';
import QuotePage from '@/pages/QuotePage';
import CartPage from '@/pages/CartPage';
import CheckoutPage from '@/pages/CheckoutPage';
import OrderSuccessPage from '@/pages/OrderSuccessPage';
import StoreProductDetailPage from '@/pages/StoreProductDetailPage';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import MyAccountPage from '@/pages/MyAccountPage';
import OrderDetailPage from '@/pages/OrderDetailPage';
import TrustSection from '@/components/TrustSection';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <ScrollToTop />
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/collections" element={<CollectionsIndexPage />} />
              <Route path="/collections/:collectionSlug" element={<CollectionPage />} />
              <Route path="/collections/:collectionSlug/:categorySlug" element={<CategoryProductsPage />} />
              <Route path="/collections/:collectionSlug/:categorySlug/:productSlug" element={<ProductDetailPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/request-quote" element={<QuotePage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order-success" element={<OrderSuccessPage />} />
              <Route path="/product/:productId" element={<StoreProductDetailPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/account" element={<ProtectedRoute><MyAccountPage /></ProtectedRoute>} />
              <Route path="/account/orders/:orderId" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
            </Routes>
          </main>
        <TrustSection />
        <Footer />
        <div className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-center gap-3">
          <a
            href={`tel:${PHONE_TEL}`}
            aria-label="Call Iconic Handicraft"
            className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
          >
            <Phone className="h-5 w-5 sm:h-6 sm:w-6" />
          </a>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp"
            className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
          >
            <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </a>
        </div>
          <Toaster />
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
