import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import RestaurantDashboard from "./pages/RestaurantDashboard";
import NGODashboard from "./pages/NGODashboard";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/restaurant" element={<RestaurantDashboard />} />
        <Route path="/ngo" element={<NGODashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;