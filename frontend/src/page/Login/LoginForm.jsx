import React, { useState } from 'react';
import axios from 'axios';

const superBrockerId  = '9428177767';
const superBrockerPass = 'abc';

const InputField = ({ iconClass, type, name, placeholder, value, onChange, error }) => (
  <div className="relative mb-6">
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-500">
      <i className={iconClass}></i>
    </div>
    <input
      type={type}
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`w-full p-3 pl-10 rounded-lg bg-gray-700/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-200 border ${
        error ? 'border-red-500' : 'border-transparent'
      } focus:border-indigo-500 shadow-inner`}
      required
      autoComplete={name === 'password' ? 'current-password' : 'username'}
    />
    {error && <p className="text-red-400 text-xs mt-1 absolute -bottom-5 left-0">{error}</p>}
  </div>
);

const LoginForm = () => {
  const [formData, setFormData] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiMessage, setApiMessage] = useState({ text: '', type: '' });

  const validate = (data) => {
    const newErrors = {};
    const digitRegex = /^\d{10}$/;

    if (!data.identifier) newErrors.identifier = 'Login ID (10 digits) zaroori hai.';
    else if (!digitRegex.test(data.identifier)) newErrors.identifier = 'ID 10 ankon (digits) ki honi chahiye.';

    if (!data.password) newErrors.password = 'Password zaroori hai.';
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
    setApiMessage({ text: '', type: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setIsSubmitting(true);
    setApiMessage({ text: '', type: '' });

    // ✅ SUPER BROCKER: token/state पहले save करें, फिर redirect करें
    if (formData.identifier === superBrockerId && formData.password === superBrockerPass) {
      const fakeToken = 'super-broker-local-token';
      const user = { id: formData.identifier, name: 'Super Broker', role: 'broker' };

      localStorage.setItem('token', fakeToken);
      localStorage.setItem('authToken', fakeToken);            // कुछ guards authToken पढ़ते हैं
      localStorage.setItem('loggedInUser', JSON.stringify(user));
      localStorage.setItem('associatedBrokerStringId', superBrockerId);

      axios.defaults.headers.common['Authorization'] = `Bearer ${fakeToken}`;
      // अब redirect (hard reload भी ठीक है क्योंकि token पहले से set है)
      window.location.href = '/brockerDetail';
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_REACT_APP_API_URL}/api/auth/login`,
        formData
      );

      if (res.data?.success) {
        const { name, role, token, associatedBrokerStringId } = res.data;
        const user = { id: formData.identifier, name, role };

        // ✅ same keys जैसे guard/बाकी code expect करता है
        localStorage.setItem('token', token);
        localStorage.setItem('authToken', token);
        localStorage.setItem('loggedInUser', JSON.stringify(user));
        if (associatedBrokerStringId) {
          localStorage.setItem('associatedBrokerStringId', associatedBrokerStringId);
        }

        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        setApiMessage({ text: ` Login successful! Redirecting… Role: ${role}`, type: 'success' });

        // NOTE: आपने पहले यहीं रखा था — इसे नहीं छेड़ रहा
        const redirectionPath = role === 'broker' ? '/customerDetail' : '/watchlist';
        setTimeout(() => (window.location.href = redirectionPath), 800);
      } else {
        setApiMessage({ text: res.data?.message || 'Login failed.', type: 'error' });
      }
    } catch (err) {
      const msg = err.response?.data?.message || ' Network error: Server unreachable or API issue.';
      setApiMessage({ text: msg, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121626] flex items-center justify-center p-4">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        crossOrigin="anonymous"
      />
      <div
        className="w-full max-w-sm p-8 bg-[#21283D] rounded-xl shadow-2xl backdrop-blur-sm border border-white/10"
        style={{ boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), 0 0 40px rgba(79, 70, 229, 0.3)' }}
      >
        <h1 className="text-3xl font-extrabold text-white mb-2 text-center tracking-wide">Sign In</h1>
        <p className="text-gray-400 text-center mb-8">Welcome back to the trading platform</p>

        {apiMessage.text && (
          <div
            className={`p-3 mb-4 rounded-lg font-semibold text-sm text-center ${
              apiMessage.type === 'success' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
            }`}
          >
            {apiMessage.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <InputField
            iconClass="fas fa-id-card"
            type="text"
            name="identifier"
            placeholder="10-Digit Login ID"
            value={formData.identifier}
            onChange={handleChange}
            error={errors.identifier}
          />
          <InputField
            iconClass="fas fa-lock"
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
          />

          <div className="flex justify-between items-center text-sm mb-6">
            <label className="flex items-center text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                className="mr-2 text-indigo-500 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
              />
              Remember Me
            </label>
            <a href="/forgot-password" className="text-indigo-400 hover:text-indigo-300 transition duration-150">
              Forgot Password?
            </a>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-lg text-lg font-bold text-white uppercase bg-indigo-600 hover:bg-indigo-700 transition duration-200 shadow-lg shadow-indigo-500/50 disabled:bg-gray-500 flex items-center justify-center space-x-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> <span>Logging In...</span>
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-gray-400">
          Broker/Admin setup?
          <a href="/add-broker" className="text-indigo-400 font-semibold ml-2 hover:underline">
            Add Broker
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
