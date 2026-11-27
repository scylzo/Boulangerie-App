import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../firebase/config';
import type { Client, Facture } from '../../types';

type PeriodeQuinzaine = 'q1' | 'q2' | 'mois';

interface TableauRecouvrementProps {
  factures: Facture[];
  clients: Client[];
  selectedMonth: Date;
  onChangeMonth: (delta: number) => void;
  onOpenClient: (client: Client) => void;
}

interface LigneRecouvrement {
  clientId: string;
  client?: Client;
  clientNom: string;
  dateLabel: string;
  montantFacture: number;
  paiementEspeces: number;
  paiementWave: number;
  paiementOm: number;
  totalPaye: number;
  resteAPayer: number;
  statut: 'payee' | 'partiel' | 'impayee';
  nbFactures: number;
}

const getStatutScore = (statut: string) => {
  switch (statut) {
    case 'payee': return 5;
    case 'partiellement_payee': return 4;
    case 'envoyee': return 3;
    case 'validee': return 2;
    case 'en_attente_retours': return 1;
    default: return 0;
  }
};

export const TableauRecouvrement: React.FC<TableauRecouvrementProps> = ({
  factures,
  clients,
  selectedMonth,
  onChangeMonth,
  onOpenClient
}) => {
  const [periodeType, setPeriodeType] = useState<PeriodeQuinzaine>(() => {
    const today = new Date();
    const sameMonth =
      today.getFullYear() === selectedMonth.getFullYear() &&
      today.getMonth() === selectedMonth.getMonth();
    if (sameMonth && today.getDate() > 15) return 'q2';
    return 'q1';
  });
  const [filtreStatut, setFiltreStatut] = useState<'tous' | 'impayes' | 'payes'>('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [commentaires, setCommentaires] = useState<Record<string, string>>({});
  const [savingClientId, setSavingClientId] = useState<string | null>(null);

  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  const { startDate, endDate, dateLabel, periodeKey } = useMemo(() => {
    const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (periodeType === 'q1') {
      return {
        startDate: new Date(year, month, 1, 0, 0, 0, 0),
        endDate: new Date(year, month, 15, 23, 59, 59, 999),
        dateLabel: '01 au 15',
        periodeKey: `${ym}_q1`
      };
    }
    if (periodeType === 'q2') {
      return {
        startDate: new Date(year, month, 16, 0, 0, 0, 0),
        endDate: new Date(year, month, lastDayOfMonth, 23, 59, 59, 999),
        dateLabel: `16 au ${lastDayOfMonth}`,
        periodeKey: `${ym}_q2`
      };
    }
    return {
      startDate: new Date(year, month, 1, 0, 0, 0, 0),
      endDate: new Date(year, month, lastDayOfMonth, 23, 59, 59, 999),
      dateLabel: `01 au ${lastDayOfMonth}`,
      periodeKey: `${ym}_mois`
    };
  }, [year, month, lastDayOfMonth, periodeType]);

  // Charger les commentaires sauvegardés pour cette période
  useEffect(() => {
    let cancelled = false;
    const chargerCommentaires = async () => {
      try {
        const q = query(
          collection(db, 'recouvrementNotes'),
          where('periodeKey', '==', periodeKey)
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const map: Record<string, string> = {};
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.clientId && typeof data.commentaire === 'string') {
            map[data.clientId] = data.commentaire;
          }
        });
        setCommentaires(map);
      } catch (err) {
        console.warn('Chargement commentaires recouvrement:', err);
      }
    };
    chargerCommentaires();
    return () => { cancelled = true; };
  }, [periodeKey]);

  const sauvegarderCommentaire = async (clientId: string, texte: string) => {
    setSavingClientId(clientId);
    try {
      const docId = `${periodeKey}_${clientId}`;
      await setDoc(
        doc(db, 'recouvrementNotes', docId),
        {
          periodeKey,
          clientId,
          commentaire: texte.trim(),
          updatedAt: new Date()
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Erreur sauvegarde commentaire:', err);
      toast.error('Impossible de sauvegarder le commentaire');
    } finally {
      setSavingClientId(null);
    }
  };

  // Construction des lignes par client sur la période sélectionnée
  const { lignes, hasOm } = useMemo(() => {
    // 1. Filtrer factures valides dans la plage et dédoublonner par (clientId, jour)
    const uniqueMap = new Map<string, Facture>();
    factures.forEach(f => {
      if (f.statut === 'annulee') return;
      const d = new Date(f.dateLivraison);
      if (isNaN(d.getTime()) || d < startDate || d > endDate) return;
      const dayKey = d.toISOString().split('T')[0];
      const key = `${f.clientId}_${dayKey}`;
      const existing = uniqueMap.get(key);
      if (!existing) {
        uniqueMap.set(key, f);
      } else {
        const sNew = getStatutScore(f.statut);
        const sOld = getStatutScore(existing.statut);
        if (sNew > sOld || (sNew === sOld && new Date(f.updatedAt).getTime() > new Date(existing.updatedAt).getTime())) {
          uniqueMap.set(key, f);
        }
      }
    });

    // 2. Agréger par client
    const byClient = new Map<string, LigneRecouvrement>();
    let anyOm = false;

    uniqueMap.forEach(f => {
      const clientObj = clients.find(c => c.id === f.clientId) || f.client;
      const clientNom = clientObj
        ? [clientObj.prenom, clientObj.nom].filter(Boolean).join(' ').trim() || clientObj.nom
        : 'Client inconnu';

      let row = byClient.get(f.clientId);
      if (!row) {
        row = {
          clientId: f.clientId,
          client: clientObj,
          clientNom,
          dateLabel,
          montantFacture: 0,
          paiementEspeces: 0,
          paiementWave: 0,
          paiementOm: 0,
          totalPaye: 0,
          resteAPayer: 0,
          statut: 'impayee',
          nbFactures: 0
        };
        byClient.set(f.clientId, row);
      }

      const netFacture = f.netAPayer ?? f.totalTTC ?? 0;
      row.montantFacture += netFacture;
      row.nbFactures += 1;

      if (f.reglements && f.reglements.length > 0) {
        f.reglements.forEach(r => {
          const mt = Number(r.montant) || 0;
          if (r.mode === 'espece') row!.paiementEspeces += mt;
          else if (r.mode === 'wave') row!.paiementWave += mt;
          else if (r.mode === 'om') {
            row!.paiementOm += mt;
            if (mt > 0) anyOm = true;
          }
        });
      } else if (f.statut === 'payee' || (f.montantRegle && f.montantRegle > 0)) {
        // Rétrocompatibilité si paiement enregistré sans tableau reglements détaillé
        const mt = f.montantRegle ?? netFacture;
        if (f.modePaiement === 'wave') row.paiementWave += mt;
        else if (f.modePaiement === 'om') {
          row.paiementOm += mt;
          if (mt > 0) anyOm = true;
        } else {
          row.paiementEspeces += mt;
        }
      }
    });

    const result = Array.from(byClient.values()).map(row => {
      const totalPaye = row.paiementEspeces + row.paiementWave + row.paiementOm;
      const reste = Math.max(0, Math.round(row.montantFacture - totalPaye));
      const statut: LigneRecouvrement['statut'] =
        reste <= 0 && row.montantFacture > 0
          ? 'payee'
          : totalPaye > 0
          ? 'partiel'
          : 'impayee';
      return {
        ...row,
        montantFacture: Math.round(row.montantFacture),
        paiementEspeces: Math.round(row.paiementEspeces),
        paiementWave: Math.round(row.paiementWave),
        paiementOm: Math.round(row.paiementOm),
        totalPaye: Math.round(totalPaye),
        resteAPayer: reste,
        statut
      };
    });

    result.sort((a, b) => a.clientNom.localeCompare(b.clientNom, 'fr', { sensitivity: 'base' }));
    return { lignes: result, hasOm: anyOm };
  }, [factures, clients, startDate, endDate, dateLabel]);

  const lignesFiltrees = useMemo(() => {
    return lignes.filter(l => {
      if (filtreStatut === 'impayes' && l.resteAPayer <= 0) return false;
      if (filtreStatut === 'payes' && l.resteAPayer > 0) return false;
      if (searchTerm.trim() && !l.clientNom.toLowerCase().includes(searchTerm.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [lignes, filtreStatut, searchTerm]);

  const totaux = useMemo(() => {
    return lignesFiltrees.reduce(
      (acc, l) => ({
        montantFacture: acc.montantFacture + l.montantFacture,
        paiementEspeces: acc.paiementEspeces + l.paiementEspeces,
        paiementWave: acc.paiementWave + l.paiementWave,
        paiementOm: acc.paiementOm + l.paiementOm,
        resteAPayer: acc.resteAPayer + l.resteAPayer
      }),
      { montantFacture: 0, paiementEspeces: 0, paiementWave: 0, paiementOm: 0, resteAPayer: 0 }
    );
  }, [lignesFiltrees]);

  const fmtNum = (n: number) => (n > 0 ? Math.round(n).toLocaleString('fr-FR') : '');
  const fmtPdfNum = (n: number) => (n > 0 ? Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '');

  const exporterPDF = () => {
    const docPdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const moisNom = selectedMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    docPdf.setFontSize(14);
    docPdf.setFont('helvetica', 'bold');
    docPdf.setTextColor(39, 94, 66);
    docPdf.text(`SUIVI DES PAIEMENTS CLIENTS — ${dateLabel.toUpperCase()} (${moisNom.toUpperCase()})`, 14, 15);

    docPdf.setFontSize(8.5);
    docPdf.setFont('helvetica', 'normal');
    docPdf.setTextColor(100, 100, 100);
    docPdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 283, 15, { align: 'right' });

    const headRow = hasOm
      ? ['CLIENT', 'DATE FACTURE', 'MONTANT FACTURE', 'PAIEMENT ESPÈCES', 'PAIEMENT WAVE', 'PAIEMENT OM', 'PAYÉ', 'NON PAYÉ', 'RESTE À PAYER', 'COMMENTAIRE']
      : ['CLIENT', 'DATE FACTURE', 'MONTANT FACTURE', 'PAIEMENT ESPÈCES', 'PAIEMENT WAVE', 'PAYÉ', 'NON PAYÉ', 'RESTE À PAYER', 'COMMENTAIRE'];

    const bodyRows = lignesFiltrees.map(l => {
      const comm = commentaires[l.clientId] || '';
      if (hasOm) {
        return [
          l.clientNom.toUpperCase(),
          l.dateLabel,
          fmtPdfNum(l.montantFacture),
          fmtPdfNum(l.paiementEspeces),
          fmtPdfNum(l.paiementWave),
          fmtPdfNum(l.paiementOm),
          l.statut === 'payee' ? 'X' : '',
          l.statut !== 'payee' ? 'X' : '',
          fmtPdfNum(l.resteAPayer),
          comm
        ];
      }
      return [
        l.clientNom.toUpperCase(),
        l.dateLabel,
        fmtPdfNum(l.montantFacture),
        fmtPdfNum(l.paiementEspeces),
        fmtPdfNum(l.paiementWave),
        l.statut === 'payee' ? 'X' : '',
        l.statut !== 'payee' ? 'X' : '',
        fmtPdfNum(l.resteAPayer),
        comm
      ];
    });

    const totalRow = hasOm
      ? ['TOTAL', '', fmtPdfNum(totaux.montantFacture), fmtPdfNum(totaux.paiementEspeces), fmtPdfNum(totaux.paiementWave), fmtPdfNum(totaux.paiementOm), '', '', fmtPdfNum(totaux.resteAPayer), '']
      : ['TOTAL', '', fmtPdfNum(totaux.montantFacture), fmtPdfNum(totaux.paiementEspeces), fmtPdfNum(totaux.paiementWave), '', '', fmtPdfNum(totaux.resteAPayer), ''];

    bodyRows.push(totalRow);

    const montantColIdx = 2;
    const espColIdx = 3;
    const waveColIdx = 4;
    const omColIdx = hasOm ? 5 : -1;
    const resteColIdx = hasOm ? 8 : 7;

    autoTable(docPdf, {
      startY: 20,
      head: [headRow],
      body: bodyRows,
      theme: 'grid',
      headStyles: {
        fillColor: [39, 94, 66],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 8
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 2.2,
        valign: 'middle',
        lineColor: [180, 180, 180],
        lineWidth: 0.2
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'left', cellWidth: 44 },
        1: { halign: 'center', textColor: [37, 99, 235], cellWidth: 22 },
        2: { halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28], cellWidth: 26 },
        3: { halign: 'right', textColor: [126, 34, 206], cellWidth: 26 },
        4: { halign: 'right', textColor: [126, 34, 206], cellWidth: 26 },
        ...(hasOm
          ? {
              5: { halign: 'right', textColor: [194, 65, 12], cellWidth: 24 },
              6: { halign: 'center', cellWidth: 14 },
              7: { halign: 'center', cellWidth: 16 },
              8: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38], cellWidth: 26 },
              9: { halign: 'left' }
            }
          : {
              5: { halign: 'center', cellWidth: 15 },
              6: { halign: 'center', cellWidth: 18 },
              7: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38], cellWidth: 26 },
              8: { halign: 'left' }
            })
      },
      didParseCell: data => {
        if (data.section === 'body' && data.row.index === bodyRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [245, 245, 244];
          if (data.column.index === montantColIdx) data.cell.styles.textColor = [20, 20, 20];
          if (data.column.index === espColIdx || data.column.index === waveColIdx) data.cell.styles.textColor = [126, 34, 206];
          if (data.column.index === omColIdx) data.cell.styles.textColor = [194, 65, 12];
          if (data.column.index === resteColIdx) data.cell.styles.textColor = [220, 38, 38];
        }
      }
    });

    docPdf.save(`Recouvrement_${periodeKey}.pdf`);
  };

  return (
    <div className="space-y-4">
      {/* Barre de contrôle : Mois + Quinzaine + Filtres + Export PDF */}
      <div className="bg-white rounded-2xl border border-sand-200 shadow-card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Sélecteur de mois + Quinzaine */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1 bg-sand-50 p-1 rounded-xl border border-sand-200">
              <button
                onClick={() => onChangeMonth(-1)}
                className="p-1.5 hover:bg-white rounded-lg text-sand-600 transition-colors"
                title="Mois précédent"
              >
                <Icon icon="mdi:chevron-left" className="text-lg" />
              </button>
              <span className="font-semibold text-sand-900 text-xs sm:text-sm min-w-[125px] text-center capitalize">
                {selectedMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => onChangeMonth(1)}
                className="p-1.5 hover:bg-white rounded-lg text-sand-600 transition-colors"
                title="Mois suivant"
              >
                <Icon icon="mdi:chevron-right" className="text-lg" />
              </button>
            </div>

            <div className="flex items-center p-1 rounded-xl bg-sand-100 border border-sand-200 gap-1">
              {([
                { id: 'q1' as const, label: '01 au 15' },
                { id: 'q2' as const, label: `16 au ${lastDayOfMonth}` },
                { id: 'mois' as const, label: 'Mois complet' }
              ]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setPeriodeType(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    periodeType === opt.id
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-sand-600 hover:text-sand-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recherche + Statut + PDF */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-52">
              <Icon icon="mdi:magnify" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sand-400 text-base" />
              <input
                type="text"
                placeholder="Filtrer un client..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-sand-50 border border-sand-200 rounded-lg focus:bg-white focus:border-sand-900 outline-none"
              />
            </div>

            <select
              value={filtreStatut}
              onChange={e => setFiltreStatut(e.target.value as 'tous' | 'impayes' | 'payes')}
              className="px-2.5 py-1.5 text-xs font-medium bg-sand-50 border border-sand-200 rounded-lg text-sand-700 outline-none"
            >
              <option value="tous">Tous ({lignes.length})</option>
              <option value="impayes">Reste à payer ({lignes.filter(l => l.resteAPayer > 0).length})</option>
              <option value="payes">Soldés ({lignes.filter(l => l.resteAPayer <= 0).length})</option>
            </select>

            <button
              onClick={exporterPDF}
              disabled={lignesFiltrees.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-40"
            >
              <Icon icon="mdi:file-pdf-box" className="text-base" />
              <span>Exporter PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tableau récapitulatif inspiré du suivi Excel */}
      <div className="bg-white rounded-2xl border border-sand-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[820px]">
            <thead>
              <tr className="bg-emerald-900 text-white text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3.5 text-left font-bold">Client</th>
                <th className="py-3 px-2.5 text-center font-bold">Date Facture</th>
                <th className="py-3 px-3 text-right font-bold">Montant Facture</th>
                <th className="py-3 px-3 text-right font-bold">Paiement Espèces</th>
                <th className="py-3 px-3 text-right font-bold">Paiement Wave</th>
                {hasOm && <th className="py-3 px-3 text-right font-bold">Paiement OM</th>}
                <th className="py-3 px-2.5 text-center font-bold">Statut</th>
                <th className="py-3 px-3 text-right font-bold">Reste à Payer</th>
                <th className="py-3 px-3.5 text-left font-bold min-w-[200px]">Commentaire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200 tabular-nums">
              {lignesFiltrees.length === 0 ? (
                <tr>
                  <td colSpan={hasOm ? 9 : 8} className="py-10 text-center text-sand-500">
                    Aucune facture client sur la période <strong>{dateLabel}</strong>.
                  </td>
                </tr>
              ) : (
                lignesFiltrees.map(row => (
                  <tr key={row.clientId} className="hover:bg-sand-50/80 transition-colors">
                    <td className="py-2.5 px-3.5 font-bold text-sand-900">
                      <button
                        type="button"
                        onClick={() => row.client && onOpenClient(row.client)}
                        className="text-left uppercase hover:text-terracotta-600 hover:underline transition-colors"
                        title="Ouvrir les factures de ce client pour encaisser un règlement"
                      >
                        {row.clientNom}
                      </button>
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-medium text-blue-700 whitespace-nowrap">
                      {row.dateLabel}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-800 whitespace-nowrap">
                      {fmtNum(row.montantFacture)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-purple-700 whitespace-nowrap">
                      {fmtNum(row.paiementEspeces) || <span className="text-sand-300">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-purple-700 whitespace-nowrap">
                      {fmtNum(row.paiementWave) || <span className="text-sand-300">—</span>}
                    </td>
                    {hasOm && (
                      <td className="py-2.5 px-3 text-right font-semibold text-amber-700 whitespace-nowrap">
                        {fmtNum(row.paiementOm) || <span className="text-sand-300">—</span>}
                      </td>
                    )}
                    <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                      {row.statut === 'payee' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Payé
                        </span>
                      ) : row.statut === 'partiel' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Partiel
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          Non payé
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-red-600 whitespace-nowrap">
                      {fmtNum(row.resteAPayer) || <span className="text-sand-300">—</span>}
                    </td>
                    <td className="py-1.5 px-2.5">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={commentaires[row.clientId] || ''}
                          onChange={e =>
                            setCommentaires(prev => ({ ...prev, [row.clientId]: e.target.value }))
                          }
                          onBlur={e => sauvegarderCommentaire(row.clientId, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          placeholder="Ex: à payer le 19 nov..."
                          className="w-full px-2 py-1 text-xs bg-transparent hover:bg-sand-50 focus:bg-white border border-transparent focus:border-sand-300 rounded-md text-sand-800 placeholder:text-sand-300 outline-none transition-all"
                        />
                        {savingClientId === row.clientId && (
                          <Icon icon="mdi:loading" className="w-3.5 h-3.5 text-sand-400 animate-spin absolute right-1.5" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {lignesFiltrees.length > 0 && (
              <tfoot>
                <tr className="bg-sand-100 border-t-2 border-sand-300 font-extrabold text-sand-900 tabular-nums text-xs sm:text-sm">
                  <td className="py-3 px-3.5">TOTAL ({lignesFiltrees.length} clients)</td>
                  <td className="py-3 px-2.5 text-center text-xs text-sand-500">{dateLabel}</td>
                  <td className="py-3 px-3 text-right text-sand-900 whitespace-nowrap">
                    {totaux.montantFacture.toLocaleString('fr-FR')}
                  </td>
                  <td className="py-3 px-3 text-right text-purple-800 whitespace-nowrap">
                    {totaux.paiementEspeces.toLocaleString('fr-FR')}
                  </td>
                  <td className="py-3 px-3 text-right text-purple-800 whitespace-nowrap">
                    {totaux.paiementWave.toLocaleString('fr-FR')}
                  </td>
                  {hasOm && (
                    <td className="py-3 px-3 text-right text-amber-800 whitespace-nowrap">
                      {totaux.paiementOm.toLocaleString('fr-FR')}
                    </td>
                  )}
                  <td className="py-3 px-2.5"></td>
                  <td className="py-3 px-3 text-right text-red-600 whitespace-nowrap">
                    {totaux.resteAPayer.toLocaleString('fr-FR')}
                  </td>
                  <td className="py-3 px-3.5 text-[11px] font-normal text-sand-500">
                    Cliquez sur un client pour encaisser
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
