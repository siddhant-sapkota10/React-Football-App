// src/components/Header.jsx
import { useNavigate } from "react-router-dom";

export default function Header() {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-50 bg-[#0b0f17]/90 backdrop-blur-md border-b border-[#00f6a3]/10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="py-3 flex justify-center items-center w-full text-center">
          <h1 className="sapko-gradient text-2xl md:text-3xl font-extrabold select-none">
            SAPKOTIX
          </h1>
        </div>
      </div>
    </div>
  );
}
