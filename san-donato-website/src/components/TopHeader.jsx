import React from "react";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";
import "../css/TopHeader.css";

export default function TopHeader() {
    const phoneNumber = "+39 123 456 7890"; // phone mock
    const email = "info@polisportiva.it"; // email mock

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
                    📞 {phoneNumber} | ✉ {email}
                </div>
            </div>
        </div>
    );
}
