import React from 'react';
import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";
import { SiTiktok } from "react-icons/si";
import { FiMapPin, FiMail, FiLock } from "react-icons/fi";
import "../../css/TopHeader.css";

// IMPORT DATI JSON
import headerData from "../../data/TopHeader.json";

export default function TopHeader() {
    const { contactInfo, socialLinks } = headerData;

    return (
        <div className="top-header">
            <div className="top-header-container">
                
                {/* Social Icons (Sinistra) */}
                <div className="social-icons">
                    <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                        <FaFacebookF />
                    </a>
                    <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                        <FaInstagram />
                    </a>
                    <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                        <FaYoutube />
                    </a>
                    <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                        <SiTiktok />
                    </a>

                    {/* Accesso all'area riservata.
                        Sta accanto ai social ma non è un social: il separatore e il
                        lucchetto col bordo vuoto servono a non farlo scambiare per
                        l'ennesimo profilo della società. */}
                    <span className="th-sep" aria-hidden="true" />

                    <Link
                        to="/login"
                        className="th-login"
                        title="Area riservata"
                        aria-label="Area riservata: accesso per chi aggiorna il sito"
                    >
                        <FiLock />
                    </Link>
                </div>

                {/* Contatti (Destra) */}
                <div className="contact-info">
                    {/* Aggiunta classe specifica per gestire la visibilità responsive */}
                    <span className="contact-address">
                        <FiMapPin className="contact-icon" /> {contactInfo.address}
                    </span>
                    <span className="contact-email">
                        <FiMail className="contact-icon" /> {contactInfo.email}
                    </span>
                </div>

            </div>
        </div>
    );
}
