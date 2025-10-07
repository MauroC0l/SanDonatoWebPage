import React, { useEffect, useState, useMemo } from "react";
import { Container } from "react-bootstrap";
import NewsList from "./NewsList";
import AboutSection from "./AboutSection";
import { getLatestPostsByCategory } from "../api/api";
import "../css/HomePage.css";

export default function HomePage() {
  const [newsByCategory, setNewsByCategory] = useState({});
  const [loading, setLoading] = useState(true); // 🟠 Stato per il caricamento

  useEffect(() => {
    let mounted = true;

    async function fetchNews() {
      try {
        const grouped = await getLatestPostsByCategory();
        const orderedCategories = ["Altro", "Calcio", "Pallavolo", "Basket", "Minivolley"];
        const sortedGrouped = {};

        for (const cat of orderedCategories) {
          if (grouped?.[cat]?.length) sortedGrouped[cat] = grouped[cat];
        }

        if (mounted) {
          setNewsByCategory(sortedGrouped);
          setLoading(false); // ✅ Fine caricamento
        }
      } catch (err) {
        console.error("Errore nel caricamento delle news:", err);
        if (mounted) setLoading(false);
      }
    }

    fetchNews();
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(() => Object.keys(newsByCategory), [newsByCategory]);

  return (
    <div className="hp-root">
      {/* Sezione Hero full width */}
      <AboutSection />

      {/* 🔄 Loader visibile finché i dati non sono caricati */}
      {loading ? (
        <div className="loader-container">
          <div className="loader"></div>
        </div>
      ) : (
        <Container fluid className="hp-container">
          {categories.map((category) => (
            <section key={category} className="hp-section">
              <h2 className="hp-title">{category}</h2>
              <NewsList news={newsByCategory[category]} />
            </section>
          ))}
        </Container>
      )}
    </div>
  );
}
