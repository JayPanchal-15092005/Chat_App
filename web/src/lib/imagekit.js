const IMAGEKIT_PUBLIC_KEY = "public_HWdcHmVK9g78x8J7uB8QyxcyBpg=";
const UPLOAD_ENDPOINT = "https://upload.imagekit.io/api/v1/files/upload";
const AUTH_ENDPOINT = "https://chat-app-backend-zj3i.onrender.com/api/upload/auth";

export const uploadToImageKit = async (file, type, token) => {
  try {
    // 1. Get auth signature from backend
    const authRes = await fetch(AUTH_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!authRes.ok) {
      throw new Error("Failed to get ImageKit auth signature");
    }

    const { signature, expire, token: imageKitToken } = await authRes.json();

    // 2. Prepare file data
    const filename = file.name || `${Date.now()}.${type === "image" ? "jpg" : "webm"}`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("publicKey", IMAGEKIT_PUBLIC_KEY);
    formData.append("signature", signature);
    formData.append("expire", expire.toString());
    formData.append("token", imageKitToken);
    formData.append("fileName", filename);
    formData.append("folder", type === "image" ? "/chat_images" : "/chat_voices");

    // 3. Upload to ImageKit
    const uploadRes = await fetch(UPLOAD_ENDPOINT, {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(uploadData.message || "Upload failed");
    }

    return uploadData.url;
  } catch (error) {
    console.error("ImageKit upload error:", error);
    throw error;
  }
};
