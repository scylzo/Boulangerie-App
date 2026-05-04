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

import { initializeApp, getApp, getApps } from 'firebase/app';
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
      case 'admin': return { bg: 'bg-purple-100', text: 'text-purple-700', icon: 'mdi:shield-crown' };
      case 'livreur': return { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'mdi:truck-delivery' };
      case 'boulanger': return { bg: 'bg-orange-100', text: 'text-orange-700', icon: 'mdi:chef-hat' };
      case 'vendeuse': return { bg: 'bg-pink-100', text: 'text-pink-700', icon: 'mdi:store' };
      case 'gestionnaire': return { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: 'mdi:briefcase-check' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-700', icon: 'mdi:account' };
    }
  };

  const getInitials = (nom: string, prenom: string) => {
    return `${nom?.charAt(0) || ''}${prenom?.charAt(0) || ''}`.toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Responsive */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <Icon icon="mdi:account-group-outline" className="text-lg sm:text-2xl text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-semibold text-gray-900 truncate">
                Gestion des Utilisateurs
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                Gestion des accès utilisateurs
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm text-xs sm:text-sm font-medium w-full sm:w-auto"
          >
            <Icon icon="mdi:account-plus" className="text-base sm:text-lg" />
            <span>Nouvel Utilisateur</span>
          </button>
        </div>
      </div>

      {/* Contenu Principal */}
      <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">

        {/* Liste des utilisateurs (Cards) */}
        {!users || users.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Icon icon="mdi:account-off-outline" className="text-3xl sm:text-4xl text-gray-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">
              Aucun utilisateur trouvé
            </h3>
            <p className="text-sm sm:text-base text-gray-500 mb-6 sm:mb-8 max-w-md mx-auto px-4">
              Commencez par ajouter des utilisateurs pour gérer les accès à l'application.
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm font-medium"
            >
              <Icon icon="mdi:plus" className="text-lg" />
              Ajouter un utilisateur
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {users.map((user) => {
              const roleStyle = getRoleStyle(user.role);
              return (
                <div key={user.id} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 hover:border-indigo-300 hover:shadow-md transition-all duration-200 group flex flex-col">
                  {/* Header Card */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 w-full overflow-hidden">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-full flex items-center justify-center shrink-0 border border-gray-200 text-gray-600 font-bold text-sm sm:text-base">
                        {getInitials(user.nom, user.prenom)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate" title={`${user.nom} ${user.prenom}`}>
                          {user.nom} {user.prenom}
                        </h3>
                        <p className="text-xs text-gray-500 truncate" title={user.email}>
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <div className="mb-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleStyle.bg} ${roleStyle.text}`}>
                      <Icon icon={roleStyle.icon} className="text-sm" />
                      {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Utilisateur'}
                    </span>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-auto flex gap-2 pt-4 border-t border-gray-50">
                    <button
                      onClick={() => handleOpenModal(user)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all text-xs sm:text-sm font-medium"
                    >
                      <Icon icon="mdi:pencil" className="text-base" />
                      <span>Modifier</span>
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id, `${user.nom} ${user.prenom}`)}
                      className="flex items-center justify-center px-3 py-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
                      title="Supprimer"
                    >
                      <Icon icon="mdi:trash-can-outline" className="text-lg" />
                    </button>
                  </div>
                </div>
              );
            })}
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
              <label className="block text-sm font-medium text-gray-700">Nom</label>
              <input
                type="text"
                value={newUser.nom}
                onChange={(e) => setNewUser({ ...newUser, nom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                placeholder="Ex: Ndiaye"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Prénom</label>
              <input
                type="text"
                value={newUser.prenom}
                onChange={(e) => setNewUser({ ...newUser, prenom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                placeholder="Ex: Moussa"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon icon="mdi:email-outline" className="text-gray-400" />
              </div>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                disabled={!!editingUser}
                className={`w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors ${editingUser ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                placeholder="Ex: nom@boulangerie.sn"
              />
            </div>
          </div>

          {!editingUser && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icon icon="mdi:lock-outline" className="text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full pl-10 pr-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  tabIndex={-1}
                >
                  <Icon icon={showPassword ? "mdi:eye-off-outline" : "mdi:eye-outline"} className="text-xl" />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Rôle</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon icon="mdi:badge-account-outline" className="text-gray-400" />
              </div>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors appearance-none bg-white"
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
            <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
              <Icon icon="mdi:shield-lock-outline" className="text-indigo-600" />
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Modules accessibles</label>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100 max-h-60 overflow-y-auto">
              {newUser.role === 'admin' ? (
                <div className="col-span-full py-4 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold">
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
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 transition-all cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <Icon icon={module.icon} className={`text-lg ${newUser.permissions.includes(module.id) ? 'text-indigo-600' : 'text-gray-400'} group-hover:scale-110 transition-transform`} />
                      <span className={`text-sm font-medium ${newUser.permissions.includes(module.id) ? 'text-gray-900' : 'text-gray-500'}`}>
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
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <Button onClick={handleSaveUser} isLoading={loading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors">
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
