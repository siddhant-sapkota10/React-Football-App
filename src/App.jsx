import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import GuestHomePage from "./pages/Guest/GuestHomePage"
import GuestLadderPage from "./pages/Guest/GuestLadderPage"
import OfficialHomePage from "./pages/Official/OfficialHomePage"
import OfficialLoginPage from "./pages/Official/OfficialLoginPage"
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/official/login" element={<OfficialLoginPage/>}/>
        <Route path="/official/home" element={<OfficialHomePage/>}/>
        <Route path="/guest" element={<GuestHomePage/>}/>
      <Route path="/ladder" element={<GuestLadderPage/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
