import React, { useState } from 'react';
import { useStockStore } from '../../store/stockStore';
import { ArrowDownLeft, ArrowUpRight, Search } from 'lucide-react';
import type { MouvementStock } from '../../types';

export const MouvementsList: React.FC = () => {
  const { mouvements, matieres } = useStockStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Enrichir les mouvements avec le nom de la matière et la valeur estimée
  const enrichedMouvements = mouvements.map(m => {
    const matiere = matieres.find(mat => mat.id === m.matiereId);
    
    // Si pas de prix total enregistré (ancien historique), on l'estime avec le PMP actuel
    // uniquement pour consommation/perte pour être cohérent avec le dashboard
    let displayPrice = m.prixTotal;
    if (!displayPrice && matiere && ['consommation', 'perte'].includes(m.type)) {
        displayPrice = Math.abs(m.quantite) * matiere.prixMoyenPondere;
    }

    return {
      ...m,
      matiereNom: matiere ? matiere.nom : 'Article Inconnu',
      matiereUnite: matiere ? matiere.unite : '',
      displayPrice // Nouvelle propriété pour l'affichage
    };
  });

  const filteredMouvements = enrichedMouvements.filter(m => 
    m.matiereNom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.motif && m.motif.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getTypeStyle = (type: MouvementStock['type']) => {
    switch (type) {
      case 'achat':
        return 'bg-green-100 text-green-800';
      case 'consommation':
        return 'bg-blue-100 text-blue-800';
      case 'perte':
        return 'bg-red-100 text-red-800';
      case 'correction':
        return 'bg-gray-100 text-gray-800';
      case 'retour_fournisseur':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getIcon = (type: MouvementStock['type']) => {
    if (type === 'achat') return <ArrowDownLeft size={16} className="mr-1" />;
    return <ArrowUpRight size={16} className="mr-1" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">Historique des Mouvements</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Article</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Auteur / Resp.</th>
              <th className="px-6 py-3 text-right">Quantité</th>
              <th className="px-6 py-3 text-right">Prix Total</th>
              <th className="px-6 py-3">Motif / Réf</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredMouvements.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(m.date).toLocaleDateString('fr-FR')} <span className="text-xs">{new Date(m.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {m.matiereNom}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeStyle(m.type)}`}>
                    {getIcon(m.type)}
                    {m.type === 'achat' ? 'Entrée' : m.type.charAt(0).toUpperCase() + m.type.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="font-medium">{m.auteur || 'Inconnu'}</div>
                  {m.responsable && <div className="text-xs text-gray-500 text-green-600">Validé par: {m.responsable}</div>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  {/* Affichage Quantité */}
                  <div className="font-medium text-gray-900">
                      {m.quantite.toLocaleString('fr-FR')} {m.matiereUnite}
                  </div>
                  {/* Parsing du motif pour afficher les sacs si présents */}
                  {(() => {
                      const sacMatch = m.motif && m.motif.match(/(\d+)\s*sacs?/i);
                      const weightMatch = m.motif && m.motif.match(/de\s*(\d+)/i); // Cherche "de 50" dans "sacs de 50kg"
                      
                      if (sacMatch) {
                          return (
                              <div className="text-xs text-blue-600 font-medium">
                                  {sacMatch[1]} sacs {weightMatch ? `de ${weightMatch[1]}kg` : ''}
                              </div>
                          );
                      }
                      return null;
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {m.displayPrice ? `${m.displayPrice.toLocaleString()} FCFA` : '-'}
                  {/* Indicateur si c'est une estimation */}
                  {!m.prixTotal && m.displayPrice && <span className="text-xs text-gray-400 ml-1">(est.)</span>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div className="flex flex-col">
                    <span>{m.motif || '-'}</span>
                    {m.referenceDocument && (
                      <span className="text-xs text-gray-400">Réf: {m.referenceDocument}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredMouvements.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  Aucun mouvement trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
