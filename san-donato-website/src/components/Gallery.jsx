import '../css/Gallery.css'

export default function Gallery({ images = [] }) {
    return (
        <div className="container py-8">
            <h2>Galleria</h2>
            <div className="grid grid-cols-3">
                {images.length === 0 ? (
                    <div className="card">Nessuna immagine disponibile</div>
                ) : images.map((src, i) => (
                    <div className="card" key={i}>
                        <img src={src} alt={`img-${i}`} style={{ width: '100%', borderRadius: 8 }} />
                    </div>
                ))}
            </div>
        </div>
    )
}