import React from "react";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";
import "../css/TopHeader.css";

import { FiMapPin, FiPhone, FiMail, FiHome } from "react-icons/fi";


export default function TopHeader() {
    const phoneNumber = "+39 123 456 7890";
    const email = "info@polisportiva.it";
    const address = "ASD PSD Via Le Chiuse 20/A - 10144 Torino P.Iva 09911610013 - C.F. 97699790016";

    return (
        <div className="top-header">
            <div className="top-header-container">
                <div className="social-icons">
                    <a href="https://www.facebook.com/polisportivasandonato/#" target="_blank" rel="noopener noreferrer">
                        <FaFacebookF />
                    </a>
                    <a href="https://www.instagram.com/poli_sandonato/" target="_blank" rel="noopener noreferrer">
                        <FaInstagram />
                    </a>
                    <a href="https://www.youtube.com/channel/UCmiLH1iB43wExROqDINTL2w" target="_blank" rel="noopener noreferrer">
                        <FaYoutube />
                    </a>
                </div>
                <div className="contact-info">
                    <span><FiMapPin className="contact-icon" /> {address}</span>
                    <span><FiPhone className="contact-icon" /> {phoneNumber}</span>
                    <span><FiMail className="contact-icon" /> {email}</span>
                    <span><FiHome className="contact-icon" /> Torino</span>
                </div>
            </div>
        </div>
    );
}
