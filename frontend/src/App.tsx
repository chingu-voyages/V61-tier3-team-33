import { BrowserRouter, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage";
import CreateRoomPage from "./pages/CreateRoomPage";
import JoinRoomPage from "./pages/JoinRoomPage";
import WaitingRoomPage from "./pages/WaitingRoomPage";
import GamePage from "./pages/GamePage";

import { SocketProvider } from "./context/SocketProvider";

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateRoomPage />} />
          <Route path="/join/:roomId?" element={<JoinRoomPage />} />
          <Route path="/waiting/:roomId" element={<WaitingRoomPage />} />
          <Route path="/game/:roomId" element={<GamePage />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  );
}