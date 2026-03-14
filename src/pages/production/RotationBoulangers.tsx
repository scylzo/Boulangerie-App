import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Team {
  id: string;
  boulanger: string;
  assistant1: string;
  assistant2: string;
}

interface ScheduleDay {
  date: Date;
  team: Team;
}

export const RotationBoulangers: React.FC = () => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Défaut : fin dans 1 mois
  const defaultEndDate = new Date();
  defaultEndDate.setMonth(defaultEndDate.getMonth() + 1);
  const [endDate, setEndDate] = useState(defaultEndDate.toISOString().split('T')[0]);

  const [teams, setTeams] = useState<Team[]>([
    { id: '1', boulanger: '', assistant1: '', assistant2: '' },
    { id: '2', boulanger: '', assistant1: '', assistant2: '' }
  ]);

  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);

  const handleAddTeam = () => {
    setTeams([...teams, { id: Date.now().toString(), boulanger: '', assistant1: '', assistant2: '' }]);
  };

  const handleRemoveTeam = (id: string) => {
    if (teams.length <= 1) {
      toast.error('Il faut au moins une équipe.');
      return;
    }
    setTeams(teams.filter(t => t.id !== id));
  };

  const handleChangeTeam = (id: string, field: keyof Team, value: string) => {
    setTeams(teams.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const generateSchedule = () => {
    // Validation
    if (teams.some(t => !t.boulanger.trim() || !t.assistant1.trim() || !t.assistant2.trim())) {
      toast.error('Veuillez remplir les noms de tous les boulangers et assistants.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      toast.error('La date de début doit être avant la date de fin.');
      return;
    }

    const newSchedule: ScheduleDay[] = [];
    let currentDate = new Date(start);
    let teamIndex = 0;
    let daysWorked = 0;

    while (currentDate <= end) {
      newSchedule.push({
        date: new Date(currentDate),
        team: teams[teamIndex]
      });

      daysWorked++;
      if (daysWorked === 3) {
        daysWorked = 0;
        teamIndex = (teamIndex + 1) % teams.length;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    setSchedule(newSchedule);
    toast.success('Calendrier généré avec succès !');
  };

  const generatePDF = () => {
    if (schedule.length === 0) {
      toast.error("Veuillez d'abord générer le calendrier.");
      return;
    }

    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Calendrier de Rotation des Boulangers', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`, 14, 30);

    const tableColumn = ["Date", "Boulanger", "Assistant 1", "Assistant 2"];
    const tableRows = schedule.map(day => [
      day.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      day.team.boulanger,
      day.team.assistant1,
      day.team.assistant2
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [249, 115, 22], textColor: 255 }, // orange-500
      alternateRowStyles: { fillColor: [250, 245, 240] }
    });

    doc.save(`Rotation_Boulangers_${startDate}_au_${endDate}.pdf`);
    toast.success('PDF téléchargé !');
  };

  const handleShareWhatsApp = () => {
    if (schedule.length === 0) {
      toast.error("Veuillez d'abord générer le calendrier.");
      return;
    }

    let message = `*ROTATION DES BOULANGERS*\n`;
    message += `_Du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}_\n\n`;

    schedule.forEach(day => {
      const dateStr = day.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      // Capitalize first letter of day
      const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
      
      message += `*${dateCapitalized}*\n`;
      message += `👨‍🍳 Boulanger : ${day.team.boulanger}\n`;
      message += `👨‍🍳 Assistant 1 : ${day.team.assistant1}\n`;
      message += `👨‍🍳 Assistant 2 : ${day.team.assistant2}\n\n`;
    });

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <Icon icon="mdi:calendar-sync" className="text-2xl text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Rotation des Boulangers</h1>
            <p className="text-sm text-gray-500 mt-1">Générez un calendrier de rotation (3 jours par équipe)</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Paramètres du calendrier */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center gap-2">
            <Icon icon="mdi:cog" className="text-xl text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-800">Paramètres de la Rotation</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de début</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de fin</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Équipes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
             <div className="flex items-center gap-2">
                <Icon icon="mdi:account-group" className="text-xl text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-800">Équipes de Boulangers</h2>
             </div>
             <button 
                onClick={handleAddTeam}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
             >
                <Icon icon="mdi:plus" /> Ajouter une équipe
             </button>
          </div>
          <div className="p-5 space-y-4">
            {teams.map((team, index) => (
              <div key={team.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 flex flex-col md:flex-row gap-4 items-start md:items-center relative">
                <div className="absolute top-2 right-2 md:static md:ml-auto">
                    <button 
                        onClick={() => handleRemoveTeam(team.id)}
                        className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors"
                        title="Supprimer cette équipe"
                    >
                        <Icon icon="mdi:trash-can" className="text-xl" />
                    </button>
                </div>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-700 font-bold shrink-0">
                    {index + 1}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full flex-1">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Boulanger</label>
                        <input
                            type="text"
                            placeholder="Nom du boulanger"
                            value={team.boulanger}
                            onChange={(e) => handleChangeTeam(team.id, 'boulanger', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Assistant 1</label>
                        <input
                            type="text"
                            placeholder="Nom de l'assistant 1"
                            value={team.assistant1}
                            onChange={(e) => handleChangeTeam(team.id, 'assistant1', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Assistant 2</label>
                        <input
                            type="text"
                            placeholder="Nom de l'assistant 2"
                            value={team.assistant2}
                            onChange={(e) => handleChangeTeam(team.id, 'assistant2', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                    </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Boutons */}
        <div className="flex items-center justify-end gap-4">
            <button 
                onClick={generateSchedule}
                className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
            >
                <Icon icon="mdi:calendar-check" className="text-xl" />
                Générer le calendrier
            </button>
            <button 
                onClick={generatePDF}
                disabled={schedule.length === 0}
                className={`flex items-center gap-2 px-6 py-3 font-medium rounded-xl transition-colors shadow-sm ${
                    schedule.length > 0 
                    ? 'bg-orange-500 text-white hover:bg-orange-600 cursor-pointer' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
                <Icon icon="mdi:file-pdf-box" className="text-xl" />
                Télécharger le PDF
            </button>
            <button 
                onClick={handleShareWhatsApp}
                disabled={schedule.length === 0}
                className={`flex items-center gap-2 px-6 py-3 font-medium rounded-xl transition-colors shadow-sm ${
                    schedule.length > 0 
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
                <Icon icon="mdi:whatsapp" className="text-xl" />
                Envoyer sur WhatsApp
            </button>
        </div>

        {/* Aperçu du calendrier */}
        {schedule.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center gap-2">
                    <Icon icon="mdi:eye" className="text-xl text-gray-600" />
                    <h2 className="text-lg font-semibold text-gray-800">Aperçu du Calendrier</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Boulanger</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assistant 1</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assistant 2</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {schedule.map((day, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                                        {day.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                        <div className="flex items-center gap-2">
                                            <Icon icon="mdi:chef-hat" className="text-orange-500" />
                                            <span className="font-semibold">{day.team.boulanger}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {day.team.assistant1}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {day.team.assistant2}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};
