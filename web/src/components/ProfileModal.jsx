import { useState, useRef } from "react";
import { User, Mail, Camera, Loader2, X } from "lucide-react";
import { useAuthStore } from "../hooks/useAuthStore";
import { useCurrentUser } from "../hooks/useCurrentuser";
import { useApi } from "../hooks/useApi";
import { uploadToImageKit } from "../lib/imagekit";
import { getAvatarUrl } from "../lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export function ProfileModal({ isOpen, onClose }) {
  const { data: user } = useCurrentUser();
  const { token, setAuth } = useAuthStore();
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen || !user) return null;

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      
      const imageUrl = await uploadToImageKit(file, "image", token);
      
      const response = await apiWithAuth({
        url: "/auth/profile",
        method: "PATCH",
        data: { avatar: imageUrl }
      });

      // Update the auth store and query cache
      await setAuth(token, response.data);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      
    } catch (err) {
      console.error(err);
      setError("Failed to upload profile picture");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-base-200 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between">
          <h2 className="text-lg font-bold">Profile Settings</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col items-center">
          
          {/* Avatar Section */}
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary bg-base-300">
              <img 
                src={getAvatarUrl(user.name, user.avatar)} 
                alt={user.name}
                className="w-full h-full object-cover"
              />
            </div>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-content hover:bg-primary/90 transition shadow-lg disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
          </div>

          {error && (
            <div className="text-error text-sm mb-4 bg-error/10 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* User Info */}
          <div className="w-full space-y-4">
            <div>
              <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1 block">
                Name
              </label>
              <div className="flex items-center gap-3 bg-base-300/50 px-4 py-3 rounded-xl">
                <User className="w-5 h-5 text-base-content/40" />
                <span className="font-medium">{user.name}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-1 block">
                Email
              </label>
              <div className="flex items-center gap-3 bg-base-300/50 px-4 py-3 rounded-xl">
                <Mail className="w-5 h-5 text-base-content/40" />
                <span className="font-medium text-base-content/80">{user.email}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
