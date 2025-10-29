import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import GuestHomePage from "./pages/Guest/GuestHomePage"
// import GuestLadderPage from "./pages/Guest/GuestLadderPage"
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/guest" element={<GuestHomePage/>}/>
      {/* <Route path="/ladder" element={<GuestLadderPage/>}/> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
