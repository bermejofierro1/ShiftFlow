import { Injectable } from '@angular/core';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, Unsubscribe, updateDoc } from 'firebase/firestore';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import { Turno } from '../model/turno.model';

/**
 * Servicio encargado de la gestión de turnos del usuario.
 *
 * Responsabilidades principales:
 * - Suscribirse en tiempo real a los turnos del usuario autenticado (Firestore)
 * - Mantener un estado reactivo de los turnos mediante BehaviorSubject
 * - Proveer métodos CRUD para crear, actualizar y eliminar turnos
 * - Gestionar automáticamente la suscripción al cambiar el estado de autenticación
 *
 * Este servicio desacopla completamente la lógica de datos
 * de los componentes de la aplicación.
 * @class TurnoService
 */
@Injectable({
  providedIn: 'root',
})
export class TurnoService {
  /**
 * Subject interno que mantiene el estado actual de los turnos.
 * Se utiliza BehaviorSubject para que los componentes
 * reciban inmediatamente el último valor disponible.
 */
  private turnosSubject = new BehaviorSubject<Turno[]>([]);
  /** Observable público para consumir los turnos desde la UI */
  public turnos$ = this.turnosSubject.asObservable();
  /** Referencia para cancelar la suscripción en tiempo real de Firestore */
  private unsubscribeSnapshot: Unsubscribe | null = null;

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService
  ) {
    this.setupAuthListener();
  }

  /**
   * Escucha los cambios de autenticación.
   *
   * - Cuando el usuario inicia sesión: se suscribe a sus turnos
   * - Cuando cierra sesión: se limpian los datos y se cancelan suscripciones
   *
   * Esto evita fugas de datos entre usuarios y mantiene la app segura.
   */
  private setupAuthListener(): void {
    this.authService.CurrentAppUser.subscribe(async (user) => {
      if (user) {
        console.log('Usuario autenticado, suscribiendose a turnos:', user.id);
        this.subscribeToTurnos(user.id);
      } else {
        console.log('Usuario no autenticado, limpiando turnos');
        this.turnosSubject.next([]);
        this.unsubscribeFromTurnos();
      }
    });
  }

  /**
  * Se suscribe a la colección de turnos del usuario en Firestore
  * utilizando onSnapshot para recibir cambios en tiempo real.
  *
  * Los turnos se ordenan por fecha descendente.
  */
  private subscribeToTurnos(userId: string): void {
    try {
      this.unsubscribeFromTurnos();

      const turnosRef = collection(this.firebaseService.firestore, 'users', userId, 'turnos');
      const q = query(turnosRef, orderBy('date', 'desc'));

      console.log('Iniciando suscripcion a turnos en tiempo real...');

      this.unsubscribeSnapshot = onSnapshot(
        q,
        (querySnapshot) => {
          console.log('Cambios detectados en turnos. Total documentos:', querySnapshot.size);

          const turnos: Turno[] = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();

            const turno: Turno = {
              id: docSnap.id,
              userId: userId,
              date: data['date'] || '',
              startTime: data['startTime'] || '',
              endTime: data['endTime'] || '',
              hours: data['hours'] || 0,
              salary: data['salary'] || 0,
              tips: data['tips'] || 0,
              location: data['location'] || '',
              notes: data['notes'] || '',
              breakTime: data['breakTime'] || 0,
              status: data['status'] || 'scheduled',
              createdAt: data['createdAt'] || new Date().toISOString(),
              updatedAt: data['updatedAt'] || new Date().toISOString()
            };
            turnos.push(turno);
          });

          console.log('Total turnos procesados:', turnos.length);
          this.turnosSubject.next(turnos);
        },
        (error) => {
          console.error('Error en suscripcion a turnos:', error);

          if (error.code === 'failed-precondition') {
            console.log('Intentando suscripcion sin ordenar...');
            this.subscribeToTurnosSinOrdenar(userId);
            return;
          }

          if (error.code === 'permission-denied') {
            this.unsubscribeFromTurnos();
            this.turnosSubject.next([]);
            return;
          }
        }
      );
    } catch (error) {
      console.error('Error al suscribirse a turnos:', error);
    }
  }

  /**
  * Suscripción alternativa sin ordenación.
  * Se utiliza como fallback cuando Firestore requiere índices compuestos.
  */
  private subscribeToTurnosSinOrdenar(userId: string): void {
    try {
      this.unsubscribeFromTurnos();

      const turnosRef = collection(this.firebaseService.firestore, 'users', userId, 'turnos');

      this.unsubscribeSnapshot = onSnapshot(
        turnosRef,
        (querySnapshot) => {
          console.log('Cambios detectados (sin ordenar). Total:', querySnapshot.size);

          const turnos: Turno[] = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const turno: Turno = {
              id: docSnap.id,
              userId: userId,
              date: data['date'] || '',
              startTime: data['startTime'] || '',
              endTime: data['endTime'] || '',
              hours: data['hours'] || 0,
              salary: data['salary'] || 0,
              tips: data['tips'] || 0,
              location: data['location'] || '',
              notes: data['notes'] || '',
              breakTime: data['breakTime'] || 0,
              status: data['status'] || 'scheduled',
              createdAt: data['createdAt'] || new Date().toISOString(),
              updatedAt: data['updatedAt'] || new Date().toISOString()
            };
            turnos.push(turno);
          });

          turnos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          this.turnosSubject.next(turnos);
        },
        (error) => {
          console.error('Error en suscripcion sin ordenar:', error);
          this.unsubscribeFromTurnos();
          this.turnosSubject.next([]);
        }
      );
    } catch (error) {
      console.error('Error al suscribirse sin ordenar:', error);
    }
  }

  /**
 * Cancela la suscripción activa a Firestore
 * para evitar fugas de memoria.
 */
  private unsubscribeFromTurnos(): void {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
      console.log('Suscripcion a turnos cancelada');
    }
  }

  getTurnosUsuarioObservable(): Observable<Turno[]> {
    return this.turnos$;
  }

  async getTurnosUsuario(userId?: string): Promise<Turno[]> {
    const turnos = await firstValueFrom(this.turnos$.pipe(take(1)));
    return userId ? turnos.filter((t) => t.userId === userId) : turnos;
  }

  /**
   * Crea un nuevo turno en Firestore.
   * Las vistas se actualizan automáticamente gracias a onSnapshot.
   */
  async addTurno(turno: Turno): Promise<string> {
    try {
      const uid = turno.userId;

      if (!uid) {
        throw new Error('No se pudo obtener el userId para agregar turno');
      }

      console.log('Agregando turno para usuario:', uid);

      const now = new Date().toISOString();
      turno.createdAt = turno.createdAt || now;
      turno.updatedAt = now;

      const turnoRef = collection(this.firebaseService.firestore, 'users', uid, 'turnos');

      const docRef = await addDoc(turnoRef, turno);

      console.log('Turno agregado exitosamente. ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error agregando turno:', error);
      throw error;
    }
  }


  //Elimina un turno del usuario
  async deleteTurno(userId: string, turnoId: string): Promise<boolean> {
    try {
      const turnoDocRef = doc(this.firebaseService.firestore, 'users', userId, 'turnos', turnoId);
      await deleteDoc(turnoDocRef);
      console.log('Turno eliminado:', turnoId);
      return true;
    } catch (error) {
      console.error('Error eliminando turno:', error);
      throw error;
    }
  }

  //Actualiza un turno existente
  async updateTurno(userId: string, turnoId: string, data: Partial<Turno>): Promise<boolean> {
    try {
      const turnoDocRef = doc(this.firebaseService.firestore, 'users', userId, 'turnos', turnoId);
      data.updatedAt = new Date().toISOString();
      await updateDoc(turnoDocRef, data);
      console.log('Turno actualizado:', turnoId);
      return true;
    } catch (error) {
      console.error('Error actualizando turno:', error);
      throw error;
    }
  }

  async getTurnoById(userId: string, turnoId: string): Promise<Turno | null> {
    const turnos = await firstValueFrom(this.turnos$.pipe(take(1)));
    const turno = turnos.find((t) => t.userId === userId && t.id === turnoId);
    return turno || null;
  }

  clearTurnos(): void {
    this.turnosSubject.next([]);
    this.unsubscribeFromTurnos();
  }
}
