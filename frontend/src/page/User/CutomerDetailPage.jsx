// src/components/CutomerDetailPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

/* ---------- Add Customer Modal (no external icons) ---------- */
const AddCustomerModal = ({ isVisible, onClose, onCustomerAdded }) => {
  const [formData, setFormData] = useState({ name: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  if (!isVisible) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    setMessage('');
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.password) {
      setMessage('Kripya naam aur password dono daalein.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_REACT_APP_API_URL}/api/auth/addCustomer`,
        formData,
        { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } }
      );
      if (res.data?.success && res.data?.newCustomer) {
        onCustomerAdded(res.data.newCustomer);
        onClose();
      } else {
        setMessage(res.data?.message || '❌ Customer add nahi ho paya.');
      }
    } catch (err) {
      setMessage(err.response?.data?.message || '❌ Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#21283D] p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-bold text-white">Naya Customer Jodein</h3>
        {message && (
          <p className={`mb-3 text-sm ${message.startsWith('❌') ? 'text-red-400' : 'text-green-400'}`}>
            {message}
          </p>
        )}
        <form onSubmit={handleAddSubmit} className="space-y-3">
          <label className="block text-sm text-gray-300">
            <span className="mb-1 block font-medium">Customer Naam</span>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded-lg border border-white/10 bg-[#1A1F30] p-2 text-white outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder="Customer ka poora naam"
              required
              disabled={isSubmitting}
            />
          </label>
          <label className="block text-sm text-gray-300">
            <span className="mb-1 block font-medium">Password</span>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full rounded-lg border border-white/10 bg-[#1A1F30] p-2 text-white outline-none focus:ring-2 focus:ring-indigo-600"
              placeholder="Login Password set karein"
              required
              disabled={isSubmitting}
            />
          </label>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------------- Main Page ---------------- */
export default function CustomerDetailsPage() {
  const { brokerId: urlBrokerId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Safe read from localStorage
  let activeBroker = null;
  try { activeBroker = JSON.parse(localStorage.getItem('activeBroker') || 'null'); } catch { activeBroker = null; }
  let loggedInUser = null;
  try { loggedInUser = JSON.parse(localStorage.getItem('loggedInUser') || 'null'); } catch { loggedInUser = null; }

  // Only for title/display (data is decided by token)
  const queryParams = new URLSearchParams(location.search);
  const displayBrokerId = activeBroker?.id || queryParams.get('brokerId') || urlBrokerId || loggedInUser?.id || '-';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errText, setErrText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const handleCustomerAdded = (c) => setCustomers((prev) => [c, ...prev]);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) { window.location.href = '/'; return; }

    (async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_REACT_APP_API_URL}/api/auth/getCustomers`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setCustomers(res.data?.customers || []);
      } catch (e) {
        setErrText(e?.response?.data?.message || '❌ Failed to load customers.');
        if (e?.response?.status === 401) window.location.href = '/';
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // View → open watchlist with brokerId(from localStorage) + customerId
  const openWatchlist = (customerId) => {
    const brokerId10 = loggedInUser?.id || displayBrokerId;
    if (!brokerId10) return alert('Broker ID missing.');
    if (!customerId) return alert('Customer ID missing.');

    localStorage.setItem('activeContext', JSON.stringify({ brokerId: brokerId10, customerId }));
    navigate(`/watchlist?brokerId=${encodeURIComponent(brokerId10)}&customerId=${encodeURIComponent(customerId)}`);
  };

  if (loading) return <div className="p-6 text-gray-400">Loading customers…</div>;

  return (
    <div className="min-h-screen bg-[#121626] p-4">
      {/* Header */}
      <div className="mx-auto mb-4 flex w-full max-w-3xl items-center justify-between">
        <h1 className="text-2xl font-bold text-white">
          Customers <span className="ml-2 text-sm font-semibold text-gray-400">({displayBrokerId})</span>
        </h1>
      </div>

      {/* List */}
      <div className="mx-auto w-full max-w-3xl space-y-4 pb-24">
        {customers.map((c) => (
          <div key={c.id} className="rounded-xl border border-white/10 bg-[#1F2638] p-4 shadow-md transition hover:bg-[#242c42]">
            <div className="flex items-start justify-between">
              <div className="text-sm font-semibold">
                <span className="text-gray-400">ID:</span>{' '}
                <span className="text-[#8aa2ff]">{c.id}</span>
              </div>
              <div className="text-right text-gray-200">{c.name}</div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => openWatchlist(c.id)}
                className="rounded-md bg-[#6C63FF] px-4 py-1 text-sm font-medium text-white hover:bg-indigo-600"
                type="button"
              >
                View
              </button>
              <Link
                to={`/profile?customerId=${encodeURIComponent(c.id)}`}
                className="rounded-md bg-red-600 px-4 py-1 text-sm font-medium text-white hover:bg-red-700"
              >
                Edit
              </Link>
            </div>
          </div>
        ))}

        {!customers.length && !errText && (
          <div className="rounded-xl border border-white/10 p-6 text-center text-gray-400">
            No customers found.
          </div>
        )}

        {errText && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {errText}
          </div>
        )}
      </div>

      {/* Floating Add */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-full bg-[#6C63FF] px-5 py-3 font-semibold text-white shadow-lg hover:bg-indigo-600"
        >
          + Add Customer
        </button>
      </div>

      <AddCustomerModal
        isVisible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCustomerAdded={handleCustomerAdded}
      />
    </div>
  );
}
