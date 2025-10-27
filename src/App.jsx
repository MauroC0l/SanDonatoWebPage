import { Routes, Route } from "react-router-dom";
import HomePage from "./components/HomePage";
import News from "./components/NewsPage";
import MyNavbar from "./components/MyNavbar";
import Hero from "./components/Hero";
import TopHeader from "./components/TopHeader"; 
import NewsDetailPage from "./components/NewsDetail";
import SubscriptionPage from "./components/SubscriptionPage";
import AboutPage from "./components/AboutPage";
import SportPage from "./components/SportPage";
import ContactPage from "./components/ContactPage";
import PrivacyPage from "./components/PrivacyPage";
import TutelaDeiMinoriPage from "./components/TutelaDeiMinoriPage";
import ContributiPage from "./components/ContributiPage";
import CinquePerMillePage from "./components/CinquePerMillePage";
import SponsorPage from "./components/SponsorPage";



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
          <Route path="/news/:id" element={<NewsDetailPage />} />


          <Route path="/iscrizione" element={<SubscriptionPage />} />
          <Route path="/chi-siamo" element={<AboutPage />} />
          <Route path="/sports" element={<SportPage />} />
          <Route path="/contatti" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/tutela-minori" element={<TutelaDeiMinoriPage />} />
          <Route path="/contributi-pubblici" element={<ContributiPage />} />
          <Route path="/cinquepermille" element={<CinquePerMillePage />} />
          <Route path="/sponsor" element={<SponsorPage />} />

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
