import axios from "axios";

/* ==================================
   Axios Instance
================================== */
const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  timeout: 15000 // prevent hanging requests
});

/* ==================================
   Request Interceptor
   Attach JWT if valid
================================== */
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const isExpired = payload.exp * 1000 < Date.now();

        if (!isExpired) {
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          // Token expired — logout safely
          localStorage.clear();
          window.dispatchEvent(new CustomEvent("auth:logout"));
          return Promise.reject(new Error("Token expired"));
        }
      } catch {
        // Token malformed
        localStorage.clear();
        window.dispatchEvent(new CustomEvent("auth:logout"));
        return Promise.reject(new Error("Invalid token"));
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ==================================
   Response Interceptor
   Handle global errors
================================== */
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    /* Retry once for network errors */
    if (!error.response && !config?._retried) {
      config._retried = true;
      await new Promise((r) => setTimeout(r, 1000));
      return instance(config);
    }

    /* Handle 401 (unauthorized) */
    if (error.response?.status === 401) {
      const isAuthRoute =
        config?.url?.includes("/auth/login") ||
        config?.url?.includes("/auth/register");

      if (!isAuthRoute) {
        localStorage.clear();
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }
    }

    return Promise.reject(error);
  }
);

export default instance;