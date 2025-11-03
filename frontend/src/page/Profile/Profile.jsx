import React from "react";
import { useNavigate } from "react-router-dom";
import { User, Shield, IdCard, LogOut, UserCheck } from "lucide-react";

const Row = ({ label, value, icon: Icon }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/10 last:border-none">
    <div className="flex items-center gap-2 text-gray-300">
      {Icon && <Icon className="w-4 h-4 opacity-80" />}
      <span className="text-sm">{label}</span>
    </div>
    <span className="text-white font-semibold text-sm">{value || "—"}</span>
  </div>
);

export default function Profile() {
  const navigate = useNavigate();

  // loggedInUser
  let loggedInUser = null;
  try {
    loggedInUser = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  } catch {}

  const role = loggedInUser?.role || "customer";  
  const userName = loggedInUser?.name || "User";
  const brokerIdStr = localStorage.getItem("associatedBrokerStringId") || "";

  // If broker opened customer, this will exist:
  let activeContext = null;
  try {
    activeContext = JSON.parse(localStorage.getItem("activeContext") || "null");
  } catch {}

  const activeCustomerId = activeContext?.customerId || null;

  // Customer ID for customer role
  const customerId = role === "customer" ? loggedInUser?.id : null;

  const handleLogout = () => {
  const brokerIdStr = localStorage.getItem('associatedBrokerStringId') || '';
  const next = brokerIdStr ? `/broker/${brokerIdStr}/customerDetail` : '/customerDetail';

  // optional server logout
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  if (token) {
    fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(()=>{});
  }

  // keep broker id, clear the rest
  localStorage.removeItem('loggedInUser');
  localStorage.removeItem('authToken');
  localStorage.removeItem('token');
  localStorage.removeItem('activeContext');

  // save post-logout target
  sessionStorage.setItem('postLogoutRedirect', next);

  // go to login
  navigate('/', { replace: true });
};



  return (
    <div className="p-4 bg-[#0b1020] min-h-screen text-white">
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">Profile</h2>
        <div className="h-1 bg-fuchsia-600 w-16 rounded mb-6" />

        <div className="bg-[#121a2b] border border-white/10 rounded-2xl shadow p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-fuchsia-600/20">
              <User className="w-6 h-6 text-fuchsia-400" />
            </div>
            <div>
              <div className="text-lg font-semibold capitalize">{userName}</div>
              <div className="text-xs text-gray-400 capitalize">Role: {role}</div>
            </div>
          </div>

          <div className="pt-2">
            {/* Customer Profile Display */}
            {role === "customer" && (
              <>
                <Row label="Customer ID" value={customerId} icon={IdCard} />
                <Row label="Broker ID" value={brokerIdStr} icon={Shield} />
              </>
            )}

            {/* Broker Profile Display */}
            {role === "broker" && (
              <>
                <Row label="Broker ID" value={brokerIdStr} icon={Shield} />

                {/* ✅ Show which customer broker is currently viewing */}
                {activeCustomerId && (
                  <Row
                    label="Currently Viewing Customer"
                    value={activeCustomerId}
                    icon={UserCheck}
                  />
                )}
              </>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 bg-fuchsia-600 hover:bg-fuchsia-700 font-semibold shadow transition"
          >
            <LogOut className="w-5 h-5" /> Logout
          </button>
        </div>
      </div>
    </div>
  );
}
