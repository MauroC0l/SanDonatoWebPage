import Gallery from './Gallery'
import '../css/GalleryPage.css'

export default function GalleryPage() {
    const images = ['/assets/photo1.jpg', '/assets/photo2.jpg', '/assets/photo3.jpg']
    return <Gallery images={images} />
}