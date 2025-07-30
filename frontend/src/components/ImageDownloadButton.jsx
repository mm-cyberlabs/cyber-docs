import React, { useRef } from 'react';
import '../css/image-download.css';

const ImageDownloadButton = ({ 
    image,
    size = 200,
    showDownloadButton = true,
    filename = 'image-download',
    className = '',
    alt = 'Downloadable image'
}) => {
    const imageRef = useRef(null);

    const handleDownload = async () => {
        try {
            const imageElement = imageRef.current;
            if (!imageElement) {
                console.error('Image element not found for download');
                return;
            }

            // For SVG images, we need to convert to canvas first
            if (image.endsWith('.svg') || imageElement.tagName === 'svg') {
                // Dynamic import to avoid SSR issues
                const html2canvas = (await import('html2canvas')).default;
                
                const canvas = await html2canvas(imageElement, {
                    backgroundColor: null,
                    scale: 2,
                    useCORS: true,
                    allowTaint: true
                });

                const link = document.createElement('a');
                link.download = `${filename}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            } else {
                // For PNG/JPG images, download directly
                const link = document.createElement('a');
                link.download = `${filename}${image.substring(image.lastIndexOf('.'))}`;
                link.href = image;
                link.click();
            }
        } catch (error) {
            console.error('Error downloading image:', error);
        }
    };

    const imageStyle = {
        width: `${size}px`,
        height: `${size}px`
    };

    const renderImage = () => {
        if (image.endsWith('.svg')) {
            return (
                <object
                    ref={imageRef}
                    data={image}
                    type="image/svg+xml"
                    style={imageStyle}
                    aria-label={alt}
                />
            );
        } else {
            return (
                <img
                    ref={imageRef}
                    src={image}
                    alt={alt}
                    style={imageStyle}
                />
            );
        }
    };

    return (
        <div className={`image-with-download ${className}`}>
            {renderImage()}
            {showDownloadButton && (
                <div>
                    <button
                        className="image-download-button"
                        onClick={handleDownload}
                        title="Download this image"
                    >
                        <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7,10 12,15 17,10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download Image
                    </button>
                </div>
            )}
        </div>
    );
};

export default ImageDownloadButton;