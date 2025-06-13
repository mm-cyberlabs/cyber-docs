import React, { useState } from 'react';
import Layout from '@theme/Layout';
import '../css/icon-marketplace.css';

// Sample icon data - replace with your actual icon server URLs and metadata
const iconData = [
    {
        id: 'user-profile',
        name: 'User Profile',
        url: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/user.svg',
        downloadUrl: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/user.svg',
        description: 'Clean and modern user profile icon perfect for authentication interfaces and user management systems.',
        category: 'User Interface',
        size: '24x24',
        format: 'SVG'
    },
    {
        id: 'home-house',
        name: 'Home',
        url: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/home.svg',
        downloadUrl: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/home.svg',
        description: 'Simple home icon ideal for navigation menus and dashboard interfaces.',
        category: 'Navigation',
        size: '24x24',
        format: 'SVG'
    },
    {
        id: 'settings-gear',
        name: 'Settings',
        url: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/cog-6-tooth.svg',
        downloadUrl: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/cog-6-tooth.svg',
        description: 'Gear icon representing settings, configuration, and system preferences.',
        category: 'System',
        size: '24x24',
        format: 'SVG'
    },
    {
        id: 'notification-bell',
        name: 'Notifications',
        url: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/bell.svg',
        downloadUrl: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/bell.svg',
        description: 'Bell icon for notifications, alerts, and messaging systems.',
        category: 'Communication',
        size: '24x24',
        format: 'SVG'
    },
    {
        id: 'search-magnify',
        name: 'Search',
        url: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/magnifying-glass.svg',
        downloadUrl: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/magnifying-glass.svg',
        description: 'Magnifying glass icon for search functionality and data exploration.',
        category: 'Actions',
        size: '24x24',
        format: 'SVG'
    },
    {
        id: 'email-mail',
        name: 'Email',
        url: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/envelope.svg',
        downloadUrl: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/envelope.svg',
        description: 'Envelope icon representing email, messages, and communication.',
        category: 'Communication',
        size: '24x24',
        format: 'SVG'
    },
    {
        id: 'document-file',
        name: 'Document',
        url: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/document.svg',
        downloadUrl: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/document.svg',
        description: 'Document icon for files, reports, and content management systems.',
        category: 'Files',
        size: '24x24',
        format: 'SVG'
    },
    {
        id: 'heart-favorite',
        name: 'Favorite',
        url: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/heart.svg',
        downloadUrl: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/heart.svg',
        description: 'Heart icon for favorites, likes, and user preferences.',
        category: 'Social',
        size: '24x24',
        format: 'SVG'
    },
    {
        id: 'calendar-date',
        name: 'Calendar',
        url: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/calendar.svg',
        downloadUrl: 'https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/calendar.svg',
        description: 'Calendar icon for date selection, scheduling, and time management.',
        category: 'Time',
        size: '24x24',
        format: 'SVG'
    }
];

const categories = ['All', ...new Set(iconData.map(icon => icon.category))];

export default function IconMarketplace() {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredIcons = iconData.filter(icon => {
        const matchesCategory = selectedCategory === 'All' || icon.category === selectedCategory;
        const matchesSearch = icon.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            icon.description.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

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
            // Fallback: open in new tab
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
                                        <div className="icon-meta">
                                            <span className="icon-category">{icon.category}</span>
                                            <span className="icon-size">{icon.size}</span>
                                            <span className="icon-format">{icon.format}</span>
                                        </div>
                                        <p className="icon-description">{icon.description}</p>

                                        <button
                                            className="download-btn"
                                            onClick={() => handleDownload(icon)}
                                        >
                                            Download {icon.format}
                                        </button>
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