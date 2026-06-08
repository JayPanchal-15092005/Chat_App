import { Navigate, Route, Routes } from "react-router";
import HomePage from "./pages/HomePage";
import ChatPage from "./pages/ChatPage";
import { useAuth } from "@clerk/clerk-react";
import PageLoader from "./components/PageLoader";
import useUserSync from "./hooks/useUserSync";
import { IncomingCallModal } from "./components/IncomingCallModal";
import { OutgoingCallScreen } from "./components/OutgoingCallScreen";
import { ActiveCallScreen } from "./components/ActiveCallScreen";
import { Analytics } from "@vercel/analytics/react";

function App() {
  const { isLoaded, isSignedIn } = useAuth();
  useUserSync();

  if (!isLoaded) return <PageLoader />;

  return (
    <>
      <IncomingCallModal />
      <OutgoingCallScreen />
      <ActiveCallScreen />
      <Analytics />
      <Routes>
        <Route path="/" element={!isSignedIn ? <HomePage /> : <Navigate to={"/chat"} />} />
        <Route path="/chat" element={isSignedIn ? <ChatPage /> : <Navigate to={"/"} />} />
      </Routes>
    </>
  );
}

export default App;