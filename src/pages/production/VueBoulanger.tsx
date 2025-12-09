import React, { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useProductionStore } from '../../store';

export const VueBoulanger: React.FC = () => {
  const { programmeActuel, chargerProgramme } = useProductionStore();

  useEffect(() => {
    // Charger le programme du jour
    const aujourd_hui = new Date();
    chargerProgramme(aujourd_hui);
  }, [chargerProgramme]);

  const totauxParProduit = programmeActuel?.totauxParProduit || [];

  // Fonction pour obtenir l'icône du produit
  const getProductIcon = (productName: string): string => {
    const name = productName?.toLowerCase() || '';
    if (name.includes('baguette')) return 'mdi:baguette';
    if (name.includes('pain')) return 'mdi:bread-slice';
    if (name.includes('croissant')) return 'mdi:croissant';
    if (name.includes('brioche')) return 'mdi:muffin';
    if (name.includes('tarte')) return 'mdi:pie';
    if (name.includes('gateau') || name.includes('gâteau')) return 'mdi:cake';
    if (name.includes('sandwich')) return 'mdi:food';
    if (name.includes('viennoiserie')) return 'mdi:pretzel';
    return 'mdi:food-variant';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header sobre */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
              <Icon icon="mdi:chef-hat" className="text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Vue Boulanger
              </h1>
              <p className="text-sm text-gray-500">
                Programme de production journalier
              </p>
            </div>
          </div>
          {/* Statut simple */}
          {programmeActuel && (
             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
               programmeActuel.statut === 'envoye'
                 ? 'bg-green-50 text-green-700 border-green-200'
                 : 'bg-gray-50 text-gray-700 border-gray-200'
             }`}>
               <Icon
                 icon={programmeActuel.statut === 'envoye' ? 'mdi:check-circle' : 'mdi:clock-outline'}
                 className="text-sm"
               />
               {programmeActuel.statut === 'envoye' ? 'Confirmé' : 'En attente'}
             </div>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {!programmeActuel || totauxParProduit.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon icon="mdi:bread-slice" className="text-3xl text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Pas de production
            </h3>
            <p className="text-gray-500">
              Aucun programme n'a été défini pour le moment.
            </p>
            <button 
              onClick={() => {
                const aujourd_hui = new Date();
                chargerProgramme(aujourd_hui);
              }}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Icon icon="mdi:refresh" className="text-lg" />
              <span>Actualiser</span>
            </button>
          </div>
        ) : (
          <>
            {/* Résumé Total Journée */}
            <div className="bg-gray-700 text-white rounded-xl p-6 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-600 rounded-lg">
                  <Icon icon="mdi:sigma" className="text-2xl" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Total Journée</h2>
                  <p className="text-gray-400 text-sm">Production globale (Matin + Soir)</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold">
                  {totauxParProduit.reduce((acc, p) => acc + (p.repartitionCar1Matin || 0) + (p.repartitionCar2Matin || 0) + (p.repartitionCarSoir || 0), 0)}
                </div>
                <div className="text-gray-400 text-sm font-medium">pièces</div>
              </div>
            </div>

            {/* Section Matin */}
            {totauxParProduit.some(p => (p.repartitionCar1Matin + p.repartitionCar2Matin) > 0) && (
              <section>
                 <div className="flex items-center gap-3 mb-6">
                   <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                      <Icon icon="wi:sunrise" className="text-xl text-gray-500" />
                   </div>
                   <h2 className="text-2xl font-bold text-gray-700">Production du Matin</h2>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                   {totauxParProduit
                     .filter(p => (p.repartitionCar1Matin + p.repartitionCar2Matin) > 0)
                     .map(produit => {
                       const car1 = produit.repartitionCar1Matin;
                       const car2 = produit.repartitionCar2Matin;
                       const total = car1 + car2;
                       
                       return (
                         <div key={`matin-${produit.produitId}`} className="relative bg-white border border-gray-200 border-t-4 border-t-gray-600 rounded-xl p-6 hover:border-gray-300 hover:shadow-md transition-all">
                           <div className="absolute top-3 right-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Matin</div>
                           
                           {/* En-tête Produit */}
                           <div className="flex items-center gap-4 mb-6 pt-2">
                             <div className="w-14 h-14 bg-gray-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                               <Icon icon={getProductIcon(produit.produit?.nom || '')} className="text-2xl text-white" />
                             </div>
                             <h3 className="text-xl font-bold text-gray-900 leading-tight">
                               {produit.produit?.nom || 'Produit'}
                             </h3>
                           </div>
                           
                           {/* Détail Car 1 / Car 2 */}
                           <div className="grid grid-cols-2 gap-4 mb-4">
                             <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                               <div className="text-xs font-bold text-gray-500 uppercase mb-1">Car 1</div>
                               <div className="text-3xl font-bold text-gray-700">{car1}</div>
                             </div>
                             <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                               <div className="text-xs font-bold text-gray-400 uppercase mb-1">Car 2</div>
                               <div className="text-3xl font-bold text-gray-700">{car2}</div>
                             </div>
                           </div>
                           
                           {/* Total Matin */}
                           <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                             <span className="text-sm font-medium text-gray-500">Total Matin</span>
                             <div className="flex items-baseline gap-1">
                               <span className="text-2xl font-bold text-gray-800">{total}</span>
                               <span className="text-sm text-gray-500">pc</span>
                             </div>
                           </div>
                         </div>
                       );
                     })}
                 </div>
              </section>
            )}

            {/* Section Soir */}
            {totauxParProduit.some(p => p.repartitionCarSoir > 0) && (
              <section className="pt-8 border-t border-gray-200">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <Icon icon="wi:sunset" className="text-xl text-gray-600" />
                   </div>
                   <h2 className="text-2xl font-bold text-gray-600">Production du Soir</h2>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                   {totauxParProduit
                     .filter(p => p.repartitionCarSoir > 0)
                     .map(produit => {
                       const total = produit.repartitionCarSoir;
                       return (
                         <div key={`soir-${produit.produitId}`} className="relative bg-white border border-gray-200 border-t-4 border-t-gray-300 rounded-xl p-6 hover:border-gray-300 hover:shadow-md transition-all">
                           <div className="absolute top-3 right-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Soir</div>
                           <div className="flex items-center gap-4 mb-8 pt-2">
                             <div className="w-16 h-16 bg-gray-400 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                               <Icon icon={getProductIcon(produit.produit?.nom || '')} className="text-3xl text-white" />
                             </div>
                             <h3 className="text-xl font-bold text-gray-900 leading-tight">
                               {produit.produit?.nom || 'Produit'}
                             </h3>
                           </div>
                           
                           <div className="text-center mb-2">
                             <div className="text-7xl font-bold text-gray-800 tracking-tight leading-none">{total}</div>
                             <div className="text-lg text-gray-500 font-medium mt-1">pièces</div>
                           </div>
                         </div>
                       );
                     })}
                 </div>
              </section>
            )}
            
            {!totauxParProduit.some(p => (p.repartitionCar1Matin + p.repartitionCar2Matin) > 0) && !totauxParProduit.some(p => p.repartitionCarSoir > 0) && (
               <div className="text-center py-12 text-gray-500">
                  <p>Aucune quantité à produire trouvée dans le programme.</p>
               </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};