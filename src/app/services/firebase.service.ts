import { Injectable } from '@angular/core';
import { initializeApp,FirebaseApp } from 'firebase/app';
import { environment } from 'src/environments/environment';
import { getAuth, setPersistence, indexedDBLocalPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage,FirebaseStorage } from 'firebase/storage';
import { Auth } from 'firebase/auth';
@Injectable({
  providedIn: 'root',
})
export class FirebaseService {

  public app:FirebaseApp;
  public auth:Auth;
  public firestore:Firestore;
public storage:FirebaseStorage;
public authReady: Promise<void>;

constructor(){
  this.app=initializeApp(environment.firebaseConfig);
  this.auth=getAuth(this.app);
  this.authReady = setPersistence(this.auth, indexedDBLocalPersistence).catch(async (error) => {
    console.warn('Auth persistence failed, falling back to localStorage:', error);
    await setPersistence(this.auth, browserLocalPersistence);
  });
  this.firestore=getFirestore(this.app);
  enableIndexedDbPersistence(this.firestore).catch((error) => {
    console.error('Error configurando la persistencia de Firestore:', error);
  });
  this.storage=getStorage(this.app);
  console.log('Firebase inicializado correctamente');
}
  
}
