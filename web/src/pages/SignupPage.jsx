import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { SparklesIcon, Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle2, Circle } from "lucide-react";
import { useAuthStore } from "../hooks/useAuthStore";
import api from "../lib/axios";

export default function SignupPage() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false); // Default to login to match mobile index
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) return;
    
    setIsLoading(true);
    try {
      if (isSignUp) {
        if (!formData.name) return;
        if (formData.password.length < 8) return;
        const response = await api.post("/auth/register", {
          name: formData.name,
          email: formData.email,
          password: formData.password,
        });
        const { token, ...user } = response.data;
        await setAuth(token, user);
      } else {
        const response = await api.post("/auth/login", {
          email: formData.email,
          password: formData.password,
        });
        const { token, ...user } = response.data;
        await setAuth(token, user);
      }
      navigate("/chat");
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col pt-10 pb-5 px-6 text-white font-sans">
      <div className="flex-1 max-w-md w-full mx-auto flex flex-col justify-between">
        
        {/* Header */}
        <div className="mb-10">
          <div className="mb-6">
            <SparklesIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {isSignUp ? "Create an account✨" : "Log in to your account✨"}
          </h1>
          <p className="text-[#888888] text-base">
            {isSignUp ? "Welcome! Please enter your details." : "Welcome back! Please enter your details."}
          </p>
        </div>

        {/* Form */}
        <div className="flex-1">
          <form onSubmit={handleSubmit}>
            
            {/* Name Field (Only on Sign Up) */}
            {isSignUp && (
              <div className="mb-5">
                <label className="block text-[#FFFFFF] text-sm font-medium mb-2">
                  Name
                </label>
                <div className="flex items-center bg-[#1A1A1A] border border-[#333] rounded-xl h-14 px-4 transition-colors focus-within:border-[#888]">
                  <User className="w-5 h-5 text-[#888] mr-3" />
                  <input
                    type="text"
                    required
                    className="flex-1 bg-transparent text-white text-base focus:outline-none placeholder-[#888]"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div className="mb-5">
              <label className="block text-[#FFFFFF] text-sm font-medium mb-2">
                Email
              </label>
              <div className="flex items-center bg-[#1A1A1A] border border-[#333] rounded-xl h-14 px-4 transition-colors focus-within:border-[#888]">
                <Mail className="w-5 h-5 text-[#888] mr-3" />
                <input
                  type="email"
                  required
                  className="flex-1 bg-transparent text-white text-base focus:outline-none placeholder-[#888]"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="mb-5">
              <label className="block text-[#FFFFFF] text-sm font-medium mb-2">
                Password
              </label>
              <div className="flex items-center bg-[#1A1A1A] border border-[#333] rounded-xl h-14 px-4 transition-colors focus-within:border-[#888]">
                <Lock className="w-5 h-5 text-[#888] mr-3" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="flex-1 bg-transparent text-white text-base focus:outline-none placeholder-[#888]"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 text-[#888]" />
                  ) : (
                    <Eye className="w-5 h-5 text-[#888]" />
                  )}
                </button>
              </div>
            </div>

            {/* Checkbox Row */}
            <div className="flex flex-row items-center mb-8">
              {isSignUp ? (
                <div className="flex flex-row items-center">
                  {formData.password.length >= 8 ? (
                    <CheckCircle2 className="w-5 h-5 text-[#10B981] mr-2" />
                  ) : (
                    <Circle className="w-5 h-5 text-[#555] mr-2" />
                  )}
                  <span className="text-[#AAAAAA] text-sm">Must be at least 8 characters</span>
                </div>
              ) : (
                <button 
                  type="button" 
                  className="flex flex-row items-center focus:outline-none" 
                  onClick={() => setRememberMe(!rememberMe)}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center mr-2.5 transition-colors ${rememberMe ? 'bg-[#E76F51] border-[#E76F51]' : 'border-[#555]'}`}>
                    {rememberMe && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className="text-[#AAAAAA] text-sm">Remember for 30 days</span>
                </button>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || (isSignUp && formData.password.length < 8)}
              className="w-full h-14 rounded-xl flex items-center justify-center text-white text-base font-bold shadow-lg disabled:opacity-50 transition-opacity"
              style={{ background: "linear-gradient(to right, #E76F51, #833AB4)" }}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isSignUp ? (
                "Sign Up"
              ) : (
                "Log In"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex flex-row justify-center items-center mt-6">
          <span className="text-[#888888] text-sm mr-1">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
          </span>
          <button 
            type="button"
            className="text-[#FFFFFF] text-sm font-bold focus:outline-none"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? "Log in" : "Sign up"}
          </button>
        </div>

      </div>
    </div>
  );
}
