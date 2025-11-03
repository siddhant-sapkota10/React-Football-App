import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import GuestHomePage from "./pages/Guest/GuestHomePage"
import GuestLadderPage from "./pages/Guest/GuestLadderPage"
import OfficialHomePage from "./pages/Official/OfficialHomePage"
import OfficialLoginPage from "./pages/Official/OfficialLoginPage"
import Header from "./components/Header"
import Footer from "./components/Footer"
function App() {
  return (
    <BrowserRouter>
    <Header/>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/official/login" element={<OfficialLoginPage/>}/>
        <Route path="/official/home" element={<OfficialHomePage/>}/>
        <Route path="/guest" element={<GuestHomePage/>}/>
      <Route path="/ladder" element={<GuestLadderPage/>}/>
      </Routes>
      <Footer/>
    </BrowserRouter>
  );
}

export default App;
