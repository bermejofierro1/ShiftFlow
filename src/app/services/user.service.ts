import { Injectable } from '@angular/core';
import { FirebaseService } from './firebase.service';
import { User } from '../model/user.model';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { UserSettings } from '../model/userSettings.model';

/**
 * Servicio encargado de la gestión de datos del usuario en Firestore.
 *
 * Tiene métodos para:
 * - Actualizar información del perfil del usuario
 * - Gestionar campos específicos (teléfono, settings, fechas)
 * - Obtener datos del usuario desde la base de datos

 */
@Injectable({
  providedIn: 'root',
})
export class UserService {

  constructor(private firebaseService: FirebaseService) { }

  /**
 * Actualiza uno o varios campos del usuario.
 *
 * Se utiliza Partial<User> para permitir actualizaciones
 * flexibles sin sobrescribir todo el documento.
 *
 * @param userId ID del usuario
 * @param data Campos a actualizar
 */
  async updateUser(userId: string, data: Partial<User>): Promise<boolean> {
    try {
      const userRef = doc(this.firebaseService.firestore, 'users', userId);

      // Añadir fecha de actualización
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, updateData);
      console.log('Usuario actualizado:', userId, data);
      return true;
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      throw error;
    }
  }

  /**
    * Actualiza el número de teléfono del usuario.
    *
    * Método específico para facilitar su uso desde la UI
    * y mantener tipado claro.
    */
  async updatePhone(userId: string, phone: string): Promise<boolean> {
    try {
      const userRef = doc(this.firebaseService.firestore, 'users', userId);

      await updateDoc(userRef, {
        phone: phone,
        updatedAt: new Date().toISOString()
      });

      console.log('Teléfono actualizado:', userId, phone);
      return true;
    } catch (error) {
      console.error('Error actualizando teléfono:', error);
      throw error;
    }
  }
  /**
   * Actualiza la configuración del usuario (settings).
   *
   * Se guarda como objeto completo para facilitar
   * la extensión futura de preferencias.
   */
  async updateUserSettings(userId: string, settings: any): Promise<boolean> {
    try {
      const userRef = doc(this.firebaseService.firestore, 'users', userId);

      await updateDoc(userRef, {
        settings: settings,
        updatedAt: new Date().toISOString()
      });

      console.log('Settings actualizados:', userId, settings);
      return true;
    } catch (error) {
      console.error('Error actualizando settings:', error);
      throw error;
    }
  }

  /**
  * Obtiene los datos del usuario desde Firestore.
  *
  * @param userId ID del usuario
  * @returns Usuario o null si no existe
  */
  async getUser(userId: string): Promise<User | null> {
    try {
      const userRef = doc(this.firebaseService.firestore, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        return userSnap.data() as User;
      }

      return null;
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      throw error;
    }
  }


  /**
 * Actualiza la fecha de inicio laboral del usuario.
 *
 * Este método se utiliza para mantener de forma automática
 * la antigüedad del usuario basada en sus turnos.
 */
  async updateStartDate(userId: string, startDate: string) {
    try {
      const userRef = doc(this.firebaseService.firestore, 'users', userId);
      await updateDoc(userRef, {
        startDate: startDate,
        updatedAt: new Date().toISOString()
      });
      console.log('startDate actualizado:', startDate);
    } catch (error) {
      console.error('Error actualizando startDate:', error);
      throw error;
    }
  }
}
