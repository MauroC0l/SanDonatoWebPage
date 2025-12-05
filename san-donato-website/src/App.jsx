import { Routes, Route } from "react-router-dom";
import HomePage from "./components/HomePage";
import About from "./components/AboutSection";
import News from "./components/NewsPage";
import MyNavbar from "./components/MyNavbar";
import Hero from "./components/Hero";
import TopHeader from "./components/TopHeader"; 
import NewsDetailPage from "./components/NewsDetail";
import ChiSiamoPage from "./components/ChiSiamoPage";

export default function App() {
  return (
    <div className="page-wrapper"> {/* Wrapper per full width & height */}

      <TopHeader /> {/* Nuovo header contatti */}

      <Hero /> {/* Hero sotto l'header */}

      <MyNavbar />  {/* Navbar sotto l'header */}


      <main className="flex-grow w-full px-0"> 
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/news" element={<News />} />
          <Route path="/chi-siamo" element={<ChiSiamoPage />} />
          <Route path="/news/:id" element={<NewsDetailPage />} />
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
