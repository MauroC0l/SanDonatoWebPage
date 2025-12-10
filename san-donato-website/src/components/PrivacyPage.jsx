import React from "react";
import { FaFilePdf, FaShieldAlt, FaCloudDownloadAlt } from "react-icons/fa";
import "../css/PrivacyPage.css";
import privacyData from "../data/Privacy.json";

export default function PrivacyPage() {
  const { header, content, documents } = privacyData;

  return (
    <div className="privacy-page prv-fade-in">
      <div className="prv-container">
        
        {/* HEADER */}
        <header className="prv-header">
          <div className="prv-icon-circle">
            <FaShieldAlt />
          </div>
          <h1 className="prv-title">{header.title}</h1>
          <p className="prv-subtitle">{header.subtitle}</p>
        </header>

        {/* CONTENUTO PRINCIPALE */}
        <div className="prv-content-card">
          <h2>{content.introTitle}</h2>
          <p>{content.introText}</p>

          <div className="prv-documents-list">
            {documents.map((doc) => (
              <a 
                key={doc.id} 
                href={doc.fileUrl} 
                download 
                className="prv-doc-item"
              >
                <div className="prv-doc-icon">
                  <FaFilePdf />
                </div>
                <div className="prv-doc-info">
                  <h3>{doc.label}</h3>
                  <span>{doc.description}</span>
                </div>
                <div className="prv-download-action">
                  <FaCloudDownloadAlt />
                </div>
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}