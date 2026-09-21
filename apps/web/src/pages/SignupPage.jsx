import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const field =
  'w-full bg-[hsl(var(--background))] border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-gold transition-colors';

const SignupPage = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }
    try {
      await signup(form.email, form.password, { name: form.name });
      navigate('/account', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not create account. Email may already be registered.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Create Account — Iconic Handicraft</title>
        <meta name="description" content="Create your Iconic Handicraft account to track orders and save your details." />
      </Helmet>
      <section className="pt-32 md:pt-40 pb-20 bg-[hsl(var(--background))] min-h-[80vh]">
        <div className="mx-auto max-w-md px-6">
          <span className="text-gold tracking-[0.35em] uppercase text-xs block">My Account</span>
          <h1 className="font-display text-primary text-4xl md:text-5xl mt-4 mb-8">Create Account</h1>

          <form onSubmit={submit} className="bg-white border border-border rounded-2xl p-7 space-y-4">
            <input required className={field} placeholder="Full Name" value={form.name} onChange={set('name')} />
            <input required type="email" className={field} placeholder="Email" value={form.email} onChange={set('email')} />
            <input required type="tel" className={field} placeholder="Mobile Number" value={form.phone} onChange={set('phone')} />
            <input required type="password" className={field} placeholder="Password (min. 8 characters)" value={form.password} onChange={set('password')} />

            {error && <p className="text-destructive text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3.5 text-sm tracking-wide hover:bg-[hsl(133_23%_33%)] transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <UserPlus className="h-4 w-4" /> Create Account
            </button>

            <p className="text-sm text-muted-foreground text-center pt-2">
              Already have an account?{' '}
              <Link to="/login" className="text-primary font-medium hover:text-gold transition-colors">
                Login
              </Link>
            </p>
          </form>
        </div>
      </section>
    </>
  );
};

export default SignupPage;
