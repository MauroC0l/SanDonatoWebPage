import { Routes, Route } from "react-router-dom";
import Home from "./components/Home";
import About from "./components/About";
import News from "./components/News";
import GalleryPage from "./components/GalleryPage";
import MyNavbar from "./components/MyNavbar";
import Hero from "./components/Hero";
import TopHeader from "./components/TopHeader"; 

export default function App() {

  return (
    <div className="page-wrapper"> {/* Wrapper per full width & height */}

      <TopHeader /> {/* Nuovo header contatti */}

      <Hero /> {/* Hero sotto l'header */}

      <MyNavbar />  {/* Navbar sotto l'header */}

      <main className="flex-grow w-full px-0"> 
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chi-siamo" element={<About />} />
          <Route path="/news" element={<News />} />
          <Route path="/galleria" element={<GalleryPage />} />
        </Routes>
      </main>
      <footer className="bg-gray-900 text-white py-6 text-center w-full">
        <div className="max-w-screen-xl mx-auto px-4">
          © Polisportiva San Donato — Tutti i diritti riservati
        </div>
      </footer>
    </div>
  );
}
