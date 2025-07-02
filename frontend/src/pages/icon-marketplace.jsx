import React, { useState } from 'react';
import Layout from '@theme/Layout';
import { iconData } from '../../static/data/icon-data.js'; // Import the data
import '../css/icon-marketplace.css';

// The categories are still generated dynamically from the imported data.
const categories = ['All', ...new Set(iconData.map(icon => icon.category))];

export default function IconMarketplace() {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedId, setCopiedId] = useState(null); // To provide feedback on copy

    const filteredIcons = iconData.filter(icon => {
        const matchesCategory = selectedCategory === 'All' || icon.category === selectedCategory;
        const matchesSearch = icon.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            icon.description.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const showFeedback = (id) => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000); // Reset after 2 seconds
    };

    const handleCopySvg = async (icon) => {
        try {
            // First, fetch the SVG content from the URL.
            const response = await fetch(icon.url);
            if (!response.ok) {
                // If the network request fails, we can't proceed.
                throw new Error(`Failed to fetch SVG: ${response.statusText}`);
            }
            const svgText = await response.text();

            // Now, attempt to copy the SVG as a rich image.
            // This is the ideal scenario, but it's not supported in all browsers (e.g., Firefox).
            try {
                const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/svg+xml': svgBlob })
                ]);
                showFeedback(`${icon.id}-svg`);
            } catch (error) {
                // If copying as an image fails, log a warning and fall back to copying as plain text.
                console.warn(
                    'Could not copy SVG as an image directly. This is likely a browser limitation. Falling back to copying as text.',
                    error
                );
                await navigator.clipboard.writeText(svgText);
                showFeedback(`${icon.id}-svg`);
            }
        } catch (error) {
            // This outer catch will handle network errors or if both copy methods fail.
            console.error('A critical error occurred during the SVG copy process:', error);
            alert('Could not copy the SVG icon. Please try again or check the browser console for more details.');
        }
    };

    const handleCopyPng = async (icon) => {
        try {
            const response = await fetch(icon.url);
            const svgText = await response.text();
            const img = new Image();
            const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const [width, height] = icon.size.split('x').map(Number);
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(url);
                canvas.toBlob(async (pngBlob) => {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': pngBlob })
                    ]);
                    showFeedback(`${icon.id}-png`);
                }, 'image/png');
            };
            img.src = url;
        } catch (error) {
            console.error('Failed to copy as PNG:', error);
            alert('Could not copy as PNG.');
        }
    };

    const handleDownload = async (icon) => {
        try {
            const response = await fetch(icon.downloadUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${icon.id}.${icon.format.toLowerCase()}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(icon.downloadUrl, '_blank');
        }
    };

    return (
        <Layout
            title="Icon Marketplace"
            description="Browse and download high-quality icons for your projects">
            <div className="icon-marketplace">
                <div className="marketplace-header">
                    <div className="container">
                        <h1>Icon Marketplace</h1>
                        <p>Discover and download premium icons for your web applications and design projects.</p>

                        <div className="marketplace-controls">
                            <div className="search-box">
                                <input
                                    type="text"
                                    placeholder="Search icons..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="search-input"
                                />
                            </div>

                            <div className="category-filters">
                                {categories.map(category => (
                                    <button
                                        key={category}
                                        className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
                                        onClick={() => setSelectedCategory(category)}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="marketplace-content">
                    <div className="container">
                        <div className="icons-grid">
                            {filteredIcons.map(icon => (
                                <div key={icon.id} className="icon-card">
                                    <div className="icon-preview">
                                        <img
                                            src={icon.url}
                                            alt={icon.name}
                                            className="icon-image"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                        <div className="icon-placeholder" style={{display: 'none'}}>
                                            <span>Icon</span>
                                        </div>
                                    </div>

                                    <div className="icon-info">
                                        <h3 className="icon-name">{icon.name}</h3>
                                        {/* The description now comes before the meta tags */}
                                        <p className="icon-description">{icon.description}</p>
                                        <div className="icon-meta">
                                            <span className="icon-category">{icon.category}</span>
                                            <span className="icon-size">{icon.size}</span>
                                            <span className="icon-format">{icon.format}</span>
                                        </div>

                                        <div className="icon-actions">
                                            <button
                                                className="copy-btn"
                                                onClick={() => handleCopySvg(icon)}
                                            >
                                                {copiedId === `${icon.id}-svg` ? 'Copied!' : 'Copy SVG'}
                                            </button>
                                            <button
                                                className="copy-btn"
                                                onClick={() => handleCopyPng(icon)}
                                            >
                                                {copiedId === `${icon.id}-png` ? 'Copied!' : 'Copy PNG'}
                                            </button>
                                            <button
                                                className="download-btn"
                                                onClick={() => handleDownload(icon)}
                                            >
                                                Download {icon.format}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredIcons.length === 0 && (
                            <div className="no-results">
                                <h3>No icons found</h3>
                                <p>Try adjusting your search terms or category filter.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}