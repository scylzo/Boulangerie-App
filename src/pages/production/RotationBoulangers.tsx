import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Team {
  id: string;
  boulanger: string;
  assistants: string[];
}

interface ScheduleDay {
  date: Date;
  team: Team;
}

const assistantsRemplis = (t: Team) => t.assistants.map(a => a.trim()).filter(Boolean);

export const RotationBoulangers: React.FC = () => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Défaut : fin dans 1 mois
  const defaultEndDate = new Date();
  defaultEndDate.setMonth(defaultEndDate.getMonth() + 1);
  const [endDate, setEndDate] = useState(defaultEndDate.toISOString().split('T')[0]);

  const [teams, setTeams] = useState<Team[]>([
    { id: '1', boulanger: '', assistants: ['', ''] },
    { id: '2', boulanger: '', assistants: ['', ''] }
  ]);

  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);

  const handleAddTeam = () => {
    setTeams([...teams, { id: Date.now().toString(), boulanger: '', assistants: ['', ''] }]);
  };

  const handleRemoveTeam = (id: string) => {
    if (teams.length <= 1) {
      toast.error('Il faut au moins une équipe.');
      return;
    }
    setTeams(teams.filter(t => t.id !== id));
  };

  const handleChangeBoulanger = (id: string, value: string) => {
    setTeams(teams.map(t => t.id === id ? { ...t, boulanger: value } : t));
  };

  const handleChangeAssistant = (id: string, index: number, value: string) => {
    setTeams(teams.map(t => t.id === id
      ? { ...t, assistants: t.assistants.map((a, i) => i === index ? value : a) }
      : t));
  };

  const handleAddAssistant = (id: string) => {
    setTeams(teams.map(t => t.id === id ? { ...t, assistants: [...t.assistants, ''] } : t));
  };

  const handleRemoveAssistant = (id: string, index: number) => {
    setTeams(teams.map(t => t.id === id
      ? { ...t, assistants: t.assistants.filter((_, i) => i !== index) }
      : t));
  };

  const generateSchedule = () => {
    // Validation : un boulanger + au moins un assistant par équipe
    if (teams.some(t => !t.boulanger.trim() || assistantsRemplis(t).length === 0)) {
      toast.error('Chaque équipe doit avoir un boulanger et au moins un assistant.');
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

    const tableColumn = ["Date", "Boulanger", "Assistants"];
    const tableRows = schedule.map(day => [
      day.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      day.team.boulanger,
      assistantsRemplis(day.team).join(', ') || '—'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [249, 115, 22], textColor: 255 }, // warning-500
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
      const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

      message += `*${dateCapitalized}*\n`;
      message += `👨‍🍳 Boulanger : ${day.team.boulanger}\n`;
      assistantsRemplis(day.team).forEach((a, i) => {
        message += `👨‍🍳 Assistant ${i + 1} : ${a}\n`;
      });
      message += `\n`;
    });

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-sand-100 overflow-x-hidden">
      <div className="bg-white border-b border-sand-200 px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
            <Icon icon="mdi:calendar-sync" className="text-2xl text-terracotta-600" />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-semibold text-sand-900">Rotation des Boulangers</h1>
            <p className="text-sm text-sand-500 mt-1">Générez un calendrier de rotation (3 jours par équipe)</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Paramètres du calendrier */}
        <div className="bg-white rounded-2xl shadow-card border border-sand-200 overflow-hidden">
          <div className="p-4 border-b border-sand-200 bg-sand-50/50 flex items-center gap-2">
            <Icon icon="mdi:cog" className="text-xl text-sand-600" />
            <h2 className="text-lg font-semibold text-sand-800">Paramètres de la Rotation</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-sand-700 mb-2">Date de début</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 bg-sand-50 border border-sand-300 rounded-lg focus:ring-2 focus:ring-warning-500 focus:border-warning-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sand-700 mb-2">Date de fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 bg-sand-50 border border-sand-300 rounded-lg focus:ring-2 focus:ring-warning-500 focus:border-warning-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Équipes */}
        <div className="bg-white rounded-2xl shadow-card border border-sand-200 overflow-hidden">
          <div className="p-4 border-b border-sand-200 bg-sand-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="mdi:account-group" className="text-xl text-sand-600" />
              <h2 className="text-lg font-semibold text-sand-800">Équipes de Boulangers</h2>
            </div>
            <button
              onClick={handleAddTeam}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sand-900 text-white rounded-lg hover:bg-sand-800 transition-colors text-sm font-medium"
            >
              <Icon icon="mdi:plus" /> Ajouter une équipe
            </button>
          </div>
          <div className="p-5 space-y-4">
            {teams.map((team, index) => (
              <div key={team.id} className="p-4 rounded-xl border border-sand-100 bg-sand-50 flex flex-col md:flex-row gap-4 items-start relative">
                <div className="absolute top-2 right-2 md:static md:order-last">
                  <button
                    onClick={() => handleRemoveTeam(team.id)}
                    className="p-2 text-danger-500 hover:bg-danger-50 hover:text-danger-700 rounded-lg transition-colors"
                    title="Supprimer cette équipe"
                  >
                    <Icon icon="mdi:trash-can" className="text-xl" />
                  </button>
                </div>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-warning-100 text-warning-600 font-semibold shrink-0 md:mt-6">
                  {index + 1}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full flex-1">
                  {/* Boulanger */}
                  <div>
                    <label className="block text-xs font-semibold text-sand-500 uppercase tracking-wider mb-1">Boulanger</label>
                    <input
                      type="text"
                      placeholder="Nom du boulanger"
                      value={team.boulanger}
                      onChange={(e) => handleChangeBoulanger(team.id, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-sand-300 rounded-lg focus:ring-2 focus:ring-warning-500 outline-none"
                    />
                  </div>

                  {/* Assistants (dynamique) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-sand-500 uppercase tracking-wider mb-1">Assistants</label>
                    <div className="flex flex-wrap gap-2">
                      {team.assistants.map((assistant, aIndex) => (
                        <div key={aIndex} className="relative flex items-center">
                          <input
                            type="text"
                            placeholder={`Assistant ${aIndex + 1}`}
                            value={assistant}
                            onChange={(e) => handleChangeAssistant(team.id, aIndex, e.target.value)}
                            className="w-44 pl-3 pr-8 py-2 bg-white border border-sand-300 rounded-lg focus:ring-2 focus:ring-warning-500 outline-none"
                          />
                          <button
                            onClick={() => handleRemoveAssistant(team.id, aIndex)}
                            title="Retirer cet assistant"
                            className="absolute right-1.5 text-sand-400 hover:text-danger-600"
                          >
                            <Icon icon="mdi:close-circle" className="text-base" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => handleAddAssistant(team.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-warning-300 text-warning-700 hover:bg-warning-50 text-sm font-medium transition-colors"
                      >
                        <Icon icon="mdi:plus" className="text-base" /> Ajouter un assistant
                      </button>
                    </div>
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
            className="flex items-center gap-2 px-6 py-3 bg-sand-900 text-white font-medium rounded-xl hover:bg-sand-800 transition-colors shadow-sm"
          >
            <Icon icon="mdi:calendar-check" className="text-xl" />
            Générer le calendrier
          </button>
          <button
            onClick={generatePDF}
            disabled={schedule.length === 0}
            className={`flex items-center gap-2 px-6 py-3 font-medium rounded-xl transition-colors shadow-sm ${schedule.length > 0
              ? 'bg-warning-500 text-white hover:bg-warning-600 cursor-pointer'
              : 'bg-sand-200 text-sand-400 cursor-not-allowed'
              }`}
          >
            <Icon icon="mdi:file-pdf-box" className="text-xl" />
            Télécharger le PDF
          </button>
          <button
            onClick={handleShareWhatsApp}
            disabled={schedule.length === 0}
            className={`flex items-center gap-2 px-6 py-3 font-medium rounded-xl transition-colors shadow-sm ${schedule.length > 0
              ? 'bg-success-600 text-white hover:bg-success-700 cursor-pointer'
              : 'bg-sand-200 text-sand-400 cursor-not-allowed'
              }`}
          >
            <Icon icon="mdi:whatsapp" className="text-xl" />
            Envoyer sur WhatsApp
          </button>
        </div>

        {/* Aperçu du calendrier */}
        {schedule.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card border border-sand-200 overflow-hidden">
            <div className="p-4 border-b border-sand-200 bg-sand-50/50 flex items-center gap-2">
              <Icon icon="mdi:eye" className="text-xl text-sand-600" />
              <h2 className="text-lg font-semibold text-sand-800">Aperçu du Calendrier</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sand-50 border-b border-sand-200">
                    <th className="px-6 py-4 text-xs font-semibold text-sand-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-semibold text-sand-500 uppercase tracking-wider">Boulanger</th>
                    <th className="px-6 py-4 text-xs font-semibold text-sand-500 uppercase tracking-wider">Assistants</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100">
                  {schedule.map((day, idx) => (
                    <tr key={idx} className="hover:bg-sand-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-sand-900 capitalize">
                        {day.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-sand-700">
                        <div className="flex items-center gap-2">
                          <Icon icon="mdi:chef-hat" className="text-warning-500" />
                          <span className="font-semibold">{day.team.boulanger}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-sand-600">
                        <div className="flex flex-wrap gap-1.5">
                          {assistantsRemplis(day.team).map((a, i) => (
                            <span key={i} className="inline-flex px-2 py-0.5 rounded-md bg-sand-100 text-sand-700 text-xs font-medium">{a}</span>
                          ))}
                        </div>
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
