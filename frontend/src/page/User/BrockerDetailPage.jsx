// src/components/BrockerDetailPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// ---------------- Add Broker Modal ----------------
function generateDummyId() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

const AddBrokerModal = ({ isVisible, onClose, onBrokerAdded, isSetupMode = false }) => {
  const [formData, setFormData] = useState({ name: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  if (!isVisible) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      const response = await axios.post(
        `${import.meta.env.VITE_REACT_APP_API_URL}/api/auth/add-broker`,
        formData
      );

      if (response.data.success) {
        const newBroker = response.data.newBroker || {
          id: generateDummyId(),
          name: formData.name,
        };
        onBrokerAdded(newBroker);
        setMessage(`✅ Success! Broker added. Login ID: ${newBroker.id}.`);
        setFormData({ name: '', password: '' });
        if (!isSetupMode) onClose();
      } else {
        setMessage(response.data.message || '❌ Broker add nahi ho paya.');
      }
    } catch (error) {
      console.error('Add broker error:', error.response?.data || error.message);
      const status = error.response?.status;
      let errorMessage = '❌ Network error: Server se data nahi mila.';
      if (status === 404) errorMessage = '❌ Error: Add Broker API Route Not Found (404).';
      setMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={isSetupMode ? 'w-full max-w-lg mx-auto' : 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4'}>
      <div className="bg-[#21283D] p-6 rounded-xl shadow-2xl w-full max-w-md border border-white/20">
        <h2 className="text-xl font-bold text-white mb-4">
          {isSetupMode ? 'System Setup: Pehla Broker Jodein' : 'Naya Broker Jodein'}
        </h2>

        {message && (
          <p className={`mb-4 font-semibold ${message.startsWith('✅ Success') ? 'text-green-400' : 'text-red-400'}`}>{message}</p>
        )}

        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Broker Naam</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Broker ka poora naam"
              className="w-full p-2 rounded-lg bg-[#1A1F30] border border-gray-600 text-white focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isSubmitting}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Initial password set karein"
              className="w-full p-2 rounded-lg bg-[#1A1F30] border border-gray-600 text-white focus:ring-indigo-500 focus:border-indigo-500"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            {!isSetupMode && (
              <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition duration-150" disabled={isSubmitting}>
                Cancel
              </button>
            )}
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-semibold transition duration-150 flex items-center" disabled={isSubmitting}>
              {isSubmitting ? (<><i className="fas fa-spinner fa-spin mr-2"></i> Adding...</>) : (isSetupMode ? 'Setup Complete Karein' : 'Broker Jodein')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------- Main Page ----------------
const BrokerDetailsPage = () => {
  const [brokers, setBrokers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const loggedInUserName = (() => {
    try {
      const raw = localStorage.getItem('loggedInUser');
      if (!raw) return 'Admin';
      const obj = JSON.parse(raw);
      return obj?.name || 'Admin';
    } catch {
      return 'Admin';
    }
  })();

  const handleNewBrokerAdded = (newBrokerData) => {
    setBrokers((prev) => [newBrokerData, ...prev]);
    if (brokers.length === 0) setError(null);
  };

  const fetchBrokers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/api/auth/get-all-brocker`);
      if (res.data.success && res.data.brokers) {
        setBrokers(res.data.brokers);
        setError(null);
      } else {
        setBrokers([]);
        setError(null);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      let msg = '❌ Network error: Server se data nahi mila.';
      if (err.response?.status === 404) {
        msg = '❌ Error: Broker List API Route Not Found (404).';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // guard: must be logged in
    const token = localStorage.getItem('authToken');
    if (!token) {
      window.location.href = '/';
      return;
    }
    fetchBrokers();
  }, []);

  // ✅ View => set activeBroker + redirect to that broker's customer page
  const openBrokerCustomers = (broker) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      window.location.href = '/';
      return;
    }
    localStorage.setItem('activeBroker', JSON.stringify(broker));
    navigate(`/broker/${broker.id}/customerDetail`);
  };

  const handleEdit = (brokerId) => {
    alert(`Edit action on Broker ID: ${brokerId}`);
  };

  if (loading && brokers.length === 0) {
    return <div className="text-center p-12 text-gray-400">⏳ Loading Broker data...</div>;
  }

  if (!loading && brokers.length === 0 && !error) {
    return (
      <div className="min-h-screen bg-[#121626] p-6 md:p-16 text-white text-center">
        <h1 className="text-4xl font-extrabold mb-4 text-indigo-400">System Setup Required</h1>
        <p className="text-xl mb-8 text-gray-400">Database mein koi Broker add nahi hai. Kripya pehla Broker add karein.</p>
        <AddBrokerModal isVisible={true} onClose={() => {}} onBrokerAdded={handleNewBrokerAdded} isSetupMode={true} />
      </div>
    );
  }

  if (error) return <div className="text-center p-12 text-red-500 font-bold">{error}</div>;

  return (
    <div className="min-h-screen bg-[#121626] p-4 md:p-8 flex flex-col ">
      {/* Header */}
      <header className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          Broker Management <span className="text-sm text-gray-400 ml-2">({loggedInUserName})</span>
        </h1>
        <div className="hidden md:flex items-center">
          <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg font-semibold transition duration-150 flex items-center space-x-2">
            <i className="fas fa-plus"></i>
            <span>Add New Broker</span>
          </button>
        </div>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-20 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {brokers.map((broker) => (
          <div key={broker.id} className="bg-[#21283D] rounded-xl p-4 border border-white/10 shadow-md hover:bg-[#2A314A] transition">
            <div className="flex flex-wrap justify-between items-center">
              <p className="text-white font-medium text-base"><span className="text-indigo-400 font-semibold">ID:</span> {broker.id}</p>
              <p className="text-gray-300 font-medium">{broker.name}</p>
            </div>
            <div className="mt-3 flex space-x-2">
              <button onClick={() => openBrokerCustomers(broker)} className="bg-indigo-600 hover:bg-indigo-700 text-white py-1 px-4 rounded-md text-sm transition">
                View
              </button>
              <button onClick={() => handleEdit(broker.id)} className="bg-red-600 hover:bg-red-700 text-white py-1 px-4 rounded-md text-sm transition">
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {brokers.length > 0 && (
        <AddBrokerModal isVisible={showAddModal} onClose={() => setShowAddModal(false)} onBrokerAdded={handleNewBrokerAdded} isSetupMode={false} />
      )}

      {/* Mobile FAB */}
      <div className="md:hidden fixed bottom-5 left-1/2 transform -translate-x-1/2 z-40">
        <button onClick={() => setShowAddModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-full shadow-lg flex items-center space-x-3">
          <i className="fas fa-plus"></i>
          <span className="font-semibold">Add Broker</span>
        </button>
      </div>

      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossOrigin="anonymous" />
    </div>
  );
};

export default BrokerDetailsPage;
