import { Link, NavLink } from 'react-router-dom'
import '../css/Header.css'


export default function Header() {
    return (
        <header className="header">
            <div className="container flex items-center justify-between py-4">
                <Link to="/" className="text-xl font-bold">Polisportiva San Donato</Link>
                <nav className="nav">
                    <NavLink to="/" end className={({ isActive }) => isActive ? 'font-semibold' : 'opacity-90'}>Home</NavLink>
                    <NavLink to="/news" className={({ isActive }) => isActive ? 'font-semibold' : 'opacity-90'}>News</NavLink>
                    <NavLink to="/galleria" className={({ isActive }) => isActive ? 'font-semibold' : 'opacity-90'}>Galleria</NavLink>
                    <NavLink to="/chi-siamo" className={({ isActive }) => isActive ? 'font-semibold' : 'opacity-90'}>Chi Siamo</NavLink>
                </nav>
                <a href="/contatti" className="button">Contatti</a>
            </div>
        </header>
    )
}