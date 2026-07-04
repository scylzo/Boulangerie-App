import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { collection, getDocs, query, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../../firebase/config';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'; // Careful with this!
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import toast from 'react-hot-toast';
import { APP_MODULES } from '../../constants/modules';

// NOTE: Creating users via client-side SDK logs out the current user. 
// A robust solution uses Firebase Admin SDK (Cloud Functions).
// For this MVP without backend, we will warn the user or use a workaround if possible, 
// OR we just create the Firestore document and ask the user to sign up themselves?
// The user explicitly asked "admin screen to create accounts".
// Best "Client Only" approach: 
// 1. Admin fills form.
// 2. We can't use createUserWithEmailAndPassword without losing session.
// 3. Alternative: Create a "Invitation" system? No, too complex.
// 4. Compromise: Admin creates the Firestore "User Profile" with a "pending" status. 
//    The actual Auth account is created when the user first "Registers" with that email?
//    OR we just tell the admin "Adding a user will sign you out".
//    Let's try to see if we can use a secondary app instance.

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';


export const GestionUtilisateurs: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    nom: '',
    prenom: '',
    role: 'livreur',
    permissions: [] as string[]
  });
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; userId: string; userNom: string }>({
    isOpen: false,
    userId: '',
    userNom: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleOpenModal = (user?: any) => {
    if (user) {
      setEditingUser(user);
      setNewUser({
        email: user.email,
        password: '', // Password not editable here
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        permissions: user.permissions || []
      });
    } else {
      setEditingUser(null);
      setNewUser({ email: '', password: '', nom: '', prenom: '', role: 'livreur', permissions: [] });
    }
    setIsModalOpen(true);
    setShowPassword(false);
  };

  const handleSaveUser = async () => {
    setLoading(true);
    try {
      if (editingUser) {
        // Mode Edition (Firestore only)
        const userRef = doc(db, 'users', editingUser.id);
        await setDoc(userRef, {
          ...editingUser,
          nom: newUser.nom,
          prenom: newUser.prenom,
          role: newUser.role,
          permissions: newUser.role === 'admin' ? APP_MODULES.map(m => m.id) : newUser.permissions,
          updatedAt: new Date()
        }, { merge: true });

        toast.success('Utilisateur modifié avec succès');
      } else {
        // Mode Création
        // TRICK: Initialize a secondary app to create user without logging out admin
        const secondaryApp = getApps().find(app => app.name === 'Secondary') 
          || initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
        const user = userCredential.user;

        // Update profile on the Auth object
        await updateProfile(user, {
          displayName: `${newUser.nom} ${newUser.prenom}`
        });

        // Create User Document in Main Firestore
        await setDoc(doc(db, 'users', user.uid), {
          email: newUser.email,
          nom: newUser.nom,
          prenom: newUser.prenom,
          role: newUser.role,
          permissions: newUser.role === 'admin' ? APP_MODULES.map(m => m.id) : newUser.permissions,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // deleteApp(secondaryApp); // Cleanup if possible
        toast.success('Utilisateur créé avec succès');
      }

      setIsModalOpen(false);
      setEditingUser(null);
      setNewUser({ email: '', password: '', nom: '', prenom: '', role: 'livreur', permissions: [] });
      fetchUsers();

    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (userId: string, userNom: string) => {
    setDeleteConfirm({
      isOpen: true,
      userId,
      userNom
    });
  };

  const confirmDeleteUser = async () => {
    try {
      // Note: We can only delete from Firestore here.
      // Deleting from Auth requires Admin SDK or the user to be signed in.
      // We will just mark as inactive or delete from Firestore.
      await deleteDoc(doc(db, 'users', deleteConfirm.userId));
      toast.success('Utilisateur supprimé (Firestore uniquement)');
      fetchUsers();
      setDeleteConfirm({ isOpen: false, userId: '', userNom: '' });
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'admin': return { bg: 'bg-terracotta-100', text: 'text-terracotta-700', icon: 'mdi:shield-crown' };
      case 'livreur': return { bg: 'bg-info-100', text: 'text-info-600', icon: 'mdi:truck-delivery' };
      case 'boulanger': return { bg: 'bg-warning-100', text: 'text-warning-600', icon: 'mdi:chef-hat' };
      case 'vendeuse': return { bg: 'bg-gold-100', text: 'text-gold-600', icon: 'mdi:store' };
      case 'gestionnaire': return { bg: 'bg-success-100', text: 'text-success-700', icon: 'mdi:briefcase-check' };
      default: return { bg: 'bg-sand-100', text: 'text-sand-700', icon: 'mdi:account' };
    }
  };

  const getInitials = (nom: string, prenom: string) => {
    return `${nom?.charAt(0) || ''}${prenom?.charAt(0) || ''}`.toUpperCase();
  };

  return (
    <div className="min-h-screen bg-sand-100">
      {/* Header Responsive */}
      <div className="bg-white border-b border-sand-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-terracotta-50 rounded-xl flex items-center justify-center shrink-0">
              <Icon icon="mdi:account-key-outline" className="text-lg sm:text-2xl text-terracotta-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-base sm:text-2xl font-semibold text-sand-900 truncate">
                Utilisateurs
              </h1>
              <p className="text-xs sm:text-sm text-sand-500 truncate">
                {users.length} compte(s) · rôles & permissions par module
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Icon icon="mdi:magnify" className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400 text-lg" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full sm:w-48 pl-10 pr-3 py-2 border border-sand-300 rounded-lg bg-white text-sm text-sand-900 focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg transition-all shadow-soft text-sm font-medium whitespace-nowrap"
            >
              <Icon icon="mdi:account-plus" className="text-lg" />
              <span className="hidden sm:inline">Nouvel utilisateur</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenu Principal */}
      <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">

        {/* Liste des utilisateurs (Cards) */}
        {!users || users.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-white rounded-xl border border-sand-200 shadow-sm">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-sand-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Icon icon="mdi:account-off-outline" className="text-3xl sm:text-4xl text-sand-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-sand-900 mb-2 sm:mb-3">
              Aucun utilisateur trouvé
            </h3>
            <p className="text-sm sm:text-base text-sand-500 mb-6 sm:mb-8 max-w-md mx-auto px-4">
              Commencez par ajouter des utilisateurs pour gérer les accès à l'application.
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-terracotta-600 hover:bg-terracotta-700 text-white rounded-lg transition-all shadow-sm font-medium"
            >
              <Icon icon="mdi:plus" className="text-lg" />
              Ajouter un utilisateur
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-sand-200 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-sand-500 border-b border-sand-200 bg-sand-50">
                    <th className="font-semibold px-4 py-3">Utilisateur</th>
                    <th className="font-semibold px-4 py-3">Email</th>
                    <th className="font-semibold px-4 py-3">Rôle</th>
                    <th className="font-semibold px-4 py-3">Permissions</th>
                    <th className="font-semibold px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter((u) => {
                      const q = search.toLowerCase().trim();
                      if (!q) return true;
                      return `${u.nom || ''} ${u.prenom || ''}`.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q);
                    })
                    .map((user) => {
                      const roleStyle = getRoleStyle(user.role);
                      const nbPerms = user.role === 'admin' ? APP_MODULES.length : (user.permissions?.length || 0);
                      return (
                        <tr key={user.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 bg-sand-900 text-white rounded-lg flex items-center justify-center font-semibold text-sm shrink-0">
                                {getInitials(user.nom, user.prenom)}
                              </div>
                              <span className="font-medium text-sand-900 truncate">{user.nom} {user.prenom}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sand-600 truncate max-w-[220px]">{user.email}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${roleStyle.bg} ${roleStyle.text}`}>
                              <Icon icon={roleStyle.icon} className="text-sm" />
                              {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Utilisateur'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sand-600">
                            {user.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1 text-terracotta-600"><Icon icon="mdi:shield-check" className="text-sm" />Tous les modules</span>
                            ) : (
                              <span>{nbPerms} module{nbPerms > 1 ? 's' : ''}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenModal(user)}
                                className="w-8 h-8 rounded-lg text-sand-500 hover:bg-sand-100 hover:text-sand-900 flex items-center justify-center transition-colors"
                                title="Modifier"
                              >
                                <Icon icon="mdi:pencil-outline" className="text-lg" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id, `${user.nom} ${user.prenom}`)}
                                className="w-8 h-8 rounded-lg text-sand-500 hover:bg-danger-50 hover:text-danger-600 flex items-center justify-center transition-colors"
                                title="Supprimer"
                              >
                                <Icon icon="mdi:trash-can-outline" className="text-lg" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}
        position="center"
        size="md" // Taille adaptée
      >
        <div className="space-y-4 sm:space-y-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-sand-700">Nom</label>
              <input
                type="text"
                value={newUser.nom}
                onChange={(e) => setNewUser({ ...newUser, nom: e.target.value })}
                className="w-full px-3 py-2 border border-sand-300 rounded-lg focus:ring-terracotta-500 focus:border-terracotta-500 sm:text-sm transition-colors"
                placeholder="Ex: Ndiaye"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-sand-700">Prénom</label>
              <input
                type="text"
                value={newUser.prenom}
                onChange={(e) => setNewUser({ ...newUser, prenom: e.target.value })}
                className="w-full px-3 py-2 border border-sand-300 rounded-lg focus:ring-terracotta-500 focus:border-terracotta-500 sm:text-sm transition-colors"
                placeholder="Ex: Moussa"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-sand-700">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon icon="mdi:email-outline" className="text-sand-400" />
              </div>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                disabled={!!editingUser}
                className={`w-full pl-10 px-3 py-2 border border-sand-300 rounded-lg focus:ring-terracotta-500 focus:border-terracotta-500 sm:text-sm transition-colors ${editingUser ? "bg-sand-100 text-sand-500 cursor-not-allowed" : ""}`}
                placeholder="Ex: nom@boulangerie.sn"
              />
            </div>
          </div>

          {!editingUser && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-sand-700">Mot de passe</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon icon="mdi:lock-outline" className="text-sand-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full pl-10 pr-10 px-3 py-2 border border-sand-300 rounded-lg focus:ring-terracotta-500 focus:border-terracotta-500 sm:text-sm transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sand-400 hover:text-sand-600 focus:outline-none"
                  tabIndex={-1}
                >
                  <Icon icon={showPassword ? "mdi:eye-off-outline" : "mdi:eye-outline"} className="text-xl" />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-sand-700">Rôle</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon icon="mdi:badge-account-outline" className="text-sand-400" />
              </div>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full pl-10 px-3 py-2 border border-sand-300 rounded-lg focus:ring-terracotta-500 focus:border-terracotta-500 sm:text-sm transition-colors appearance-none bg-white"
              >
                <option value="livreur">Livreur</option>
                <option value="vendeuse">Vendeuse</option>
                <option value="boulanger">Boulanger</option>
                <option value="gestionnaire">Gestionnaire</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
          </div>

          {/* SECTION PERMISSIONS MODULES */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 pb-1 border-b border-sand-100">
              <Icon icon="mdi:shield-lock-outline" className="text-terracotta-600" />
              <label className="text-sm font-semibold text-sand-700 uppercase tracking-wider">Modules accessibles</label>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 bg-sand-50 p-4 rounded-xl border border-sand-100 max-h-60 overflow-y-auto">
              {newUser.role === 'admin' ? (
                <div className="col-span-full py-4 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-terracotta-100 text-terracotta-700 rounded-lg text-sm font-semibold">
                    <Icon icon="mdi:shield-check" className="text-lg" />
                    L'administrateur a accès à TOUS les modules par défaut
                  </div>
                </div>
              ) : (
                APP_MODULES.map((module) => (
                  <label key={module.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg transition-colors cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={newUser.permissions.includes(module.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setNewUser(prev => ({
                          ...prev,
                          permissions: checked 
                            ? [...prev.permissions, module.id]
                            : prev.permissions.filter(id => id !== module.id)
                        }));
                      }}
                      className="w-5 h-5 text-terracotta-600 border-sand-300 rounded focus:ring-terracotta-500 transition-all cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <Icon icon={module.icon} className={`text-lg ${newUser.permissions.includes(module.id) ? 'text-terracotta-600' : 'text-sand-400'} transition-transform`} />
                      <span className={`text-sm font-medium ${newUser.permissions.includes(module.id) ? 'text-sand-900' : 'text-sand-500'}`}>
                        {module.name}
                      </span>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 gap-3">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-sand-300 rounded-lg text-sm font-medium text-sand-700 hover:bg-sand-50 transition-colors"
            >
              Annuler
            </button>
            <Button onClick={handleSaveUser} isLoading={loading} className="px-4 py-2 bg-terracotta-600 hover:bg-terracotta-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors">
              {editingUser ? "Enregistrer" : "Créer l'utilisateur"}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, userId: '', userNom: '' })}
        onConfirm={confirmDeleteUser}
        title="Confirmer la suppression"
        message={`Êtes-vous sûr de vouloir supprimer l'utilisateur "${deleteConfirm.userNom}" ?\n\nCette action supprimera uniquement les données Firestore. Le compte Auth Firebase restera actif.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        type="danger"
        position="center"
      />
    </div>
  );
};
