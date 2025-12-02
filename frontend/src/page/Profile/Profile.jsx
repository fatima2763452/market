import React from "react";
import { useNavigate } from "react-router-dom";
import { User, Shield, IdCard, LogOut, UserCheck, Moon, Sun, CurlyBraces } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

const Row = ({ label, value, icon: Icon }) => (
  <div className="flex items-center justify-between py-2 border-b border-[var(--border-color)] last:border-none">
    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
      {Icon && <Icon className="w-4 h-4 opacity-80" />}
      <span className="text-sm">{label}</span>
    </div>
    <span className="text-[var(--text-primary)] font-semibold text-sm">{value || "—"}</span>
  </div>
);

export default function Profile() {
  const navigate = useNavigate();
  const { theme, toggleTheme, isDark } = useTheme();

  // ------------------ READ LOCAL STORAGE ------------------
  let loggedInUser = null;
  try {
    loggedInUser = JSON.parse(localStorage.getItem("loggedInUser") || "null");
    
  } catch {
    loggedInUser = null;
  }

  const role = loggedInUser?.role || "customer";

  const userName = loggedInUser?.name || "User";

  const brokerIdStr = localStorage.getItem("associatedBrokerStringId") || "";
  
  const customerName = role === 'broker'? localStorage.getItem('customerName') : "—";
  let activeContext = null;
  try {
    activeContext = JSON.parse(localStorage.getItem("activeContext") || "null");
  } catch {
    activeContext = null;
  }

  const activeCustomerId = activeContext?.customerId || null;
  const customerId = role === "customer" ? loggedInUser?.id : null;

  // ------------------ LOGOUT FUNCTION ------------------
  const handleLogout = () => {
    const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    const apiBase = import.meta.env.VITE_REACT_APP_API_URL || "";

    // optional server logout call
    if (token) {
      fetch(`${apiBase}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }

    // ✅ Keep broker ID safe — remove everything else
    const keepBrokerId = brokerIdStr;

    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("token");
    localStorage.removeItem("activeContext");

    // DO NOT REMOVE associatedBrokerStringId
    localStorage.setItem("associatedBrokerStringId", keepBrokerId);

    // ✅ Redirect always to broker’s customer list page
    if (keepBrokerId) {
      navigate(`/broker/${keepBrokerId}/customerDetail`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  // ------------------ UI ------------------
  return (
    <div className="p-4 bg-[var(--bg-primary)] min-h-screen text-[var(--text-primary)]">
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">Profile</h2>
        <div className="h-1 bg-fuchsia-600 w-16 rounded mb-6" />

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow p-5 space-y-4">
          
          {/* User header */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-fuchsia-600/20">
              <User className="w-6 h-6 text-fuchsia-400" />
            </div>
            <div>
              <div className="text-lg font-semibold capitalize">{userName}</div>
              <div className="text-xs text-[var(--text-secondary)] capitalize">Role: {role}</div>
              {role === 'broker' && <div className="text-xs text-[var(--text-secondary)] capitalize">customer Name: {customerName}</div>}


            </div>
          </div>

          <div className="pt-2">

            {/* ✅ Customer View */}
            {role === "customer" && (
              <>
                <Row label="Customer ID" value={customerId} icon={IdCard} />
                {/* <Row label="Broker ID" value={brokerIdStr} icon={Shield} /> */}
              </>
            )}

            {/* ✅ Broker View */}
            {role === "broker" && (
              <>
                <Row label="Broker ID" value={brokerIdStr} icon={Shield} />

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

          {/* Theme Toggle */}
          <div className="flex items-center justify-between py-3 border-t border-[var(--border-color)]">
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span className="text-sm">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                isDark ? 'bg-fuchsia-600' : 'bg-gray-300'
              }`}
              aria-label="Toggle theme"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                  isDark ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Logout Button */}
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
