import React, { useEffect, useState, useMemo } from "react";
import { Container } from "react-bootstrap";
import NewsList from "./NewsList";
import AboutSection from "./AboutSection";
import { getLatestPostsByCategory } from "../api/api";
import "../css/HomePage.css";


// Lightweight, memo-friendly homepage that minimizes re-renders
export default function HomePage() {
const [newsByCategory, setNewsByCategory] = useState({});


useEffect(() => {
let mounted = true;


async function fetchNews() {
try {
const grouped = await getLatestPostsByCategory();
// Order once in a compact, predictable way
const orderedCategories = ["Altro", "Calcio", "Pallavolo", "Basket", "Minivolley"];
const sortedGrouped = {};


// Use a single pass to preserve order and avoid creating lots of intermediate objects
for (const cat of orderedCategories) {
if (grouped?.[cat]?.length) sortedGrouped[cat] = grouped[cat];
}


if (mounted) setNewsByCategory(sortedGrouped);
} catch (err) {
// Consider logging to a monitoring service in production
// console.error('Failed fetching news', err);
}
}


fetchNews();
return () => {
mounted = false; // avoid state updates after unmount
};
}, []);


// memoize the array of keys so child components only receive stable props
const categories = useMemo(() => Object.keys(newsByCategory), [newsByCategory]);


return (
<div className="hp-root">
<Container fluid className="hp-container">
<AboutSection />


{categories.map((category) => (
<section key={category} className="hp-section">
<h2 className="hp-title">{category}</h2>
<NewsList news={newsByCategory[category]} />
</section>
))}
</Container>
</div>
);
}