import axios from "axios";

const apiUrl = import.meta.env.API_URL;
if (!apiUrl) {
  console.error("API_URL environment variable is not set");
}

const api = axios.create({
  baseURL: import.meta.env.API_URL + "/api",
  withCredentials: true,
}); 

export default api;