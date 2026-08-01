import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import axios from "axios";

import Shell from "@/components/Shell";
import ClientHome from "@/pages/ClientHome";
import ProviderProfile from "@/pages/ProviderProfile";
import ClientBookings from "@/pages/ClientBookings";
import ProviderDashboard from "@/pages/ProviderDashboard";
import AdminPortal from "@/pages/AdminPortal";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  useEffect(() => {
    // Warm the API so first-time visits feel snappy.
    axios.get(`${API}/`).catch(() => {});
  }, []);

  return (
    <div className="App">
      <BrowserRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<ClientHome />} />
            <Route path="/providers/:providerId" element={<ProviderProfile />} />
            <Route path="/bookings" element={<ClientBookings />} />
            <Route path="/provider" element={<ProviderDashboard />} />
            <Route path="/admin" element={<AdminPortal />} />
          </Routes>
        </Shell>
        <Toaster position="top-right" richColors closeButton />
      </BrowserRouter>
    </div>
  );
}

export default App;
