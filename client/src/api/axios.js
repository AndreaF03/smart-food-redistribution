import axios from "axios";

const instance = axios.create({
  // Fixed: use env variable, fallback to localhost for development
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api"
});

/* ==================================
   Request Interceptor
   Auto-attach token to every request
================================== */
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ==================================
   Response Interceptor
   Handle 401 globally — no need to
   repeat this logic in every component
================================== */
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default instance;