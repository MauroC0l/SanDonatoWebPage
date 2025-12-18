import { Routes, Route } from "react-router-dom";
import HomePage from "./components/Home/HomePage";
import News from "./components/News/NewsPage";
import MyNavbar from "./components/AllPages/MyNavbar";
import Hero from "./components/AllPages/Hero";
import TopHeader from "./components/AllPages/TopHeader"; 
import NewsDetailPage from "./components/NewsDetail";
import ChiSiamoPage from "./components/ChiSiamoPage";
import SubscriptionPage from "./components/SubscriptionPage";
import CalendarPage from "./components/CalendarPage";
import ContactPage from "./components/Contatti";
import PrivacyPage from "./components/PrivacyPage";
import TutelaMinoriPage from "./components/TutelaMinoriPage";
import ContributiPage from "./components/ContributiPage";
import CinquePerMillePage from "./components/CinquePerMillePage";
import SponsorPage from "./components/SponsorPage";
import SportPage from "./components/SportPage";
import NotFoundPage from "./components/NotFoundPage"; // <--- 1. Importa la pagina 404

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
          <Route path="/iscrizione" element={<SubscriptionPage />} /> 
          <Route path="/sports" element={<SportPage />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/contatti" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/tutela-minori" element={<TutelaMinoriPage />} />
          <Route path="/contributi-pubblici" element={<ContributiPage />} />
          <Route path="/cinquepermille" element={<CinquePerMillePage />} />
          <Route path="/sponsor" element={<SponsorPage />} />

          <Route path="*" element={<NotFoundPage />} /> 

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