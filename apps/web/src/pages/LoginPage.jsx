import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const field =
  'w-full bg-[hsl(var(--background))] border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-gold transition-colors';

const LoginPage = () => {
  const { login, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/account';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResetMsg('');
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) {
      setError('Enter your email above first, then click "Forgot Password".');
      return;
    }
    setError('');
    try {
      await requestPasswordReset(email);
      setResetMsg('Password reset link sent to your email. Check your inbox.');
    } catch (err) {
      setError('Could not send reset email. Please check the email address.');
    }
  };

  return (
    <>
      <Helmet>
        <title>Login — Iconic Handicraft</title>
        <meta name="description" content="Login to your Iconic Handicraft account to view orders and profile." />
      </Helmet>
      <section className="pt-32 md:pt-40 pb-20 bg-[hsl(var(--background))] min-h-[80vh]">
        <div className="mx-auto max-w-md px-6">
          <span className="text-gold tracking-[0.35em] uppercase text-xs block">My Account</span>
          <h1 className="font-display text-primary text-4xl md:text-5xl mt-4 mb-8">Login</h1>

          <form onSubmit={submit} className="bg-white border border-border rounded-2xl p-7 space-y-4">
            <input required type="email" className={field} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input required type="password" className={field} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

            {error && <p className="text-destructive text-sm">{error}</p>}
            {resetMsg && <p className="text-green-700 text-sm">{resetMsg}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3.5 text-sm tracking-wide hover:bg-[hsl(133_23%_33%)] transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <LogIn className="h-4 w-4" /> Login
            </button>

            <button type="button" onClick={handleReset} className="w-full text-xs text-muted-foreground hover:text-primary transition-colors">
              Forgot Password?
            </button>

            <p className="text-sm text-muted-foreground text-center pt-2">
              New customer?{' '}
              <Link to="/signup" className="text-primary font-medium hover:text-gold transition-colors">
                Create an account
              </Link>
            </p>
          </form>
        </div>
      </section>
    </>
  );
};

export default LoginPage;
