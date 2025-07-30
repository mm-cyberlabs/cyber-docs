import React, { useState, useMemo } from 'react';
import { Search, Book, Filter, ChevronUp, ChevronDown } from 'lucide-react';
import '../css/acronym-dictionary.css';


// Sample acronym data - you can replace this with your actual data
const acronymsData = [
    { acronym: 'API', definition: 'Application Programming Interface', category: 'Development' },
    { acronym: 'CDC', definition: 'Change Data Capture', category: 'Data' },
    { acronym: 'JWT', definition: 'JSON Web Token', category: 'Security' },
    { acronym: 'CRUD', definition: 'Create, Read, Update, Delete', category: 'Development' },
    { acronym: 'REST', definition: 'Representational State Transfer', category: 'Architecture' },
    { acronym: 'SQL', definition: 'Structured Query Language', category: 'Database' },
    { acronym: 'HTTP', definition: 'HyperText Transfer Protocol', category: 'Network' },
    { acronym: 'HTTPS', definition: 'HyperText Transfer Protocol Secure', category: 'Network' },
    { acronym: 'JSON', definition: 'JavaScript Object Notation', category: 'Data' },
    { acronym: 'XML', definition: 'eXtensible Markup Language', category: 'Data' },
    { acronym: 'CLI', definition: 'Command Line Interface', category: 'Development' },
    { acronym: 'GUI', definition: 'Graphical User Interface', category: 'Development' },
    { acronym: 'ORM', definition: 'Object-Relational Mapping', category: 'Database' },
    { acronym: 'MVC', definition: 'Model-View-Controller', category: 'Architecture' },
    { acronym: 'SOA', definition: 'Service-Oriented Architecture', category: 'Architecture' },
    { acronym: 'SPA', definition: 'Single Page Application', category: 'Frontend' },
    { acronym: 'PWA', definition: 'Progressive Web Application', category: 'Frontend' },
    { acronym: 'DOM', definition: 'Document Object Model', category: 'Frontend' },
    { acronym: 'CSS', definition: 'Cascading Style Sheets', category: 'Frontend' },
    { acronym: 'HTML', definition: 'HyperText Markup Language', category: 'Frontend' },
    { acronym: 'URL', definition: 'Uniform Resource Locator', category: 'Network' },
    { acronym: 'URI', definition: 'Uniform Resource Identifier', category: 'Network' },
    { acronym: 'TCP', definition: 'Transmission Control Protocol', category: 'Network' },
    { acronym: 'UDP', definition: 'User Datagram Protocol', category: 'Network' },
    { acronym: 'SSL', definition: 'Secure Sockets Layer', category: 'Security' },
    { acronym: 'TLS', definition: 'Transport Layer Security', category: 'Security' },
    { acronym: 'SSH', definition: 'Secure Shell', category: 'Security' },
    { acronym: 'VPN', definition: 'Virtual Private Network', category: 'Security' },
    { acronym: 'OAUTH', definition: 'Open Authorization', category: 'Security' },
    { acronym: 'SAML', definition: 'Security Assertion Markup Language', category: 'Security' },
    { acronym: 'LDAP', definition: 'Lightweight Directory Access Protocol', category: 'Security' },
    { acronym: 'AWS', definition: 'Amazon Web Services', category: 'Cloud' },
    { acronym: 'GCP', definition: 'Google Cloud Platform', category: 'Cloud' },
    { acronym: 'CICD', definition: 'Continuous Integration/Continuous Deployment', category: 'DevOps' },
    { acronym: 'CI', definition: 'Continuous Integration', category: 'DevOps' },
    { acronym: 'CD', definition: 'Continuous Deployment', category: 'DevOps' },
    { acronym: 'IaC', definition: 'Infrastructure as Code', category: 'DevOps' },
    { acronym: 'SLA', definition: 'Service Level Agreement', category: 'Business' },
    { acronym: 'KPI', definition: 'Key Performance Indicator', category: 'Business' },
    { acronym: 'ROI', definition: 'Return on Investment', category: 'Business' },
    { acronym: 'B2B', definition: 'Business to Business', category: 'Business' },
    { acronym: 'B2C', definition: 'Business to Consumer', category: 'Business' },
    { acronym: 'ETL', definition: 'Extract, Transform, Load', category: 'Data' },
    { acronym: 'ELT', definition: 'Extract, Load, Transform', category: 'Data' },
    { acronym: 'OLTP', definition: 'Online Transaction Processing', category: 'Database' },
    { acronym: 'OLAP', definition: 'Online Analytical Processing', category: 'Database' },
    { acronym: 'ACID', definition: 'Atomicity, Consistency, Isolation, Durability', category: 'Database' },
    { acronym: 'NoSQL', definition: 'Not Only SQL', category: 'Database' },
    { acronym: 'RDBMS', definition: 'Relational Database Management System', category: 'Database' }
];

