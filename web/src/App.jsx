import { Navigate, Route, Routes } from "react-router";
import HomePage from "./pages/HomePage";
import ChatPage from "./pages/ChatPage";
import SignupPage from "./pages/SignupPage";
import PageLoader from "./components/PageLoader";
import { IncomingCallModal } from "./components/IncomingCallModal";
import { OutgoingCallScreen } from "./components/OutgoingCallScreen";
import { ActiveCallScreen } from "./components/ActiveCallScreen";
import { Analytics } from "@vercel/analytics/react";
import { useAuthStore } from "./hooks/useAuthStore";
import { useEffect } from "react";

function App() {
  const { token, isLoading, restoreToken } = useAuthStore();
  const isSignedIn = !!token;

  useEffect(() => {
    restoreToken();
  }, [restoreToken]);

  if (isLoading) return <PageLoader />;

  return (
    <>
      <IncomingCallModal />
      <OutgoingCallScreen />
      <ActiveCallScreen />
      <Analytics />
      <Routes>
        <Route path="/" element={!isSignedIn ? <HomePage /> : <Navigate to={"/chat"} />} />
        <Route path="/signup" element={!isSignedIn ? <SignupPage /> : <Navigate to={"/chat"} />} />
        <Route path="/chat" element={isSignedIn ? <ChatPage /> : <Navigate to={"/"} />} />
      </Routes>
    </>
  );
}

export default App;