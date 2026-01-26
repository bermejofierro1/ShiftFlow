import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
  updateDoc,
} from 'firebase/firestore';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import { Turno } from '../model/turno.model';

/**
 * Servicio encargado de gestionar los turnos del usuario y mantenerlos
 * sincronizados con Firestore en tiempo real.
 *
 * La suscripción se gestiona automáticamente en función del estado
 * de autenticación para evitar fugas de datos entre usuarios.
 */
@Injectable({
  providedIn: 'root',
})
export class TurnoService {
  // Mantiene el estado actual de los turnos y notifica a la UI
  private turnosSubject = new BehaviorSubject<Turno[]>([]);
  public readonly turnos$ = this.turnosSubject.asObservable();

  // Turnos futuros en subcoleccion separada
  private futureTurnosSubject = new BehaviorSubject<Turno[]>([]);
  public readonly futureTurnos$ = this.futureTurnosSubject.asObservable();

  // Pendientes de sincronizacion (turnos realizados)
  private pendingWritesSubject = new BehaviorSubject<number>(0);
  public readonly pendingWrites$ = this.pendingWritesSubject.asObservable();

  // Referencia para cancelar la suscripción en tiempo real
  private unsubscribeSnapshot: Unsubscribe | null = null;
  private unsubscribeFutureSnapshot: Unsubscribe | null = null;

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService
  ) {
    this.initAuthListener();
  }

  /**
   * Escucha los cambios de autenticación para cargar o limpiar los turnos
   * según el usuario activo.
   */
  private initAuthListener(): void {
    this.authService.CurrentAppUser.subscribe((user) => {
      if (user) {
        this.subscribeToTurnos(user.id);
        this.subscribeToTurnosFuturos(user.id);
      } else {
        this.clearTurnos();
      }
    });
  }

  /**
   * Se suscribe a los turnos del usuario ordenados por fecha.
   * Si Firestore requiere un índice compuesto, se aplica un fallback sin orden.
   */
  private subscribeToTurnos(userId: string): void {
    this.unsubscribeFromTurnos();

    const turnosRef = collection(
      this.firebaseService.firestore,
      'users',
      userId,
      'turnos'
    );

    const q = query(turnosRef, orderBy('date', 'desc'));

    this.unsubscribeSnapshot = onSnapshot(
      q,
      (snapshot) => {
        const turnos = snapshot.docs.map((docSnap) =>
          this.mapDocToTurno(docSnap, userId)
        );
        this.turnosSubject.next(turnos);
        this.pendingWritesSubject.next(
          snapshot.docs.filter((docSnap) => docSnap.metadata.hasPendingWrites).length
        );
      },
      (error) => {
        // Fallback habitual cuando Firestore exige índices compuestos
        if (error.code === 'failed-precondition') {
          this.subscribeToTurnosSinOrden(userId);
          return;
        }

        if (error.code === 'permission-denied') {
          this.clearTurnos();
          return;
        }

        console.error('[TurnoService] Error en la suscripción:', error);
      }
    );
  }

  /**
   * Suscripción alternativa sin ordenación.
   * El orden se aplica posteriormente en cliente.
   */
  private subscribeToTurnosSinOrden(userId: string): void {
    this.unsubscribeFromTurnos();

    const turnosRef = collection(
      this.firebaseService.firestore,
      'users',
      userId,
      'turnos'
    );

    this.unsubscribeSnapshot = onSnapshot(
      turnosRef,
      (snapshot) => {
        const turnos = snapshot.docs
          .map((docSnap) => this.mapDocToTurno(docSnap, userId))
          .sort(
            (a, b) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          );

        this.turnosSubject.next(turnos);
        this.pendingWritesSubject.next(
          snapshot.docs.filter((docSnap) => docSnap.metadata.hasPendingWrites).length
        );
      },
      (error) => {
        console.error(
          '[TurnoService] Error en suscripción sin orden:',
          error
        );
        this.clearTurnos();
      }
    );
  }

  private subscribeToTurnosFuturos(userId: string): void {
    this.unsubscribeFromTurnosFuturos();

    const turnosRef = collection(
      this.firebaseService.firestore,
      'users',
      userId,
      'turnos_futuros'
    );

    const q = query(turnosRef, orderBy('date', 'asc'));

    this.unsubscribeFutureSnapshot = onSnapshot(
      q,
      (snapshot) => {
        const turnos = snapshot.docs.map((docSnap) =>
          this.mapDocToTurno(docSnap, userId)
        );
        this.futureTurnosSubject.next(turnos);
      },
      (error) => {
        if (error.code === 'failed-precondition') {
          this.subscribeToTurnosFuturosSinOrden(userId);
          return;
        }

        if (error.code === 'permission-denied') {
          this.futureTurnosSubject.next([]);
          return;
        }

        console.error('[TurnoService] Error en suscripcion de futuros:', error);
      }
    );
  }

  private subscribeToTurnosFuturosSinOrden(userId: string): void {
    this.unsubscribeFromTurnosFuturos();

    const turnosRef = collection(
      this.firebaseService.firestore,
      'users',
      userId,
      'turnos_futuros'
    );

    this.unsubscribeFutureSnapshot = onSnapshot(
      turnosRef,
      (snapshot) => {
        const turnos = snapshot.docs
          .map((docSnap) => this.mapDocToTurno(docSnap, userId))
          .sort(
            (a, b) =>
              new Date(a.date).getTime() - new Date(b.date).getTime()
          );

        this.futureTurnosSubject.next(turnos);
      },
      (error) => {
        console.error('[TurnoService] Error en suscripcion futuros sin orden:', error);
        this.futureTurnosSubject.next([]);
      }
    );
  }

  /**
   * Convierte un documento de Firestore en un modelo Turno.
   */
  private mapDocToTurno(docSnap: any, userId: string): Turno {
    const data = docSnap.data();

    return {
      id: docSnap.id,
      userId,
      date: data.date ?? '',
      startTime: data.startTime ?? '',
      endTime: data.endTime ?? '',
      hours: data.hours ?? 0,
      salary: data.salary ?? 0,
      tips: data.tips ?? 0,
      location: data.location ?? '',
      notes: data.notes ?? '',
      breakTime: data.breakTime ?? 0,
      status: data.status ?? 'scheduled',
      createdAt: data.createdAt ?? new Date().toISOString(),
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    };
  }

  /**
   * Cancela la suscripción activa para evitar fugas de memoria.
   */
  private unsubscribeFromTurnos(): void {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }
  }

  private unsubscribeFromTurnosFuturos(): void {
    if (this.unsubscribeFutureSnapshot) {
      this.unsubscribeFutureSnapshot();
      this.unsubscribeFutureSnapshot = null;
    }
  }

  getTurnosUsuarioObservable(): Observable<Turno[]> {
    return this.turnos$;
  }

  getPendingWritesObservable(): Observable<number> {
    return this.pendingWrites$;
  }

  getTurnosFuturosObservable(): Observable<Turno[]> {
    return this.futureTurnos$;
  }

  async getTurnosUsuario(userId?: string): Promise<Turno[]> {
    const turnos = await firstValueFrom(this.turnos$.pipe(take(1)));
    return userId ? turnos.filter((t) => t.userId === userId) : turnos;
  }

  /**
   * Crea un nuevo turno en Firestore.
   * La UI se actualiza automáticamente mediante onSnapshot.
   */
  async addTurno(turno: Turno): Promise<string> {
    if (!turno.userId) {
      throw new Error('No se puede crear un turno sin userId');
    }

    const now = new Date().toISOString();

    const turnoRef = collection(
      this.firebaseService.firestore,
      'users',
      turno.userId,
      'turnos'
    );

    const docRef = await addDoc(turnoRef, {
      ...turno,
      createdAt: turno.createdAt ?? now,
      updatedAt: now,
    });

    return docRef.id;
  }

  async addTurnoFuturo(turno: Turno): Promise<string> {
    if (!turno.userId) {
      throw new Error('No se puede crear un turno sin userId');
    }

    const now = new Date().toISOString();

    const turnoRef = collection(
      this.firebaseService.firestore,
      'users',
      turno.userId,
      'turnos_futuros'
    );

    const docRef = await addDoc(turnoRef, {
      ...turno,
      createdAt: turno.createdAt ?? now,
      updatedAt: now,
    });

    return docRef.id;
  }

  async deleteTurno(userId: string, turnoId: string): Promise<void> {
    const turnoRef = doc(
      this.firebaseService.firestore,
      'users',
      userId,
      'turnos',
      turnoId
    );

    await deleteDoc(turnoRef);
  }

  async deleteTurnoFuturo(userId: string, turnoId: string): Promise<void> {
    const turnoRef = doc(
      this.firebaseService.firestore,
      'users',
      userId,
      'turnos_futuros',
      turnoId
    );

    await deleteDoc(turnoRef);
  }

  async updateTurno(
    userId: string,
    turnoId: string,
    data: Partial<Turno>
  ): Promise<void> {
    const turnoRef = doc(
      this.firebaseService.firestore,
      'users',
      userId,
      'turnos',
      turnoId
    );

    await updateDoc(turnoRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  async getTurnoById(
    userId: string,
    turnoId: string
  ): Promise<Turno | null> {
    const turnos = await firstValueFrom(this.turnos$.pipe(take(1)));
    return (
      turnos.find((t) => t.userId === userId && t.id === turnoId) ?? null
    );
  }

  /**
   * Limpia el estado local y cancela suscripciones activas.
   */
  clearTurnos(): void {
    this.turnosSubject.next([]);
    this.futureTurnosSubject.next([]);
    this.pendingWritesSubject.next(0);
    this.unsubscribeFromTurnos();
    this.unsubscribeFromTurnosFuturos();
  }
}
