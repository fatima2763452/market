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

    // optional server logout call
    if (token) {
      fetch("/api/auth/logout", {
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
    <div className="p-4 bg-[#0b1020] min-h-screen text-white">
      <div className="max-w-xl mx-auto">
        <h2 className="text-2xl font-bold mb-2">Profile</h2>
        <div className="h-1 bg-fuchsia-600 w-16 rounded mb-6" />

        <div className="bg-[#121a2b] border border-white/10 rounded-2xl shadow p-5 space-y-4">
          
          {/* User header */}
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

            {/* ✅ Customer View */}
            {role === "customer" && (
              <>
                <Row label="Customer ID" value={customerId} icon={IdCard} />
                <Row label="Broker ID" value={brokerIdStr} icon={Shield} />
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
