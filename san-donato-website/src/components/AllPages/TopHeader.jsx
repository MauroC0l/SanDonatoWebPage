import React from 'react';
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";
import { SiTiktok } from "react-icons/si";
import { FiMapPin, FiMail } from "react-icons/fi";
import "../../css/TopHeader.css";

// IMPORT DATI JSON
import headerData from "../../data/TopHeader.json";

export default function TopHeader() {
    const { contactInfo, socialLinks } = headerData;

    return (
        <div className="top-header">
            <div className="top-header-container">
                
                {/* Social Icons */}
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
                </div>

                {/* Contatti */}
                <div className="contact-info">
                    <span>
                        <FiMapPin className="contact-icon" /> {contactInfo.address}
                    </span>
                    <span>
                        <FiMail className="contact-icon" /> {contactInfo.email}
                    </span>
                </div>

            </div>
        </div>
    );
}