import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';

export const ScrollToTopBottom: React.FC = () => {
    const [isAtBottom, setIsAtBottom] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
             // On considère qu'on est en bas si on est proche de la fin (marge de 100px)
            const isBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;
            setIsAtBottom(isBottom);
        };

        window.addEventListener('scroll', handleScroll);
        // Au montage, vérifier position
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleClick = () => {
        if (isAtBottom) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`fixed bottom-24 right-6 w-12 h-12 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-50 flex items-center justify-center group border ${
                isAtBottom ? 'bg-gray-700 hover:bg-gray-600 border-gray-500' : 'bg-gray-800 hover:bg-gray-700 border-gray-600'
            }`}
            title={isAtBottom ? "Remonter en haut" : "Aller en bas"}
        >
            <Icon 
                icon={isAtBottom ? "mdi:arrow-up" : "mdi:arrow-down"} 
                className={`text-xl transition-transform ${isAtBottom ? 'group-hover:-translate-y-1' : 'group-hover:translate-y-1'}`} 
            />
        </button>
    );
};
