import React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import NGOFoodMap from "../components/NGOFoodMap";
// Fix for default Leaflet marker icons not showing up in React
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper to auto-center map when food items change
function ChangeView({ center }) {
  const map = useMap();
  map.setView(center, 13);
  return null;
}

const NGOFoodMap = ({ foodItems, userLocation, onReserve }) => {
  // Default to user location or a fallback (e.g., Bengaluru)
  const center = userLocation || [12.9716, 77.5946];

  return (
    <div style={{ height: "400px", width: "100%", borderRadius: "16px", overflow: "hidden", marginBottom: "20px", border: "1px solid #e2e8f0" }}>
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <ChangeView center={center} />

        {/* User Location Marker */}
        {userLocation && (
          <Marker position={userLocation}>
            <Popup>📍 Your NGO Location</Popup>
          </Marker>
        )}

        {/* Food Markers */}
        {foodItems.map((item) => {
          // Check if food has valid coordinates
          if (!item.location?.coordinates) return null;
          
          // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
          const pos = [item.location.coordinates[1], item.location.coordinates[0]];

          return (
            <Marker key={item._id} position={pos}>
              <Popup>
                <div style={{ fontFamily: "DM Sans, sans-serif" }}>
                  <strong style={{ fontSize: "14px" }}>{item.foodType}</strong><br />
                  <span style={{ fontSize: "12px", color: "#64748b" }}>🏪 {item.restaurant?.name}</span><br />
                  <div style={{ marginTop: "8px" }}>
                    <button 
                      onClick={() => onReserve(item._id)}
                      style={{
                        background: "#16a34a", color: "#fff", border: "none",
                        padding: "5px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px"
                      }}
                    >
                      Reserve Now
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default NGOFoodMap;