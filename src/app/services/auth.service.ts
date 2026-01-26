import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../model/user.model';
import { FirebaseService } from './firebase.service';
import { createUserWithEmailAndPassword, onAuthStateChanged, User as AuthUser, signInWithEmailAndPassword, signOut, EmailAuthProvider, reauthenticateWithCredential, updateEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/** Servicio encargado de la autenticación y gestión del usuario en la aplicación.
 * Tiene métodos para:
 * - registrar nuevos usuarios,
 * - iniciar y cerrar sesión,
 * - obtener el usuario autenticado actual,
 * - gestionar el estado de autenticación en toda la aplicación.
 * Utiliza Firebase Authentication y Firestore para el almacenamiento de datos de usuarios.
 * Mantiene un BehaviorSubject para el usuario de la aplicación que emite cambios en el estado de autenticación.
 * Permite suscribirse a los cambios del usuario autenticado mediante un Observable público.

 *
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {

  //Usuario actual de la App
  /**
   * BehaviorSubject privado que mantiene el estado del usuario autenticado.
   * Observable público para suscribirse a los cambios del usuario autenticado. 
   */
  private _appUser = new BehaviorSubject<User | null>(null);
  public appUser$: Observable<User | null> = this._appUser.asObservable();
  private _authReady = new BehaviorSubject<boolean>(false);
  public authReady$: Observable<boolean> = this._authReady.asObservable();

  constructor(private firebaseService: FirebaseService) {
    /**
     * Escucha los cambios en el estado de autenticación de Firebase.
     * Actualiza el BehaviorSubject del usuario de la aplicación en consecuencia.
     * Si hay un usuario autenticado, obtiene sus datos de Firestore y los emite.
     * Maneja errores al obtener los datos del usuario. 
     * 
     */
    onAuthStateChanged(this.firebaseService.auth, async (user) => {
      if (user) {
        try {
          const appUser = await this.getAppUser(user.uid);
          this._appUser.next(appUser);
        } catch (err) {
          console.error('Error fetching app user onAuthStateChanged:', err);
          this._appUser.next(null);
        }
      } else {
        this._appUser.next(null);
      }
      this._authReady.next(true);
    });
  }


  /**
   * Registra un usuario en Firebase Auth y crea su perfil en Firestore.
   *
   * Flujo:
   *  Crear usuario en Firebase Authentication (email/password)
   *  Construir el objeto `User` de la aplicación con campos extra (role, hourlyRate, fechas...)
   *  Guardar ese perfil en Firestore (colección 'users')
   *  Publicar el usuario en el estado reactivo para actualizar la UI
   */
  async register(name: string, email: string, password: string, role: string = 'Camarero', hourlyRate: number = 10): Promise<AuthUser> {
    try {
      await this.firebaseService.authReady;
      const credential = await createUserWithEmailAndPassword(this.firebaseService.auth, email, password);
      const authUser = credential.user;

      const appUser: User = {
        id: authUser.uid,
        name,
        email,
        role,
        hourlyRate,
        startDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(this.firebaseService.firestore, 'users', authUser.uid), appUser);
      this._appUser.next(appUser);

      console.log('User registered successfully:', authUser.uid);
      return authUser;

    } catch (error: any) {
      console.error('Error registering user:', error);
      throw new Error(error.message || 'Error al registrar usuario');
    }
  }

  /**
  * Inicia sesión con email/password.
  *
  * Tras autenticar en Firebase Auth:
  * - Se obtiene el perfil completo desde Firestore
  * - Se publica en el BehaviorSubject para actualizar la UI
  */
  async login(email: string, password: string): Promise<AuthUser> {
    try {
      console.log('AuthService.login called with', email);
      await this.firebaseService.authReady;
      const credential = await signInWithEmailAndPassword(this.firebaseService.auth, email, password);
      const authUser = credential.user;

      const appUser = await this.getAppUser(authUser.uid);
      if (!appUser) {
        throw new Error('Perfil de usuario no encontrado. Regístrate o contacta con soporte.');
      }

      this._appUser.next(appUser);

      console.log('Login successful for user:', authUser.uid);
      return authUser;

    } catch (error: any) {
      console.error('Login failed:', error);
      throw new Error(error.message || 'Error al iniciar sesión');
    }
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.firebaseService.auth);
      this._appUser.next(null);
      console.log('User logged out');
    } catch (error: any) {
      console.error('Logout failed:', error);
      throw new Error(error.message || 'Error al cerrar sesión');
    }
  }

  /**
  * Recupera el perfil de usuario de la aplicación desde Firestore.
  * Se separa de login/register para reutilizarlo en distintos flujos.
  *
  * @param uid UID de Firebase Authentication
  * @returns User de la app o null si no existe
  */
  async getAppUser(uid: string): Promise<User | null> {
    try {
      const docRef = doc(this.firebaseService.firestore, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) return docSnap.data() as User;
      return null;
    } catch (error: any) {
      console.error('Error fetching app user:', error);
      return null;
    }
  }

  get CurrentAppUser(): Observable<User | null> {
    return this.appUser$;
  }

  get AuthReady(): Observable<boolean> {
    return this.authReady$;
  }

  /**
   * Cambiar correo electrónico dle usuario
   * 
   */
  async changeEmail(currentPassword: string, newEmail: string): Promise<void> {
    const user = this.firebaseService.auth.currentUser;
    if (!user || !user.email) throw new Error('No hay usuario autenticado');

    // Reautenticación (Firebase lo exige para cambios sensibles)
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    await updateEmail(user, newEmail);
  }


}