// Fuzzy search function
const fuzzySearch = (query, text) => {
    if (!query) return true;

    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Direct substring match gets highest priority
    if (textLower.includes(queryLower)) return true;

    // Fuzzy matching: check if all characters in query exist in order in text
    let queryIndex = 0;
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
        if (textLower[i] === queryLower[queryIndex]) {
            queryIndex++;
        }
    }

    return queryIndex === queryLower.length;
};

// Calculate relevance score for sorting
const calculateRelevance = (query, acronym, definition) => {
    if (!query) return 0;

    const queryLower = query.toLowerCase();
    const acronymLower = acronym.toLowerCase();
    const definitionLower = definition.toLowerCase();

    let score = 0;

    // Exact acronym match gets highest score
    if (acronymLower === queryLower) score += 100;
    else if (acronymLower.startsWith(queryLower)) score += 80;
    else if (acronymLower.includes(queryLower)) score += 60;

    // Definition matches
    if (definitionLower.includes(queryLower)) score += 40;

    // Fuzzy matches get lower scores
    if (fuzzySearch(query, acronym)) score += 20;
    if (fuzzySearch(query, definition)) score += 10;

    return score;
};

export default function AcronymDictionaryComponent() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [sortField, setSortField] = useState('acronym');
    const [sortDirection, setSortDirection] = useState('asc');

    // Get unique categories
    const categories = useMemo(() => {
        const cats = [...new Set(acronymsData.map(item => item.category))].sort();
        return ['All', ...cats];
    }, []);

    // Filter and search acronyms
    const filteredAcronyms = useMemo(() => {
        let filtered = acronymsData;

        // Filter by category
        if (selectedCategory !== 'All') {
            filtered = filtered.filter(item => item.category === selectedCategory);
        }

        // Apply search with fuzzy matching
        if (searchQuery.trim()) {
            filtered = filtered.filter(item =>
                fuzzySearch(searchQuery, item.acronym) ||
                fuzzySearch(searchQuery, item.definition)
            );

            // Sort by relevance when searching
            filtered = filtered.sort((a, b) => {
                const scoreA = calculateRelevance(searchQuery, a.acronym, a.definition);
                const scoreB = calculateRelevance(searchQuery, b.acronym, b.definition);
                return scoreB - scoreA;
            });
        } else {
            // Sort by selected field when not searching
            filtered = filtered.sort((a, b) => {
                const aVal = a[sortField].toLowerCase();
                const bVal = b[sortField].toLowerCase();

                if (sortDirection === 'asc') {
                    return aVal.localeCompare(bVal);
                } else {
                    return bVal.localeCompare(aVal);
                }
            });
        }

        return filtered;
    }, [searchQuery, selectedCategory, sortField, sortDirection]);

    const handleSort = (field) => {
        if (searchQuery.trim()) return; // Don't allow sorting when searching (relevance takes priority)

        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const highlightText = (text, query) => {
        if (!query.trim()) return text;

        const queryLower = query.toLowerCase();
        const textLower = text.toLowerCase();
        const index = textLower.indexOf(queryLower);

        if (index === -1) return text;

        return (
            <>
                {text.substring(0, index)}
                <mark className="acronym-dictionary-highlight">
                    {text.substring(index, index + query.length)}
                </mark>
                {text.substring(index + query.length)}
            </>
        );
    };

    const getCategoryClassName = (category) => {
        const categoryMap = {
            'Development': 'development',
            'Data': 'data',
            'Security': 'security',
            'Network': 'network',
            'Frontend': 'frontend',
            'Architecture': 'architecture',
            'Database': 'database',
            'Cloud': 'cloud',
            'DevOps': 'devops',
            'Business': 'business'
        };
        return `acronym-dictionary-category-badge--${categoryMap[category] || 'development'}`;
    };

    return (
        <div className="acronym-dictionary-container">
            {/* Header */}
            <div className="acronym-dictionary-header">
                <div className="acronym-dictionary-header-content">
                    <Book size={28} color="var(--ifm-color-primary)" />
                    <h1 className="acronym-dictionary-title">
                        Acronym Dictionary
                    </h1>
                </div>
                <p className="acronym-dictionary-subtitle">
                    Search through our comprehensive dictionary of technical acronyms and abbreviations.
                    Use fuzzy search to find what you're looking for even with partial matches.
                </p>
            </div>

            {/* Search and Filter Controls */}
            <div className="acronym-dictionary-controls">
                <div className="acronym-dictionary-controls-grid">
                    {/* Search Input */}
                    <div className="acronym-dictionary-input-group">
                        <label className="acronym-dictionary-label">
                            Search Acronyms
                        </label>
                        <div className="acronym-dictionary-input-wrapper">
                            <Search size={18} className="acronym-dictionary-input-icon" />
                            <input
                                type="text"
                                placeholder="Type to search acronyms or definitions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="acronym-dictionary-search-input"
                            />
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div className="acronym-dictionary-input-group">
                        <label className="acronym-dictionary-label">
                            Category
                        </label>
                        <div className="acronym-dictionary-input-wrapper">
                            <Filter size={16} className="acronym-dictionary-input-icon" />
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="acronym-dictionary-select"
                            >
                                {categories.map(category => (
                                    <option key={category} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Results Count */}
                <div className="acronym-dictionary-results-info">
                    {filteredAcronyms.length} {filteredAcronyms.length === 1 ? 'result' : 'results'} found
                    {searchQuery && (
                        <span className="acronym-dictionary-search-term">
              for "{searchQuery}"
            </span>
                    )}
                    {searchQuery.trim() && (
                        <span className="acronym-dictionary-sort-info">
              (sorted by relevance)
            </span>
                    )}
                </div>
            </div>

            {/* Results Table */}
            {filteredAcronyms.length > 0 ? (
                <div className="acronym-dictionary-table-container">
                    <table className="acronym-dictionary-table">
                        <thead>
                        <tr>
                            <th
                                className={`acronym-dictionary-th acronym-dictionary-th--acronym ${
                                    !searchQuery.trim() && sortField === 'acronym' ? 'acronym-dictionary-th--active' : ''
                                }`}
                                onClick={() => handleSort('acronym')}
                            >
                                <div className="acronym-dictionary-th-content">
                                    Acronym
                                    {!searchQuery.trim() && sortField === 'acronym' && (
                                        sortDirection === 'asc' ?
                                            <ChevronUp size={14} color="#ffffff" /> :
                                            <ChevronDown size={14} color="#ffffff" />
                                    )}
                                </div>
                            </th>
                            <th
                                className={`acronym-dictionary-th acronym-dictionary-th--definition ${
                                    !searchQuery.trim() && sortField === 'definition' ? 'acronym-dictionary-th--active' : ''
                                }`}
                                onClick={() => handleSort('definition')}
                            >
                                <div className="acronym-dictionary-th-content">
                                    Definition
                                    {!searchQuery.trim() && sortField === 'definition' && (
                                        sortDirection === 'asc' ?
                                            <ChevronUp size={14} color="#ffffff" /> :
                                            <ChevronDown size={14} color="#ffffff" />
                                    )}
                                </div>
                            </th>
                            <th
                                className={`acronym-dictionary-th acronym-dictionary-th--category ${
                                    !searchQuery.trim() && sortField === 'category' ? 'acronym-dictionary-th--active' : ''
                                }`}
                                onClick={() => handleSort('category')}
                            >
                                <div className="acronym-dictionary-th-content">
                                    Category
                                    {!searchQuery.trim() && sortField === 'category' && (
                                        sortDirection === 'asc' ?
                                            <ChevronUp size={14} color="#ffffff" /> :
                                            <ChevronDown size={14} color="#ffffff" />
                                    )}
                                </div>
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredAcronyms.map((item, index) => (
                            <tr
                                key={`${item.acronym}-${index}`}
                                className="acronym-dictionary-tr"
                            >
                                <td
                                    className="acronym-dictionary-td acronym-dictionary-td--acronym"
                                    data-label="Acronym"
                                >
                                    {highlightText(item.acronym, searchQuery)}
                                </td>
                                <td
                                    className="acronym-dictionary-td"
                                    data-label="Definition"
                                >
                                    {highlightText(item.definition, searchQuery)}
                                </td>
                                <td
                                    className="acronym-dictionary-td"
                                    data-label="Category"
                                >
                                    <span className={`acronym-dictionary-category-badge ${getCategoryClassName(item.category)}`}>
                                      {item.category}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="acronym-dictionary-no-results">
                    <Book size={42} color="var(--ifm-color-emphasis-500)" className="acronym-dictionary-no-results-icon" />
                    <h3 className="acronym-dictionary-no-results-title">No results found</h3>
                    <p className="acronym-dictionary-no-results-text">
                        Try adjusting your search terms or selecting a different category.
                    </p>
                </div>
            )}

            {/* Footer Info */}
            <div className="acronym-dictionary-footer">
                <p className="acronym-dictionary-footer-tip">
                    <strong>Fuzzy Search Tips:</strong> You can search with partial matches, typos, or abbreviations.
                </p>
                <p className="acronym-dictionary-footer-contact">
                    Click column headers to sort when not searching. Can't find an acronym? Contact your team to add it to the dictionary.
                </p>
            </div>
        </div>
    );
}