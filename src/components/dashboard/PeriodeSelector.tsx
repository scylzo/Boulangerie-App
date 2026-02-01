import React from 'react';
import { Icon } from '@iconify/react';

interface PeriodeSelectorProps {
    dateDebut: string;
    dateFin: string;
    onDateDebutChange: (date: string) => void;
    onDateFinChange: (date: string) => void;
}

export const PeriodeSelector: React.FC<PeriodeSelectorProps> = ({
    dateDebut,
    dateFin,
    onDateDebutChange,
    onDateFinChange
}) => {
    return (
        <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2">
                <Icon icon="mdi:calendar-range" className="text-indigo-600 text-xl" />
                <span className="text-sm font-medium text-gray-700">Période :</span>
            </div>

            <div className="flex items-center gap-2">
                <label htmlFor="dateDebut" className="text-sm text-gray-600">Du</label>
                <input
                    id="dateDebut"
                    type="date"
                    value={dateDebut}
                    onChange={(e) => onDateDebutChange(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>

            <div className="flex items-center gap-2">
                <label htmlFor="dateFin" className="text-sm text-gray-600">Au</label>
                <input
                    id="dateFin"
                    type="date"
                    value={dateFin}
                    onChange={(e) => onDateFinChange(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
        </div>
    );
};
