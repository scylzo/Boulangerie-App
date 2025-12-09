import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { collection, getDocs, query, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'; // Careful with this!
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import toast from 'react-hot-toast';

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

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// We need to re-import config to initialize a secondary app
const firebaseConfig = {
  apiKey: "AIzaSyBwaC_ySezVpfv9y9xHNromiTW77qJQlmA",
  authDomain: "boulangerie-da431.firebaseapp.com",
  projectId: "boulangerie-da431",
  storageBucket: "boulangerie-da431.firebasestorage.app",
  messagingSenderId: "324942492234",
  appId: "1:324942492234:web:afbc851e38b557a87f2cb3",
  measurementId: "G-3E7K2Y6N31"
};

export const GestionUtilisateurs: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    nom: '',
    prenom: '',
    role: 'livreur'
  });
  const [loading, setLoading] = useState(false);

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
      // toast.error('Erreur lors du chargement des utilisateurs');
    }
  };

  const handleCreateUser = async () => {
    setLoading(true);
    try {
      // TRICK: Initialize a secondary app to create user without logging out admin
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
      const user = userCredential.user;

      // Update profile on the Auth object (optional but good)
      await updateProfile(user, {
        displayName: `${newUser.nom} ${newUser.prenom}`
      });

      // Create User Document in Main Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: newUser.email,
        nom: newUser.nom,
        prenom: newUser.prenom,
        role: newUser.role,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      toast.success('Utilisateur créé avec succès');
      setIsModalOpen(false);
      setNewUser({ email: '', password: '', nom: '', prenom: '', role: 'livreur' });
      fetchUsers();
      
      // Cleanup secondary app (not strictly necessary but good practice)
      // deleteApp(secondaryApp); 
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;
    
    try {
      // Note: We can only delete from Firestore here. 
      // Deleting from Auth requires Admin SDK or the user to be signed in.
      // We will just mark as inactive or delete from Firestore.
      await deleteDoc(doc(db, 'users', userId));
      toast.success('Utilisateur supprimé (Firestore uniquement)');
      fetchUsers();
    } catch (error) {
       toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Icon icon="mdi:account-plus" className="mr-2" />
          Nouvel Utilisateur
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.nom} {user.prenom}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                      user.role === 'livreur' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900">
                      <Icon icon="mdi:trash-can" className="text-xl" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Ajouter un utilisateur">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Nom" 
              value={newUser.nom} 
              onChange={(e) => setNewUser({...newUser, nom: e.target.value})} 
            />
            <Input 
              label="Prénom" 
              value={newUser.prenom} 
              onChange={(e) => setNewUser({...newUser, prenom: e.target.value})} 
            />
          </div>
          <Input 
            label="Email" 
            type="email" 
            value={newUser.email} 
            onChange={(e) => setNewUser({...newUser, email: e.target.value})} 
          />
          <Input 
            label="Mot de passe" 
            type="password" 
            value={newUser.password} 
            onChange={(e) => setNewUser({...newUser, password: e.target.value})} 
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
            <select 
              value={newUser.role}
              onChange={(e) => setNewUser({...newUser, role: e.target.value})}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
            >
              <option value="admin">Administrateur</option>
              <option value="livreur">Livreur</option>
              <option value="boulanger">Boulanger</option>
              <option value="vendeuse">Vendeuse</option>
              <option value="gestionnaire">Gestionnaire</option>
            </select>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={handleCreateUser} isLoading={loading}>Créer l'utilisateur</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
