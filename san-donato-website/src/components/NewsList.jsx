import { useEffect, useState } from 'react'
import '../css/NewsList.css'

import { useNavigate } from 'react-router-dom'
import Button from 'react-bootstrap/Button'

export default function NewsList() {
    const [posts, setPosts] = useState([])

    const navigate = useNavigate()

    useEffect(() => {
        // Demo: se il sito ha feed RSS o API, qui si sostituisce l'endpoint.
        // Per ora carichiamo un mock rapido.
        
        const mock = [
            { id: 1, title: 'Inizio stagione: iscrizioni aperte', excerpt: 'Le iscrizioni per la stagione 2025-26 sono aperte...' },
            { id: 2, title: 'Torneo di calcetto', excerpt: 'Sabato 12 ottobre torneo giovanile...' }
        ]
        setPosts(mock)
    }, [])



    return (
        <div className="container py-8">
            <h2>Ultime notizie</h2>
            <div className="grid grid-cols-3">
                {posts.map(p => (
                    <article key={p.id} className="card">
                        <h3>{p.title}</h3>
                        <p>{p.excerpt}</p>
                        <Button onClick={() => navigate(`/news/${p.id}`)}>Leggi</Button>
                        
                    </article>
                ))}
            </div>
        </div>
    )
}