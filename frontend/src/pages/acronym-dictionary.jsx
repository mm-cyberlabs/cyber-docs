import React from 'react';
import Layout from '@theme/Layout';
import AcronymDictionary from '../components/AcronymDictionaryComponent.jsx';

export default function AcronymDictionaryPage() {
    return (
        <Layout title="Acronym Dictionary">
            {/* Remove the container class that might be interfering */}
            <div style={{
                padding: '2rem 1rem',
                maxWidth: '1200px',
                margin: '0 auto',
                // Isolate styles from Docusaurus
                isolation: 'isolate'
            }}>
                <AcronymDictionary />
            </div>
        </Layout>
    );
}