import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, LogOut, Package, User, Lock, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbaseClient';

const formatINR = (cents) => `\u20b9${((cents || 0) / 100).toFixed(2)}`;

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-200 text-green-900',
  cancelled: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
};

const field =
  'w-full bg-[hsl(var(--background))] border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-gold transition-colors';

const MyAccountPage = () => {
  const { user, isAuthed, logout, updateProfile, changePassword } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [tab, setTab] = useState('orders');

  // Profile form
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password form
  const [pw, setPw] = useState({ old: '', new: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (!isAuthed) return;
    setProfile({ name: user?.name || '', phone: user?.phone || '' });
    pb.collection('orders')
      .getFullList({ sort: '-created' })
      .then(setOrders)
      .catch((err) => console.error('load orders failed', err))
      .finally(() => setOrdersLoading(false));
  }, [isAuthed, user]);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg('');
    try {
      await updateProfile({ name: profile.name });
      setProfileMsg('Profile updated successfully.');
    } catch (err) {
      setProfileMsg('Could not update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwLoading(true);
    setPwMsg('');
    if (pw.new.length < 8) {
      setPwMsg('New password must be at least 8 characters.');
      setPwLoading(false);
      return;
    }
    try {
      await changePassword(pw.old, pw.new);
      setPwMsg('Password changed successfully.');
      setPw({ old: '', new: '' });
    } catch (err) {
      setPwMsg('Could not change password. Check your current password.');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>My Account — Iconic Handicraft</title>
        <meta name="description" content="View your profile and order history." />
      </Helmet>
      <section className="pt-32 md:pt-40 pb-20 bg-[hsl(var(--background))]">
        <div className="mx-auto max-w-[90rem] px-6">
          <span className="text-gold tracking-[0.35em] uppercase text-xs block">My Account</span>
          <h1 className="font-display text-primary text-4xl md:text-5xl mt-4 mb-8">
            Hello, {user?.name || user?.email}
          </h1>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-border rounded-2xl p-5 space-y-1">
                <button onClick={() => setTab('orders')} className={`w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-2 transition-colors ${tab === 'orders' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'}`}>
                  <Package className="h-4 w-4" /> Order History
                </button>
                <button onClick={() => setTab('profile')} className={`w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-2 transition-colors ${tab === 'profile' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'}`}>
                  <User className="h-4 w-4" /> Profile Details
                </button>
                <button onClick={() => setTab('password')} className={`w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-2 transition-colors ${tab === 'password' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'}`}>
                  <Lock className="h-4 w-4" /> Change Password
                </button>
                <button onClick={handleLogout} className="w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-2 text-destructive hover:bg-destructive/10 transition-colors">
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="lg:col-span-3">
              {tab === 'orders' && (
                <div className="bg-white border border-border rounded-2xl p-6 md:p-8">
                  <h2 className="font-display text-2xl text-primary mb-6">Order History</h2>
                  {ordersLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-10 w-10 text-muted-foreground mx-auto mb-4" strokeWidth={1.25} />
                      <p className="font-display text-xl text-primary mb-2">No orders yet</p>
                      <p className="text-muted-foreground text-sm mb-5">When you place an order, it will appear here.</p>
                      <Link to="/collections" className="inline-block px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm">Explore Collections</Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((o) => (
                        <Link key={o.id} to={`/account/orders/${o.id}`} className="block border border-border rounded-xl p-5 hover:border-gold transition-colors">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-primary">{o.order_number || o.razorpay_order_id}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(o.created).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {(o.total_quantity || 0)} pieces
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[o.status] || 'bg-secondary text-muted-foreground'}`}>
                                {o.status}
                              </span>
                              <span className="font-display text-lg text-primary">{formatINR(o.amount_in_paise)}</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === 'profile' && (
                <div className="bg-white border border-border rounded-2xl p-6 md:p-8">
                  <h2 className="font-display text-2xl text-primary mb-6">Profile Details</h2>
                  <form onSubmit={saveProfile} className="space-y-4 max-w-md">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                      <input className={`${field} bg-secondary/40`} value={user?.email || ''} disabled />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                      <input className={field} value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
                    </div>
                    {profileMsg && <p className={`text-sm ${profileMsg.includes('success') ? 'text-green-700' : 'text-destructive'}`}>{profileMsg}</p>}
                    <button type="submit" disabled={profileLoading} className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm hover:bg-[hsl(133_23%_33%)] transition-all disabled:opacity-50">
                      {profileLoading && <Loader2 className="h-4 w-4 animate-spin" />} Save Changes
                    </button>
                  </form>
                </div>
              )}

              {tab === 'password' && (
                <div className="bg-white border border-border rounded-2xl p-6 md:p-8">
                  <h2 className="font-display text-2xl text-primary mb-6">Change Password</h2>
                  <form onSubmit={savePassword} className="space-y-4 max-w-md">
                    <input required type="password" className={field} placeholder="Current Password" value={pw.old} onChange={(e) => setPw((p) => ({ ...p, old: e.target.value }))} />
                    <input required type="password" className={field} placeholder="New Password (min. 8 characters)" value={pw.new} onChange={(e) => setPw((p) => ({ ...p, new: e.target.value }))} />
                    {pwMsg && <p className={`text-sm ${pwMsg.includes('success') ? 'text-green-700' : 'text-destructive'}`}>{pwMsg}</p>}
                    <button type="submit" disabled={pwLoading} className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm hover:bg-[hsl(133_23%_33%)] transition-all disabled:opacity-50">
                      {pwLoading && <Loader2 className="h-4 w-4 animate-spin" />} Update Password
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default MyAccountPage;
